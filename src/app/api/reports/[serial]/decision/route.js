import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canAct } from "@/lib/rbac";
import { sendMail, approvalRequestEmail, decisionEmail } from "@/lib/email";
import { recordAudit } from "@/lib/audit";
import { notifyEmails, notifyUsers } from "@/lib/notify";

export async function POST(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const decision = body.decision === "reject" ? "reject" : "approve";
  const comment = String(body.comment || "").trim();
  if (decision === "reject" && !comment)
    return Response.json({ error: "A comment is required to reject." }, { status: 400 });

  const report = await prisma.report.findUnique({
    where: { serial: params.serial },
    include: { author: true },
  });
  if (!report) return Response.json({ error: "Report not found." }, { status: 404 });

  const stage = canAct(report, user); // "SUPERVISOR" | "MANAGER" | null
  if (!stage) return Response.json({ error: "You can't act on this report now." }, { status: 403 });

  let nextStatus;
  let action;
  if (stage === "SUPERVISOR") {
    nextStatus = decision === "approve" ? "PENDING_MANAGER" : "REJECTED";
    action = decision === "approve" ? "Supervisor approved" : "Supervisor rejected";
  } else {
    nextStatus = decision === "approve" ? "APPROVED" : "REJECTED";
    action = decision === "approve" ? "Manager approved" : "Manager rejected";
  }

  const updated = await prisma.report.update({
    where: { serial: report.serial },
    data: {
      status: nextStatus,
      trailEvents: {
        create: [{ action, byName: user.name, byUserId: user.sub, comment: comment || null }],
      },
    },
  });

  await recordAudit({
    actor: user,
    action: decision === "approve" ? "APPROVE" : "REJECT",
    entity: "REPORT",
    entityId: report.serial,
    summary: `${action} ${report.serial}${comment ? ` — "${comment}"` : ""}`,
  });

  // Notifications (best-effort) — email + in-app.
  let mail = { sent: false, reason: "no notification needed" };
  if (stage === "SUPERVISOR" && decision === "approve") {
    // Passed to the Client/Manager for final approval.
    mail = await sendMail(approvalRequestEmail(updated, user.name));
    await notifyEmails([updated.managerEmail], {
      type: "APPROVAL",
      title: `Approval needed · ${updated.serial}`,
      body: `${updated.templateName} — reviewed by ${user.name}`,
      link: `/reports/${updated.serial}`,
    });
  } else if (report.author?.email) {
    const word = decision === "approve" ? "APPROVED" : "REJECTED";
    mail = await sendMail(decisionEmail(updated, report.author.email, word, user.name, comment));
    if (report.authorId)
      await notifyUsers([report.authorId], {
        type: "DECISION",
        title: `${word === "APPROVED" ? "Approved" : "Returned"} · ${updated.serial}`,
        body: `${word === "APPROVED" ? "Fully approved" : "Rejected"} by ${user.name}${comment ? ` — "${comment}"` : ""}`,
        link: `/reports/${updated.serial}`,
      });
  }

  return Response.json({ status: nextStatus, emailSent: mail.sent });
}

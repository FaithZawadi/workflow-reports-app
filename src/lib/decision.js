import { prisma } from "./db";
import { sendMail, approvalRequestEmail, decisionEmail } from "./email";
import { createApprovalLinks } from "./approvalToken";
import { recordAudit } from "./audit";
import { notifyEmails, notifyUsers } from "./notify";

// Apply an approve/reject decision to a report at a given stage. Shared by the
// in-app decision route (a signed-in reviewer) and the one-click email approval
// route (token-authenticated, no session). `actor` = { name, sub?, role? }.
export async function applyDecision({ report, stage, decision, comment, actor }) {
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
        create: [{ action, byName: actor.name, byUserId: actor.sub || null, comment: comment || null }],
      },
    },
  });

  await recordAudit({
    actor: { sub: actor.sub || null, name: actor.name, role: actor.role || null },
    action: decision === "approve" ? "APPROVE" : "REJECT",
    entity: "REPORT",
    entityId: report.serial,
    summary: `${action} ${report.serial}${comment ? ` — "${comment}"` : ""}${actor.sub ? "" : " (via email link)"}`,
  });

  // Notifications (best-effort) — email + in-app.
  let mail = { sent: false, reason: "no notification needed" };
  if (stage === "SUPERVISOR" && decision === "approve") {
    // Passed to the Client/Manager for final approval — email them a one-click link too.
    const links = await createApprovalLinks(updated, "MANAGER");
    mail = await sendMail(approvalRequestEmail(updated, actor.name, links));
    await notifyEmails([updated.managerEmail], {
      type: "APPROVAL",
      title: `Approval needed · ${updated.serial}`,
      body: `${updated.templateName} — reviewed by ${actor.name}`,
      link: `/reports/${updated.serial}`,
    });
  } else {
    const full = await prisma.report.findUnique({
      where: { serial: report.serial },
      include: { author: true },
    });
    if (full?.author?.email) {
      const word = decision === "approve" ? "APPROVED" : "REJECTED";
      mail = await sendMail(decisionEmail(updated, full.author.email, word, actor.name, comment));
      if (full.authorId)
        await notifyUsers([full.authorId], {
          type: "DECISION",
          title: `${word === "APPROVED" ? "Approved" : "Returned"} · ${updated.serial}`,
          body: `${word === "APPROVED" ? "Fully approved" : "Rejected"} by ${actor.name}${comment ? ` — "${comment}"` : ""}`,
          link: `/reports/${updated.serial}`,
        });
    }
  }

  return { status: nextStatus, emailSent: mail.sent, action };
}

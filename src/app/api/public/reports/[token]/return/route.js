import { prisma } from "@/lib/db";
import { notifyEmails } from "@/lib/notify";

export const dynamic = "force-dynamic";

// POST /api/public/reports/[token]/return — the client returns the report with a
// comment instead of approving. No login: the token is the capability. The
// report moves to CLIENT_RETURNED and goes back to the routed manager(s).
export async function POST(req, { params }) {
  const report = await prisma.report.findUnique({ where: { signToken: params.token } });
  if (!report || report.status !== "PENDING_CLIENT") {
    return Response.json({ error: "This link is not valid." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const comment = String(body.comment || "").trim().slice(0, 1000);
  const name = String(body.name || "").trim().slice(0, 120);
  if (!comment) return Response.json({ error: "Please add a comment explaining what to change." }, { status: 400 });
  const by = name || "Client";

  await prisma.report.update({
    where: { id: report.id },
    data: {
      status: "CLIENT_RETURNED",
      trailEvents: { create: [{ action: "CLIENT RETURNED", byName: by, comment }] },
    },
  });

  // Notify the routed managers so they can act on the returned report.
  const managers = [...new Set([report.supervisorEmail, ...(report.supervisorEmails || [])]
    .map((e) => String(e || "").trim().toLowerCase()).filter(Boolean))];
  await notifyEmails(managers, {
    type: "DECISION",
    title: `Client returned · ${report.serial}`,
    body: `${report.clientName}${report.site ? " - " + report.site : ""} — "${comment}"`,
    link: `/reports/${report.serial}`,
  }).catch(() => {});

  return Response.json({ ok: true });
}

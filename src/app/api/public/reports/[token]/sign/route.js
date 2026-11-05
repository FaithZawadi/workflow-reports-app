import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX = 700 * 1024;
const isImg = (s) => typeof s === "string" && /^data:image\/(png|jpe?g);base64,/.test(s);
const bytesOf = (d) => { const b = d.slice(d.indexOf(",") + 1); return Math.floor((b.length * 3) / 4) - (b.endsWith("==") ? 2 : b.endsWith("=") ? 1 : 0); };

// POST /api/public/reports/[token]/sign — the client submits their signature
// externally (no login). Stored on the report and printed on the PDF. Can only be
// signed once; staff would re-issue a fresh link if needed.
export async function POST(req, { params }) {
  const report = await prisma.report.findUnique({ where: { signToken: params.token } });
  // The client approves & signs while the report is out for approval.
  if (!report || !["PENDING_CLIENT", "APPROVED"].includes(report.status)) {
    return Response.json({ error: "This link is not valid." }, { status: 404 });
  }
  if (report.clientSignatureImage) {
    return Response.json({ error: "This report has already been signed." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const signature = body.signatureImage;
  const name = String(body.signedByName || "").trim().slice(0, 120);
  if (!name) return Response.json({ error: "Please enter your name." }, { status: 400 });
  if (!isImg(signature)) return Response.json({ error: "Please sign before submitting." }, { status: 400 });
  if (bytesOf(signature) > MAX) return Response.json({ error: "The signature image is too large." }, { status: 413 });
  const title = String(body.title || "").trim().slice(0, 80);
  const label = title ? `${name} (${title})` : name;
  const approvalComment = String(body.comment || "").trim().slice(0, 1000);

  // Approving & signing fully approves the report (the manager had already
  // approved it internally; this records the client's external approval).
  await prisma.report.update({
    where: { id: report.id },
    data: {
      clientSignatureImage: signature,
      clientSignedByName: label,
      clientSignedAt: new Date(),
      status: "APPROVED",
    },
  });
  await prisma.trailEvent.create({
    data: { reportId: report.id, action: "CLIENT APPROVED & SIGNED", byName: label, comment: approvalComment || null },
  }).catch(() => {});

  return Response.json({ ok: true, signedByName: label });
}

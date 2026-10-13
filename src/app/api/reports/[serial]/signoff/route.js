import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canView } from "@/lib/rbac";
import { isClient } from "@/lib/roles";

export const runtime = "nodejs";

// POST /api/reports/[serial]/signoff — capture a billing sign-off signature.
// Qalibrated signs first ({ party: "QSL" }); once that's present, the client
// signs and (optionally) stamps ({ party: "CLIENT" }). Signatures are drawn or
// uploaded on the device and arrive as data URLs. Only available once the report
// is fully APPROVED.
const MAX_BYTES = 700 * 1024; // ~700 KB per image
const isImageDataUrl = (s) => typeof s === "string" && /^data:image\/(png|jpe?g);base64,/.test(s);
const bytesOf = (dataUrl) => {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
};

export async function POST(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }

  const report = await prisma.report.findUnique({ where: { serial: params.serial } });
  if (!report) return Response.json({ error: "Report not found." }, { status: 404 });
  if (!canView(report, user)) return Response.json({ error: "Not allowed." }, { status: 403 });
  if (report.status !== "APPROVED")
    return Response.json({ error: "The report must be fully approved before it can be signed off." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const party = String(body.party || "").toUpperCase();
  const signature = body.signatureImage;
  const stamp = body.stampImage;
  const signedByName = String(body.signedByName || user.name || "").trim().slice(0, 120);

  if (!isImageDataUrl(signature)) return Response.json({ error: "A signature is required." }, { status: 400 });
  if (bytesOf(signature) > MAX_BYTES) return Response.json({ error: "The signature image is too large." }, { status: 413 });
  if (stamp !== undefined && stamp !== null && stamp !== "") {
    if (!isImageDataUrl(stamp)) return Response.json({ error: "The stamp must be an image." }, { status: 400 });
    if (bytesOf(stamp) > MAX_BYTES) return Response.json({ error: "The stamp image is too large." }, { status: 413 });
  }

  if (party === "QSL") {
    // Qalibrated signs — staff only (never a client login).
    if (isClient(user)) return Response.json({ error: "Only Qalibrated staff can add the Qalibrated signature." }, { status: 403 });
    const updated = await prisma.report.update({
      where: { id: report.id },
      data: { qslSignatureImage: signature, qslSignedByName: signedByName, qslSignedAt: new Date() },
    });
    await prisma.trailEvent.create({
      data: { reportId: report.id, action: "QSL SIGNED", byName: signedByName, byUserId: user.sub || null },
    }).catch(() => {});
    return Response.json({ ok: true, party: "QSL", qslSignedByName: updated.qslSignedByName });
  }

  if (party === "CLIENT") {
    // The client signs & stamps — only after Qalibrated has signed.
    if (!report.qslSignatureImage)
      return Response.json({ error: "Qalibrated must sign first, before the client." }, { status: 400 });
    const updated = await prisma.report.update({
      where: { id: report.id },
      data: {
        clientSignatureImage: signature,
        clientStampImage: isImageDataUrl(stamp) ? stamp : null,
        clientSignedByName: signedByName,
        clientSignedAt: new Date(),
      },
    });
    await prisma.trailEvent.create({
      data: { reportId: report.id, action: "CLIENT SIGNED", byName: signedByName, byUserId: user.sub || null },
    }).catch(() => {});
    return Response.json({ ok: true, party: "CLIENT", clientSignedByName: updated.clientSignedByName });
  }

  return Response.json({ error: "Unknown sign-off party." }, { status: 400 });
}

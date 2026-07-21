import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { TRAINING_ROLES } from "@/lib/roles";
import { TrainingFeedbackDocument } from "@/pdf/TrainingFeedbackDocument";
import { logoDataUrl } from "@/lib/logo";
import { qrDataUrl, verifyUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/training-feedback/[id]/pdf — one training-feedback sheet as a PDF.
// HR/admin only (internal HR data).
export async function GET(_req, { params }) {
  try {
    await requireUser(TRAINING_ROLES);
  } catch (res) {
    return res;
  }

  const feedback = await prisma.trainingFeedback.findUnique({ where: { id: params.id } });
  if (!feedback) return Response.json({ error: "Not found." }, { status: 404 });

  const qrSrc = await qrDataUrl(verifyUrl(`/api/training-feedback/${feedback.id}/pdf`));
  const buffer = await renderToBuffer(
    React.createElement(TrainingFeedbackDocument, { feedback, logoSrc: logoDataUrl(), qrSrc })
  );

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="training-feedback-${params.id.slice(-6)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

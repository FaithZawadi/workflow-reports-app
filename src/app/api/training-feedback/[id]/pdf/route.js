import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { TrainingFeedbackDocument } from "@/pdf/TrainingFeedbackDocument";
import { logoDataUrl } from "@/lib/logo";
import { qrDataUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/training-feedback/[id]/pdf — one completed training-feedback sheet as
// a PDF. Reached by capability URL: the id is an unguessable cuid, so both the
// participant (right after submitting) and HR (from the admin list) can download
// their copy — mirroring the customer survey.
export async function GET(_req, { params }) {
  const feedback = await prisma.trainingFeedback.findUnique({ where: { id: params.id } });
  if (!feedback) return Response.json({ error: "Not found." }, { status: 404 });

  // The QR carries a brief description of the sheet (shown when scanned).
  const qrText = [
    `QSL Training Feedback`,
    `Participant: ${feedback.traineeName || "-"}`,
    feedback.organization ? `Organization: ${feedback.organization}` : null,
    feedback.overall ? `Overall rating: ${feedback.overall} / 5` : null,
    `Recorded ${new Date(feedback.createdAt).toLocaleDateString()}`,
  ].filter(Boolean).join("\n");
  const qrSrc = await qrDataUrl(qrText);
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

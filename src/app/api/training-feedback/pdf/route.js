import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { TRAINING_ROLES } from "@/lib/roles";
import { TrainingFeedbackBook } from "@/pdf/TrainingFeedbackDocument";
import { logoDataUrl } from "@/lib/logo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/training-feedback/pdf — every recorded feedback sheet in one PDF
// (one page each). HR/admin only.
export async function GET() {
  try {
    await requireUser(TRAINING_ROLES);
  } catch (res) {
    return res;
  }

  const list = await prisma.trainingFeedback.findMany({ orderBy: { createdAt: "desc" }, take: 1000 });
  if (!list.length) return Response.json({ error: "No feedback recorded yet." }, { status: 404 });

  const buffer = await renderToBuffer(React.createElement(TrainingFeedbackBook, { list, logoSrc: logoDataUrl() }));

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="training-feedback-sheets.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

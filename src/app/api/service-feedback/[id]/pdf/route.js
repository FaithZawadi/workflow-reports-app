import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { SurveyDocument } from "@/pdf/SurveyDocument";
import { logoDataUrl } from "@/lib/logo";
import { qrDataUrl, verifyUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/service-feedback/[id]/pdf — the completed Customer Satisfaction Survey
// as a PDF. Reached by capability URL: the id is an unguessable cuid, so both the
// customer (right after submitting) and staff (from the admin list) can download
// their copy without a login.
export async function GET(_req, { params }) {
  const feedback = await prisma.serviceFeedback.findUnique({ where: { id: params.id } });
  if (!feedback) return Response.json({ error: "Not found." }, { status: 404 });

  const qrSrc = await qrDataUrl(verifyUrl(`/api/service-feedback/${feedback.id}/pdf`));
  const buffer = await renderToBuffer(React.createElement(SurveyDocument, { feedback, logoSrc: logoDataUrl(), qrSrc }));

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="customer-survey-${params.id.slice(-6)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

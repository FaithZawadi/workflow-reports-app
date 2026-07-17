import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { rolesOf, canPrepareQuotes, isClient } from "@/lib/roles";
import { QuotationDocument } from "@/pdf/QuotationDocument";
import { logoDataUrl } from "@/lib/logo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }

  const q = await prisma.quotation.findUnique({ where: { id: params.id } });
  if (!q) return Response.json({ error: "Not found." }, { status: 404 });

  const roles = rolesOf(user);
  const allowed =
    roles.includes("ADMIN") ||
    canPrepareQuotes(user) ||
    (isClient(user) && (q.requestedById === user.sub || (user.clientId && q.clientId === user.clientId)));
  if (!allowed) return Response.json({ error: "Not allowed." }, { status: 403 });

  const buffer = await renderToBuffer(React.createElement(QuotationDocument, { quotation: q, logoSrc: logoDataUrl() }));

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${q.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

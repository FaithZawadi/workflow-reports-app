import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireUser } from "@/lib/auth";
import { canGenerateReports } from "@/lib/roles";
import { buildManagementReport } from "@/lib/managementReport";
import { ClientStatementDocument } from "@/pdf/ClientStatementDocument";
import { logoDataUrl } from "@/lib/logo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A readable "1 Jul – 31 Jul 2026" style period label, or a single month name
// when the range spans exactly one calendar month.
function periodLabel(from, to) {
  if (!from && !to) return "All time";
  const f = from ? new Date(`${from}T00:00:00`) : null;
  const t = to ? new Date(`${to}T00:00:00`) : null;
  const opt = { day: "numeric", month: "short", year: "numeric" };
  const monthOpt = { month: "long", year: "numeric" };
  if (f && t && f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear() && f.getDate() === 1) {
    const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    if (t.getDate() === last) return f.toLocaleDateString("en-GB", monthOpt);
  }
  return `${f ? f.toLocaleDateString("en-GB", opt) : "start"} – ${t ? t.toLocaleDateString("en-GB", opt) : "today"}`;
}

// GET /api/reports/statement/pdf?client=&from=&to= — the client-facing monthly
// service statement as a branded PDF.
export async function GET(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canGenerateReports(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();
  const client = (searchParams.get("client") || "").trim() || null;

  const data = await buildManagementReport(user, { from, to, client });
  const clientName = data.clientLabel || null;

  // Statement reference, e.g. QSL-STMT-2026-07-KAP.
  const stampMonth = (to || from || new Date().toISOString().slice(0, 10)).slice(0, 7).replace("-", "-");
  const slug = (clientName || "ALL").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "ALL";
  const statementRef = `QSL-STMT-${stampMonth}-${slug}`;

  const buffer = await renderToBuffer(
    React.createElement(ClientStatementDocument, {
      data,
      logoSrc: logoDataUrl(),
      clientName,
      periodLabel: periodLabel(from, to),
      statementRef,
      generatedByName: user.name || user.email,
    })
  );

  const stamp = new Date().toISOString().slice(0, 10);
  const fileClient = (clientName || "all-clients").replace(/[^A-Za-z0-9]+/g, "-").toLowerCase();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="QSL-statement-${fileClient}-${stamp}.pdf"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

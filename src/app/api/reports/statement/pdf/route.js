import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canGenerateReports } from "@/lib/roles";
import { invoiceStatement } from "@/lib/docData";
import { renderStatementPdf } from "@/lib/statementPdf";
import { syncCompany } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/reports/statement/pdf?client=&from=&to=&site= — the client-facing
// financial Statement of Account (invoices as debits, payments as credits, a
// running balance and an aging summary), rendered from the refined HTML
// statement template via headless Chromium.
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
  const client = (searchParams.get("client") || "").trim();
  const site = (searchParams.get("site") || "").trim() || null;
  if (!client) return Response.json({ error: "A client is required for an account statement." }, { status: 400 });

  // A branch statement scopes to that branch's invoices (siteName snapshot).
  const invoices = await prisma.invoice.findMany({
    where: { clientName: client, ...(site ? { siteName: site } : {}) },
    include: { client: true },
    orderBy: [{ issuedAt: "asc" }, { createdAt: "asc" }],
  });
  // Client registration record for the address/PIN block — from any invoice's
  // relation, falling back to a name lookup when invoices carry only a snapshot.
  const clientRec =
    invoices.find((i) => i.client)?.client ||
    (await prisma.client.findFirst({ where: { name: client } }));

  const statementName = site ? `${client} — ${site}` : client;
  const stampMonth = (to || from || new Date().toISOString().slice(0, 10)).slice(0, 7);
  const slug = (statementName || "ALL").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "ALL";
  const statementRef = `QSL-STMT-${stampMonth}-${slug}`;

  const statement = invoiceStatement({
    clientName: statementName,
    client: clientRec,
    invoices,
    from,
    to,
    ref: statementRef,
    qrKey: "qr1",
  });

  await syncCompany(); // reflect any branding changes from System Settings
  const buffer = await renderStatementPdf([statement]);

  const stamp = new Date().toISOString().slice(0, 10);
  const fileClient = statementName.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase();
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

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { AuditLogDocument } from "@/pdf/AuditLogDocument";
import { logoDataUrl } from "@/lib/logo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/audit/pdf?entity=&action=&q= — the (filtered) audit log as a PDF.
export async function GET(req) {
  let user;
  try {
    user = await requireUser(["ADMIN"]);
  } catch (res) {
    return res;
  }

  const { searchParams } = new URL(req.url);
  const entity = searchParams.get("entity");
  const action = searchParams.get("action");
  const q = (searchParams.get("q") || "").trim();

  const where = { AND: [] };
  if (entity && entity !== "all") where.AND.push({ entity });
  if (action && action !== "all") where.AND.push({ action });
  if (q) {
    where.AND.push({
      OR: [
        { actorName: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
        { entityId: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const logs = await prisma.auditLog.findMany({
    where: where.AND.length ? where : {},
    orderBy: { at: "desc" },
    take: 2000,
  });

  const parts = [];
  if (entity && entity !== "all") parts.push(entity);
  if (action && action !== "all") parts.push(action);
  if (q) parts.push(`"${q}"`);
  const filterLabel = parts.join(" · ");

  const buffer = await renderToBuffer(
    React.createElement(AuditLogDocument, {
      logs,
      filterLabel,
      generatedByName: user.name || user.email,
      logoSrc: logoDataUrl(),
    })
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="QSL-audit-log-${stamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

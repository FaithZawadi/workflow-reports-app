import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { rolesOf, canPrepareQuotes, isClient } from "@/lib/roles";
import { CalibrationRequestDocument } from "@/pdf/CalibrationRequestDocument";
import { logoDataUrl } from "@/lib/logo";
import { qrDataUrl, verifyUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }

  const request = await prisma.calibrationRequest.findUnique({ where: { id: params.id } });
  if (!request) return Response.json({ error: "Not found." }, { status: 404 });

  const roles = rolesOf(user);
  const allowed =
    roles.includes("ADMIN") ||
    canPrepareQuotes(user) ||
    (isClient(user) && (request.requestedById === user.sub || (user.clientId && request.clientId === user.clientId)));
  if (!allowed) return Response.json({ error: "Not allowed." }, { status: 403 });

  // The QR carries a brief description of the document (shown when scanned),
  // ending with the verify link.
  const nItems = Array.isArray(request.equipment) ? request.equipment.length : 0;
  const qrText = [
    `QSL Calibration Request ${request.serial}`,
    `Client: ${request.clientName}`,
    `${nItems} instrument${nItems === 1 ? "" : "s"} · ${request.calibrationType === "IN_SITU" ? "on site" : request.calibrationType === "LAB" ? "lab" : "calibration"}`,
    `Status: ${String(request.status || "").replace(/_/g, " ").toLowerCase()}`,
    verifyUrl(`/calibration-requests/${request.id}`),
  ].join("\n");
  const qrSrc = await qrDataUrl(qrText);
  const buffer = await renderToBuffer(
    React.createElement(CalibrationRequestDocument, { request, logoSrc: logoDataUrl(), qrSrc })
  );

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${request.serial}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { FinancialStatementDocument } from "@/pdf/FinancialStatementDocument";
import { logoDataUrl } from "@/lib/logo";
import { qrDataUrl } from "@/lib/qr";

// Render a financial Statement of Account to a PDF Buffer with react-pdf (the
// bordered document layout). `statement` is the object produced by
// invoiceStatement(); its QR summary text drives the verification QR.
export async function renderStatementPdf(statement) {
  const qrSrc = await qrDataUrl(statement?.qrText || `QSL Statement ${statement?.ref || ""}`);
  return renderToBuffer(
    React.createElement(FinancialStatementDocument, { statement, logoSrc: logoDataUrl(), qrSrc })
  );
}

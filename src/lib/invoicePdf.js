import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument } from "@/pdf/InvoiceDocument";
import { logoDataUrl } from "@/lib/logo";
import { qrDataUrl } from "@/lib/qr";
import { syncCompany, getSettings } from "@/lib/settings";

// Render an invoice to a PDF Buffer. Payment details follow live System Settings
// when the invoice hasn't frozen its own.
export async function renderInvoicePdf(inv) {
  const qrText = [
    `QSL Invoice ${inv.number}`,
    `Client: ${inv.clientName}`,
    `Amount due: ${inv.currency} ${Number(inv.grandTotal || 0).toLocaleString()}`,
    inv.dueDate ? `Due ${new Date(inv.dueDate).toLocaleDateString()}` : null,
  ].filter(Boolean).join("\n");
  const qrSrc = await qrDataUrl(qrText);
  await syncCompany();
  const settings = await getSettings();
  const doc = { ...inv, paymentDetails: inv.paymentDetails || settings.finance?.paymentDetails };
  return renderToBuffer(
    React.createElement(InvoiceDocument, { invoice: doc, logoSrc: logoDataUrl(), qrSrc })
  );
}

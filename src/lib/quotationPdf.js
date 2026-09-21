import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { QuotationDocument } from "@/pdf/QuotationDocument";
import { logoDataUrl } from "@/lib/logo";
import { qrDataUrl } from "@/lib/qr";
import { syncCompany, getSettings } from "@/lib/settings";

// Render a quotation to a PDF Buffer. Shared by the inline/download PDF route and
// the "email PDF to client" action so both produce an identical document.
//
// Payment details & terms follow live System Settings when the quote hasn't
// frozen its own (see the PDF route); an issued quote keeps what it was issued
// with. `internal` includes staff-only amendment history.
export async function renderQuotationPdf(q, { internal = false } = {}) {
  const qrText = [
    `QSL Quotation ${q.number}`,
    `Client: ${q.clientName}`,
    `Total: ${q.currency} ${Number(q.grandTotal || 0).toLocaleString()}`,
    q.validUntil ? `Valid until ${new Date(q.validUntil).toLocaleDateString()}` : null,
  ].filter(Boolean).join("\n");
  const qrSrc = await qrDataUrl(qrText);
  await syncCompany(); // reflect any branding changes from System Settings
  const settings = await getSettings();
  const doc = {
    ...q,
    paymentDetails: q.paymentDetails || settings.finance?.paymentDetails,
    terms: q.terms || settings.finance?.quoteTerms,
  };
  return renderToBuffer(
    React.createElement(QuotationDocument, { quotation: doc, logoSrc: logoDataUrl(), qrSrc, internal })
  );
}

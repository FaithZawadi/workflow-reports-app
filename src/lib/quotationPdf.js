import { renderHtmlPdf } from "@/lib/htmlPdf";
import { orgData, quotationToDoc, rawB64 } from "@/lib/docData";
import { logoDataUrl } from "@/lib/logo";
import { qrDataUrl } from "@/lib/qr";
import { syncCompany } from "@/lib/settings";

// Render a quotation to a PDF Buffer using the HTML document template + headless
// Chromium (the single source of truth for the design). The QR is generated
// server-side from the document's own summary text.
//
// `internal` is accepted for API compatibility; the HTML template carries no
// staff-only amendment history.
export async function renderQuotationPdf(q, { internal = false } = {}) {
  void internal;
  await syncCompany();
  const doc = quotationToDoc(q);
  const qr = await qrDataUrl(doc.qrText);
  return renderHtmlPdf("quotation-invoice", {
    __QSL_ASSETS__: { logo: rawB64(logoDataUrl()), qr_main: rawB64(qr) },
    __QSL_ORG__: orgData(),
    __QSL_DOCS__: [doc],
  });
}

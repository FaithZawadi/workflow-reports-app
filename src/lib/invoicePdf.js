import { renderHtmlPdf } from "@/lib/htmlPdf";
import { orgData, invoiceToDoc, rawB64 } from "@/lib/docData";
import { logoDataUrl } from "@/lib/logo";
import { qrDataUrl } from "@/lib/qr";
import { syncCompany } from "@/lib/settings";

// Render an invoice to a PDF Buffer using the HTML document template + headless
// Chromium. The QR is generated server-side from the document's summary text.
export async function renderInvoicePdf(inv) {
  await syncCompany();
  const doc = invoiceToDoc(inv);
  const qr = await qrDataUrl(doc.qrText);
  return renderHtmlPdf("quotation-invoice", {
    __QSL_ASSETS__: { logo: rawB64(logoDataUrl()), qr_main: rawB64(qr) },
    __QSL_ORG__: orgData(),
    __QSL_DOCS__: [doc],
  });
}

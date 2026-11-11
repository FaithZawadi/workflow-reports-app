import { renderHtmlPdf } from "@/lib/htmlPdf";
import { orgData, rawB64, lpoToDoc } from "@/lib/docData";
import { logoDataUrl } from "@/lib/logo";
import { qrDataUrl } from "@/lib/qr";

// Render a Local Purchase Order to a PDF Buffer using the HTML template +
// headless Chromium (order sheet + Conditions of Purchase). The QR image is
// generated server-side from the order's own summary text.
export async function renderLpoPdf(lpo) {
  const doc = lpoToDoc(lpo);
  const qr = await qrDataUrl(doc.qrText);
  return renderHtmlPdf("local-purchase-order", {
    __QSL_ASSETS__: { logo: rawB64(logoDataUrl()), qr: rawB64(qr) },
    __QSL_ORG__: orgData(),
    __QSL_LPO__: doc,
  });
}

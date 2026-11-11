import { renderHtmlPdf } from "@/lib/htmlPdf";
import { orgData, rawB64 } from "@/lib/docData";
import { logoDataUrl } from "@/lib/logo";
import { qrDataUrl } from "@/lib/qr";

// Render one or more account statements to a single PDF Buffer using the HTML
// statement template + headless Chromium. Each statement carries its own `qr`
// asset key and `qrText`; we pre-render each QR image and inject it under that
// key so the template prints it on the statement's last sheet.
export async function renderStatementPdf(statements = []) {
  const assets = { logo: rawB64(logoDataUrl()) };
  for (const s of statements) {
    if (s.qr && s.qrText) assets[s.qr] = rawB64(await qrDataUrl(s.qrText));
  }
  return renderHtmlPdf("statement", {
    __QSL_ASSETS__: assets,
    __QSL_ORG__: orgData(),
    __QSL_STATEMENTS__: statements,
  });
}

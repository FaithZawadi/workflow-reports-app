import { PDFDocument } from "pdf-lib";

// Append the pages of one or more attached PDFs to the end of a generated
// report PDF. Used for Site Instructions, where a supporting PDF becomes part of
// the document. Best-effort per attachment: a corrupt/unreadable file is
// skipped rather than failing the whole download.
export async function appendPdfPages(baseBuffer, attachments = []) {
  if (!attachments.length) return baseBuffer;
  let out;
  try {
    out = await PDFDocument.load(baseBuffer);
  } catch {
    return baseBuffer; // couldn't parse our own render — return it unchanged
  }
  for (const a of attachments) {
    try {
      const url = String(a?.dataUrl || "");
      const comma = url.indexOf(",");
      if (comma < 0) continue;
      const bytes = Buffer.from(url.slice(comma + 1), "base64");
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    } catch {
      // skip an unreadable attachment
    }
  }
  const merged = await out.save();
  return Buffer.from(merged);
}

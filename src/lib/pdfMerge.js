import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const COAL = rgb(0x16 / 255, 0x13 / 255, 0x10 / 255);
const GOLD = rgb(0xf5 / 255, 0xa8 / 255, 0x00 / 255);
const TEAL = rgb(0x1e / 255, 0x6b / 255, 0x63 / 255);
const MUTE = rgb(0x6b / 255, 0x63 / 255, 0x55 / 255);

// A slim separator sheet that introduces the appended attachments so they read
// as a continuation of the report rather than loose pages.
async function addSeparator(out, serial, names) {
  const page = out.addPage([595.28, 841.89]); // A4 pt
  const { width, height } = page.getSize();
  let bold, reg;
  try {
    bold = await out.embedFont(StandardFonts.HelveticaBold);
    reg = await out.embedFont(StandardFonts.Helvetica);
  } catch { return; }
  // Accent band across the top (teal — the report hue).
  page.drawRectangle({ x: 0, y: height - 13, width, height: 13, color: TEAL });
  // Gold-on-coal title pill.
  const title = "SUPPORTING DOCUMENTS";
  const tSize = 15;
  const tW = bold.widthOfTextAtSize(title, tSize);
  page.drawRectangle({ x: 34, y: height - 150, width: tW + 32, height: 30, color: COAL });
  page.drawText(title, { x: 50, y: height - 141, size: tSize, font: bold, color: GOLD });
  // Continuation line + attachment list.
  page.drawText(`Continuation of report ${serial}`, { x: 34, y: height - 180, size: 10, font: reg, color: MUTE });
  let y = height - 210;
  (names || []).forEach((n, i) => {
    page.drawText(`${i + 1}.  ${String(n || "attachment").slice(0, 90)}`, { x: 34, y, size: 9.5, font: reg, color: COAL });
    y -= 16;
  });
  page.drawText("The pages that follow are attached to and form part of this report.", { x: 34, y: y - 6, size: 8.5, font: reg, color: MUTE });
}

// Append the pages of one or more attached PDFs to the end of a generated
// report PDF so they flow after it as a continuation. Robust by design: each
// attachment is loaded tolerantly and copied PAGE BY PAGE, so one unreadable
// page (or file) no longer silently drops the entire attachment.
//   opts.serial   — the report serial, printed on the separator sheet.
//   opts.separator — set false to skip the separator sheet (default true).
export async function appendPdfPages(baseBuffer, attachments = [], opts = {}) {
  if (!attachments || !attachments.length) return baseBuffer;
  let out;
  try {
    out = await PDFDocument.load(baseBuffer);
  } catch {
    return baseBuffer; // couldn't parse our own render — return it unchanged
  }

  // Load every attachment first so the separator can list only the ones that
  // actually have usable pages.
  const loaded = [];
  for (const a of attachments) {
    const url = String(a?.dataUrl || "");
    const comma = url.indexOf(",");
    if (comma < 0) continue;
    let src = null;
    const bytes = Buffer.from(url.slice(comma + 1), "base64");
    for (const options of [
      { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false },
      { ignoreEncryption: true },
    ]) {
      try { src = await PDFDocument.load(bytes, options); break; } catch { /* try next */ }
    }
    if (src && src.getPageCount() > 0) loaded.push({ name: a?.name, src });
  }
  if (loaded.length === 0) return Buffer.from(await out.save());

  if (opts.separator !== false && opts.serial) {
    try { await addSeparator(out, String(opts.serial), loaded.map((l) => l.name)); } catch { /* best effort */ }
  }

  for (const { src } of loaded) {
    for (const i of src.getPageIndices()) {
      try {
        const [pg] = await out.copyPages(src, [i]);
        out.addPage(pg);
      } catch {
        // skip a single unreadable page rather than losing the whole attachment
      }
    }
  }

  return Buffer.from(await out.save());
}

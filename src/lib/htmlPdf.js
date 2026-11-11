import fs from "fs";
import path from "path";

// Render one of the HTML document templates to an A4 PDF Buffer with headless
// Chromium. The templates live in public/doc-templates and are the single
// source of truth for the design; they read their data from window globals we
// inject here, then paginate themselves in the page before we print.
//
// Production (Alpine) uses the system Chromium from `apk add chromium`, pointed
// to by CHROMIUM_PATH (set in the Dockerfile). In dev / this container, the
// bundled Playwright browser is used when no path is given.

let _chromium;
async function getChromium() {
  if (_chromium) return _chromium;
  // Prefer the lightweight playwright-core (production); fall back to full
  // playwright where that's what's installed (local/dev container).
  // webpackIgnore keeps Next's bundler from trying to resolve these at build
  // time — `playwright` isn't a dependency (only `playwright-core` is), so a
  // static import of it fails the production build. Both are resolved by Node
  // at runtime instead.
  try {
    _chromium = (await import(/* webpackIgnore: true */ "playwright-core")).chromium;
  } catch {
    _chromium = (await import(/* webpackIgnore: true */ "playwright")).chromium;
  }
  return _chromium;
}

function readTemplate(name) {
  const candidates = [
    path.join(process.cwd(), "public", "doc-templates", `${name}.html`),
    path.join(process.cwd(), "src", "pdf", "templates", `${name}.html`),
  ];
  for (const c of candidates) {
    try { return fs.readFileSync(c, "utf8"); } catch { /* try next */ }
  }
  throw new Error(`Document template not found: ${name}`);
}

// data: a map of window-global name -> value, e.g.
//   { __QSL_ASSETS__: {...}, __QSL_ORG__: {...}, __QSL_DOCS__: [...] }
export async function renderHtmlPdf(name, data = {}) {
  let html = readTemplate(name);
  const inject =
    "<script>" +
    Object.entries(data)
      .map(([k, v]) => `window.${k}=${JSON.stringify(v)};`)
      .join("") +
    "</script>";
  // Inject before the template's own first <script> so the globals exist first.
  html = html.replace("<script>", inject + "<script>");

  const chromium = await getChromium();
  const execPath = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
  const browser = await chromium.launch({
    ...(execPath ? { executablePath: execPath } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    // Let the in-page paginator finish laying out before printing.
    await page.waitForTimeout(150);
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
  } finally {
    await browser.close();
  }
}

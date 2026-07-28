import { chromium } from "/opt/node22/lib/node_modules/playwright/index.js";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: 1224, height: 900 }, deviceScaleFactor: 2 });
await p.goto("file://" + process.cwd() + "/dash.html");
await p.waitForTimeout(400);
await p.screenshot({ path: "dash.png", fullPage: true });
await b.close();
console.log("ok");

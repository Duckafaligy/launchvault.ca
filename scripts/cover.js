// Render one cover HTML to a 1600x900 PNG. Paths come from env when set (LV_PLAYWRIGHT, LV_CHROME); see PUBLISHING.md.
const pw = process.env.LV_PLAYWRIGHT || "C:/Promo Business/Other projects/Freelance Leads/node_modules/playwright-core";
const chrome = process.env.LV_CHROME || "C:/Users/brend/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe";
const { chromium } = require(pw);
(async () => {
  const [, , src, out] = process.argv;
  const b = await chromium.launch({ executablePath: chrome, args: ["--allow-file-access-from-files"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.goto("file:///" + src.replace(/^\/+/, ""), { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
  await p.screenshot({ path: out }); await b.close();
})().catch(e => { console.error(e); process.exit(1); });

import { chromium } from "playwright";

const BASE = "http://localhost:4173";
const paths = process.argv.slice(2);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const problems = [];
let current = "";
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/fonts\.(googleapis|gstatic)|favicon/.test(t)) return;
  problems.push(`[console] ${current}  ${t}`);
});
page.on("pageerror", (e) => problems.push(`[throw] ${current}  ${e.message}`));

for (const p of paths) {
  current = p;
  await page.goto(`${BASE}/#${p}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(document.querySelector("#page h1, #page [data-page-title]")), { timeout: 4000 }).catch(() => {});
  const info = await page.evaluate(() => {
    const host = document.querySelector("#page");
    return { title: host?.querySelector("h1")?.textContent ?? null, len: (host?.innerText ?? "").trim().length };
  });
  console.log(`${info.len > 40 ? "✓" : "✗"} ${p.padEnd(28)} "${(info.title ?? "—").slice(0,38)}"  (${info.len} حرف)`);
}

if (problems.length) {
  console.log(`\n❌ ${problems.length} مشكلة:`);
  problems.slice(0, 20).forEach((p) => console.log("  " + p));
} else console.log("\n✅ لا أخطاء console ولا استثناءات.");

await browser.close();
process.exit(problems.length ? 1 : 0);

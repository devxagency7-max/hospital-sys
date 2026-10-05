/**
 * يزور كل مسار مسجَّل في خريطة التنقل ويتحقق من أنه يُرسم بلا أخطاء.
 * شرط «لا روابط أو أزرار مكسورة» من docs/09-DEFINITION-OF-DONE.md.
 */

import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:4173";
const NAV = "../js/config/navigation.js";

const { flatScreens } = await import(NAV);
const screens = [...flatScreens(), { path: "/design-system", label: "نظام التصميم" }];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const problems = [];
let currentPath = "";

page.on("console", (msg) => {
  if (msg.type() !== "error") return;
  const text = msg.text();
  if (/fonts\.(googleapis|gstatic)|favicon/.test(text)) return;
  problems.push({ path: currentPath, kind: "console", text });
});
page.on("pageerror", (err) => {
  problems.push({ path: currentPath, kind: "exception", text: err.message });
});

console.log(`زيارة ${screens.length} مسار…\n`);

let rendered = 0;
let blank = 0;

for (const screen of screens) {
  currentPath = screen.path;
  await page.goto(`${BASE}/#${screen.path}`, { waitUntil: "load" });
  await page.waitForTimeout(260);

  // كل شاشة يجب أن تُنتج عنوانًا (h1) ومحتوى غير فارغ.
  const info = await page.evaluate(() => {
    const host = document.querySelector("#page");
    return {
      hasTitle: Boolean(host?.querySelector("h1, [data-page-title]")),
      textLength: (host?.innerText ?? "").trim().length,
    };
  });

  if (!info.hasTitle || info.textLength < 20) {
    blank += 1;
    problems.push({
      path: screen.path,
      kind: "blank",
      text: `عنوان=${info.hasTitle} طول النص=${info.textLength}`,
    });
  } else {
    rendered += 1;
  }
}

/* --- فحص أن كل رابط في الشريط الجانبي يُطابق مسارًا مسجَّلاً --- */
currentPath = "(فحص الروابط)";
await page.goto(`${BASE}/#/design-system`, { waitUntil: "load" });
await page.waitForTimeout(400);

/*
 * الشريط يُعاد رسمه بعد كل نقرة فتتغيّر الفهارس، فنفتح كل مجموعة بنصها ونجمع
 * روابطها قبل الانتقال للتالية. الفتح والإغلاق متبادل، فنجمع تدريجيًا.
 */
const { navigation } = await import(NAV);
const groupLabels = navigation.filter((entry) => entry.children).map((entry) => entry.label);

const hrefs = new Set(
  await page.locator("aside nav a").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href"))),
);

for (const label of groupLabels) {
  const toggle = page.locator("aside nav button", { hasText: label }).first();
  if (!(await toggle.count())) continue; // مجموعة محجوبة بالصلاحيات

  // نفتح المجموعة لو كانت مغلقة فقط.
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
    await page.waitForTimeout(80);
  }

  for (const href of await page
    .locator("aside nav a")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href")))) {
    hrefs.add(href);
  }
}
const known = new Set(screens.map((s) => `#${s.path}`));
const dangling = [...hrefs].filter((h) => !known.has(h));

console.log(`مسارات رُسمت بنجاح : ${rendered}`);
console.log(`مسارات فارغة       : ${blank}`);
console.log(`روابط الشريط       : ${hrefs.size} (${dangling.length} غير مسجَّل)`);

if (dangling.length) console.log(`\nروابط غير مسجَّلة:\n${dangling.join("\n")}`);

if (problems.length) {
  console.log(`\n❌ ${problems.length} مشكلة:`);
  for (const p of problems.slice(0, 25)) {
    console.log(`  [${p.kind}] ${p.path}\n      ${p.text}`);
  }
} else {
  console.log("\n✅ كل المسارات تُرسم بلا أخطاء، وكل روابط الشريط مسجَّلة.");
}

await browser.close();
process.exit(problems.length || dangling.length ? 1 : 0);

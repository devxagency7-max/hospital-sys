/**
 * فحص الواجهة في متصفح حقيقي.
 * يتحقق من: الإقلاع، RTL، كل تبويبات نظام التصميم، عيّنة من المسارات،
 * الجدول الحقيقي (بحث/ترتيب/ترقيم)، النوافذ، والصلاحيات — وصفر أخطاء console.
 */

import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:4173";

const consoleErrors = [];
const pageErrors = [];
let failures = 0;

const check = (name, ok, detail = "") => {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
};
const section = (t) => console.log(`\n${t}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => pageErrors.push(err.message));

/** ينتقل إلى مسار hash وينتظر استقرار الرسم. */
async function go(hash) {
  await page.goto(`${BASE}/#${hash}`, { waitUntil: "load" });
  await page.waitForTimeout(700);
}

/* ───────────────────────── الإقلاع ───────────────────────── */
section("الإقلاع والإطار");
await go("/design-system");

check("الاتجاه RTL", (await page.getAttribute("html", "dir")) === "rtl");
check("اللغة عربية", (await page.getAttribute("html", "lang")) === "ar");
check("الإطار مُركَّب", (await page.locator("#app > div").count()) > 0);
check("الشريط الجانبي موجود", await page.locator("aside nav").isVisible());
// الكروت تستخدم <header> أيضًا (صحيح دلاليًا)، فنحدد هيدر الإطار بالمحور.
const appHeader = page.locator("#app header").first();
check("الهيدر موجود", await appHeader.isVisible());
check("وسم «بيانات تجريبية» ظاهر", await page.getByText("بيانات تجريبية").first().isVisible());

const sidebarBox = await page.locator("aside").boundingBox();
check(
  "الشريط الجانبي على يمين الشاشة (RTL)",
  sidebarBox.x > 1000,
  `x=${Math.round(sidebarBox.x)}`,
);

// الأنماط مُحمَّلة فعلًا — لا صفحة بلا CSS
const railBg = await page.locator("aside").evaluate((n) => getComputedStyle(n).backgroundColor);
check("أنماط Tailwind مُطبَّقة", railBg !== "rgba(0, 0, 0, 0)", railBg);

const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
check("الخط العربي مُحمَّل", /IBM Plex Sans Arabic/.test(bodyFont), bodyFont.slice(0, 40));

/* ───────────────────────── الشريط الجانبي ───────────────────────── */
section("الشريط الجانبي والتنقل");
const moduleButtons = await page.locator("aside nav > div > button").count();
check("كل الموديولات المجمَّعة ظاهرة", moduleButtons >= 11, `${moduleButtons}`);

await page.locator("aside nav button", { hasText: "المرضى" }).first().click();
await page.waitForTimeout(250);
check("فتح مجموعة يُظهر شاشاتها", await page.locator("aside nav a", { hasText: "قائمة المرضى" }).isVisible());

await page.locator("aside nav a", { hasText: "قائمة المرضى" }).click();
await page.waitForTimeout(700);
check("الانتقال من الشريط يعمل", page.url().includes("/patients"));
check("مسار التنقل ظاهر", await page.locator('nav[aria-label="مسار التنقل"]').isVisible());
check(
  "صفحة «مخطَّطة» صريحة لا 404",
  await page.getByText("هذه الشاشة لم تُنفَّذ بعد").isVisible(),
);
check("تذكر رقم المرحلة", await page.getByText(/المرحلة 1/).first().isVisible());

/* ───────────────────────── تبويبات نظام التصميم ───────────────────────── */
section("تبويبات نظام التصميم");
const TABS = [
  ["tokens", "الألوان والخطوط"],
  ["controls", "الأزرار والشرائح"],
  ["forms", "النماذج"],
  ["feedback", "التغذية الراجعة"],
  ["patients", "جدول المرضى"],
  ["invoices", "جدول الفواتير"],
  ["data", "طبقة البيانات"],
];

for (const [key, label] of TABS) {
  await go(`/design-system?tab=${key}`);
  const selected = await page.locator(`[role="tab"][aria-selected="true"]`).first().textContent();
  check(`تبويب «${label}» يُحمَّل من الرابط`, selected.includes(label), selected?.trim());
}

/* ───────────────────────── الجدول الحقيقي ───────────────────────── */
section("جدول المرضى — بيانات حقيقية من طبقة البيانات");
await go("/design-system?tab=patients");
await page.waitForSelector("tbody tr", { timeout: 5000 });

const rowCount = await page.locator("tbody tr").count();
check("الجدول يعرض صفحة كاملة", rowCount === 25, `${rowCount} صف`);

const totalLabel = await page.locator("text=/من 148/").first().textContent();
check("الترقيم يذكر العدد الكلي", /148/.test(totalLabel), totalLabel?.trim());

// البحث العربي المُطبَّع في المتصفح
await page.locator('input[type="search"]').fill("احمد");
await page.waitForTimeout(900);
const searchRows = await page.locator("tbody tr").count();
check("البحث بـ «احمد» يُرجع نتائج", searchRows > 0, `${searchRows} صف`);
const firstName = await page.locator("tbody tr").first().textContent();
check("النتيجة تحتوي «أحمد» بالهمزة", /أحمد|احمد/.test(firstName));

await page.locator('button[aria-label="مسح البحث"]').click();
await page.waitForTimeout(900);
check("مسح البحث يُعيد القائمة", (await page.locator("tbody tr").count()) === 25);

// الترتيب
await page.locator('th button[aria-label*="الزيارات"]').click();
await page.waitForTimeout(800);
const ariaSort = await page
  .locator("th", { has: page.locator('button[aria-label*="الزيارات"]') })
  .getAttribute("aria-sort");
check("الترتيب يضبط aria-sort", ariaSort === "ascending", String(ariaSort));

// الترقيم
await page.locator('button[aria-label="الصفحة التالية"]').click();
await page.waitForTimeout(800);
check("الصفحة التالية تعمل", await page.locator("text=/26–50/").first().isVisible());

/* --- اتجاه الأرقام (bidi) — الهاتف كان يُعرض بمجموعات معكوسة --- */
const bidi = await page.evaluate(() => {
  // الهاتف يُعرض عبر phoneValue() فيخرج داخل <bdi class="ltr-isolate">.
  const holder = document.querySelector("tbody tr td:nth-child(3) bdi");
  if (!holder) return { missing: true };

  const node = holder.firstChild;
  const text = node.textContent;
  const groups = text.replace(/[⁦⁩]/g, "").split(/[\s ]+/).filter(Boolean);

  const positions = [];
  let cursor = 0;
  for (const g of groups) {
    const i = text.indexOf(g, cursor);
    cursor = i + g.length;
    const r = document.createRange();
    r.setStart(node, i);
    r.setEnd(node, i + g.length);
    const box = r.getBoundingClientRect();
    positions.push({ g, x: box.x, y: Math.round(box.y) });
  }

  return {
    logical: groups,
    visual: [...positions].sort((a, b) => a.x - b.x).map((p) => p.g),
    lines: new Set(positions.map((p) => p.y)).size,
    usesNbsp: / /.test(text),
  };
});

check("الهاتف يُعرض داخل عنصر معزول اتجاهيًا", !bidi.missing);
check(
  "الهاتف: المجموعات بترتيبها الصحيح بصريًا",
  !bidi.missing && bidi.logical.join(" ") === bidi.visual.join(" "),
  bidi.missing ? "لم يُعثر على <bdi>" : `منطقي=${bidi.logical.join(" ")} بصري=${bidi.visual.join(" ")}`,
);
check("الهاتف: سطر واحد لا يلتف", bidi.lines === 1, `${bidi.lines} سطر`);
check("الهاتف: فاصل غير قابل للكسر", bidi.usesNbsp);

// الفلاتر
await page.locator("button", { hasText: "فلاتر" }).first().click();
await page.waitForTimeout(250);
check("لوحة الفلاتر تُفتح", await page.locator("text=الحالة").first().isVisible());

// التحديد والإجراءات الجماعية
await page.locator('tbody input[type="checkbox"]').first().check();
await page.waitForTimeout(250);
check("شريط الإجراءات الجماعية يظهر", await page.getByText(/تم تحديد 1/).isVisible());

// قائمة الأعمدة
await page.locator('button[aria-label="الأعمدة الظاهرة"]').click();
await page.waitForTimeout(250);
check("قائمة الأعمدة تُفتح", await page.getByText("الأعمدة الظاهرة").last().isVisible());
await page.keyboard.press("Escape");

/* ───────────────────────── جدول الفواتير ───────────────────────── */
section("جدول الفواتير — المجاميع والمحاذاة");
await go("/design-system?tab=invoices");
await page.waitForSelector("tbody tr", { timeout: 5000 });

check("صف المجاميع موجود", await page.locator("tfoot tr").isVisible());
const sumText = await page.locator("tfoot tr").textContent();
check("المجاميع تذكر عدد صفوف الصفحة", /مجموع الصفحة \(25\)/.test(sumText), sumText?.slice(0, 40));

const align = await page
  .locator("tbody tr")
  .first()
  .locator("td")
  .nth(5)
  .evaluate((n) => getComputedStyle(n).textAlign);
check("الأعمدة المالية محاذاتها نهاية", align === "end" || align === "left", align);

/* ───────────────────────── النوافذ ───────────────────────── */
section("النوافذ والأدراج ونوافذ التأكيد");
await go("/design-system?tab=feedback");

await page.locator("button", { hasText: "نافذة" }).first().click();
await page.waitForTimeout(400);
check("النافذة تُفتح", await page.locator('[role="dialog"]').isVisible());
check("النافذة لها aria-modal", (await page.getAttribute('[role="dialog"]', "aria-modal")) === "true");
const focusInModal = await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null);
check("التركيز ينتقل داخل النافذة", focusInModal);

await page.keyboard.press("Escape");
await page.waitForTimeout(350);
check("Escape يُغلق النافذة", (await page.locator('[role="dialog"]').count()) === 0);

await page.locator("button", { hasText: "درج جانبي" }).click();
await page.waitForTimeout(400);
const drawerBox = await page.locator('[role="dialog"]').boundingBox();
check("الدرج ينزلق من اليسار (RTL)", drawerBox.x < 100, `x=${Math.round(drawerBox.x)}`);
await page.keyboard.press("Escape");
await page.waitForTimeout(350);

// نافذة التأكيد بكتابة نص
await page.locator("button", { hasText: "تأكيد بكتابة نص" }).click();
await page.waitForTimeout(400);
check("نافذة التأكيد role=alertdialog", await page.locator('[role="alertdialog"]').isVisible());
const confirmBtn = page.locator('[role="alertdialog"] button', { hasText: "إغلاق الفترة" });
check("زر التأكيد معطّل قبل كتابة النص", await confirmBtn.isDisabled());
await page.locator('[role="alertdialog"] input[type="text"]').fill("إغلاق");
await page.waitForTimeout(250);
check("كتابة النص الصحيح تُمكّن الزر", await confirmBtn.isEnabled());
await confirmBtn.click();
await page.waitForTimeout(500);
check("الإشعار يظهر بعد التأكيد", await page.getByText("تم إغلاق الفترة المحاسبية").isVisible());

// الإشعار لا يدّعي نجاحًا وهميًا
await go("/design-system?tab=forms");
await page.locator("button", { hasText: "حفظ" }).first().click();
await page.waitForTimeout(500);
check(
  "نموذج العرض لا يُظهر «تم الحفظ بنجاح» كذبًا",
  await page.getByText(/لا يحفظ شيئًا/).isVisible(),
);

/* ───────────────────────── الصلاحيات ───────────────────────── */
section("الواجهة المدركة للصلاحيات");
await go("/design-system?tab=controls");

const adminVisible = await page.locator("button", { hasText: "إدارة الأدوار" }).count();
check("admin يرى زر إدارة الأدوار", adminVisible === 1);

// تبديل الدور إلى موظف استقبال
await page.locator('button[title*="تبديل الدور"]').click();
await page.waitForTimeout(250);
await page.locator("button", { hasText: "موظف استقبال" }).click();
await page.waitForTimeout(900);

const receptionistHidden = await page.locator("button", { hasText: "إدارة الأدوار" }).count();
check("موظف الاستقبال لا يرى زر إدارة الأدوار", receptionistHidden === 0);
check(
  "الزر المخفي مُعلَّم بسبب الإخفاء",
  await page.getByText("مخفي: roles.manage").isVisible(),
);

const accountingVisible = await page.locator("aside nav button", { hasText: "المحاسبة" }).count();
check("موديول المحاسبة يختفي من الشريط", accountingVisible === 0);

// شاشة ممنوعة
await go("/accounting/journal");
check("الشاشة الممنوعة تُظهر حالة منع", await page.getByText("لا تملك صلاحية الوصول").isVisible());
check("وتذكر الصلاحية المطلوبة", await page.getByText("accounting.view").isVisible());

/* ───────────────────── التنقل بالأمام والخلف ───────────────────── */
section("تاريخ المتصفح (رجوع/تقدّم)");

// نعود إلى صلاحيات كاملة حتى لا تحجب الصلاحيات المسارات المستخدمة هنا.
await go("/design-system?tab=controls");
await page.locator('button[title*="تبديل الدور"]').click();
await page.waitForTimeout(250);
await page.locator("button", { hasText: "مدير النظام" }).first().click();
await page.waitForTimeout(600);

await go("/patients");
await go("/billing/invoices");
await go("/inventory/items");

await page.goBack();
await page.waitForTimeout(600);
check("الرجوع يعود للشاشة السابقة", page.url().includes("/billing/invoices"), page.url().split("#")[1]);
check(
  "الشاشة تُرسم فعلًا بعد الرجوع",
  (await page.locator("#page h1").textContent()).includes("الفواتير"),
  await page.locator("#page h1").textContent(),
);

await page.goBack();
await page.waitForTimeout(600);
check("رجوع مرتين", page.url().includes("/patients"), page.url().split("#")[1]);

await page.goForward();
await page.waitForTimeout(600);
check("التقدّم يعمل", page.url().includes("/billing/invoices"), page.url().split("#")[1]);
check(
  "عنوان المستند يتبع الشاشة",
  (await page.title()).includes("الفواتير"),
  await page.title(),
);

// العنصر النشط في الشريط يتبع التاريخ لا النقر فقط
const activeAfterHistory = await page
  .locator('aside nav a[aria-current="page"]')
  .textContent()
  .catch(() => null);
check("العنصر النشط في الشريط يتحدّث مع الرجوع", activeAfterHistory?.includes("الفواتير"), String(activeAfterHistory));

/* ───────────────────── مسار التنقل (breadcrumbs) ───────────────────── */
section("مسار التنقل");

await go("/billing/payments");
const crumbs = await page.locator('nav[aria-label="مسار التنقل"]').textContent();
check("يعرض الموديول والشاشة", /الفواتير/.test(crumbs) && /المدفوعات/.test(crumbs), crumbs?.trim());
check("يبدأ من لوحة التحكم", /لوحة التحكم/.test(crumbs));

// الباگ: مسار التنقل كان يبقى من الشاشة السابقة على 404
await go("/no/such/screen");
const crumbsOn404 = await page.locator('nav[aria-label="مسار التنقل"]').count();
check("مسار التنقل لا يبقى قديمًا على 404", crumbsOn404 === 0, `${crumbsOn404} عنصر`);
check("عنوان المستند يتغيّر على 404", (await page.title()).includes("غير موجودة"), await page.title());

/* ───────────────────── تنظيف الشاشة عند الانتقال ───────────────────── */
section("تنظيف الشاشة");

// الباگ: بحث مؤجَّل في جدول كان يُنفَّذ بعد مغادرة الشاشة فيكتب فلاتره
// في رابط الصفحة التالية.
await go("/design-system?tab=patients");
await page.waitForSelector("tbody tr");
await page.locator('input[type="search"]').fill("احمد");
// نغادر فورًا قبل انقضاء مهلة التأجيل (280ms)
await page.goto(`${BASE}/#/inventory/items`, { waitUntil: "load" });
await page.waitForTimeout(900);
check(
  "البحث المؤجَّل لا يلوّث رابط الشاشة التالية",
  !page.url().includes("search="),
  page.url().split("#")[1],
);
check("الشاشة التالية تُرسم سليمة", await page.locator("#page h1").isVisible());

/* ───────────────────────── 404 والاستجابة ───────────────────────── */
section("404 والتجاوب");
await go("/no/such/screen");
check("مسار غير موجود يُظهر 404", await page.getByText("الصفحة غير موجودة").isVisible());

await page.setViewportSize({ width: 390, height: 844 });
await go("/design-system?tab=tokens");
check("الشريط الجانبي يختفي على الموبايل", !(await page.locator("aside").first().isVisible()));

const hScroll = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
);
check("لا تمرير أفقي على الموبايل", !hScroll);

await page.setViewportSize({ width: 1440, height: 900 });

/* ───────────────────────── أخطاء الـ console ───────────────────────── */
section("نظافة وحدة التحكم");
// تحذيرات الخط من Google Fonts خارج سيطرتنا في بيئة محجوبة.
const realErrors = consoleErrors.filter(
  (e) => !/fonts\.(googleapis|gstatic)|favicon|ERR_NETWORK_CHANGED/.test(e),
);
check("صفر أخطاء console", realErrors.length === 0, realErrors.slice(0, 4).join(" | "));
check("صفر استثناءات غير ملتقطة", pageErrors.length === 0, pageErrors.slice(0, 4).join(" | "));

await browser.close();
console.log(failures === 0 ? "\n✅ كل فحوص الواجهة نجحت." : `\n❌ ${failures} فحص فاشل.`);
process.exit(failures ? 1 : 0);

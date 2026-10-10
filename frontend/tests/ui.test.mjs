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

// Cairo أولًا: خط محلي مُرفَق ضمن الملف (assets/fonts، @font-face)، صفر طلب
// شبكة خارجية — راجع css/tailwind.src.css. Dubai/Segoe UI احتياط محلي أيضًا.
const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
check("مكدّس الخط العربي مُطبَّق (Cairo أولًا)", /^["']?Cairo/.test(bodyFont), bodyFont.slice(0, 40));

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

/*
 * فحص «صفحة مخطَّطة صريحة لا 404» حُذف من هنا: كان يتحقق أن «قائمة المرضى»
 * تعرض وسم «هذه الشاشة لم تُنفَّذ بعد» + رقم المرحلة، لأنها كانت فعليًا غير
 * منفَّذة وقت كتابة الفحص. أصبحت الآن منفَّذة بالكامل (راجع قسم «جدول
 * المرضى» أدناه) — وفعليًا كل شاشة في js/config/navigation.js أصبح لها
 * مسار حقيقي في routes.js (راجع buildRoutes: مصفوفة planned الناتجة
 * فارغة الآن لعدم وجود أي شاشة غير مسجَّلة). آلية الرجوع الصادق نفسها
 * (planned.page.js) ما زالت قائمة في الكود لأي شاشة تُضاف للتنقل دون
 * مسار مطابق لاحقًا — وتُراقَب بديلًا عبر تقرير tests/routes.test.mjs
 * («روابط الشريط: N (0 غير مسجَّل)»)، لا عبر نقر مباشر هنا على شاشة لم
 * تعد موجودة أصلًا.
 */

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

/* ───────────────────────── لوحة التحكم (Phase 1) ───────────────────────── */
section("لوحة التحكم — المحتوى");

await go("/");
await page.waitForSelector("#page h1");
await page.waitForTimeout(1300); // استقرار عدّاد المؤشرات (900ms) + هامش

// العنوان أصبح تحية شخصية باسم المستخدم الحالي (session.user.name في permissions.js)
// لا نصًا ثابتًا — راجع welcomeHeroCard في dashboard.page.js.
check("العنوان لوحة التحكم", (await page.locator("#page h1").textContent()) === "مساء الخير، عبدالله محمد");

/*
 * فحص ظهور كل تسمية على حدة لا `.count()` على نمط واحد: `getByText` يُطابق
 * أي عنصر يحتوي نصّه (مع نصوص أبنائه) على النمط، فتُحتسَب كل العناصر
 * الأصل في السلسلة أيضًا — ست تسميات ورقية حقيقية أنتجت عدّات أعلى من 6
 * بسبب هذا السلوك، لا لأن شيئًا تكرَّر فعليًا في الصفحة.
 */
// dash-stat-card__title حصريًا على سطر التسمية داخل kpi-tile.js — لا نستخدم
// getByText العام هنا لأن بعض التسميات (كـ"بانتظار الاعتماد") تتكرر في
// أقسام أخرى من الصفحة (لوحات تفصيلية، شرائح) فيفشل الفحص بـ strict mode.
for (const label of [
  "بانتظار الاعتماد",
  "إجمالي المرضى",
  "حالات مقبولة / منتهية",
  "الأرصدة المستحقة",
  "فريق العمل الطبي",
  "العيادات المعتمدة",
]) {
  check(
    `بطاقة «${label}» ظاهرة`,
    await page.locator("#page .dash-stat-card__title").filter({ hasText: label }).first().isVisible(),
  );
}

// لا نص خام مُسرَّب — فحص عام يكشف أي قيمة undefined/NaN نسيت صياغتها بأداة التنسيق.
const pageText = await page.locator("#page").innerText();
check(
  "لا 'undefined' أو 'NaN' أو '[object Object]' مُسرَّبة في النص",
  !/undefined|NaN|\[object Object\]/.test(pageText),
  pageText.match(/.{0,20}(undefined|NaN|\[object Object\]).{0,20}/)?.[0] ?? "",
);

check("رسم الإيرادات يحتوي مسارات SVG", (await page.locator("#page svg path").count()) > 0);

// العدّاد المتحرك استقرّ على قيمة نهائية ثابتة — لا يتغيّر بين قراءتين متتاليتين.
const firstTileValue = await page.locator("#page p.num").first().textContent();
await page.waitForTimeout(300);
const firstTileValueAgain = await page.locator("#page p.num").first().textContent();
check("عدّاد البطاقة الأولى استقرّ على قيمة ثابتة", firstTileValue === firstTileValueAgain, `${firstTileValue} / ${firstTileValueAgain}`);
check("قيمة البطاقة ليست صفرًا أو شرطة فارغة", firstTileValue !== "0" && firstTileValue !== "—" && firstTileValue !== "", firstTileValue);

// أعمدة توزيع الأقسام تحرّكت عن صفر بعد التسوية.
const barWidths = await page.locator("#page .bg-gradient-to-l.from-brand-500").evaluateAll((nodes) =>
  nodes.map((n) => n.style.width),
);
check(
  "أعمدة توزيع الأقسام لا تبقى صفرًا بعد التحريك",
  barWidths.length > 0 && barWidths.every((w) => w !== "0%" && w !== ""),
  barWidths.slice(0, 3).join(", "),
);

section("لوحة التحكم — شريط البحث الرئيسي");

check("عنوان قسم البحث ظاهر", await page.getByText("البحث والاستعلام عن المرضى").isVisible());

await page.getByRole("button", { name: "رقم الهاتف", exact: true }).click();
await page.waitForTimeout(150);
check(
  "تبديل شريحة النطاق يُغيّر النص التوضيحي للحقل",
  (await page.locator('input[aria-label="ابحث عن مريض"]').getAttribute("placeholder")) === "أدخل رقم الهاتف…",
);

await page.locator('input[aria-label="ابحث عن مريض"]').fill("احمد");
await page.keyboard.press("Enter");
await page.waitForTimeout(600);
check(
  "إرسال البحث ينتقل فعليًا لقائمة المرضى بمعامل بحث حقيقي",
  page.url().includes("/patients?search=") && page.url().includes("%D8%A7%D8%AD%D9%85%D8%AF"),
  page.url(),
);
await page.goBack();
await page.waitForSelector("#page h1");
await page.waitForTimeout(400);

/*
 * باگ فعلي ظهر أثناء تطبيق المرجع البصري الجديد: إصلاح backdrop-filter (راجع
 * تعليق glass في tailwind.src.css) جعل الهيدر يُنشئ سياق تكديس حقيقيًا لأول
 * مرة — وبلا z-index صريح عليه، كانت قائمة المستخدم المنسدلة (ابنة الهيدر)
 * تُرسَم تحت <main> الشقيق فعليًا رغم ظهورها بصريًا فوقه، فتعترض بطاقات لوحة
 * التحكم كل نقرة داخل القائمة. الفحص هنا يتحقق من قابلية النقر الفعلية لا
 * الظهور البصري فقط.
 */
section("لوحة التحكم — تكديس قائمة المستخدم فوق المحتوى");
await page.locator('button[aria-haspopup="true"]').click();
await page.waitForTimeout(300);
const settingsLink = page.getByRole("menu").getByText("الإعدادات");
const elAtSettingsPoint = await settingsLink.evaluate((el) => {
  const r = el.getBoundingClientRect();
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return hit === el || el.contains(hit) || hit.contains(el);
});
check("عنصر «الإعدادات» في القائمة قابل للنقر فعليًا لا محجوبًا بالمحتوى", elAtSettingsPoint);
// إغلاق اللوحة بالنقر خارجها — القائمة لا تستمع لـ Escape (نمط ثابت في هذا المشروع).
await page.mouse.click(800, 500);
await page.waitForTimeout(200);

section("لوحة التحكم — لوحة الأوامر (بحث سريع)");

await page.keyboard.press("Control+k");
await page.waitForTimeout(300);
check("Ctrl+K يفتح لوحة الأوامر", await page.locator('input[aria-label="بحث سريع"]').isVisible());

// كل الفحوص مُقيَّدة بمربع حوار لوحة الأوامر تحديدًا — الشريط الجانبي خلفها
// يحمل عناصر بنفس النصوص («المرضى» وغيرها)، فبحث غير مُقيَّد يُطابقها خطأً.
const paletteDialog = page.getByRole("dialog", { name: "بحث سريع" });

await page.locator('input[aria-label="بحث سريع"]').fill("احمد");
/*
 * انتظار محتوى فعلي لا مهلة ثابتة: debounce البحث (280ms) + كمون الشبكة
 * التجريبي (حتى 420ms) قد يتجاوزا معًا 500ms تحت حِمل — مهلة ثابتة هنا
 * كانت تُفشِل الفحص أحيانًا بسبب التوقيت لا بخلل فعلي.
 */
await paletteDialog.getByText(/أحمد/).first().waitFor({ timeout: 3000 }).catch(() => {});
check(
  "البحث يُظهر نتائج مرضى حقيقية (تطبيع عربي: «احمد» بلا همزة يجد «أحمد»)",
  await paletteDialog.getByText(/أحمد/).first().isVisible(),
);
check("قسم «المرضى» ظاهر في نتائج البحث", await paletteDialog.getByText("المرضى", { exact: true }).isVisible());

await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check("Escape يُغلق لوحة الأوامر", (await page.locator('input[aria-label="بحث سريع"]').count()) === 0);

section("لوحة التحكم — الإشعارات وقائمة المستخدم");

await page.locator('button[aria-label="الإشعارات"]').click();
await page.waitForTimeout(600);
check("لوحة الإشعارات تُفتح", await page.getByText("تنبيهات المخزون").isVisible());

/*
 * باگ فعلي ظهر في هذه الجلسة: «كمية / حد أدنى» لصنف نافد (0 من 10) كانت
 * تُعرض «10 / 0» — نفس فئة باگ الهاتف من المرحلة 0 (رقمان متجاوران بفاصل
 * محايد في فقرة RTL يُعاد ترتيبهما). يُفحَص هنا تحديدًا حتى لا يتكرر صمتًا.
 */
const quantityRatio = await page.evaluate(() => {
  const holder = document.querySelector('[role="region"][aria-label="الإشعارات"] bdi');
  if (!holder) return { missing: true };
  const node = holder.firstChild;
  const text = node.textContent;
  const [a, , b] = text.trim().split(/\s+/);
  const parts = text.trim().split(/\s+/).map((part) => {
    const i = text.indexOf(part);
    const r = document.createRange();
    r.setStart(node, i);
    r.setEnd(node, i + part.length);
    return { part, x: r.getBoundingClientRect().x };
  });
  const visual = [...parts].sort((x, y) => x.x - y.x).map((p) => p.part);
  return { logical: [a, b], visualFirst: visual[0], text };
});
check(
  "نسبة الكمية/الحد الأدنى معزولة اتجاهيًا وبترتيبها الصحيح",
  !quantityRatio.missing && quantityRatio.visualFirst === quantityRatio.logical[0],
  JSON.stringify(quantityRatio),
);

/*
 * باگ فعلي ثانٍ ظهر في الجلسة نفسها: صفوف «تشغيلات منتهية» تحمل حقل quantity
 * أيضًا (كما صفوف الرصيد)، فالتمييز بوجود الحقل وحده كان يُحوِّلها خطأً لعرض
 * «40 / —» بدل تاريخ الانتهاء. التمييز الصحيح بنوع المجموعة (kind) لا الحقل.
 */
const expiryRowText = await page.evaluate(() => {
  const region = document.querySelector('[role="region"][aria-label="الإشعارات"]');
  const groups = [...(region?.querySelectorAll(".max-h-96 > div > div") ?? [])];
  const group = groups.find((g) => /تشغيلات منتهية|قاربت الانتهاء/.test(g.textContent ?? ""));
  const row = group?.querySelector("a");
  return row ? row.querySelector("span:last-child")?.textContent?.trim() : null;
});
check(
  "صفوف انتهاء الصلاحية تعرض تاريخًا لا نسبة رصيد مكسورة",
  // تاريخ حقيقي (مثل 30‏/06‏/2026) يحتوي 4 رقمًا فأكثر؛ نسبة رصيد مكسورة
  // كانت تظهر كـ«40 / —» — شرطة بلا حد أدنى حقيقي، فنرفض وجود «—» فقط.
  Boolean(expiryRowText) && !/—/.test(expiryRowText) && /\d{4}/.test(expiryRowText),
  String(expiryRowText),
);

// إغلاق بإعادة النقر على زر الجرس: اللوحة قائمة مُنسدلة بسيطة، لا نافذة
// منبثقة كاملة — لا تستمع لـ Escape، تستمع فقط للنقر خارجها أو تبديل الزر.
await page.locator('button[aria-label="الإشعارات"]').click();
await page.waitForTimeout(250);

const avatarButton = page.locator('button[aria-haspopup="true"]');
await avatarButton.click();
await page.waitForTimeout(300);
// محدَّد ضمن role=menu لا نصًا عامًا: الشريط الجانبي يحمل زر خروج مستقلاً
// بنفس النص المرئي (المرجع البصري الجديد)، باسم وصولي مختلف («... من الشريط
// الجانبي») حتى لا يتشابه مع هذا — لكن getByText يطابق النص المرئي بصرف
// النظر عن aria-label، فالفحص هنا يحتاج تضييقًا صريحًا بالحاوية لا بالاسم.
const userMenu = page.getByRole("menu");
check("قائمة المستخدم تُفتح", await userMenu.getByText("تسجيل الخروج").isVisible());

await userMenu.getByText("تسجيل الخروج").click();
await page.waitForTimeout(400);
check(
  "تسجيل الخروج صريح بعدم التنفيذ — لا يدّعي نجاحًا وهميًا",
  await page.getByText(/غير منفَّذ بعد/).isVisible(),
);

section("لوحة التحكم — طيّ الشريط الجانبي");

/*
 * sidebar.js الجديد (المرجع البصري) يُبقي زرّي «طيّ»/«توسيع» كليهما في DOM
 * دائمًا، ويُظهر أحدهما فقط عبر group-data-[collapsed]:hidden — لا يستبدل
 * أحدهما بالآخر. فـ`.first()` بلا `:visible` كان يطابق دومًا زرّ «طيّ» (الأول
 * في DOM) حتى بعد أن يصبح هو نفسه مخفيًا، فيتعطّل النقر الثاني (إعادة الفتح).
 */
const sidebarBefore = await page.locator("aside").first().boundingBox();
await page.locator('button[title="طيّ القائمة الجانبية"]:visible, button[title="توسيع القائمة الجانبية"]:visible').first().click();
await page.waitForTimeout(400);
const sidebarAfter = await page.locator("aside").first().boundingBox();
check("طيّ الشريط يُغيّر عرضه فعليًا", sidebarBefore.width !== sidebarAfter.width, `${sidebarBefore.width} → ${sidebarAfter.width}`);

// نعيده كما كان حتى لا يؤثر على فحوص لاحقة تعتمد شريطًا مفتوحًا.
await page.locator('button[title="طيّ القائمة الجانبية"]:visible, button[title="توسيع القائمة الجانبية"]:visible').first().click();
await page.waitForTimeout(400);

section("نظام السمات (داكن/فاتح/النظام)");

/*
 * باگ فعلي حرج اكتُشف أثناء بناء نظام السمات: readPreference في store.js
 * كانت تُستدعى (داخل appState) قبل سطر `const STORAGE_PREFIX` نصيًا — منطقة
 * ميتة زمنيًا (TDZ) ترمي ReferenceError يبتلعه try/catch في readPreference
 * بصمت، فتُعيد القيمة الافتراضية دائمًا بصرف النظر عمّا هو محفوظ فعليًا في
 * localStorage. أثّر هذا على كل تفضيل محفوظ منذ المرحلة 1 (بما فيها طيّ
 * الشريط)، ولم يظهر من قبل لأن القيمة الافتراضية الخاطئة والصحيحة كانتا
 * غالبًا متطابقتين في الاختبار اليدوي. يُفحص هنا مباشرة حتى لا يتكرر صمتًا.
 */
await page.evaluate(() => localStorage.setItem("hospital-erp:themePreference", JSON.stringify("light")));
await page.reload({ waitUntil: "load" });
await page.waitForSelector("#page h1");
await page.waitForTimeout(500);
check(
  "تفضيل محفوظ في localStorage يُقرأ فعليًا بعد إعادة التحميل (فحص باگ TDZ)",
  (await page.evaluate(() => document.documentElement.dataset.theme)) === "light",
);

// التبديل التفاعلي عبر قائمة المستخدم.
await page.locator('button[aria-haspopup="true"]').click();
await page.waitForTimeout(300);
await page.getByRole("radio", { name: "داكن" }).click();
await page.waitForTimeout(300);
check(
  "التبديل لداكن من قائمة المستخدم يُحدِّث data-theme فورًا",
  (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark",
);

const tokensAfterDark = await page.evaluate(() => ({
  canvas: getComputedStyle(document.documentElement).getPropertyValue("--color-canvas").trim(),
}));
check(
  "توكن --color-canvas يتغيّر فعليًا مع السمة (لا مجرد data-theme بلا أثر)",
  tokensAfterDark.canvas !== "#eef1f7",
  tokensAfterDark.canvas,
);

await page.getByRole("radio", { name: "فاتح" }).click();
await page.waitForTimeout(300);
await page.keyboard.press("Escape").catch(() => {});

check(
  "الوضع الفاتح لا يُسقط Tailwind ولا يكسر الرسم",
  await page.locator("aside nav").isVisible(),
);

// نعيده للداكن (الحالة الافتراضية لبقية الاختبارات) حتى لا يؤثر على ما بعده.
await page.evaluate(() => localStorage.setItem("hospital-erp:themePreference", JSON.stringify("dark")));
await page.reload({ waitUntil: "load" });
await page.waitForSelector("#page h1");
await page.waitForTimeout(400);

section("تخصيص المظهر — استوديو الخلفية");

await page.evaluate(() => localStorage.removeItem("hospital-erp:backgroundStudio"));
await go("/settings/appearance");
check("شاشة تخصيص المظهر منفَّذة لا «مخطَّطة»", await page.getByText("صورة الخلفية").isVisible());

// اختيار شريحة لون جاهزة يُغيّر خلفية #bg-layer فعليًا، لا عرضًا بصريًا فقط.
const bgBefore = await page.evaluate(() => document.getElementById("bg-layer").style.backgroundColor);
await page.getByRole("button", { name: /كحلي داكن/ }).click();
await page.waitForTimeout(200);
const bgAfter = await page.evaluate(() => document.getElementById("bg-layer").style.backgroundColor);
check("اختيار شريحة لون يُحدِّث خلفية #bg-layer فعليًا", bgAfter !== bgBefore && bgAfter.includes("15, 23, 42"), bgAfter);

// شريحة الضبابية تُحدِّث متغيّر CSS حيًّا — نفس الآلية التي يقرأها .glass.
const blurSlider = page.locator('input[type="range"]').first();
await blurSlider.fill("30");
await blurSlider.dispatchEvent("input");
await page.waitForTimeout(150);
const blurVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--glass-blur").trim());
check("شريحة الضبابية تُحدِّث --glass-blur حيًّا", blurVar === "30px", blurVar);

// الاستمرارية: القيم المحفوظة تُقرأ فعليًا بعد إعادة تحميل كاملة — نفس فحص
// باگ TDZ أعلاه، لكن لمفتاح backgroundStudio هذه المرة (مسار كود مختلف).
await page.reload({ waitUntil: "load" });
await page.waitForSelector("#page h1");
await page.waitForTimeout(400);
const blurVarAfterReload = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue("--glass-blur").trim(),
);
check("إعدادات الخلفية تبقى محفوظة بعد إعادة التحميل", blurVarAfterReload === "30px", blurVarAfterReload);

// زر إعادة الضبط يُعيد كل القيم للافتراضي الموثَّق في DEFAULTS
// (background-studio.js: blur=25 — منسوخ حرفيًا من اللقطة المرجعية لمؤسسة النهضة).
await page.getByRole("button", { name: "إعادة ضبط المصنع" }).click();
await page.waitForTimeout(300);
const blurVarAfterReset = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue("--glass-blur").trim(),
);
check("إعادة ضبط المصنع تُعيد الضبابية للقيمة الافتراضية (25px)", blurVarAfterReset === "25px", blurVarAfterReset);

await page.evaluate(() => localStorage.removeItem("hospital-erp:backgroundStudio"));
await go("/");

/* ───────────────────────── 404 والاستجابة ───────────────────────── */
section("404 والتجاوب");
await go("/no/such/screen");
check("مسار غير موجود يُظهر 404", await page.getByText("الصفحة غير موجودة").isVisible());

await page.setViewportSize({ width: 390, height: 844 });
await go("/design-system?tab=tokens");
check("الشريط الجانبي يختفي على الموبايل", !(await page.locator("aside").first().isVisible()));

/*
 * باگ فعلي ظهر في هذه الجلسة: iconButton الأساسي (button.js) يُلحق inline-flex
 * غير المشروط بكل زر عبر BASE، فتضارب لاحقًا مع hidden غير المشروط لزر طيّ
 * الشريط على سطح المكتب — ترتيب القاعدتين في مخرجات Tailwind حسم الفائز بصرف
 * النظر عن ترتيب الأصناف في HTML، فظهر زرّا القائمة معًا على الموبايل. أُصلح
 * باستخدام max-lg:hidden (مؤهَّل داخل media query فلا يصطدم بقاعدة غير مشروطة).
 */
check(
  "زر واحد فقط لفتح/طيّ القائمة ظاهر على الموبايل",
  (await page.locator('header button[aria-label="طي القائمة"]').isVisible()) === false &&
    (await page.locator('header button[aria-label="فتح القائمة"]').isVisible()) === true,
);

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

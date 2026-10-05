/**
 * اختبارات معمارية — تُنفَّذ على الكود المصدري نفسه.
 *
 * تحرس القواعد التي لا يكشفها اختبار سلوكي: الفصل بين الطبقات، وعدم تسرّب
 * البيانات التجريبية إلى الشاشات، وعدم عودة الحساب المالي إلى طبقة العرض.
 * هذه القواعد تنهار بصمت مع الوقت ما لم يحرسها شيء آلي.
 *
 *   node tests/architecture.test.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, section, report } from "./harness.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".js")) out.push(full);
  }
  return out;
}

/**
 * يُزيل التعليقات والنصوص الحرفية.
 *
 * الفحص على الكود الفعّال فقط: صفحة توثيق طبقة البيانات تذكر «mock-adapter»
 * في شرحها، وهذا ليس اقترانًا. الفحص على النص الخام يُنتج إنذارات كاذبة
 * فيُهمَل الاختبار كله — وهو أسوأ من عدم وجوده.
 */
function stripNonCode(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")   // تعليقات الكتل
    .replace(/(^|[^:])\/\/.*$/gm, "$1 ") // تعليقات السطر
    .replace(/`(?:\\.|[^`\\])*`/g, "``") // قوالب نصية
    .replace(/"(?:\\.|[^"\\])*"/g, '""') // نصوص مزدوجة
    .replace(/'(?:\\.|[^'\\])*'/g, "''"); // نصوص مفردة
}

const files = walk(join(ROOT, "js"))
  .concat(walk(join(ROOT, "components")))
  .concat(walk(join(ROOT, "pages")))
  .map((path) => {
    const src = readFileSync(path, "utf8");
    return {
      path,
      rel: relative(ROOT, path).split(sep).join("/"),
      src,
      /** الكود بلا تعليقات ولا نصوص. */
      code: stripNonCode(src),
      /** مسارات الاستيراد وحدها. */
      imports: [...src.matchAll(/(?:^|\n)\s*import\s[\s\S]*?from\s+["']([^"']+)["']/g)].map((m) => m[1])
        .concat([...src.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1])),
    };
  });

const inDir = (file, prefix) => file.rel.startsWith(prefix);

/* ==========================================================================
   فصل طبقة البيانات التجريبية
   ========================================================================== */

section("عزل البيانات التجريبية");

const mockImporters = files.filter(
  (file) =>
    !inDir(file, "js/mock/") &&
    file.rel !== "js/api/mock-adapter.js" &&
    file.imports.some((spec) => spec.includes("/mock/")),
);
assert(
  "لا شيء خارج js/mock و mock-adapter يستورد من js/mock",
  mockImporters.length === 0,
  mockImporters.map((f) => f.rel).join("، "),
);

const ADAPTER_ALLOWED = new Set(["js/api/http.js", "js/api/meta.api.js", "js/api/mock-adapter.js"]);
const adapterImporters = files.filter(
  (file) => !ADAPTER_ALLOWED.has(file.rel) && file.imports.some((spec) => spec.includes("mock-adapter")),
);
assert(
  "لا شيء يستورد mock-adapter إلا http.js و meta.api.js",
  adapterImporters.length === 0,
  adapterImporters.map((f) => f.rel).join("، "),
);

const pagesAndComponents = files.filter((f) => inDir(f, "pages/") || inDir(f, "components/"));

// الفحص على الكود الفعّال: ذكر «mock» في شرح صفحة التوثيق ليس اقترانًا.
const mockAware = pagesAndComponents.filter((file) => /\bmock\b/i.test(file.code));
assert(
  "لا صفحة أو مكوّن يُشير إلى mock في كوده الفعّال",
  mockAware.length === 0,
  mockAware.map((f) => f.rel).join("، "),
);

/* ==========================================================================
   عدم تسرّب عناوين الـ API إلى الشاشات
   ========================================================================== */

section("تجريد الـ API");

// على الكود الفعّال: صفحة التوثيق تعرض «/api/v1» كمثال نصي، وهذا ليس استدعاءً.
const urlLeaks = pagesAndComponents.filter((file) =>
  /\bfetch\s*\(|XMLHttpRequest|\bnew\s+WebSocket\b/.test(file.code),
);
assert(
  "لا صفحة أو مكوّن يستدعي الشبكة مباشرة",
  urlLeaks.length === 0,
  urlLeaks.map((f) => f.rel).join("، "),
);

const httpImporters = files.filter(
  (file) => !inDir(file, "js/api/") && /from\s+["'][^"']*http\.js["']/.test(file.src),
);
assert(
  "http.js لا يُستورد إلا داخل js/api",
  httpImporters.length === 0,
  httpImporters.map((f) => f.rel).join("، "),
);

// كل صفحة تجلب بيانات يجب أن تمر من *.api.js
const apiFiles = files.filter((f) => inDir(f, "js/api/") && f.rel.endsWith(".api.js"));
assert("طبقة API تحتوي ملفات موديولية", apiFiles.length >= 5, `${apiFiles.length}`);

/* ==========================================================================
   عزل الحساب المالي عن العرض
   ========================================================================== */

section("عزل الحساب المالي");

const domainFiles = files.filter((f) => inDir(f, "js/domain/"));
assert("وحدة المجال موجودة", domainFiles.length > 0);

const domainImpure = domainFiles.filter((file) =>
  /\bdocument\b|\bwindow\b|from\s+["'][^"']*components\//.test(file.src),
);
assert(
  "وحدة المجال لا تلمس DOM ولا المكوّنات",
  domainImpure.length === 0,
  domainImpure.map((f) => f.rel).join("، "),
);

const moneyFile = files.find((f) => f.rel === "js/core/money.js");
assert("وحدة المال موجودة", Boolean(moneyFile));
assert(
  "وحدة المال خالية من DOM",
  moneyFile && !/\bdocument\b|\bwindow\b/.test(moneyFile.src),
);

// حساب مالي يدوي في طبقة العرض
const manualMoney = pagesAndComponents.filter((file) =>
  /Math\.round\([^)]*\*\s*100\s*\)|\/\s*100\s*\)/.test(file.src),
);
assert(
  "لا تقريب مالي يدوي في الصفحات والمكوّنات",
  manualMoney.length === 0,
  manualMoney.map((f) => f.rel).join("، "),
);

const duplicateRound = files.filter((file) => /const\s+round2\s*=/.test(file.src));
assert(
  "لا تعريفات مكررة لـ round2",
  duplicateRound.length === 0,
  duplicateRound.map((f) => f.rel).join("، "),
);

/* ==========================================================================
   اتجاه النص (RTL)
   ========================================================================== */

section("قواعد الاتجاه");

const inlineDirection = files.filter((file) =>
  /\[direction:\s*ltr\]|style="direction/.test(file.src),
);
assert(
  "لا إصلاحات اتجاه مفردة — تُستخدم أدوات ltr-isolate",
  inlineDirection.length === 0,
  inlineDirection.map((f) => f.rel).join("، "),
);

const valueModule = files.find((f) => f.rel === "components/common/value.js");
assert("وحدة عرض القيم اللاتينية موجودة", Boolean(valueModule));
assert(
  "تُصدّر الأدوات المتوقَّعة",
  valueModule &&
    ["export function ltr", "export function ref", "export function code", "export function phoneValue"].every(
      (sig) => valueModule.src.includes(sig),
    ),
);

const css = readFileSync(join(ROOT, "css/tailwind.src.css"), "utf8");
assert("أداة ltr-isolate مُعرَّفة في CSS", css.includes("@utility ltr-isolate"));
assert("أداة num مُعرَّفة في CSS", css.includes("@utility num"));

/* ==========================================================================
   قواعد المشروع الصارمة
   ========================================================================== */

section("قواعد المشروع");

const innerHtmlUsers = files.filter(
  (file) => file.rel !== "js/core/dom.js" && /\.innerHTML\s*=/.test(file.src),
);
assert(
  "لا استخدام مباشر لـ innerHTML خارج dom.js",
  innerHtmlUsers.length === 0,
  innerHtmlUsers.map((f) => f.rel).join("، "),
);

const inlineHandlers = files.filter((file) => /\sonclick\s*=\s*["']/i.test(file.src));
assert(
  "لا معالجات أحداث داخل HTML",
  inlineHandlers.length === 0,
  inlineHandlers.map((f) => f.rel).join("، "),
);

const roleChecks = pagesAndComponents.filter((file) =>
  /role\s*===\s*["'](admin|manager|doctor|accountant)/.test(file.src),
);
assert(
  "لا فحص دور مباشر في الصفحات — تُستخدم can()",
  roleChecks.length === 0,
  roleChecks.map((f) => f.rel).join("، "),
);

const hardDelete = files.filter((file) =>
  inDir(file, "js/mock/") && /export\s+function\s+(remove|hardDelete|destroy)\b/.test(file.src),
);
assert("لا دالة حذف فعلي في طبقة البيانات", hardDelete.length === 0);

/* ==========================================================================
   دورة حياة الشاشة
   ========================================================================== */

section("دورة حياة الشاشة");

const lifecycle = files.find((f) => f.rel === "js/core/lifecycle.js");
assert("وحدة التنظيف موجودة", Boolean(lifecycle));

const router = files.find((f) => f.rel === "js/core/router.js");
assert("الراوتر يُشغّل التنظيف", router && router.src.includes("runCleanups()"));

const table = files.find((f) => f.rel === "components/tables/data-table.js");
assert("الجدول يُسجّل تنظيفه تلقائيًا", table && table.src.includes("registerCleanup(destroy)"));

/* ==========================================================================
   إمكانية الاستبدال بباك-إند حقيقي
   ========================================================================== */

section("جاهزية استبدال الباك-إند");

const http = files.find((f) => f.rel === "js/api/http.js");
assert("http.js يدعم الوضعين", http && /requestMock/.test(http.src) && /requestLive/.test(http.src));
assert("الوضع يُقرأ من config لا من ثابت مكتوب", http && /API\.mode/.test(http.src));

const configFile = files.find((f) => f.rel === "js/core/config.js");
assert("config يحدد mode و baseUrl", configFile && /mode:/.test(configFile.src) && /baseUrl:/.test(configFile.src));

// الشاشات تستدعي دوال الـ API بالاسم لا بالمسار
const designSystem = files.find((f) => f.rel === "pages/_system/design-system.page.js");
assert(
  "الصفحة تستدعي دوال API مسمّاة",
  designSystem && /listPatients|listInvoices/.test(designSystem.src),
);
assert(
  "الصفحة لا تعرف شكل المسار",
  designSystem && !/["'`]\/patients["'`]|["'`]\/invoices["'`]/.test(designSystem.src),
);

report();

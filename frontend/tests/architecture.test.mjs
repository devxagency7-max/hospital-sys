/**
 * اختبارات معمارية — تُنفَّذ على الكود المصدري نفسه.
 *
 * تحرس القواعد التي لا يكشفها اختبار سلوكي: الفصل بين الطبقات، وعدم تسرّب
 * البيانات التجريبية إلى الشاشات، وعدم عودة الحساب المالي إلى طبقة العرض.
 * هذه القواعد تنهار بصمت مع الوقت ما لم يحرسها شيء آلي.
 *
 *   node tests/architecture.test.mjs
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
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
 * الفحص على الكود الفعّال فقط: تعليق يشرح طبقة البيانات يذكر «mock-adapter»،
 * وهذا ليس اقترانًا. الفحص على النص الخام يُنتج إنذارات كاذبة فيُهمَل الاختبار
 * كله — وهو أسوأ من عدم وجوده.
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
      code: stripNonCode(src),
      imports: [...src.matchAll(/(?:^|\n)\s*import\s[\s\S]*?from\s+["']([^"']+)["']/g)].map((m) => m[1])
        .concat([...src.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1])),
    };
  });

const inDir = (file, prefix) => file.rel.startsWith(prefix);
const find = (rel) => files.find((file) => file.rel === rel);

/* ==========================================================================
   عزل البيانات التجريبية
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

const mockAware = pagesAndComponents.filter((file) => /\bmock\b/i.test(file.code));
assert(
  "لا صفحة أو مكوّن يُشير إلى mock في كوده الفعّال",
  mockAware.length === 0,
  mockAware.map((f) => f.rel).join("، "),
);

/* ==========================================================================
   تجريد الـ API
   ========================================================================== */

section("تجريد الـ API");

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

/**
 * الشاشة لا تعرف شكل المسار.
 *
 * فحص على الكود الفعّال: أي نص يشبه مسار API (`"/gl/..."`) في صفحة يعني أنها
 * تبني الطلب بنفسها، فتكسر نقطة التبديل الواحدة بين البيانات التجريبية و API
 * حقيقي.
 */
const MODULE_PREFIXES = ["gl", "fin", "hr", "inv", "admin", "settings", "lookups", "dashboard", "auth"];
const pathLeaks = pagesAndComponents.filter((file) =>
  MODULE_PREFIXES.some((prefix) =>
    new RegExp(`(?:http|fetchList)[\\s\\S]{0,40}["'\`]/${prefix}/`).test(file.src),
  ),
);
assert(
  "لا صفحة أو مكوّن يبني مسار API بنفسه",
  pathLeaks.length === 0,
  pathLeaks.map((f) => f.rel).join("، "),
);

const apiFiles = files.filter((f) => inDir(f, "js/api/") && f.rel.endsWith(".api.js"));
assert("طبقة API موديولية لكل نطاق", apiFiles.length >= 6, `${apiFiles.length} ملف`);

/* ==========================================================================
   طبقة المجال خالصة
   ========================================================================== */

section("نقاء طبقة المجال");

const domainFiles = files.filter((f) => inDir(f, "js/domain/"));
assert("وحدات المجال موجودة", domainFiles.length >= 8, `${domainFiles.length} وحدة`);

/*
 * الفحص على **الوصول** إلى المتصفح لا على الاسم.
 *
 * `document` اسم معامل مشروع في posting-rules.js — المستند المصدري الذي
 * يُترجم إلى سطور قيد. فحص الاسم المجرد يُنتج إنذارًا كاذبًا، والإنذار الكاذب
 * يجعل الاختبار يُهمَل كله. ما يهمّ هو `document.body` و`window.` ونظائرهما.
 */
const domainImpure = domainFiles.filter((file) =>
  /\bdocument\.|\bwindow\.|\blocalStorage\b|\bnavigator\.|from\s+["'][^"']*components\//.test(
    file.code,
  ),
);
assert(
  "لا وحدة مجال تلمس DOM ولا المتصفح ولا المكوّنات",
  domainImpure.length === 0,
  domainImpure.map((f) => f.rel).join("، "),
);

const domainMockImporters = domainFiles.filter((file) =>
  file.imports.some((spec) => spec.includes("/mock/") || spec.includes("/api/")),
);
assert(
  "لا وحدة مجال تستورد من طبقة البيانات أو الـ API",
  domainMockImporters.length === 0,
  domainMockImporters.map((f) => f.rel).join("، "),
);

const moneyFile = find("js/core/money.js");
assert("وحدة المال موجودة", Boolean(moneyFile));
assert("وحدة المال خالية من DOM", moneyFile && !/\bdocument\b|\bwindow\b/.test(moneyFile.src));

/*
 * تقريب النسب المئوية للعرض ليس حسابًا ماليًا: شريط تقدّم يقرّب 0.834 إلى
 * 83% لا يمسّ مبلغًا. الفحص يستهدف تقريب المبالغ تحديدًا (القسمة على 100
 * بعد الضرب)، وهو ما تتولاه js/core/money.js وحدها.
 */
const manualMoney = pagesAndComponents.filter((file) =>
  /Math\.round\([^)]*\*\s*100\s*\)\s*\/\s*100/.test(file.code),
);
assert(
  "لا تقريب مالي يدوي في الصفحات والمكوّنات",
  manualMoney.length === 0,
  manualMoney.map((f) => f.rel).join("، "),
);

/* ==========================================================================
   مركزية الترحيل المحاسبي

   هذا القسم يحرس أهم قرار معماري في النظام: قيد اليومية يُبنى في مكان واحد.
   أربعة موديولات تُولّد قيودًا، ولو بنى كل منها قيوده بنفسه لاحتجنا أربع نسخ
   من ضمانة «المدين = الدائن» — وثلاثًا منها ستنكسر بصمت.
   ========================================================================== */

section("مركزية الترحيل المحاسبي");

const posting = find("js/domain/posting.js");
assert("js/domain/posting.js موجود", Boolean(posting));

const REQUIRED_POSTING_EXPORTS = [
  "EntryStatus", "SourceType", "debit", "credit",
  "assertBalanced", "isBalanced", "imbalance",
  "postingKey", "assertNotPosted", "findExistingPosting",
  "buildEntry", "approveEntry", "postEntry", "reverseEntry",
  "assertEntryMutable", "assertPeriodOpen", "nextEntryNumber",
];
const missingPosting = REQUIRED_POSTING_EXPORTS.filter(
  (name) =>
    !posting?.src.includes(`export function ${name}`) &&
    !posting?.src.includes(`export const ${name}`),
);
assert(
  "وحدة الترحيل تُصدّر كل عناصر النموذج (التوازن + التفرّد + دورة الحياة + العكس)",
  missingPosting.length === 0,
  missingPosting.join("، "),
);

/** البوابة الوحيدة: `buildEntry` هو المسار الوحيد لإنشاء قيد. */
assert(
  "buildEntry يتحقق من التوازن داخليًا",
  /function buildEntry\([\s\S]*?assertBalanced\(/.test(posting?.src ?? ""),
);

const rules = find("js/domain/posting-rules.js");
assert("js/domain/posting-rules.js موجود", Boolean(rules));
assert(
  "قواعد الربط تقرأ الحسابات من خريطة لا من أرقام مكتوبة",
  rules?.src.includes("resolveAccount") && rules?.src.includes("MAP_KEYS"),
);

/**
 * التحويل الداخلي لا يُنتج إيرادًا.
 *
 * خطأ جوهري متكرر في أنظمة ERP: التحويل بين مخزنين أو بين خزينتين يُرحَّل
 * كبيع أو شراء، فيُضخَّم الإيراد بحركات داخلية. الدالتان أدناه تضمنان أن
 * التحويل نقل قيمة بين حسابين من نفس النوع.
 */
assert(
  "التحويل المخزني لا يمسّ حسابات الإيراد ولا المشتريات",
  rules?.src.includes("inventoryTransferLines") &&
    /function inventoryTransferLines\([\s\S]*?toInventoryAccountId/.test(rules?.src ?? "") &&
    !/function inventoryTransferLines\([\s\S]*?salesRevenue/.test(rules?.src ?? ""),
);
/* الفحص محصور في جسم الدالة: `[\s\S]*?` يعبر إلى الدالة التالية ويُنتج إنذارًا كاذبًا. */
const cashTransferBody =
  (rules?.src ?? "").match(/export function cashTransferLines\([\s\S]*?\n\}/)?.[0] ?? "";
assert(
  "التحويل النقدي لا يمسّ حسابات الإيراد ولا المصروف",
  cashTransferBody.length > 0 &&
    !/salesRevenue|otherIncome|costOfGoodsSold|salesReturns/.test(cashTransferBody),
);

/** لا موديول يبني قيدًا بنفسه: الكل يمر من خدمة الترحيل. */
const services = files.filter((f) => inDir(f, "js/mock/services/"));
const rogueBuilders = services.filter(
  (file) =>
    file.rel !== "js/mock/services/posting.service.js" &&
    (file.imports.some((spec) => spec.includes("domain/posting-rules")) ||
      /\bbuildEntry\s*\(/.test(file.code)),
);
assert(
  "لا خدمة موديول تبني قيدًا بنفسها — الكل يمر من posting.service",
  rogueBuilders.length === 0,
  rogueBuilders.map((f) => f.rel).join("، "),
);

const postingService = find("js/mock/services/posting.service.js");
assert(
  "خدمة الترحيل تُطبّق الحماية من التكرار وفحص الفترة",
  postingService?.src.includes("assertNotPosted") &&
    postingService?.src.includes("periods:") &&
    postingService?.src.includes("audit("),
);

/* ==========================================================================
   اشتقاق الأرصدة من القيود
   ========================================================================== */

section("اشتقاق الأرصدة");

const ledger = find("js/domain/ledger.js");
assert("js/domain/ledger.js موجود", Boolean(ledger));

const REQUIRED_LEDGER_EXPORTS = [
  "toMovements", "aggregateByAccount", "rollUpBalances",
  "accountStatement", "trialBalance",
  "incomeStatement", "balanceSheet", "cashFlowStatement", "costCenterAnalysis",
];
const missingLedger = REQUIRED_LEDGER_EXPORTS.filter(
  (name) => !ledger?.src.includes(`export function ${name}`),
);
assert(
  "محرك الأستاذ يُصدّر الأرصدة والميزان والقوائم الثلاث",
  missingLedger.length === 0,
  missingLedger.join("، "),
);

/**
 * حسابات المقابلة تُوقَّع بالنوع في القوائم المالية.
 *
 * `signedBalance` يوقّع بطبيعة الحساب (صحيح للميزان وكشف الحساب)، و
 * `statementAmount` يوقّع بنوعه (صحيح للقوائم). استخدام الأول في القوائم
 * يجعل مجمع الإهلاك يُضاف إلى الأصول بدل أن يُخصم منها — وكان ذلك باگًا
 * فعليًا أخرج الميزانية غير متوازنة بضعف مجمع الإهلاك.
 */
const accountsDomain = find("js/domain/accounts.js");
assert(
  "accounts.js يفصل توقيع الطبيعة عن توقيع النوع",
  accountsDomain?.src.includes("export function signedBalance") &&
    accountsDomain?.src.includes("export function statementAmount"),
);
assert(
  "القوائم المالية تستخدم statementAmount لا signedBalance",
  /function incomeStatement\([\s\S]*?statementAmount\(/.test(ledger?.src ?? "") &&
    /function balanceSheet\([\s\S]*?statementAmount\(/.test(ledger?.src ?? ""),
);

/** لا رصيد مخزَّن على الحساب — الأرصدة مُشتقّة. */
const accountsMock = find("js/mock/accounting.mock.js");
assert(
  "دليل الحسابات لا يحمل حقل رصيد مخزَّن",
  accountsMock && !/^\s*\{ id: \d+, code: "[^"]+",[^}]*\bbalance:/m.test(accountsMock.src),
);

/* ==========================================================================
   نموذج الفوترة والتسوية
   ========================================================================== */

section("نموذج الفوترة والتسوية");

const invoicing = find("js/domain/invoicing.js");
assert("js/domain/invoicing.js موجود", Boolean(invoicing));

const REQUIRED_INVOICING_EXPORTS = [
  "InvoiceLifecycle", "DocumentStatus",
  "isDraft", "isIssued", "isCancelled", "isFinalized",
  "assertMutable", "assertDocumentMutable",
  "issueInvoice", "cancelInvoice",
  "maxRefundable", "maxCreditable",
  "settleInvoice", "summarizePartyAccount", "buildInvoiceTimeline",
];
const missingInvoicing = REQUIRED_INVOICING_EXPORTS.filter(
  (name) =>
    !invoicing?.src.includes(`export function ${name}`) &&
    !invoicing?.src.includes(`export const ${name}`),
);
assert(
  "وحدة الفوترة تُصدّر دورة الحياة والتسوية والحدود",
  missingInvoicing.length === 0,
  missingInvoicing.join("، "),
);

/** إشعار الدائن منفصل عن المرتجع: محورا تصحيح مستقلان لا واحد. */
assert(
  "settleInvoice يستقبل creditNotes منفصلة عن refunds",
  /settleInvoice\s*\([^)]*\{[^}]*refunds[^}]*creditNotes/s.test(invoicing?.src ?? ""),
);
assert(
  "الوحدة محايدة تجاه نوع الطرف (تخدم العملاء والموردين)",
  invoicing?.src.includes("summarizePartyAccount") && !invoicing?.src.includes("summarizePatientAccount"),
);

/* ==========================================================================
   محركات التقييم والرواتب والإهلاك
   ========================================================================== */

section("محركات الحساب المتخصصة");

const valuation = find("js/domain/valuation.js");
assert(
  "محرك التقييم يُنفّذ الطريقتين فعلًا",
  valuation?.src.includes("export function runFifo") &&
    valuation?.src.includes("export function runWeightedAverage") &&
    valuation?.src.includes("export function previewIssueCost"),
);
assert(
  "الصرف لا يُكتب له سعر في البيانات — المحرك يحسبه",
  valuation?.src.includes("shortfalls"),
);

const payroll = find("js/domain/payroll.js");
assert(
  "محرك الرواتب يُنفّذ الشرائح التصاعدية وحدود التأمينات",
  payroll?.src.includes("export function taxOnAnnual") &&
    payroll?.src.includes("export function insuranceBase") &&
    payroll?.src.includes("export function calculatePayslip"),
);
/**
 * الصافي يُخفَّض باسترداد السلفة لا بالتقييد عند الصفر.
 *
 * تقييد الصافي عند الصفر مع إبقاء القسط كاملًا في الاستقطاعات يجعل
 * (الإجمالي − الاستقطاعات) ≠ الصافي، فيخرج قيد الرواتب غير متوازن — وهو
 * باگ فعلي رفعه محرك الترحيل.
 */
assert(
  "الرواتب تؤجّل قسط السلفة بدل تقييد الصافي",
  payroll?.src.includes("carriedForward") && payroll?.src.includes("requestedRecovery"),
);
assert(
  "ملخص المسيّر يحمل فحص تماسك (الإجمالي − الاستقطاعات = الصافي)",
  payroll?.src.includes("isConsistent"),
);

const depreciation = find("js/domain/depreciation.js");
assert(
  "محرك الإهلاك يحترم حد قيمة الخردة",
  depreciation?.src.includes("remainingDepreciable") &&
    /periodDepreciation\([\s\S]*?money\.min\(/.test(depreciation?.src ?? ""),
);

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
assert("لا معالجات أحداث داخل HTML", inlineHandlers.length === 0, inlineHandlers.map((f) => f.rel).join("، "));

const roleChecks = pagesAndComponents.filter((file) =>
  /role\s*===\s*["'](admin|gm|accountant|financial_manager|hr_manager)/.test(file.src),
);
assert(
  "لا فحص دور مباشر في الصفحات — تُستخدم can()",
  roleChecks.length === 0,
  roleChecks.map((f) => f.rel).join("، "),
);

const hardDelete = files.filter(
  (file) => inDir(file, "js/mock/") && /export\s+function\s+(remove|hardDelete|destroy)\b/.test(file.src),
);
assert("لا دالة حذف فعلي في طبقة البيانات", hardDelete.length === 0);

/**
 * معالج القيمة صريح.
 *
 * `onInput` و `onChange` يُمرّران الحدث الخام، فكتابة `onInput: (v) => (x = v)`
 * تضع كائن `Event` في حقل نصي — خطأ صامت يظهر عند `x.trim()` أو في الطلب.
 * المحوّل `value()` يجعل النية صريحة، وهذا الفحص يمنع العودة إلى الشكل الخاطئ.
 */
/*
 * الفحص على أدوات الإدخال الخام وحدها (`textField`، `moneyInput`، `textarea`،
 * `select`، `dateField`). الأغلفة في pages/_shared/forms.js (مثل `dateRange`)
 * تُمرّر كائنًا مُهيَّكلًا لا حدثًا، فمعالجها يستلم القيمة بحق.
 */
const rawValueHandlers = files.filter(
  (file) =>
    inDir(file, "pages/") &&
    /(?:textField|moneyInput|quantityInput|textarea|searchInput)\(\{[^}]*on(?:Input|Change):\s*\((?:value|v|next|e)\)\s*=>/s.test(
      file.code,
    ),
);
assert(
  "لا معالج إدخال يفترض أنه يستلم القيمة بدل الحدث",
  rawValueHandlers.length === 0,
  rawValueHandlers.map((f) => f.rel).join("، "),
);

/* ==========================================================================
   دورة حياة الشاشة
   ========================================================================== */

section("دورة حياة الشاشة");

assert("وحدة التنظيف موجودة", Boolean(find("js/core/lifecycle.js")));
assert("الراوتر يُشغّل التنظيف", find("js/core/router.js")?.src.includes("runCleanups()"));
assert(
  "الجدول يُسجّل تنظيفه تلقائيًا",
  find("components/tables/data-table.js")?.src.includes("registerCleanup(destroy)"),
);

/* ==========================================================================
   اتجاه النص (RTL)
   ========================================================================== */

section("قواعد الاتجاه");

const inlineDirection = files.filter((file) => /\[direction:\s*ltr\]|style="direction/.test(file.src));
assert(
  "لا إصلاحات اتجاه مفردة — تُستخدم أدوات ltr-isolate",
  inlineDirection.length === 0,
  inlineDirection.map((f) => f.rel).join("، "),
);

const valueModule = find("components/common/value.js");
assert(
  "وحدة عرض القيم اللاتينية تُصدّر الأدوات المتوقَّعة",
  valueModule &&
    ["export function ltr", "export function ref", "export function code", "export function phoneValue"].every(
      (sig) => valueModule.src.includes(sig),
    ),
);

const css = readFileSync(join(ROOT, "css/tailwind.src.css"), "utf8");
assert("أداة ltr-isolate مُعرَّفة في CSS", css.includes("@utility ltr-isolate"));
assert("أداة num مُعرَّفة في CSS", css.includes("@utility num"));

/* ==========================================================================
   خلو الكود من نطاق المستشفى
   ========================================================================== */

section("اكتمال التحويل");

const CLINICAL_TERMS = /\b(patient|doctor|clinic|pharmacy|prescription|radiolog|laborator)\w*/i;
const clinicalLeftovers = files.filter((file) => CLINICAL_TERMS.test(file.code));
assert(
  "لا مصطلح إكلينيكي في الكود الفعّال",
  clinicalLeftovers.length === 0,
  clinicalLeftovers.map((f) => f.rel).join("، "),
);

const ARABIC_CLINICAL = /مريض|مرضى|طبيب|عيادة|صيدلية|روشتة|أشعة|مستشفى/;
const arabicLeftovers = files.filter((file) => ARABIC_CLINICAL.test(file.src));
assert(
  "لا مصطلح إكلينيكي عربي في أي ملف",
  arabicLeftovers.length === 0,
  arabicLeftovers.map((f) => f.rel).join("، "),
);

/* ==========================================================================
   جاهزية استبدال الباك-إند
   ========================================================================== */

section("جاهزية استبدال الباك-إند");

const http = find("js/api/http.js");
assert("http.js يدعم الوضعين", http && /requestMock/.test(http.src) && /requestLive/.test(http.src));
assert("الوضع يُقرأ من config لا من ثابت مكتوب", http && /API\.mode/.test(http.src));

const configFile = find("js/core/config.js");
assert("config يحدد mode و baseUrl", configFile && /mode:/.test(configFile.src) && /baseUrl:/.test(configFile.src));

/** كل مسار في routes.js له ملف موجود — وإلا فشل الاستيراد الديناميكي. */
const routesFile = find("js/config/routes.js");
const brokenRoutes = [...(routesFile?.src.matchAll(/import\("\.\.\/\.\.\/(pages\/[^"]+)"\)/g) ?? [])]
  .map((match) => match[1])
  .filter((rel) => !existsSync(join(ROOT, rel)));
assert(
  "كل مسار مسجَّل يشاور على ملف موجود",
  brokenRoutes.length === 0,
  brokenRoutes.join("، "),
);

report();

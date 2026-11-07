/**
 * جدول المسارات.
 *
 * كل شاشة في خريطة التنقل إمّا مسجَّلة هنا بصفحتها الحقيقية، أو تُعرض كصفحة
 * «مخطَّطة» صريحة — لا رابط مكسور ولا شاشة فارغة بلا تفسير.
 *
 * المسارات الديناميكية (بمعاملات) تُسجَّل في `DYNAMIC` ولا تظهر في الشريط
 * الجانبي، لأنها تُفتح من صف في جدول لا من قائمة.
 */

import { flatScreens } from "./navigation.js";

/** الشاشات المنفَّذة فعلًا. */
const IMPLEMENTED = [
  /* ===================== النظام ولوحة التحكم ===================== */
  {
    path: "/",
    title: "لوحة التحكم",
    permission: "dashboard.view",
    load: () => import("../../pages/dashboard/dashboard.page.js"),
  },

  /* ===================== 1. المحاسبة العامة ===================== */
  {
    path: "/gl/accounts",
    title: "دليل الحسابات",
    permission: "gl.view",
    load: () => import("../../pages/gl/accounts.page.js"),
  },
  {
    path: "/gl/journal",
    title: "قيود اليومية",
    permission: "gl.view",
    load: () => import("../../pages/gl/journal.page.js"),
  },
  {
    path: "/gl/journal/new",
    title: "إنشاء قيد يومية",
    permission: "gl.journal.create",
    load: () => import("../../pages/gl/journal-new.page.js"),
  },
  {
    path: "/gl/ledger",
    title: "دفتر الأستاذ العام",
    permission: "gl.ledger.view",
    load: () => import("../../pages/gl/ledger.page.js"),
  },
  {
    path: "/gl/trial-balance",
    title: "ميزان المراجعة",
    permission: "gl.trialbalance.view",
    load: () => import("../../pages/gl/trial-balance.page.js"),
  },
  {
    path: "/gl/periods",
    title: "الفترات المحاسبية",
    permission: "gl.period.manage",
    load: () => import("../../pages/gl/periods.page.js"),
  },

  /* ===================== 2. المحاسبة المالية ===================== */
  {
    path: "/fin/customers",
    title: "العملاء",
    permission: "fin.view",
    load: () => import("../../pages/fin/customers.page.js"),
  },
  {
    path: "/fin/customer-invoices",
    title: "فواتير العملاء",
    permission: "fin.view",
    load: () => import("../../pages/fin/customer-invoices.page.js"),
  },
  {
    path: "/fin/receivables-aging",
    title: "تقادم ذمم العملاء",
    permission: "fin.view",
    load: () => import("../../pages/fin/receivables-aging.page.js"),
  },
  {
    path: "/fin/suppliers",
    title: "الموردون",
    permission: "fin.view",
    load: () => import("../../pages/fin/suppliers.page.js"),
  },
  {
    path: "/fin/payables-aging",
    title: "تقادم ذمم الموردين",
    permission: "fin.view",
    load: () => import("../../pages/fin/payables-aging.page.js"),
  },
  {
    path: "/fin/cash-boxes",
    title: "الخزائن النقدية",
    permission: "fin.view",
    load: () => import("../../pages/fin/cash-boxes.page.js"),
  },
  {
    path: "/fin/banks",
    title: "الحسابات البنكية",
    permission: "fin.view",
    load: () => import("../../pages/fin/banks.page.js"),
  },
  {
    path: "/fin/statements",
    title: "القوائم المالية",
    permission: "fin.statements.view",
    load: () => import("../../pages/fin/statements.page.js"),
  },

  /* ===================== 3. الموارد البشرية ===================== */
  {
    path: "/hr/employees",
    title: "الموظفون",
    permission: "hr.view",
    load: () => import("../../pages/hr/employees.page.js"),
  },
  {
    path: "/hr/attendance",
    title: "الحضور والانصراف",
    permission: "hr.attendance.view",
    load: () => import("../../pages/hr/attendance.page.js"),
  },
  {
    path: "/hr/payroll",
    title: "مسيّرات الرواتب",
    permission: "hr.payroll.view",
    load: () => import("../../pages/hr/payroll.page.js"),
  },

  /* ===================== الإعدادات ===================== */
  {
    path: "/settings/appearance",
    title: "تخصيص المظهر",
    permission: "admin.settings.view",
    load: () => import("../../pages/settings/appearance.page.js"),
  },
];

/**
 * مسارات ديناميكية (بمعاملات) — تُفتح من صف في جدول لا من الشريط الجانبي.
 *
 * الراوتر يُطابق المقطع المتغيّر ويُمرّره في `params`. هذه المسارات مستبعدة
 * من خريطة التنقل عن قصد: لا معنى لرابط «تفاصيل القيد» بلا قيد محدَّد.
 */
const DYNAMIC = [
  {
    path: "/gl/ledger/:accountId",
    title: "كشف حساب",
    permission: "gl.ledger.view",
    load: () => import("../../pages/gl/ledger.page.js"),
  },
];

/**
 * شاشات تفاصيل مُسجَّلة ولم تُبنَ بعد.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ضرورية لا زائدة: صفوف الجداول تنتقل إلى هذه المسارات بالنقر.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * مسار غير مسجَّل يُنتج شاشة «غير موجود» — وهي تعني للمستخدم أن النظام مكسور.
 * تسجيله هنا يُنتج صفحة «غير منفَّذة» تقول الحقيقة: الشاشة قادمة ولم تُبنَ.
 * الفرق بين الرسالتين هو الفرق بين عيب ونقص مُعلَن.
 *
 * `label` هنا لأن `flatScreens()` لا يعرف هذه المسارات — فهي ليست في خريطة
 * التنقل عن قصد (لا معنى لرابط «تفاصيل فاتورة» بلا فاتورة محدَّدة).
 */
const PLANNED_DETAIL = [
  { path: "/gl/journal/:id", label: "تفاصيل قيد اليومية", permission: "gl.view", module: "gl" },
  { path: "/fin/customers/:id", label: "كشف حساب عميل", permission: "fin.view", module: "fin" },
  { path: "/fin/customer-invoices/:id", label: "تفاصيل فاتورة عميل", permission: "fin.view", module: "fin" },
  { path: "/fin/suppliers/:id", label: "كشف حساب مورد", permission: "fin.view", module: "fin" },
  { path: "/fin/supplier-invoices/:id", label: "تفاصيل فاتورة مورد", permission: "fin.view", module: "fin" },
  { path: "/fin/cash-boxes/:id", label: "كشف خزينة", permission: "fin.view", module: "fin" },
  { path: "/fin/banks/:id", label: "كشف حساب بنكي", permission: "fin.view", module: "fin" },
  { path: "/fin/assets/:id", label: "ملف أصل ثابت", permission: "fin.asset.manage", module: "fin" },
  { path: "/hr/employees/:id", label: "ملف موظف", permission: "hr.view", module: "hr" },
  { path: "/hr/payroll/:id", label: "تفاصيل مسيّر رواتب", permission: "hr.payroll.view", module: "hr" },
  { path: "/hr/payslips/:id", label: "قسيمة راتب", permission: "hr.payroll.view", module: "hr" },
  { path: "/inv/items/:id", label: "ملف صنف", permission: "inv.view", module: "inv" },
  { path: "/inv/counts/:id", label: "تفاصيل جرد", permission: "inv.count.manage", module: "inv" },
];

export function buildRoutes() {
  const implementedPaths = new Set([...IMPLEMENTED, ...DYNAMIC].map((route) => route.path));

  /** كل شاشة في خريطة التنقل ليست منفَّذة بعد → صفحة «مخطَّطة». */
  const planned = flatScreens()
    .filter((screen) => !implementedPaths.has(screen.path))
    .map((screen) => ({
      path: screen.path,
      title: screen.label,
      permission: screen.permission,
      load: () => import("../../pages/_system/planned.page.js"),
      meta: { screen },
    }));

  const plannedDetail = PLANNED_DETAIL.filter((screen) => !implementedPaths.has(screen.path)).map(
    (screen) => ({
      path: screen.path,
      title: screen.label,
      permission: screen.permission,
      load: () => import("../../pages/_system/planned.page.js"),
      meta: { screen },
    }),
  );

  /*
   * الترتيب يحكم المطابقة: المسارات الثابتة أولًا فيسبق `/gl/journal/new`
   * النمط `/gl/journal/:id`، وإلا التقط النمط المتغيّر كلمة «new» كمُعرِّف.
   */
  return [...IMPLEMENTED, ...DYNAMIC, ...planned, ...plannedDetail];
}

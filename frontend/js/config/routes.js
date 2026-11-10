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
  {
    path: "/gl/cost-centers",
    title: "مراكز التكلفة",
    permission: "gl.view",
    load: () => import("../../pages/gl/cost-centers.page.js"),
  },
  {
    path: "/gl/year-end",
    title: "إغلاق السنة المالية",
    permission: "gl.year.close",
    load: () => import("../../pages/gl/year-end.page.js"),
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
    path: "/fin/customer-invoices/new",
    title: "إصدار فاتورة",
    permission: "fin.customer.invoice",
    load: () => import("../../pages/fin/customer-invoices-new.page.js"),
  },
  {
    path: "/fin/receipts",
    title: "التحصيلات",
    permission: "fin.view",
    load: () => import("../../pages/fin/receipts.page.js"),
  },
  {
    path: "/fin/credit-notes",
    title: "إشعارات الدائن",
    permission: "fin.view",
    load: () => import("../../pages/fin/credit-notes.page.js"),
  },
  {
    path: "/fin/suppliers",
    title: "الموردون",
    permission: "fin.view",
    load: () => import("../../pages/fin/suppliers.page.js"),
  },
  {
    path: "/fin/supplier-invoices",
    title: "فواتير الموردين",
    permission: "fin.view",
    load: () => import("../../pages/fin/supplier-invoices.page.js"),
  },
  {
    path: "/fin/supplier-payments",
    title: "مدفوعات الموردين",
    permission: "fin.view",
    load: () => import("../../pages/fin/supplier-payments.page.js"),
  },
  {
    path: "/fin/cash-boxes",
    title: "الخزائن النقدية",
    permission: "fin.view",
    load: () => import("../../pages/fin/cash-boxes.page.js"),
  },
  {
    path: "/fin/cash-movements",
    title: "الحركات النقدية",
    permission: "fin.view",
    load: () => import("../../pages/fin/cash-movements.page.js"),
  },
  {
    path: "/fin/transfers",
    title: "التحويلات بين الحسابات",
    permission: "fin.cashbox.transact",
    load: () => import("../../pages/fin/transfers.page.js"),
  },
  {
    path: "/fin/banks",
    title: "الحسابات البنكية",
    permission: "fin.view",
    load: () => import("../../pages/fin/banks.page.js"),
  },
  {
    path: "/fin/bank-reconciliation",
    title: "المطابقة البنكية",
    permission: "fin.bank.reconcile",
    load: () => import("../../pages/fin/bank-reconciliation.page.js"),
  },
  {
    path: "/fin/assets",
    title: "الأصول الثابتة",
    permission: "fin.asset.manage",
    load: () => import("../../pages/fin/assets.page.js"),
  },
  {
    path: "/fin/depreciation",
    title: "الإهلاك الدوري",
    permission: "fin.asset.depreciate",
    load: () => import("../../pages/fin/depreciation.page.js"),
  },
  {
    path: "/fin/taxes",
    title: "الضرائب والإقرارات",
    permission: "fin.tax.manage",
    load: () => import("../../pages/fin/taxes.page.js"),
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
    path: "/hr/employees/new",
    title: "إضافة موظف",
    permission: "hr.employee.manage",
    load: () => import("../../pages/hr/employees-new.page.js"),
  },
  {
    path: "/hr/org-chart",
    title: "الهيكل التنظيمي",
    permission: "hr.view",
    load: () => import("../../pages/hr/org-chart.page.js"),
  },
  {
    path: "/hr/positions",
    title: "الوظائف والدرجات",
    permission: "hr.org.manage",
    load: () => import("../../pages/hr/positions.page.js"),
  },
  {
    path: "/hr/shifts",
    title: "الورديات",
    permission: "hr.org.manage",
    load: () => import("../../pages/hr/shifts.page.js"),
  },
  {
    path: "/hr/attendance",
    title: "الحضور والانصراف",
    permission: "hr.attendance.view",
    load: () => import("../../pages/hr/attendance.page.js"),
  },
  {
    path: "/hr/leaves",
    title: "طلبات الإجازات",
    permission: "hr.view",
    load: () => import("../../pages/hr/leaves.page.js"),
  },
  {
    path: "/hr/leave-balances",
    title: "أرصدة الإجازات",
    permission: "hr.view",
    load: () => import("../../pages/hr/leave-balances.page.js"),
  },
  {
    path: "/hr/advances",
    title: "سلف الموظفين",
    permission: "hr.advance.manage",
    load: () => import("../../pages/hr/advances.page.js"),
  },
  {
    path: "/hr/payroll",
    title: "مسيّرات الرواتب",
    permission: "hr.payroll.view",
    load: () => import("../../pages/hr/payroll.page.js"),
  },
  {
    path: "/hr/payslips",
    title: "قسائم الرواتب",
    permission: "hr.payroll.view",
    load: () => import("../../pages/hr/payslips.page.js"),
  },
  {
    path: "/hr/payroll-settings",
    title: "إعدادات الرواتب",
    permission: "hr.payroll.process",
    load: () => import("../../pages/hr/payroll-settings.page.js"),
  },

  /* ===================== 4. المخازن ===================== */
  {
    path: "/inv/items",
    title: "الأصناف",
    permission: "inv.view",
    load: () => import("../../pages/inv/items.page.js"),
  },
  {
    path: "/inv/balances",
    title: "أرصدة المخزون",
    permission: "inv.view",
    load: () => import("../../pages/inv/balances.page.js"),
  },
  {
    path: "/inv/movements",
    title: "حركات المخزون",
    permission: "inv.view",
    load: () => import("../../pages/inv/movements.page.js"),
  },
  {
    path: "/inv/categories",
    title: "التصنيفات",
    permission: "inv.item.manage",
    load: () => import("../../pages/inv/categories.page.js"),
  },
  {
    path: "/inv/warehouses",
    title: "المخازن",
    permission: "inv.view",
    load: () => import("../../pages/inv/warehouses.page.js"),
  },
  {
    path: "/inv/receipts",
    title: "إذن إضافة",
    permission: "inv.receipt.create",
    load: () => import("../../pages/inv/receipts.page.js"),
  },
  {
    path: "/inv/issues",
    title: "إذن صرف",
    permission: "inv.issue.create",
    load: () => import("../../pages/inv/issues.page.js"),
  },
  {
    path: "/inv/transfers",
    title: "تحويل مخزني",
    permission: "inv.transfer.create",
    load: () => import("../../pages/inv/transfers.page.js"),
  },
  {
    path: "/inv/adjustments",
    title: "التسويات المخزنية",
    permission: "inv.view",
    load: () => import("../../pages/inv/adjustments.page.js"),
  },
  {
    path: "/inv/batches",
    title: "التشغيلات",
    permission: "inv.view",
    load: () => import("../../pages/inv/batches.page.js"),
  },
  {
    path: "/inv/expiry",
    title: "تتبّع الصلاحية",
    permission: "inv.view",
    load: () => import("../../pages/inv/expiry.page.js"),
  },
  {
    path: "/inv/counts",
    title: "الجرد الفعلي",
    permission: "inv.count.manage",
    load: () => import("../../pages/inv/counts.page.js"),
  },

  /* ===================== التقارير ===================== */
  {
    path: "/reports",
    title: "مركز التقارير",
    permission: "reports.view",
    load: () => import("../../pages/reports/reports-hub.page.js"),
  },
  {
    path: "/reports/financial",
    title: "التقارير المالية",
    permission: "reports.financial.view",
    load: () => import("../../pages/reports/financial-reports.page.js"),
  },
  {
    path: "/reports/receivables",
    title: "تقارير الذمم",
    permission: "reports.financial.view",
    load: () => import("../../pages/reports/receivables-reports.page.js"),
  },
  {
    path: "/reports/hr",
    title: "تقارير الموارد البشرية",
    permission: "reports.hr.view",
    load: () => import("../../pages/reports/hr-reports.page.js"),
  },
  {
    path: "/reports/inventory",
    title: "تقارير المخازن",
    permission: "reports.inventory.view",
    load: () => import("../../pages/reports/inventory-reports.page.js"),
  },

  /* ===================== الإدارة والنظام ===================== */
  {
    path: "/admin/users",
    title: "المستخدمون",
    permission: "admin.users.view",
    load: () => import("../../pages/admin/users.page.js"),
  },
  {
    path: "/admin/roles",
    title: "الأدوار",
    permission: "admin.roles.manage",
    load: () => import("../../pages/admin/roles.page.js"),
  },
  {
    path: "/admin/audit",
    title: "سجل التدقيق",
    permission: "admin.audit.view",
    load: () => import("../../pages/admin/audit.page.js"),
  },

  /* ===================== الإعدادات ===================== */
  {
    path: "/settings/company",
    title: "بيانات المنشأة",
    permission: "admin.settings.view",
    load: () => import("../../pages/settings/company.page.js"),
  },
  {
    path: "/settings/posting-map",
    title: "خريطة الربط المحاسبي",
    permission: "admin.settings.view",
    load: () => import("../../pages/settings/posting-map.page.js"),
  },
  {
    path: "/settings/preferences",
    title: "تفضيلات النظام",
    permission: "admin.settings.manage",
    load: () => import("../../pages/settings/preferences.page.js"),
  },
  {
    path: "/settings/notifications",
    title: "تفضيلات الإشعارات",
    permission: "admin.settings.view",
    load: () => import("../../pages/settings/notifications.page.js"),
  },
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

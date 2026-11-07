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
  {
    path: "/design-system",
    title: "نظام التصميم",
    load: () => import("../../pages/_system/design-system.page.js"),
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
    path: "/gl/cost-centers",
    title: "مراكز التكلفة",
    permission: "gl.view",
    load: () => import("../../pages/gl/cost-centers.page.js"),
  },
  {
    path: "/gl/periods",
    title: "الفترات المحاسبية",
    permission: "gl.period.manage",
    load: () => import("../../pages/gl/periods.page.js"),
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
    title: "إصدار فاتورة عميل",
    permission: "fin.customer.invoice",
    load: () => import("../../pages/fin/customer-invoice-new.page.js"),
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
  {
    path: "/fin/reconciliation",
    title: "مطابقة الحسابات الرقابية",
    permission: "fin.view",
    load: () => import("../../pages/fin/reconciliation.page.js"),
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
    load: () => import("../../pages/hr/employee-new.page.js"),
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
    path: "/inv/categories",
    title: "التصنيفات",
    permission: "inv.item.manage",
    load: () => import("../../pages/inv/categories.page.js"),
  },
  {
    path: "/inv/units",
    title: "وحدات القياس",
    permission: "inv.item.manage",
    load: () => import("../../pages/inv/units.page.js"),
  },
  {
    path: "/inv/warehouses",
    title: "المخازن",
    permission: "inv.view",
    load: () => import("../../pages/inv/warehouses.page.js"),
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
    path: "/inv/valuation",
    title: "تقييم المخزون",
    permission: "inv.valuation.view",
    load: () => import("../../pages/inv/valuation.page.js"),
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
    load: () => import("../../pages/reports/financial.page.js"),
  },
  {
    path: "/reports/receivables",
    title: "تقارير الذمم",
    permission: "reports.financial.view",
    load: () => import("../../pages/reports/receivables.page.js"),
  },
  {
    path: "/reports/hr",
    title: "تقارير الموارد البشرية",
    permission: "reports.hr.view",
    load: () => import("../../pages/reports/hr.page.js"),
  },
  {
    path: "/reports/inventory",
    title: "تقارير المخازن",
    permission: "reports.inventory.view",
    load: () => import("../../pages/reports/inventory.page.js"),
  },
  {
    path: "/reports/cost-centers",
    title: "تقارير مراكز التكلفة",
    permission: "reports.financial.view",
    load: () => import("../../pages/reports/cost-centers.page.js"),
  },
  {
    path: "/reports/exports",
    title: "مركز التصدير",
    permission: "reports.export",
    load: () => import("../../pages/reports/exports.page.js"),
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
    path: "/admin/permissions",
    title: "كتالوج الصلاحيات",
    permission: "admin.roles.manage",
    load: () => import("../../pages/admin/permissions.page.js"),
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
    title: "الربط المحاسبي",
    permission: "admin.settings.manage",
    load: () => import("../../pages/settings/posting-map.page.js"),
  },
  {
    path: "/settings/branches",
    title: "الفروع",
    permission: "admin.settings.view",
    load: () => import("../../pages/settings/branches.page.js"),
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
    path: "/gl/journal/:id",
    title: "تفاصيل قيد اليومية",
    permission: "gl.view",
    load: () => import("../../pages/gl/journal-detail.page.js"),
  },
  {
    path: "/gl/ledger/:accountId",
    title: "كشف حساب",
    permission: "gl.ledger.view",
    load: () => import("../../pages/gl/ledger.page.js"),
  },
  {
    path: "/fin/customers/:id",
    title: "كشف حساب عميل",
    permission: "fin.view",
    load: () => import("../../pages/fin/customer-detail.page.js"),
  },
  {
    path: "/fin/customer-invoices/:id",
    title: "تفاصيل فاتورة عميل",
    permission: "fin.view",
    load: () => import("../../pages/fin/customer-invoice-detail.page.js"),
  },
  {
    path: "/fin/suppliers/:id",
    title: "كشف حساب مورد",
    permission: "fin.view",
    load: () => import("../../pages/fin/supplier-detail.page.js"),
  },
  {
    path: "/fin/supplier-invoices/:id",
    title: "تفاصيل فاتورة مورد",
    permission: "fin.view",
    load: () => import("../../pages/fin/supplier-invoice-detail.page.js"),
  },
  {
    path: "/fin/cash-boxes/:id",
    title: "كشف خزينة",
    permission: "fin.view",
    load: () => import("../../pages/fin/cash-box-detail.page.js"),
  },
  {
    path: "/fin/banks/:id",
    title: "كشف حساب بنكي",
    permission: "fin.view",
    load: () => import("../../pages/fin/bank-detail.page.js"),
  },
  {
    path: "/fin/assets/:id",
    title: "ملف أصل ثابت",
    permission: "fin.asset.manage",
    load: () => import("../../pages/fin/asset-detail.page.js"),
  },
  {
    path: "/hr/employees/:id",
    title: "ملف موظف",
    permission: "hr.view",
    load: () => import("../../pages/hr/employee-detail.page.js"),
  },
  {
    path: "/hr/payroll/:id",
    title: "تفاصيل مسيّر رواتب",
    permission: "hr.payroll.view",
    load: () => import("../../pages/hr/payroll-detail.page.js"),
  },
  {
    path: "/hr/payslips/:id",
    title: "قسيمة راتب",
    permission: "hr.payroll.view",
    load: () => import("../../pages/hr/payslip-detail.page.js"),
  },
  {
    path: "/inv/items/:id",
    title: "ملف صنف",
    permission: "inv.view",
    load: () => import("../../pages/inv/item-detail.page.js"),
  },
  {
    path: "/inv/counts/:id",
    title: "تفاصيل جرد",
    permission: "inv.count.manage",
    load: () => import("../../pages/inv/count-detail.page.js"),
  },
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

  return [...IMPLEMENTED, ...DYNAMIC, ...planned];
}

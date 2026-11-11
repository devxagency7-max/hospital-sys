/**
 * خريطة التنقل.
 *
 * مصدر الحقيقة الوحيد للشريط الجانبي ومسار التنقل (breadcrumbs) وعنوان الشاشة.
 * إضافة شاشة = مدخل هنا + مسار في js/config/routes.js، ولا شيء ثالث.
 *
 * البنية تتبع الموديولات الأربعة للنظام: المحاسبة العامة، المحاسبة المالية،
 * الموارد البشرية، المخازن — ثم التقارير والإدارة والإعدادات.
 *
 * الترتيب داخل كل موديول يتبع تدفق العمل لا الأبجدية: التعريفات أولًا
 * (الدليل، الأصناف)، ثم المعاملات، ثم التقارير والإغلاق.
 */

export const navigation = [
  {
    key: "dashboard",
    label: "لوحة التحكم",
    icon: "dashboard",
    path: "/",
    permission: "dashboard.view",
  },

  /* ======================================================================
     الاستقبال وخدمة المرضى
     ====================================================================== */
  {
    key: "reception",
    label: "الاستقبال واستعلام المرضى",
    icon: "users",
    permission: "reception.view",
    children: [
      { label: "استعلام وسداد حسابات المرضى", path: "/reception", permission: "reception.view" },
      { label: "سندات قبض ودفعات الاستقبال", path: "/reception/receipts", permission: "reception.receipt" },
    ],
  },

  /* ======================================================================
     حسابات المرضى والخدمات الطبية
     ====================================================================== */
  {
    key: "patients",
    label: "حسابات المرضى والخدمات",
    icon: "hospital",
    permission: "patients.view",
    children: [
      { label: "سجل المرضى", path: "/patients", permission: "patients.view" },
      { label: "فواتير المرضى", path: "/patients/invoices", permission: "patients.view" },
      { label: "سندات القبض والدفعات", path: "/patients/receipts", permission: "patients.receipt" },
      { label: "الإقامة والعمليات والعناية", path: "/patients/admissions", permission: "patients.view" },
      { label: "دليل الخدمات الطبية", path: "/patients/services", permission: "patients.services.manage" },
    ],
  },

  /* ======================================================================
     1. المحاسبة العامة
     ====================================================================== */
  {
    key: "gl",
    label: "المحاسبة العامة",
    icon: "accounting",
    permission: "gl.view",
    children: [
      { label: "دليل الحسابات", path: "/gl/accounts", permission: "gl.view" },
      { label: "قيود اليومية", path: "/gl/journal", permission: "gl.view" },
      { label: "دفتر الأستاذ العام", path: "/gl/ledger", permission: "gl.ledger.view" },
      { label: "ميزان المراجعة", path: "/gl/trial-balance", permission: "gl.trialbalance.view" },
      { label: "مراكز التكلفة", path: "/gl/cost-centers", permission: "gl.view" },
      { label: "الفترات المحاسبية", path: "/gl/periods", permission: "gl.period.manage" },
      { label: "إغلاق السنة المالية", path: "/gl/year-end", permission: "gl.year.close" },
    ],
  },

  /* ======================================================================
     2. المحاسبة المالية
     ====================================================================== */
  {
    key: "fin",
    label: "المحاسبة المالية",
    icon: "billing",
    permission: "fin.view",
    children: [
      { label: "العملاء", path: "/fin/customers", permission: "fin.view" },
      { label: "فواتير العملاء", path: "/fin/customer-invoices", permission: "fin.view" },
      { label: "التحصيلات", path: "/fin/receipts", permission: "fin.view" },
      { label: "إشعارات الدائن", path: "/fin/credit-notes", permission: "fin.view" },

      { label: "الموردون", path: "/fin/suppliers", permission: "fin.view" },
      { label: "فواتير الموردين", path: "/fin/supplier-invoices", permission: "fin.view" },
      { label: "مدفوعات الموردين", path: "/fin/supplier-payments", permission: "fin.view" },

      { label: "الخزائن النقدية", path: "/fin/cash-boxes", permission: "fin.view" },
      { label: "الحركات النقدية", path: "/fin/cash-movements", permission: "fin.view" },
      { label: "التحويلات بين الحسابات", path: "/fin/transfers", permission: "fin.cashbox.transact" },
      { label: "الحسابات البنكية", path: "/fin/banks", permission: "fin.view" },
      { label: "المطابقة البنكية", path: "/fin/bank-reconciliation", permission: "fin.bank.reconcile" },

      { label: "الأصول الثابتة", path: "/fin/assets", permission: "fin.asset.manage" },
      { label: "الإهلاك الدوري", path: "/fin/depreciation", permission: "fin.asset.depreciate" },

      { label: "الضرائب والإقرارات", path: "/fin/taxes", permission: "fin.tax.manage" },
      { label: "القوائم المالية", path: "/fin/statements", permission: "fin.statements.view" },
    ],
  },

  /* ======================================================================
     3. الموارد البشرية
     ====================================================================== */
  {
    key: "hr",
    label: "الموارد البشرية",
    icon: "users",
    permission: "hr.view",
    children: [
      { label: "الموظفون", path: "/hr/employees", permission: "hr.view" },
      { label: "الهيكل التنظيمي", path: "/hr/org-chart", permission: "hr.view" },
      { label: "الوظائف والدرجات", path: "/hr/positions", permission: "hr.org.manage" },
      { label: "الورديات", path: "/hr/shifts", permission: "hr.org.manage" },

      { label: "الحضور والانصراف", path: "/hr/attendance", permission: "hr.attendance.view" },
      { label: "طلبات الإجازات", path: "/hr/leaves", permission: "hr.view" },
      { label: "أرصدة الإجازات", path: "/hr/leave-balances", permission: "hr.view" },

      { label: "سلف الموظفين", path: "/hr/advances", permission: "hr.advance.manage" },
      { label: "مسيّرات الرواتب", path: "/hr/payroll", permission: "hr.payroll.view" },
      { label: "قسائم الرواتب", path: "/hr/payslips", permission: "hr.payroll.view" },
      { label: "إعدادات الرواتب", path: "/hr/payroll-settings", permission: "hr.payroll.process" },
    ],
  },

  /* ======================================================================
     4. المخازن
     ====================================================================== */
  {
    key: "inv",
    label: "المخازن",
    icon: "inventory",
    permission: "inv.view",
    children: [
      { label: "الأصناف", path: "/inv/items", permission: "inv.view" },
      { label: "التصنيفات", path: "/inv/categories", permission: "inv.item.manage" },
      { label: "المخازن", path: "/inv/warehouses", permission: "inv.view" },

      { label: "أرصدة المخزون", path: "/inv/balances", permission: "inv.view" },
      { label: "حركات المخزون", path: "/inv/movements", permission: "inv.view" },
      { label: "إذن إضافة", path: "/inv/receipts", permission: "inv.receipt.create" },
      { label: "إذن صرف", path: "/inv/issues", permission: "inv.issue.create" },
      { label: "تحويل مخزني", path: "/inv/transfers", permission: "inv.transfer.create" },
      { label: "التسويات المخزنية", path: "/inv/adjustments", permission: "inv.view" },

      { label: "التشغيلات", path: "/inv/batches", permission: "inv.view" },
      { label: "تتبّع الصلاحية", path: "/inv/expiry", permission: "inv.view" },
      { label: "الجرد الفعلي", path: "/inv/counts", permission: "inv.count.manage" },
    ],
  },

  /* ======================================================================
     التقارير
     ====================================================================== */
  {
    key: "reports",
    label: "التقارير",
    icon: "reports",
    permission: "reports.view",
    children: [
      { label: "مركز التقارير", path: "/reports", permission: "reports.view" },
      { label: "التقارير المالية", path: "/reports/financial", permission: "reports.financial.view" },
      { label: "تقارير الذمم", path: "/reports/receivables", permission: "reports.financial.view" },
      { label: "تقارير الموارد البشرية", path: "/reports/hr", permission: "reports.hr.view" },
      { label: "تقارير المخازن", path: "/reports/inventory", permission: "reports.inventory.view" },
    ],
  },

  /* ======================================================================
     الإدارة والنظام
     ====================================================================== */
  {
    key: "admin",
    label: "المستخدمون والصلاحيات",
    icon: "shield",
    permission: "admin.users.view",
    children: [
      { label: "المستخدمون", path: "/admin/users", permission: "admin.users.view" },
      { label: "الأدوار", path: "/admin/roles", permission: "admin.roles.manage" },
    ],
  },

  {
    key: "audit",
    label: "سجل التدقيق",
    icon: "audit",
    path: "/admin/audit",
    permission: "admin.audit.view",
  },

  {
    key: "settings",
    label: "إعدادات النظام",
    icon: "settings",
    permission: "admin.settings.view",
    children: [
      { label: "بيانات المنشأة", path: "/settings/company", permission: "admin.settings.view" },
      { label: "الربط المحاسبي", path: "/settings/posting-map", permission: "admin.settings.manage" },
      { label: "تفضيلات النظام", path: "/settings/preferences", permission: "admin.settings.manage" },
      { label: "تفضيلات الإشعارات", path: "/settings/notifications", permission: "admin.settings.view" },
      { label: "تخصيص المظهر", path: "/settings/appearance", permission: "admin.settings.view" },
    ],
  },
];

/** كل الشاشات في قائمة مسطّحة — يبنيها الراوتر. */
export function flatScreens() {
  const out = [];

  for (const entry of navigation) {
    if (entry.path) {
      out.push({
        path: entry.path,
        label: entry.label,
        permission: entry.permission,
        module: entry.key,
        moduleLabel: entry.label,
      });
    }

    for (const child of entry.children ?? []) {
      out.push({
        ...child,
        module: entry.key,
        moduleLabel: entry.label,
      });
    }
  }

  return out;
}

/** يجد مدخل التنقل المطابق لمسار — لتحديد العنصر النشط وبناء المسار. */
export function findScreen(path) {
  return flatScreens().find((screen) => screen.path === path);
}

/**
 * خريطة التنقل.
 *
 * مصدر الحقيقة الوحيد للشريط الجانبي ومسار التنقل (breadcrumbs) وعنوان الشاشة.
 * إضافة شاشة = مدخل هنا + مسار في js/config/routes.js، ولا شيء ثالث.
 *
 * `phase` هي المرحلة من docs/08-IMPLEMENTATION-PLAN.md التي تُنفَّذ فيها الشاشة.
 * الشاشات غير المنفَّذة بعد تُعرض كصفحة «مخطَّطة» صريحة لا كرابط مكسور.
 */

export const navigation = [
  {
    key: "dashboard",
    label: "لوحة التحكم",
    icon: "dashboard",
    path: "/",
    permission: "dashboard.view",
    phase: 1,
  },

  {
    key: "patients",
    label: "المرضى",
    icon: "patients",
    permission: "patients.view",
    children: [
      { label: "قائمة المرضى", path: "/patients", permission: "patients.view", phase: 1 },
      { label: "إضافة مريض", path: "/patients/new", permission: "patients.create", phase: 1 },
      { label: "حسابات المرضى", path: "/patients/accounts", permission: "patients.account.view", phase: 1 },
      { label: "مستندات المرضى", path: "/patients/documents", permission: "patients.view", phase: 1 },
    ],
  },

  {
    key: "appointments",
    label: "المواعيد والعيادات",
    icon: "calendar",
    permission: "appointments.view",
    children: [
      { label: "تقويم المواعيد", path: "/appointments/calendar", permission: "appointments.view", phase: 1 },
      { label: "قائمة المواعيد", path: "/appointments", permission: "appointments.view", phase: 1 },
      { label: "حجز موعد", path: "/appointments/new", permission: "appointments.create", phase: 1 },
      { label: "جدول الأطباء", path: "/appointments/doctors", permission: "appointments.view", phase: 1 },
      { label: "جدول العيادات", path: "/appointments/clinics", permission: "appointments.view", phase: 1 },
      { label: "قائمة الانتظار", path: "/appointments/queue", permission: "appointments.view", phase: 1 },
    ],
  },

  {
    key: "billing",
    label: "الفواتير",
    icon: "billing",
    permission: "billing.view",
    children: [
      { label: "الفواتير", path: "/billing/invoices", permission: "billing.view", phase: 1 },
      { label: "إنشاء فاتورة", path: "/billing/invoices/new", permission: "billing.invoice.create", phase: 1 },
      { label: "المدفوعات", path: "/billing/payments", permission: "billing.view", phase: 1 },
      { label: "المرتجعات", path: "/billing/refunds", permission: "billing.refund.create", phase: 1 },
      { label: "الخصومات", path: "/billing/discounts", permission: "billing.discount.approve", phase: 1 },
      { label: "الأرصدة المستحقة", path: "/billing/outstanding", permission: "billing.view", phase: 1 },
      { label: "كشف حساب مريض", path: "/billing/statements", permission: "billing.view", phase: 1 },
      { label: "الفاتورة الإلكترونية", path: "/billing/eta", permission: "billing.view", phase: 1 },
    ],
  },

  {
    key: "accounting",
    label: "المحاسبة",
    icon: "accounting",
    permission: "accounting.view",
    children: [
      { label: "شجرة الحسابات", path: "/accounting/accounts", permission: "accounting.view", phase: 2 },
      { label: "قيود اليومية", path: "/accounting/journal", permission: "accounting.view", phase: 2 },
      { label: "الصناديق النقدية", path: "/accounting/cash", permission: "accounting.view", phase: 2 },
      { label: "الحسابات البنكية", path: "/accounting/banks", permission: "accounting.view", phase: 2 },
      { label: "العملاء (مدينون)", path: "/accounting/receivables", permission: "accounting.view", phase: 2 },
      { label: "الموردون (دائنون)", path: "/accounting/payables", permission: "accounting.view", phase: 2 },
      { label: "مراكز التكلفة", path: "/accounting/cost-centers", permission: "accounting.view", phase: 2 },
      { label: "الفترات المحاسبية", path: "/accounting/periods", permission: "accounting.period.close", phase: 2 },
      { label: "ميزان المراجعة", path: "/accounting/trial-balance", permission: "accounting.view", phase: 2 },
      { label: "القوائم المالية", path: "/accounting/statements", permission: "accounting.view", phase: 2 },
    ],
  },

  {
    key: "inventory",
    label: "المخازن",
    icon: "inventory",
    permission: "inventory.view",
    children: [
      { label: "الأصناف", path: "/inventory/items", permission: "inventory.view", phase: 3 },
      { label: "التصنيفات", path: "/inventory/categories", permission: "inventory.item.manage", phase: 3 },
      { label: "وحدات القياس", path: "/inventory/units", permission: "inventory.item.manage", phase: 3 },
      { label: "المخازن", path: "/inventory/warehouses", permission: "inventory.view", phase: 3 },
      { label: "أرصدة المخزون", path: "/inventory/balances", permission: "inventory.view", phase: 3 },
      { label: "حركات المخزون", path: "/inventory/movements", permission: "inventory.view", phase: 3 },
      { label: "تحويل مخزني", path: "/inventory/transfers", permission: "inventory.movement.create", phase: 3 },
      { label: "تسوية مخزنية", path: "/inventory/adjustments", permission: "inventory.movement.create", phase: 3 },
      { label: "التشغيلات", path: "/inventory/batches", permission: "inventory.view", phase: 3 },
      { label: "تتبع الصلاحية", path: "/inventory/expiry", permission: "inventory.view", phase: 3 },
      { label: "تقييم المخزون", path: "/inventory/valuation", permission: "inventory.view", phase: 3 },
    ],
  },

  {
    key: "purchasing",
    label: "المشتريات",
    icon: "purchasing",
    permission: "purchasing.view",
    children: [
      { label: "طلبات الشراء", path: "/purchasing/requests", permission: "purchasing.view", phase: 3 },
      { label: "أوامر الشراء", path: "/purchasing/orders", permission: "purchasing.view", phase: 3 },
      { label: "استلام الأصناف", path: "/purchasing/receiving", permission: "purchasing.receive", phase: 3 },
      { label: "فواتير الموردين", path: "/purchasing/invoices", permission: "purchasing.view", phase: 3 },
      { label: "مرتجعات الموردين", path: "/purchasing/returns", permission: "purchasing.view", phase: 3 },
      { label: "الموردون", path: "/purchasing/suppliers", permission: "purchasing.view", phase: 3 },
      { label: "حسابات الموردين", path: "/purchasing/supplier-accounts", permission: "purchasing.view", phase: 3 },
    ],
  },

  {
    key: "pharmacy",
    label: "الصيدلية",
    icon: "pharmacy",
    permission: "pharmacy.view",
    children: [
      { label: "الروشتات", path: "/pharmacy/prescriptions", permission: "pharmacy.view", phase: 3 },
      { label: "صرف الأدوية", path: "/pharmacy/dispensing", permission: "pharmacy.dispense", phase: 3 },
      { label: "مخزون الصيدلية", path: "/pharmacy/stock", permission: "pharmacy.view", phase: 3 },
      { label: "تشغيلات الأدوية", path: "/pharmacy/batches", permission: "pharmacy.view", phase: 3 },
      { label: "صلاحية الأدوية", path: "/pharmacy/expiry", permission: "pharmacy.view", phase: 3 },
      { label: "حركات الصيدلية", path: "/pharmacy/transactions", permission: "pharmacy.view", phase: 3 },
    ],
  },

  {
    key: "laboratory",
    label: "المختبر",
    icon: "laboratory",
    permission: "laboratory.view",
    children: [
      { label: "طلبات التحاليل", path: "/laboratory/requests", permission: "laboratory.view", phase: 4 },
      { label: "سحب العيّنات", path: "/laboratory/samples", permission: "laboratory.sample.collect", phase: 4 },
      { label: "نتائج معلّقة", path: "/laboratory/pending", permission: "laboratory.view", phase: 4 },
      { label: "النتائج", path: "/laboratory/results", permission: "laboratory.view", phase: 4 },
    ],
  },

  {
    key: "radiology",
    label: "الأشعة",
    icon: "radiology",
    permission: "radiology.view",
    children: [
      { label: "طلبات الأشعة", path: "/radiology/requests", permission: "radiology.view", phase: 4 },
      { label: "جدولة الفحوصات", path: "/radiology/scheduling", permission: "radiology.view", phase: 4 },
      { label: "تقارير الأشعة", path: "/radiology/reports", permission: "radiology.view", phase: 4 },
      { label: "المرفقات", path: "/radiology/attachments", permission: "radiology.view", phase: 4 },
    ],
  },

  {
    key: "reports",
    label: "التقارير",
    icon: "reports",
    permission: "reports.view",
    children: [
      { label: "مركز التقارير", path: "/reports", permission: "reports.view", phase: 5 },
      { label: "تقارير المرضى", path: "/reports/patients", permission: "reports.view", phase: 5 },
      { label: "التقارير المالية", path: "/reports/financial", permission: "reports.financial.view", phase: 5 },
      { label: "تقارير المخزون", path: "/reports/inventory", permission: "reports.view", phase: 5 },
      { label: "تقارير المشتريات", path: "/reports/purchasing", permission: "reports.view", phase: 5 },
      { label: "تقارير الإيرادات", path: "/reports/revenue", permission: "reports.financial.view", phase: 5 },
      { label: "تقارير المديونيات", path: "/reports/receivables", permission: "reports.financial.view", phase: 5 },
      { label: "مركز التصدير", path: "/reports/exports", permission: "reports.export", phase: 5 },
    ],
  },

  {
    key: "users",
    label: "المستخدمون والصلاحيات",
    icon: "users",
    permission: "users.view",
    children: [
      { label: "المستخدمون", path: "/users", permission: "users.view", phase: 6 },
      { label: "الأدوار", path: "/users/roles", permission: "roles.manage", phase: 6 },
      { label: "الصلاحيات", path: "/users/permissions", permission: "roles.manage", phase: 6 },
    ],
  },

  {
    key: "audit",
    label: "سجل التدقيق",
    icon: "audit",
    path: "/audit",
    permission: "audit.view",
    phase: 6,
  },

  {
    key: "settings",
    label: "الإعدادات",
    icon: "settings",
    permission: "settings.view",
    children: [
      { label: "بيانات المستشفى", path: "/settings/hospital", permission: "settings.view", phase: 6 },
      { label: "الأقسام", path: "/settings/departments", permission: "settings.manage", phase: 6 },
      { label: "العيادات", path: "/settings/clinics", permission: "settings.manage", phase: 6 },
      { label: "الخدمات والأسعار", path: "/settings/services", permission: "settings.manage", phase: 6 },
      { label: "الضرائب", path: "/settings/taxes", permission: "settings.manage", phase: 6 },
      { label: "طرق الدفع", path: "/settings/payment-methods", permission: "settings.manage", phase: 6 },
      { label: "تفضيلات النظام", path: "/settings/preferences", permission: "settings.manage", phase: 6 },
      { label: "تفضيلات الإشعارات", path: "/settings/notifications", permission: "settings.view", phase: 6 },
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
        phase: entry.phase,
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

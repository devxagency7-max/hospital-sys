/**
 * جدول المسارات الشامل لـ Hospital ERP (مستشفى النيل التخصصي).
 *
 * جميع شاشات النظام منفذة وتعتمد معمارية الـ Glassmorphism والتفاعل الحي.
 */

import { flatScreens } from "./navigation.js";

/** الشاشات المنفَّذة فعلًا. */
const IMPLEMENTED = [
  // لوحة التحكم والنظام
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

  // المرضى
  {
    path: "/patients",
    title: "قائمة المرضى",
    permission: "patients.view",
    load: () => import("../../pages/patients/patients-list.page.js"),
  },
  {
    path: "/patients/new",
    title: "إضافة مريض",
    permission: "patients.create",
    load: () => import("../../pages/patients/new-patient.page.js"),
  },
  {
    path: "/patients/accounts",
    title: "حسابات المرضى",
    permission: "patients.account.view",
    load: () => import("../../pages/patients/patient-accounts.page.js"),
  },
  {
    path: "/patients/documents",
    title: "مستندات المرضى",
    permission: "patients.view",
    load: () => import("../../pages/patients/patient-documents.page.js"),
  },
  {
    path: "/patients/case-report",
    title: "تقرير ملف وبحث الحالة",
    permission: "patients.view",
    load: () => import("../../pages/patients/case-report.page.js"),
  },
  {
    path: "/patients/report",
    title: "تقرير ملف وبحث الحالة",
    permission: "patients.view",
    load: () => import("../../pages/patients/case-report.page.js"),
  },

  // المواعيد والعيادات
  {
    path: "/appointments/calendar",
    title: "تقويم المواعيد",
    permission: "appointments.view",
    load: () => import("../../pages/appointments/calendar.page.js"),
  },
  {
    path: "/appointments",
    title: "قائمة المواعيد",
    permission: "appointments.view",
    load: () => import("../../pages/appointments/appointments-list.page.js"),
  },
  {
    path: "/appointments/new",
    title: "حجز موعد",
    permission: "appointments.create",
    load: () => import("../../pages/appointments/new-appointment.page.js"),
  },
  {
    path: "/appointments/doctors",
    title: "جدول الأطباء",
    permission: "appointments.view",
    load: () => import("../../pages/appointments/doctors-schedule.page.js"),
  },
  {
    path: "/appointments/clinics",
    title: "جدول العيادات",
    permission: "appointments.view",
    load: () => import("../../pages/appointments/clinics-schedule.page.js"),
  },
  {
    path: "/appointments/queue",
    title: "قائمة الانتظار",
    permission: "appointments.view",
    load: () => import("../../pages/appointments/queue.page.js"),
  },

  // الفواتير
  {
    path: "/billing/invoices",
    title: "الفواتير",
    permission: "billing.view",
    load: () => import("../../pages/billing/invoices-list.page.js"),
  },
  {
    path: "/billing/invoices/new",
    title: "إنشاء فاتورة",
    permission: "billing.invoice.create",
    load: () => import("../../pages/billing/new-invoice.page.js"),
  },
  {
    path: "/billing/payments",
    title: "المدفوعات",
    permission: "billing.view",
    load: () => import("../../pages/billing/payments-list.page.js"),
  },
  {
    path: "/billing/refunds",
    title: "المرتجعات",
    permission: "billing.refund.create",
    load: () => import("../../pages/billing/refunds-list.page.js"),
  },
  {
    path: "/billing/discounts",
    title: "الخصومات",
    permission: "billing.discount.approve",
    load: () => import("../../pages/billing/discounts-list.page.js"),
  },
  {
    path: "/billing/outstanding",
    title: "الأرصدة المستحقة",
    permission: "billing.view",
    load: () => import("../../pages/billing/outstanding.page.js"),
  },
  {
    path: "/billing/statements",
    title: "كشف حساب مريض",
    permission: "billing.view",
    load: () => import("../../pages/billing/statements.page.js"),
  },
  {
    path: "/billing/eta",
    title: "الفاتورة الإلكترونية",
    permission: "billing.view",
    load: () => import("../../pages/billing/eta-invoices.page.js"),
  },

  // المحاسبة المالية
  {
    path: "/accounting/accounts",
    title: "شجرة الحسابات",
    permission: "accounting.view",
    load: () => import("../../pages/accounting/accounts-tree.page.js"),
  },
  {
    path: "/accounting/journal",
    title: "قيود اليومية",
    permission: "accounting.view",
    load: () => import("../../pages/accounting/journal-entries.page.js"),
  },
  {
    path: "/accounting/cash",
    title: "الصناديق النقدية",
    permission: "accounting.view",
    load: () => import("../../pages/accounting/cash-boxes.page.js"),
  },
  {
    path: "/accounting/banks",
    title: "الحسابات البنكية",
    permission: "accounting.view",
    load: () => import("../../pages/accounting/bank-accounts.page.js"),
  },
  {
    path: "/accounting/receivables",
    title: "العملاء (مدينون)",
    permission: "accounting.view",
    load: () => import("../../pages/accounting/receivables.page.js"),
  },
  {
    path: "/accounting/payables",
    title: "الموردون (دائنون)",
    permission: "accounting.view",
    load: () => import("../../pages/accounting/payables.page.js"),
  },
  {
    path: "/accounting/cost-centers",
    title: "مراكز التكلفة",
    permission: "accounting.view",
    load: () => import("../../pages/accounting/cost-centers.page.js"),
  },
  {
    path: "/accounting/periods",
    title: "الفترات المحاسبية",
    permission: "accounting.period.close",
    load: () => import("../../pages/accounting/periods.page.js"),
  },
  {
    path: "/accounting/trial-balance",
    title: "ميزان المراجعة",
    permission: "accounting.view",
    load: () => import("../../pages/accounting/trial-balance.page.js"),
  },
  {
    path: "/accounting/statements",
    title: "القوائم المالية",
    permission: "accounting.view",
    load: () => import("../../pages/accounting/financial-statements.page.js"),
  },

  // المخازن
  {
    path: "/inventory/items",
    title: "الأصناف",
    permission: "inventory.view",
    load: () => import("../../pages/inventory/items-list.page.js"),
  },
  {
    path: "/inventory/categories",
    title: "التصنيفات",
    permission: "inventory.item.manage",
    load: () => import("../../pages/inventory/categories.page.js"),
  },
  {
    path: "/inventory/units",
    title: "وحدات القياس",
    permission: "inventory.item.manage",
    load: () => import("../../pages/inventory/units.page.js"),
  },
  {
    path: "/inventory/warehouses",
    title: "المخازن",
    permission: "inventory.view",
    load: () => import("../../pages/inventory/warehouses.page.js"),
  },
  {
    path: "/inventory/balances",
    title: "أرصدة المخزون",
    permission: "inventory.view",
    load: () => import("../../pages/inventory/balances.page.js"),
  },
  {
    path: "/inventory/movements",
    title: "حركات المخزون",
    permission: "inventory.view",
    load: () => import("../../pages/inventory/movements.page.js"),
  },
  {
    path: "/inventory/transfers",
    title: "تحويل مخزني",
    permission: "inventory.movement.create",
    load: () => import("../../pages/inventory/transfers.page.js"),
  },
  {
    path: "/inventory/adjustments",
    title: "تسوية مخزنية",
    permission: "inventory.movement.create",
    load: () => import("../../pages/inventory/adjustments.page.js"),
  },
  {
    path: "/inventory/batches",
    title: "التشغيلات",
    permission: "inventory.view",
    load: () => import("../../pages/inventory/batches.page.js"),
  },
  {
    path: "/inventory/expiry",
    title: "تتبع الصلاحية",
    permission: "inventory.view",
    load: () => import("../../pages/inventory/expiry.page.js"),
  },
  {
    path: "/inventory/valuation",
    title: "تقييم المخزون",
    permission: "inventory.view",
    load: () => import("../../pages/inventory/valuation.page.js"),
  },

  // المشتريات
  {
    path: "/purchasing/requests",
    title: "طلبات الشراء",
    permission: "purchasing.view",
    load: () => import("../../pages/purchasing/requests.page.js"),
  },
  {
    path: "/purchasing/orders",
    title: "أوامر الشراء",
    permission: "purchasing.view",
    load: () => import("../../pages/purchasing/orders.page.js"),
  },
  {
    path: "/purchasing/receiving",
    title: "استلام الأصناف",
    permission: "purchasing.receive",
    load: () => import("../../pages/purchasing/receiving.page.js"),
  },
  {
    path: "/purchasing/invoices",
    title: "فواتير الموردين",
    permission: "purchasing.view",
    load: () => import("../../pages/purchasing/invoices.page.js"),
  },
  {
    path: "/purchasing/returns",
    title: "مرتجعات الموردين",
    permission: "purchasing.view",
    load: () => import("../../pages/purchasing/returns.page.js"),
  },
  {
    path: "/purchasing/suppliers",
    title: "الموردون",
    permission: "purchasing.view",
    load: () => import("../../pages/purchasing/suppliers.page.js"),
  },
  {
    path: "/purchasing/supplier-accounts",
    title: "حسابات الموردين",
    permission: "purchasing.view",
    load: () => import("../../pages/purchasing/supplier-accounts.page.js"),
  },

  // الصيدلية
  {
    path: "/pharmacy/prescriptions",
    title: "الروشتات",
    permission: "pharmacy.view",
    load: () => import("../../pages/pharmacy/prescriptions.page.js"),
  },
  {
    path: "/pharmacy/dispensing",
    title: "صرف الأدوية",
    permission: "pharmacy.dispense",
    load: () => import("../../pages/pharmacy/dispensing.page.js"),
  },
  {
    path: "/pharmacy/stock",
    title: "مخزون الصيدلية",
    permission: "pharmacy.view",
    load: () => import("../../pages/pharmacy/pharmacy-stock.page.js"),
  },
  {
    path: "/pharmacy/batches",
    title: "تشغيلات الأدوية",
    permission: "pharmacy.view",
    load: () => import("../../pages/pharmacy/pharmacy-batches.page.js"),
  },
  {
    path: "/pharmacy/expiry",
    title: "صلاحية الأدوية",
    permission: "pharmacy.view",
    load: () => import("../../pages/pharmacy/pharmacy-expiry.page.js"),
  },
  {
    path: "/pharmacy/transactions",
    title: "حركات الصيدلية",
    permission: "pharmacy.view",
    load: () => import("../../pages/pharmacy/pharmacy-transactions.page.js"),
  },

  // المختبر
  {
    path: "/laboratory/requests",
    title: "طلبات التحاليل",
    permission: "laboratory.view",
    load: () => import("../../pages/laboratory/requests.page.js"),
  },
  {
    path: "/laboratory/samples",
    title: "سحب العيّنات",
    permission: "laboratory.sample.collect",
    load: () => import("../../pages/laboratory/samples.page.js"),
  },
  {
    path: "/laboratory/pending",
    title: "نتائج معلّقة",
    permission: "laboratory.view",
    load: () => import("../../pages/laboratory/pending.page.js"),
  },
  {
    path: "/laboratory/results",
    title: "النتائج",
    permission: "laboratory.view",
    load: () => import("../../pages/laboratory/results.page.js"),
  },

  // الأشعة
  {
    path: "/radiology/requests",
    title: "طلبات الأشعة",
    permission: "radiology.view",
    load: () => import("../../pages/radiology/requests.page.js"),
  },
  {
    path: "/radiology/scheduling",
    title: "جدولة الفحوصات",
    permission: "radiology.view",
    load: () => import("../../pages/radiology/scheduling.page.js"),
  },
  {
    path: "/radiology/reports",
    title: "تقارير الأشعة",
    permission: "radiology.view",
    load: () => import("../../pages/radiology/reports.page.js"),
  },
  {
    path: "/radiology/attachments",
    title: "المرفقات",
    permission: "radiology.view",
    load: () => import("../../pages/radiology/attachments.page.js"),
  },

  // التقارير
  {
    path: "/reports",
    title: "مركز التقارير",
    permission: "reports.view",
    load: () => import("../../pages/reports/reports-hub.page.js"),
  },
  {
    path: "/reports/patients",
    title: "تقارير المرضى",
    permission: "reports.view",
    load: () => import("../../pages/reports/patient-reports.page.js"),
  },
  {
    path: "/reports/financial",
    title: "التقارير المالية",
    permission: "reports.financial.view",
    load: () => import("../../pages/reports/financial-reports.page.js"),
  },
  {
    path: "/reports/inventory",
    title: "تقارير المخزون",
    permission: "reports.view",
    load: () => import("../../pages/reports/inventory-reports.page.js"),
  },
  {
    path: "/reports/purchasing",
    title: "تقارير المشتريات",
    permission: "reports.view",
    load: () => import("../../pages/reports/purchasing-reports.page.js"),
  },
  {
    path: "/reports/revenue",
    title: "تقارير الإيرادات",
    permission: "reports.financial.view",
    load: () => import("../../pages/reports/revenue-reports.page.js"),
  },
  {
    path: "/reports/receivables",
    title: "تقارير المديونيات",
    permission: "reports.financial.view",
    load: () => import("../../pages/reports/receivables-reports.page.js"),
  },
  {
    path: "/reports/exports",
    title: "مركز التصدير",
    permission: "reports.export",
    load: () => import("../../pages/reports/exports-center.page.js"),
  },

  // المستخدمون وسجل التدقيق
  {
    path: "/users",
    title: "المستخدمون",
    permission: "users.view",
    load: () => import("../../pages/users/users-list.page.js"),
  },
  {
    path: "/users/roles",
    title: "الأدوار",
    permission: "roles.manage",
    load: () => import("../../pages/users/roles-list.page.js"),
  },
  {
    path: "/users/permissions",
    title: "الصلاحيات",
    permission: "roles.manage",
    load: () => import("../../pages/users/permissions-list.page.js"),
  },
  {
    path: "/audit",
    title: "سجل التدقيق",
    permission: "audit.view",
    load: () => import("../../pages/audit/audit-log.page.js"),
  },

  // الإعدادات
  {
    path: "/settings/appearance",
    title: "تخصيص المظهر",
    permission: "settings.manage",
    load: () => import("../../pages/settings/appearance.page.js"),
  },
  {
    path: "/settings/hospital",
    title: "بيانات المستشفى",
    permission: "settings.view",
    load: () => import("../../pages/settings/hospital-info.page.js"),
  },
  {
    path: "/settings/departments",
    title: "الأقسام",
    permission: "settings.manage",
    load: () => import("../../pages/settings/departments.page.js"),
  },
  {
    path: "/settings/clinics",
    title: "العيادات",
    permission: "settings.manage",
    load: () => import("../../pages/settings/clinics.page.js"),
  },
  {
    path: "/settings/services",
    title: "الخدمات والأسعار",
    permission: "settings.manage",
    load: () => import("../../pages/settings/services.page.js"),
  },
  {
    path: "/settings/taxes",
    title: "الضرائب",
    permission: "settings.manage",
    load: () => import("../../pages/settings/taxes.page.js"),
  },
  {
    path: "/settings/payment-methods",
    title: "طرق الدفع",
    permission: "settings.manage",
    load: () => import("../../pages/settings/payment-methods.page.js"),
  },
  {
    path: "/settings/preferences",
    title: "تفضيلات النظام",
    permission: "settings.manage",
    load: () => import("../../pages/settings/preferences.page.js"),
  },
  {
    path: "/settings/notifications",
    title: "تفضيلات الإشعارات",
    permission: "settings.view",
    load: () => import("../../pages/settings/notifications.page.js"),
  },
];

/** مسارات ديناميكية (بمعاملات) تُسجَّل يدويًا — لا تظهر في الشريط الجانبي. */
const DYNAMIC = [];

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

/**
 * بيانات الإدارة والنظام التجريبية:
 * المستخدمون والأدوار، سجل التدقيق، بيانات المنشأة، والتفضيلات.
 */

import { createRandom, REFERENCE_DATE, addDays } from "./seed.js";
import { ROLES, PERMISSIONS } from "../core/permissions.js";
import { SOURCE_LABELS } from "../domain/posting.js";

const random = createRandom(129_476);
const TODAY = REFERENCE_DATE.toISOString().slice(0, 10);

/* ============================================================================
   1. بيانات المنشأة
   ============================================================================ */

export const companyInfo = {
  name: "مستشفى الحياة التخصصي",
  nameEn: "Al-Hayah Specialized Hospital",
  legalForm: "شركة مساهمة مصرية — منشأة طبية خاصة",
  commercialRegister: "128470",
  taxId: "204-851-963",
  taxOffice: "مأمورية ضرائب بني سويف",
  vatRegistration: "VAT-204851963",
  industrialRegister: "LIC-77410",
  establishedAt: "2014-03-18",
  capital: 12_000_000,

  address: "بني سويف — شارع سعد زغلول، مبنى المستشفى الرئيسي",
  governorate: "بني سويف",
  postalCode: "62511",
  phone: "0822401234",
  fax: "0822401235",
  email: "info@alhayah-hospital.example",
  website: "www.alhayah-hospital.example",

  logoUrl: "assets/logo.png",
  currency: "EGP",
  currencyLabel: "ج.م",
  fiscalYearStartMonth: 1,
  defaultLanguage: "ar",
  timeZone: "Africa/Cairo",

  /** يظهر في تذييل كل تقرير مطبوع. */
  reportFooter: "مستشفى الحياة التخصصي — س.ت 128470 — ب.ض 204-851-963",
};

/* ============================================================================
   2. المستخدمون
   ============================================================================ */

/**
 * المستخدمون مرتبطون بموظفين: حساب النظام ليس كيانًا مستقلًا عن الموظف،
 * بل صلاحية دخول تُمنح له. `employeeId` هو الرابط، وإلغاء خدمة الموظف يجب
 * أن يُعطّل حسابه — قاعدة يفرضها الباك-إند لاحقًا.
 */
const USER_SEEDS = [
  { id: 1, name: "عبدالله محمد فتحي", username: "a.fathy", role: "admin", employeeId: null, departmentId: 8, jobTitle: "مدير النظام" },
  { id: 2, name: "محمود سيد الغزالي", username: "m.ghazaly", role: "admin", employeeId: 1, departmentId: 1, jobTitle: "المدير العام" },
  { id: 3, name: "هشام عمر البحيري", username: "h.behairy", role: "fin", employeeId: 2, departmentId: 2, jobTitle: "المدير المالي" },
  { id: 4, name: "هالة إبراهيم منصور", username: "h.mansour", role: "gl", employeeId: 3, departmentId: 2, jobTitle: "رئيس الحسابات" },
  { id: 5, name: "كريم أحمد فتحي", username: "k.fathy", role: "fin", employeeId: 5, departmentId: 2, jobTitle: "محاسب أول" },
  { id: 6, name: "مصطفى وليد زكي", username: "m.zaki", role: "gl", employeeId: 6, departmentId: 2, jobTitle: "محاسب" },
  { id: 7, name: "سامح محمد زكي", username: "s.zaki", role: "fin", employeeId: 9, departmentId: 2, jobTitle: "أمين الخزينة" },
  { id: 8, name: "إيمان خالد القاضي", username: "e.kady", role: "hr", employeeId: 11, departmentId: 3, jobTitle: "مدير الموارد البشرية" },
  { id: 9, name: "دعاء سامح شلبي", username: "d.shalaby", role: "hr", employeeId: 12, departmentId: 3, jobTitle: "أخصائي موارد بشرية" },
  { id: 10, name: "نادر طارق سليمان", username: "n.soliman", role: "inv", employeeId: 28, departmentId: 6, jobTitle: "مدير المخازن" },
  { id: 11, name: "وليد حسن البحيري", username: "w.behairy", role: "inv", employeeId: 29, departmentId: 6, jobTitle: "أمين مخزن" },
  { id: 12, name: "ماجد فادي عطية", username: "m.atya", role: "inv", employeeId: 30, departmentId: 6, jobTitle: "أمين مخزن — الصيدلية المركزية" },
  { id: 13, name: "نادر إسلام الفقي", username: "n.fakey", role: "gl", employeeId: null, departmentId: 1, jobTitle: "مراجع داخلي" },
  { id: 14, name: "رامي عادل خليل", username: "r.khalil", role: "fin", employeeId: 21, departmentId: 4, jobTitle: "مسؤول تعاقدات ومطالبات أول" },
  { id: 15, name: "شيماء باسم النجار", username: "s.naggar", role: "hr", employeeId: 13, departmentId: 3, jobTitle: "أخصائي موارد بشرية" },
];

export const users = USER_SEEDS.map((seed, index) => {
  /* آخر دخول: المستخدمون النشطون دخلوا حديثًا، والمعطَّلون منذ شهور. */
  const inactive = index === USER_SEEDS.length - 1;

  return {
    ...seed,
    code: `USR-${String(seed.id).padStart(3, "0")}`,
    email: `${seed.username}@alhayah-hospital.example`,
    phone: random.phone(),
    roleName: ROLES[seed.role]?.label ?? seed.role,
    /** صلاحيات إضافية فوق الدور — استثناء مُعلَن لا تعديل صامت على الدور. */
    extraPermissions: seed.id === 5 ? ["gl.journal.approve"] : [],
    twoFactorEnabled: ["admin", "fin"].includes(seed.role),
    mustChangePassword: false,
    lastLoginAt: inactive
      ? "2026-07-14T09:12:00+03:00"
      : `${addDays(TODAY, -random.int(0, 4))}T${random.time(7, 19)}:00+03:00`,
    lastLoginIp: `10.0.${random.int(1, 6)}.${random.int(10, 240)}`,
    failedAttempts: 0,
    createdAt: random.date(1400, 120),
    createdBy: "مدير النظام",
    status: inactive ? "inactive" : "active",
    notes: inactive ? "مُعطَّل — ترك العمل." : null,
  };
});

/**
 * وصف كل دور — يظهر في شاشة إدارة الأدوار.
 *
 * مُعرَّف **قبل** `roles` لا بعده: `roles` يقرؤه في مُهيّئ مصفوفته، وهو
 * استدعاء متزامن يُنفَّذ لحظة تقييم الوحدة. تعريفه بعدها يُوقع القراءة في
 * «المنطقة الميتة زمنيًا» للثابت فيرمي ReferenceError عند أول استيراد.
 */
const DESCRIPTIONS = {
  admin: "وصول كامل لكل الموديولات والإعدادات. يُمنح لمسؤول النظام فقط.",
  gl: "المحاسبة العامة كاملة: الدليل والقيود والترحيل والفترات والإغلاق، مع التقارير المالية.",
  fin: "المحاسبة المالية كاملة: العملاء والموردون والخزائن والبنوك والأصول والضرائب، مع التقارير المالية.",
  hr: "الموارد البشرية كاملة: الموظفون والحضور والإجازات والرواتب، مع تقارير الموارد البشرية.",
  inv: "المخازن كاملة: الأصناف والحركات والجرد والتقييم، مع تقارير المخازن.",
};


/** الأدوار بصيغة صفوف جدول — مع عدد الصلاحيات الفعلي وعدد مستخدميها. */
export const roles = Object.entries(ROLES).map(([key, role], index) => {
  const expanded = role.permissions.includes("*")
    ? Object.keys(PERMISSIONS)
    : Object.keys(PERMISSIONS).filter((permission) =>
        role.permissions.some(
          (granted) =>
            granted === permission ||
            (granted.endsWith(".*") && permission.startsWith(granted.slice(0, -1))),
        ),
      );

  return {
    id: index + 1,
    code: key,
    name: role.label,
    description: DESCRIPTIONS[key] ?? null,
    permissions: role.permissions,
    permissionsCount: expanded.length,
    usersCount: users.filter((user) => user.role === key).length,
    isSystem: key === "admin",
    status: "active",
  };
});


/* ============================================================================
   3. سجل التدقيق

   مُولَّد من أحداث واقعية موزَّعة على المستخدمين والموديولات. كل صف يحمل
   الكيان المتأثر ومعرّفه، فيكون السجل قابلاً للربط بالمستند لا نصًا حرًا.
   ============================================================================ */

const AUDIT_EVENTS = [
  { action: "login", label: "تسجيل دخول", module: "النظام", entity: "session", severity: "info" },
  { action: "logout", label: "تسجيل خروج", module: "النظام", entity: "session", severity: "info" },
  { action: "journal.create", label: "إنشاء قيد يومية", module: "المحاسبة العامة", entity: "journal_entry", severity: "info" },
  { action: "journal.approve", label: "اعتماد قيد يومية", module: "المحاسبة العامة", entity: "journal_entry", severity: "warning" },
  { action: "journal.post", label: "ترحيل قيد يومية", module: "المحاسبة العامة", entity: "journal_entry", severity: "warning" },
  { action: "journal.reverse", label: "عكس قيد مُرحَّل", module: "المحاسبة العامة", entity: "journal_entry", severity: "critical" },
  { action: "account.create", label: "إضافة حساب للدليل", module: "المحاسبة العامة", entity: "account", severity: "info" },
  { action: "period.close", label: "إغلاق فترة محاسبية", module: "المحاسبة العامة", entity: "accounting_period", severity: "critical" },
  { action: "invoice.create", label: "إصدار فاتورة عميل", module: "المحاسبة المالية", entity: "customer_invoice", severity: "info" },
  { action: "receipt.create", label: "تسجيل تحصيل", module: "المحاسبة المالية", entity: "customer_receipt", severity: "info" },
  { action: "payment.create", label: "تسجيل دفعة لمورد", module: "المحاسبة المالية", entity: "supplier_payment", severity: "info" },
  { action: "creditnote.approve", label: "اعتماد إشعار دائن", module: "المحاسبة المالية", entity: "credit_note", severity: "warning" },
  { action: "cashbox.reconcile", label: "جرد خزينة", module: "المحاسبة المالية", entity: "cash_reconciliation", severity: "warning" },
  { action: "bank.reconcile", label: "مطابقة كشف بنكي", module: "المحاسبة المالية", entity: "bank_reconciliation", severity: "info" },
  { action: "asset.depreciate", label: "تشغيل الإهلاك الدوري", module: "المحاسبة المالية", entity: "depreciation_run", severity: "warning" },
  { action: "asset.dispose", label: "استبعاد أصل ثابت", module: "المحاسبة المالية", entity: "fixed_asset", severity: "critical" },
  { action: "employee.create", label: "إضافة موظف", module: "الموارد البشرية", entity: "employee", severity: "info" },
  { action: "employee.update", label: "تعديل بيانات موظف", module: "الموارد البشرية", entity: "employee", severity: "info" },
  { action: "leave.approve", label: "اعتماد طلب إجازة", module: "الموارد البشرية", entity: "leave_request", severity: "info" },
  { action: "payroll.process", label: "تشغيل مسيّر رواتب", module: "الموارد البشرية", entity: "payroll_run", severity: "warning" },
  { action: "payroll.approve", label: "اعتماد مسيّر رواتب", module: "الموارد البشرية", entity: "payroll_run", severity: "critical" },
  { action: "payroll.pay", label: "صرف رواتب", module: "الموارد البشرية", entity: "payroll_run", severity: "critical" },
  { action: "item.create", label: "إضافة صنف", module: "المخازن", entity: "item", severity: "info" },
  { action: "stock.receipt", label: "إذن إضافة مخزني", module: "المخازن", entity: "stock_movement", severity: "info" },
  { action: "stock.issue", label: "إذن صرف مخزني", module: "المخازن", entity: "stock_movement", severity: "info" },
  { action: "stock.transfer", label: "تحويل مخزني", module: "المخازن", entity: "stock_movement", severity: "info" },
  { action: "stock.adjust", label: "تسوية مخزنية", module: "المخازن", entity: "stock_movement", severity: "warning" },
  { action: "stock.count", label: "إغلاق جرد فعلي", module: "المخازن", entity: "stock_count", severity: "warning" },
  { action: "report.export", label: "تصدير تقرير", module: "التقارير", entity: "report", severity: "info" },
  { action: "user.create", label: "إضافة مستخدم", module: "الإدارة", entity: "user", severity: "warning" },
  { action: "role.update", label: "تعديل صلاحيات دور", module: "الإدارة", entity: "role", severity: "critical" },
  { action: "settings.update", label: "تعديل إعدادات النظام", module: "الإدارة", entity: "setting", severity: "warning" },
  { action: "postingmap.update", label: "تعديل خريطة الربط المحاسبي", module: "الإدارة", entity: "posting_map", severity: "critical" },
];

/** المستخدم الذي يُنسب إليه كل نوع حدث — لا عشوائية بلا معنى. */
const EVENT_ACTORS = {
  "المحاسبة العامة": [4, 5, 6],
  "المحاسبة المالية": [4, 5, 6, 7],
  "الموارد البشرية": [8, 9, 15],
  "المخازن": [10, 11, 12],
  "التقارير": [3, 4, 13],
  "الإدارة": [1, 3],
  "النظام": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
};

export const auditLogs = (() => {
  const out = [];
  const userById = new Map(users.map((user) => [user.id, user]));

  for (let index = 0; index < 220; index += 1) {
    const event = random.pick(AUDIT_EVENTS);
    const candidates = EVENT_ACTORS[event.module] ?? [1];
    const user = userById.get(random.pick(candidates));

    const timestamp = `${random.date(75, 0)}T${random.time(7, 20)}:${String(random.int(10, 59)).padStart(2, "0")}+03:00`;

    out.push({
      id: index + 1,
      timestamp,
      userId: user?.id ?? 1,
      user: user?.name ?? "مدير النظام",
      userRole: user?.roleName ?? "—",
      action: event.action,
      actionLabel: event.label,
      module: event.module,
      entity: event.entity,
      entityId: random.int(1, 200),
      severity: event.severity,
      ip: user?.lastLoginIp ?? "10.0.1.15",
      userAgent: random.pick([
        "Chrome 141 / Windows 11",
        "Edge 141 / Windows 11",
        "Firefox 134 / Windows 10",
        "Chrome 141 / Android 15",
      ]),
      /** وصف مقروء — يبنيه الباك-إند من الكيان ومعرّفه. */
      details: `${event.label} — ${event.entity}#${random.int(1, 200)}`,
      result: random.chance(0.97) ? "success" : "failed",
    });
  }

  return out.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
})();

/* ============================================================================
   4. تفضيلات النظام
   ============================================================================ */

export const systemPreferences = {
  /* --- المحاسبة --- */
  requireJournalApproval: true,
  allowPostingToClosedPeriods: false,
  autoPostModuleDocuments: true,
  journalNumberPrefix: "JV",
  defaultCostCenterId: 1,

  /* --- الفوترة --- */
  defaultCustomerPaymentTerms: "net30",
  defaultSupplierPaymentTerms: "net30",
  defaultTaxId: 1,
  allowNegativeInventory: false,
  invoiceNumberPrefix: "SI",

  /* --- المخازن --- */
  defaultCostingMethod: "weighted_average",
  nearExpiryWarningDays: 90,
  requireAdjustmentApproval: true,
  enforceWarehousePermissions: true,

  /* --- الموارد البشرية --- */
  payrollCutoffDay: 25,
  payDay: 5,
  maxAdvanceInstalments: 12,
  requireLeaveApproval: true,
  overtimeRequiresApproval: true,

  /* --- عام --- */
  sessionTimeoutMinutes: 45,
  passwordMinLength: 10,
  passwordRequiresSymbols: true,
  enforceTwoFactorForManagers: true,
  auditRetentionMonths: 60,
};

export const notificationPreferences = [
  { id: 1, key: "journal_pending_approval", label: "قيد يومية بانتظار الاعتماد", module: "المحاسبة العامة", inApp: true, email: true, roles: ["gl", "admin"] },
  { id: 2, key: "period_closing_due", label: "موعد إغلاق الفترة المحاسبية", module: "المحاسبة العامة", inApp: true, email: true, roles: ["gl"] },
  { id: 3, key: "invoice_overdue", label: "فاتورة عميل تجاوزت تاريخ الاستحقاق", module: "المحاسبة المالية", inApp: true, email: true, roles: ["fin"] },
  { id: 4, key: "credit_limit_exceeded", label: "عميل تجاوز حد الائتمان", module: "المحاسبة المالية", inApp: true, email: true, roles: ["fin", "admin"] },
  { id: 5, key: "supplier_payment_due", label: "دفعة مورد تستحق قريبًا", module: "المحاسبة المالية", inApp: true, email: false, roles: ["fin"] },
  { id: 6, key: "cashbox_over_limit", label: "رصيد الخزينة تجاوز الحد المسموح", module: "المحاسبة المالية", inApp: true, email: false, roles: ["fin"] },
  { id: 7, key: "bank_unreconciled", label: "حركات بنكية غير مُطابَقة", module: "المحاسبة المالية", inApp: true, email: false, roles: ["fin"] },
  { id: 8, key: "payroll_ready", label: "مسيّر رواتب جاهز للاعتماد", module: "الموارد البشرية", inApp: true, email: true, roles: ["hr", "fin"] },
  { id: 9, key: "leave_request_pending", label: "طلب إجازة بانتظار الاعتماد", module: "الموارد البشرية", inApp: true, email: false, roles: ["hr"] },
  { id: 10, key: "document_expiring", label: "مستند موظف قارب انتهاء صلاحيته", module: "الموارد البشرية", inApp: true, email: true, roles: ["hr"] },
  { id: 11, key: "low_stock", label: "صنف وصل الحد الأدنى", module: "المخازن", inApp: true, email: false, roles: ["inv"] },
  { id: 12, key: "stock_near_expiry", label: "تشغيلة قاربت انتهاء الصلاحية", module: "المخازن", inApp: true, email: true, roles: ["inv"] },
  { id: 13, key: "adjustment_pending", label: "تسوية مخزنية بانتظار الاعتماد", module: "المخازن", inApp: true, email: false, roles: ["inv", "admin"] },
  { id: 14, key: "stock_count_due", label: "جرد فعلي مُجدول", module: "المخازن", inApp: true, email: true, roles: ["inv"] },
];

/** أنواع المستندات المصدرية — تظهر في فلتر «المصدر» في دفتر اليومية. */
export const documentSources = Object.entries(SOURCE_LABELS).map(([key, label]) => ({
  id: key,
  name: label,
}));

export { TODAY as ADMIN_TODAY };

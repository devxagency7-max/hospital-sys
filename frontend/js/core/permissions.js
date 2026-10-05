/**
 * الصلاحيات — وحدة مركزية واحدة.
 *
 * قاعدة من docs/07-FRONTEND-RULES.md: «ممنوع كتابة الصلاحيات داخل الصفحات».
 * لا تكتب أبدًا `if (user.role === 'admin')` في شاشة. اسأل `can('patients.create')`
 * وأضف المفتاح إلى `PERMISSIONS` أدناه.
 *
 * هذه طبقة تجربة مستخدم فقط. إخفاء زر ليس أمانًا — التحقق الفعلي مسؤولية
 * الباك-إند في Phase 7.
 */

import { emit } from "./events.js";

/**
 * كتالوج الصلاحيات.
 * الصيغة: `<module>.<action>` — والنص العربي للعرض في شاشة إدارة الأدوار.
 */
export const PERMISSIONS = {
  "dashboard.view": "عرض لوحة التحكم",

  "patients.view": "عرض المرضى",
  "patients.create": "إضافة مريض",
  "patients.edit": "تعديل بيانات مريض",
  "patients.delete": "أرشفة مريض",
  "patients.account.view": "عرض حساب المريض المالي",

  "appointments.view": "عرض المواعيد",
  "appointments.create": "حجز موعد",
  "appointments.edit": "تعديل موعد",
  "appointments.cancel": "إلغاء موعد",

  "billing.view": "عرض الفواتير",
  "billing.invoice.create": "إنشاء فاتورة",
  "billing.invoice.edit": "تعديل فاتورة",
  "billing.payment.record": "تسجيل دفعة",
  "billing.refund.create": "تسجيل مرتجع",
  "billing.discount.approve": "اعتماد خصم",

  "accounting.view": "عرض الحسابات",
  "accounting.journal.create": "إنشاء قيد يومية",
  "accounting.journal.post": "ترحيل قيد",
  "accounting.period.close": "إغلاق فترة محاسبية",

  "inventory.view": "عرض المخزون",
  "inventory.item.manage": "إدارة الأصناف",
  "inventory.movement.create": "تسجيل حركة مخزنية",
  "inventory.adjustment.approve": "اعتماد تسوية مخزنية",

  "purchasing.view": "عرض المشتريات",
  "purchasing.request.create": "إنشاء طلب شراء",
  "purchasing.order.approve": "اعتماد أمر شراء",
  "purchasing.receive": "استلام أصناف",

  "pharmacy.view": "عرض الصيدلية",
  "pharmacy.dispense": "صرف دواء",

  "laboratory.view": "عرض المختبر",
  "laboratory.sample.collect": "سحب عيّنة",
  "laboratory.result.enter": "إدخال نتيجة",
  "laboratory.result.approve": "اعتماد نتيجة",

  "radiology.view": "عرض الأشعة",
  "radiology.report.write": "كتابة تقرير أشعة",

  "reports.view": "عرض التقارير",
  "reports.financial.view": "عرض التقارير المالية",
  "reports.export": "تصدير التقارير",

  "users.view": "عرض المستخدمين",
  "users.manage": "إدارة المستخدمين",
  "roles.manage": "إدارة الأدوار والصلاحيات",

  "audit.view": "عرض سجل التدقيق",

  "settings.view": "عرض الإعدادات",
  "settings.manage": "تعديل الإعدادات",
};

/**
 * الأدوار. `*` = كل الصلاحيات، و `patients.*` = كل صلاحيات موديول المرضى.
 * الأدوار النهائية يحددها العميل؛ هذه نقطة بداية واقعية للمستشفيات.
 */
export const ROLES = {
  admin: {
    label: "مدير النظام",
    permissions: ["*"],
  },
  manager: {
    label: "مدير المستشفى",
    permissions: [
      "dashboard.view",
      "patients.view",
      "appointments.view",
      "billing.view",
      "billing.discount.approve",
      "accounting.view",
      "inventory.view",
      "purchasing.*",
      "reports.*",
      "audit.view",
      "settings.view",
    ],
  },
  accountant: {
    label: "محاسب",
    permissions: [
      "dashboard.view",
      "patients.view",
      "patients.account.view",
      "billing.*",
      "accounting.*",
      "reports.view",
      "reports.financial.view",
      "reports.export",
    ],
  },
  receptionist: {
    label: "موظف استقبال",
    permissions: [
      "dashboard.view",
      "patients.view",
      "patients.create",
      "patients.edit",
      "appointments.*",
      "billing.view",
      "billing.invoice.create",
      "billing.payment.record",
      "reports.view",
    ],
  },
  doctor: {
    label: "طبيب",
    permissions: [
      "dashboard.view",
      "patients.view",
      "appointments.view",
      "laboratory.view",
      "laboratory.result.approve",
      "radiology.view",
      "radiology.report.write",
      "reports.view",
    ],
  },
  pharmacist: {
    label: "صيدلي",
    permissions: [
      "dashboard.view",
      "patients.view",
      "pharmacy.*",
      "inventory.view",
      "reports.view",
    ],
  },
  lab_technician: {
    label: "فني مختبر",
    permissions: [
      "dashboard.view",
      "patients.view",
      "laboratory.view",
      "laboratory.sample.collect",
      "laboratory.result.enter",
    ],
  },
  storekeeper: {
    label: "أمين مخزن",
    permissions: [
      "dashboard.view",
      "inventory.*",
      "purchasing.view",
      "purchasing.request.create",
      "purchasing.receive",
      "reports.view",
    ],
  },
};

/**
 * المستخدم الحالي.
 *
 * نائب عن المصادقة الحقيقية (Phase 7). عند تنفيذها يملأ `session` من التوكن
 * ولا يتغير شيء آخر في التطبيق.
 */
let session = {
  authenticated: true,
  user: {
    id: 1,
    name: "عبدالله محمد",
    jobTitle: "مدير النظام",
    role: "admin",
    departmentId: null,
  },
};

/** مجموعة الصلاحيات المحسوبة — تُعاد بناؤها عند تغيير الدور فقط. */
let granted = new Set();

function rebuild() {
  const role = ROLES[session.user?.role];
  granted = new Set(role?.permissions ?? []);
}

rebuild();

export function currentUser() {
  return session.user;
}

export function isAuthenticated() {
  return session.authenticated;
}

export function currentRole() {
  const key = session.user?.role;
  return { key, ...(ROLES[key] ?? { label: "غير معروف", permissions: [] }) };
}

/**
 * هل يملك المستخدم هذه الصلاحية؟
 *
 * قيمة فارغة تعني «لا قيد» وتُعيد true — حتى لا تحتاج كل شاشة عامة مفتاحًا.
 */
export function can(permission) {
  if (!permission) return true;
  if (!session.authenticated) return false;
  if (granted.has("*")) return true;
  if (granted.has(permission)) return true;

  // تطابق بالبادئة: `patients.*` يمنح `patients.create`.
  const segments = permission.split(".");
  for (let i = segments.length - 1; i > 0; i -= 1) {
    if (granted.has(`${segments.slice(0, i).join(".")}.*`)) return true;
  }

  return false;
}

export function canAny(permissions = []) {
  return permissions.length === 0 || permissions.some(can);
}

export function canAll(permissions = []) {
  return permissions.every(can);
}

/** كل الصلاحيات الفعلية للدور الحالي — لشاشة «صلاحيات الدور». */
export function effectivePermissions() {
  return Object.keys(PERMISSIONS).filter(can);
}

/**
 * تبديل الدور أثناء التطوير.
 *
 * ليس ميزة للمستخدم النهائي: الغرض اختبار أن الواجهة تحترم الصلاحيات فعلًا
 * بدل افتراض ذلك. تُزال نقطة الدخول من الهيدر عند ربط المصادقة الحقيقية.
 */
export function setRole(roleKey) {
  if (!ROLES[roleKey]) {
    throw new Error(`دور غير معروف: ${roleKey}`);
  }

  session = {
    ...session,
    user: { ...session.user, role: roleKey, jobTitle: ROLES[roleKey].label },
  };

  rebuild();
  emit("session:changed", { role: roleKey });
}

/** يستدعيها طبقة المصادقة في Phase 7. */
export function setSession(next) {
  session = next;
  rebuild();
  emit("session:changed", { role: session.user?.role });
}

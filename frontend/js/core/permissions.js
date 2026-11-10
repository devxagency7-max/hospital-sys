/**
 * الصلاحيات — وحدة مركزية واحدة.
 *
 * قاعدة من docs/07-FRONTEND-RULES.md: «ممنوع كتابة الصلاحيات داخل الصفحات».
 * لا تكتب أبدًا `if (user.role === 'admin')` في شاشة. اسأل `can("gl.journal.post")`
 * وأضف المفتاح إلى `PERMISSIONS` أدناه.
 *
 * هذه طبقة تجربة مستخدم فقط. إخفاء زر ليس أمانًا — التحقق الفعلي مسؤولية
 * الباك-إند.
 *
 * بنية المفاتيح تتبع نطاقات النظام:
 *   gl.*        المحاسبة العامة  (الدليل، القيود، الأستاذ، الميزان، الفترات)
 *   fin.*       المحاسبة المالية (العملاء، الموردون، الخزينة، البنوك، الأصول، الضرائب)
 *   hr.*        الموارد البشرية  (الموظفون، الحضور، الإجازات، الرواتب)
 *   inv.*       المخازن          (الأصناف، المخازن، الحركات، الجرد، التقييم)
 *   reports.*   التقارير والتصدير
 *   admin.*     المستخدمون والأدوار والإعدادات وسجل التدقيق
 */

import { emit } from "./events.js";

/**
 * كتالوج الصلاحيات.
 * الصيغة: `<domain>.<entity>.<action>` — والنص العربي للعرض في شاشة إدارة الأدوار.
 */
export const PERMISSIONS = {
  "dashboard.view": "عرض لوحة التحكم",

  /* ===================== المحاسبة العامة ===================== */
  "gl.view": "عرض المحاسبة العامة",
  "gl.account.manage": "إدارة دليل الحسابات",
  "gl.journal.create": "إنشاء قيد يومية",
  "gl.journal.approve": "اعتماد قيد يومية",
  "gl.journal.post": "ترحيل قيد يومية",
  "gl.journal.reverse": "عكس قيد مُرحَّل",
  "gl.ledger.view": "عرض دفتر الأستاذ العام",
  "gl.trialbalance.view": "عرض ميزان المراجعة",
  "gl.period.manage": "إدارة الفترات المحاسبية",
  "gl.period.close": "إغلاق فترة محاسبية",
  "gl.year.close": "إغلاق السنة المالية",

  /* ===================== المحاسبة المالية ===================== */
  "fin.view": "عرض المحاسبة المالية",
  "fin.customer.manage": "إدارة حسابات العملاء",
  "fin.customer.invoice": "إصدار فاتورة عميل",
  "fin.customer.receipt": "تسجيل تحصيل من عميل",
  "fin.supplier.manage": "إدارة حسابات الموردين",
  "fin.supplier.invoice": "تسجيل فاتورة مورد",
  "fin.supplier.payment": "تسجيل دفعة لمورد",
  "fin.cashbox.manage": "إدارة الصناديق النقدية",
  "fin.cashbox.transact": "تسجيل حركة نقدية",
  "fin.cashbox.reconcile": "جرد ومطابقة الصندوق",
  "fin.bank.manage": "إدارة الحسابات البنكية",
  "fin.bank.transact": "تسجيل حركة بنكية",
  "fin.bank.reconcile": "مطابقة كشف حساب بنكي",
  "fin.asset.manage": "إدارة الأصول الثابتة",
  "fin.asset.depreciate": "تشغيل الإهلاك الدوري",
  "fin.asset.dispose": "استبعاد أصل ثابت",
  "fin.costcenter.manage": "إدارة مراكز التكلفة",
  "fin.tax.manage": "إدارة الضرائب ونسبها",
  "fin.statements.view": "عرض القوائم المالية",

  /* ===================== الموارد البشرية ===================== */
  "hr.view": "عرض الموارد البشرية",
  "hr.employee.manage": "إدارة ملفات الموظفين",
  "hr.employee.document": "إدارة مستندات الموظفين",
  "hr.org.manage": "إدارة الهيكل التنظيمي والوظائف",
  "hr.attendance.view": "عرض الحضور والانصراف",
  "hr.attendance.manage": "تسجيل وتعديل الحضور",
  "hr.leave.request": "تقديم طلب إجازة",
  "hr.leave.approve": "اعتماد طلبات الإجازات",
  "hr.payroll.view": "عرض مسيّرات الرواتب",
  "hr.payroll.process": "تشغيل مسيّر رواتب",
  "hr.payroll.approve": "اعتماد مسيّر رواتب وترحيله محاسبيًا",
  "hr.payroll.pay": "صرف الرواتب",
  "hr.advance.manage": "إدارة سلف الموظفين",

  /* ===================== المخازن ===================== */
  "inv.view": "عرض المخازن",
  "inv.item.manage": "إدارة الأصناف والتصنيفات",
  "inv.warehouse.manage": "إدارة المخازن",
  "inv.receipt.create": "تسجيل إذن إضافة",
  "inv.issue.create": "تسجيل إذن صرف",
  "inv.transfer.create": "تسجيل تحويل مخزني",
  "inv.adjustment.create": "تسجيل تسوية مخزنية",
  "inv.adjustment.approve": "اعتماد تسوية مخزنية",
  "inv.return.create": "تسجيل مرتجع مخزني",
  "inv.count.manage": "إدارة الجرد الفعلي",
  "inv.valuation.view": "عرض تقييم المخزون",

  /* ===================== التقارير ===================== */
  "reports.view": "عرض التقارير",
  "reports.financial.view": "عرض التقارير المالية",
  "reports.hr.view": "عرض تقارير الموارد البشرية",
  "reports.inventory.view": "عرض تقارير المخازن",
  "reports.export": "تصدير التقارير",

  /* ===================== الإدارة والنظام ===================== */
  "admin.users.view": "عرض المستخدمين",
  "admin.users.manage": "إدارة المستخدمين",
  "admin.roles.manage": "إدارة الأدوار والصلاحيات",
  "admin.audit.view": "عرض سجل التدقيق",
  "admin.settings.view": "عرض الإعدادات",
  "admin.settings.manage": "تعديل الإعدادات",
};

/**
 * الأدوار. `*` = كل الصلاحيات، و `gl.*` = كل صلاحيات نطاق المحاسبة العامة.
 *
 * خمسة أدوار على قدر الموديولات: مدير النظام يرى كل شيء، وكل دور آخر
 * محصور في موديوله + تقاريره فقط. لوحة التحكم مشتركة للجميع كنقطة هبوط.
 */
export const ROLES = {
  admin: {
    label: "مدير النظام",
    permissions: ["*"],
  },

  gl: {
    label: "محاسب عام",
    permissions: [
      "dashboard.view",
      "gl.*",
      "reports.view",
      "reports.financial.view",
      "reports.export",
    ],
  },

  fin: {
    label: "محاسب مالي",
    permissions: [
      "dashboard.view",
      "fin.*",
      "reports.view",
      "reports.financial.view",
      "reports.export",
    ],
  },

  hr: {
    label: "مسؤول الموارد البشرية",
    permissions: [
      "dashboard.view",
      "hr.*",
      "reports.view",
      "reports.hr.view",
      "reports.export",
    ],
  },

  inv: {
    label: "أمين المخازن",
    permissions: [
      "dashboard.view",
      "inv.*",
      "reports.view",
      "reports.inventory.view",
      "reports.export",
    ],
  },
};

/**
 * المستخدم الحالي.
 *
 * نائب عن المصادقة الحقيقية. عند تنفيذها يملأ `session` من التوكن
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

  // تطابق بالبادئة: `gl.*` يمنح `gl.journal.post`.
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

/** يستدعيها طبقة المصادقة عند ربط الباك-إند. */
export function setSession(next) {
  session = next;
  rebuild();
  emit("session:changed", { role: session.user?.role });
}

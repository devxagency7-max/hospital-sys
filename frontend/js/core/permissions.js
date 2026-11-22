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
import { readPreference, writePreference } from "./store.js";

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

  /*
   * مفاتيح عرض دقيقة لكل شاشة مخزون.
   *
   * `inv.view` وحدها كانت تفتح قسم المخازن كاملًا، فكانت الممرضة ترى
   * «المستودعات والفروع» و«الأصناف والمخزون» — شاشات إدارة لا تخص شغلها.
   * الصلاحية الواسعة تُسهّل الإعداد وتُفسد القائمة.
   */
  "inv.movements.view": "عرض حركات المخزون",
  "inv.items.view": "عرض دليل الأصناف والأرصدة",
  "inv.warehouse.view": "عرض المستودعات والفروع",
  "inv.operations.view": "عمليات المخزون التفصيلية (جرد · تسويات · تشغيلات · صلاحية)",
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
  "inv.dispense.patient": "صرف أدوية ومستلزمات لمريض",

  /*
   * الاسترجاع ليس «صرفًا بالسالب».
   *
   * الكمية ترجع للرف بتكلفتها الأصلية (لا بتكلفة اليوم)، والمبلغ يُرفع عن
   * حساب المريض — وكلاهما يُرفض إن كان البند قد فُوتر: فاتورة صادرة لا
   * تُعدَّل، يُعالَج فرقها بإشعار دائن.
   */
  "inv.dispense.return": "استرجاع صنف مصروف لمريض ورفعه عن حسابه",

  "inv.requisition.create": "إنشاء طلب نواقص من فرع",

  /*
   * «يطلب نواقص» ≠ «يدير طلبات النواقص».
   *
   * الشاشة الواحدة تخدم الاثنين بما يملكه كلٌّ منهما: الرئيسي يرى طلبات كل
   * الفروع وأزرار الشحن والتوزيع وأوامر الشراء، والفرع يرى طلباته هو ويتتبّع
   * أين وصلت ويفحص الوارد. ما يفصلهما هو `fulfill` لا شاشة ثانية.
   */
  "inv.requisition.view": "عرض طلبات النواقص وتتبّعها",
  "inv.requisition.fulfill": "اعتماد وشحن طلبات النواقص",
  "inv.requisition.inspect": "فحص واستلام الشحنات بالفرع",

  /* ===================== التسعير وهوامش الربح ===================== */
  "pricing.manage": "مراجعة واعتماد أسعار البيع وهوامش الربح للأصناف",
  "pricing.tiers.manage": "إدارة شرائح التعريفة (نقدي · تأمين · وافد · عاملون)",
  "pricing.fx.manage": "إعلان أسعار الصرف",

  /* ===================== حسابات المرضى والخدمات الطبية ===================== */
  "patients.view": "عرض حسابات المرضى والخدمات",
  "patients.manage": "إدارة ملفات المرضى",
  "patients.invoice": "إصدار فواتير المرضى",
  "patients.invoices.view": "عرض فواتير المرضى",
  "patients.receipt": "تسجيل سندات قبض ودفعات المرضى",
  "patients.services.manage": "إدارة دليل الخدمات الطبية",
  "patients.admissions.manage": "إدارة الإقامة والعمليات والعناية",
  "patients.rooms.manage": "إدارة الغرف والأسرّة وحالاتها",
  "patients.charges.run": "تشغيل استحقاق الإقامة اليومي",

  /* ===================== الاستقبال واستعلام المرضى ===================== */
  "reception.view": "عرض موديول الاستقبال واستعلام المرضى",

  /*
   * لوحة الإشغال مفصولة عن استعلام الحسابات: الممرضة تحتاج أن ترى غرف
   * قسمها، ولا تحتاج شاشة الاستعلام والسداد — وهي شغل كاشير لا تمريض.
   */
  "reception.occupancy.view": "عرض لوحة إشغال الغرف والأسرّة",
  "reception.receipt": "تسجيل سندات قبض الاستقبال",
  "reception.summary.print": "طباعة كشف حساب ملخص للاستقبال",

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

  reception: {
    label: "موظف استقبال وخدمة مرضى",
    permissions: [
      "dashboard.view",
      "reception.*",
      "reception.occupancy.view",
      "patients.view",
      "patients.manage",
      "patients.receipt",
      "patients.invoice",
      "patients.invoices.view",
      "patients.admissions.manage",
      "patients.rooms.manage",
    ],
  },

  gl: {
    label: "محاسب عام ومدير حسابات",
    permissions: [
      "dashboard.view",
      "gl.*",
      "pricing.*",
      "inv.view",
      "inv.movements.view",
      "inv.items.view",
      "patients.invoices.view",
      "patients.manage",
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
      "pricing.*",
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

  /**
   * أمين المخزن الرئيسي — صاحب القرار في كل ما يدخل النظام ويخرج منه.
   *
   * هو وحده من: يستلم من المورد، ويشحن للفروع، ويأمر بالتحويل بين مخزنين،
   * ويضيف صنفًا أو يعدّل كمية. الفرع لا يملك شيئًا من ذلك — يطلب منه،
   * ويستلم ما يُرسله، ويصرف من رصيده فقط.
   */
  inv: {
    label: "أمين المخزن الرئيسي",
    permissions: [
      /*
       * لا `dashboard.view`.
       *
       * لوحة التحكم نظرة مالية إدارية: إيراد الشهر وربحه والنقدية والبنوك
       * وذمم العملاء. وأمين المخزن لا يملك شيئًا من ذلك، فبعد حجب ما لا
       * يراه لم يتبقَّ له فيها إلا بطاقتا مخزون يصل إليهما من شاشته أصلًا.
       * شاشته الأولى هي شغله: طلبات النواقص.
       */

      /*
       * صلاحيات مُعدَّدة لا `inv.*`.
       *
       * الـwildcard هو أصل كل ما سبق: `inv.view` فتحت قسم المخازن كاملًا
       * لكل من يملكها، والوضوح هنا أرخص من مفاجأة لاحقة.
       */
      "inv.view",
      "inv.item.manage",
      "inv.items.view",
      "inv.warehouse.manage",
      "inv.warehouse.view",
      "inv.movements.view",
      "inv.operations.view",
      "inv.valuation.view",

      "inv.receipt.create",
      "inv.issue.create",
      "inv.transfer.create",
      "inv.return.create",
      "inv.adjustment.create",
      "inv.adjustment.approve",
      "inv.count.manage",
      "inv.dispense.patient",

      "inv.requisition.view",
      "inv.requisition.create",
      "inv.requisition.fulfill",
      "inv.requisition.inspect",

      /** الاسترجاع من المريض — متاح للرئيسي كما للفرع. */
      "inv.dispense.return",

      "reports.view",
      "reports.inventory.view",
      "reports.export",
    ],
  },

  /**
   * أمين مخزن فرعي — يصرف من رصيده، ويطلب نواقصه، ويستلم ما يُرسله الرئيسي.
   *
   * ═══════════════════════════════════════════════════════════════════════
   *  الفرع **لا يُدخل كمية إلى النظام ولا يُخرجها منه بقراره**.
   *
   *  رصيده لا يزيد إلا بشحنة من المخزن الرئيسي يفحصها ويُقرّ باستلامها،
   *  ولا ينقص إلا بصرف لمريض من عنده. ولذلك لا يملك:
   *    · `inv.receipt.create`  — الاستلام من المورد يدخل الرئيسي وحده
   *    · `inv.item.manage`     — لا يضيف صنفًا ولا يعدّل بياناته
   *    · `inv.transfer.create` — لا يُحوّل لفرع آخر بقراره. التحويل يبدأ
   *      بأمر من الرئيسي، ويُنفَّذ من شاشة طلبات النواقص لا من شاشة تحويل
   *      حرة يختار فيها الوجهة والكمية بنفسه.
   *    · `pricing.*`           — السعر قرار المحاسب ومدير الحسابات
   *
   *  وما يملكه: الصرف للمريض، واسترجاع ما صُرف، وطلب النواقص وتتبّعها،
   *  وفحص الشحنة الواردة وإثبات عجزها أو زيادتها، والجرد الفعلي وتسوياته.
   * ═══════════════════════════════════════════════════════════════════════
   */
  pharmacy: {
    label: "أمين مخزن فرعي",
    permissions: [
      /* لا `dashboard.view`: لوحة التحكم نظرة مالية إدارية، وبعد حجب ما لا
         يملكه لم يتبقَّ فيها شيء. شاشته الأولى هي شغله: الصرف. */
      "inv.view",
      "inv.movements.view",
      "inv.items.view",
      "inv.operations.view",
      "inv.dispense.patient",
      "inv.dispense.return",
      "inv.issue.create",
      "inv.requisition.create",
      "inv.requisition.view",
      "inv.requisition.inspect",
      "inv.count.manage",
      "inv.adjustment.create",

      /*
       * لا `inv.warehouse.view`: إدارة المستودعات قرار المخزن الرئيسي.
       * ولا `reception.occupancy.view`: شاشة الصرف تعرض الغرف المشغولة
       * بنفسها، فلوحة الإشغال المستقلة تكرار لا يضيف شيئًا له.
       *
       * ولا `patients.view`: شاشة الصرف تبحث عن المريض وتعرض غرفته بنفسها
       * بلا هذه الصلاحية (لا تتحقق منها) — فمنحها إياه كان يفتح له قسم
       * «ملفات المرضى» كاملًا (سجل المرضى ودليل الخدمات) وهو شغل لا يخصه.
       */
      "reports.view",
      "reports.inventory.view",
    ],
  },

  billing: {
    label: "مسؤول حسابات المرضى والخدمات",
    permissions: [
      /*
       * لا `dashboard.view`.
       *
       * لوحة التحكم نظرة مالية إدارية: إيراد الشهر وربحه والنقدية والبنوك
       * وذمم العملاء — ولا شيء من ذلك من شغل من يحاسب مريضًا. وبعد حجب ما
       * لا يراه لم يتبقَّ له فيها إلا مربع بحث يصل إليه من شريطه العلوي
       * أصلًا. شاشته الأولى هي شغله: فواتير المرضى.
       */

      "patients.*",
      "reception.*",

      /*
       * لا `pricing.*` كاملة: إعلان سعر الصرف (`pricing.fx.manage`) قرار
       * محاسبي يخصّ المحاسبة المالية — ومن يحاسب مريضًا يستعمل السعر ولا
       * يُعلنه. كانت الشاشة تظهر لهذا الدور تحت «المحاسبة المالية» بلا سبب.
       */
      "pricing.tiers.manage",
      "pricing.manage",
      "reports.view",
      "reports.financial.view",
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

    /**
     * المخازن التي يملك المستخدم التصرف فيها.
     *
     * `null` = بلا قيد (مدير النظام ومدير المخازن). ومصفوفة معرّفات = قيد
     * فعلي: أمين مخزن فرع 1 لا يصرف من مخزن فرع 3 ولا يشحن منه، ولو فتح
     * الشاشة. الصلاحية تقول «يملك الصرف»، والنطاق يقول «من أين».
     */
    warehouseIds: null,
  },
};

/**
 * بوابة الدخول — شاشة اللوج إن في js/app.js.
 *
 * الدور المحفوظ من آخر دخول (`sessionRole`) يُستعاد عند تحميل الصفحة، فلا
 * يُعاد السؤال "ادخل بأي دور؟" عند كل تحديث (F5) — تمامًا كتسجيل الدخول في
 * أي تطبيق حقيقي. تسجيل الخروج (`exitApp`) يمسح المحفوظ فتعود البوابة.
 */
const savedRole = readPreference("sessionRole", null);
let entered = Boolean(savedRole && ROLES[savedRole]);

if (entered) {
  session = {
    ...session,
    user: { ...session.user, role: savedRole, jobTitle: ROLES[savedRole].label },
  };
}

/** مجموعة الصلاحيات المحسوبة — تُعاد بناؤها عند تغيير الدور فقط. */
let granted = new Set();

function rebuild() {
  const role = ROLES[session.user?.role];
  granted = new Set(role?.permissions ?? []);
}

rebuild();

/** هل دخل المستخدم باختيار دوره من شاشة اللوج إن؟ */
export function hasEnteredApp() {
  return entered;
}

/** الدخول من شاشة اللوج إن — يضبط الدور ويحفظه لإعادة التحميل. */
export function enterAsRole(roleKey) {
  setRole(roleKey);
  entered = true;
  writePreference("sessionRole", roleKey);
}

/** تسجيل الخروج — يمسح الدور المحفوظ فتظهر شاشة اللوج إن من جديد. */
export function exitApp() {
  entered = false;
  writePreference("sessionRole", null);
}

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

/* ==========================================================================
   نطاق المخازن

   الصلاحية والنطاق سؤالان مختلفان:
     · `can("inv.issue.create")`        → هل يملك الصرف أصلًا؟
     · `canAccessWarehouse(3)`          → هل يملك الصرف **من هذا المخزن**؟

   الخلط بينهما يُنتج أمين مخزن فرع يصرف من مخزن فرع آخر لأن صلاحيته العامة
   تسمح بالصرف. ولذلك فُصل النطاق في دالة مستقلة تُسأل بجوار الصلاحية.
   ========================================================================== */

/** المخازن المسموح بها للمستخدم الحالي — `null` تعني بلا قيد. */
export function allowedWarehouseIds() {
  const ids = session.user?.warehouseIds;
  if (ids === null || ids === undefined) return null;
  return ids.map(String);
}

/** هل يملك المستخدم الحالي التصرف في هذا المخزن؟ */
export function canAccessWarehouse(warehouseId) {
  const allowed = allowedWarehouseIds();
  if (allowed === null) return true;
  if (warehouseId === null || warehouseId === undefined) return false;
  return allowed.includes(String(warehouseId));
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
 * نطاق المخزن الافتراضي لكل دور فرعي — نائب عن تعيين مستخدم حقيقي بمخزن
 * بعينه (كما في admin.mock.js#users) إلى حين ربط مصادقة حقيقية.
 *
 * بلا هذا، كل دخول بدور "أمين مخزن فرعي" يحصل على `warehouseIds: null`
 * (بلا قيد) فيرى كل الفروع في شاشة الصرف كأزرار جنب بعضها — بالضبط
 * اللخبطة التي لا يفهمها أمين مخزن له فرع واحد يعمل فيه.
 */
const DEFAULT_WAREHOUSE_SCOPE = {
  pharmacy: [2],
};

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
    user: {
      ...session.user,
      role: roleKey,
      jobTitle: ROLES[roleKey].label,
      warehouseIds: DEFAULT_WAREHOUSE_SCOPE[roleKey] ?? null,
    },
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

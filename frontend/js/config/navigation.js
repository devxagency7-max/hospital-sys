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
    label: "الاستقبال والغرف",
    icon: "users",
    permission: "reception.view",
    children: [
      { label: "إشغال الغرف والأسرّة", path: "/reception/occupancy", permission: "reception.occupancy.view" },
      { label: "استعلام وسداد حساب مريض", path: "/reception", permission: "reception.view" },
    ],
  },

  /* ======================================================================
     حسابات المرضى والخدمات الطبية
     ====================================================================== */
  /*
   * كان هناك قسمان متداخلان: «الاستقبال واستعلام المرضى» و«حسابات المرضى
   * والخدمات»، وفيهما سندا قبض بمسارين مختلفين واسمين متشابهين
   * (`/reception/receipts` و`/patients/receipts`). موظفة الاستقبال كانت
   * تقف أمام زرّين لا تعرف أيهما تضغط.
   *
   * الآن: «الاستقبال والغرف» لما يخص الحجز والاستعلام، و«المرضى والفواتير»
   * لما يخص الحساب — وسند قبض واحد في مكان واحد.
   */
  {
    key: "patients",
    label: "المرضى والفواتير",
    icon: "hospital",
    permission: "patients.view",
    children: [
      { label: "سجل المرضى", path: "/patients", permission: "patients.view" },
      { label: "الإقامة والعمليات والعناية", path: "/patients/admissions", permission: "patients.admissions.manage" },
      { label: "فواتير المرضى", path: "/patients/invoices", permission: "patients.invoices.view" },
      { label: "سندات القبض والدفعات", path: "/patients/receipts", permission: "patients.receipt" },
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

      /*
       * «تسعير الأصناف وهوامش الربح» كان مُدرجًا هنا أيضًا بنفس المسار
       * (`/inv/price-reviews`) وباسم مختلف — فكان مدير حسابات المرضى يرى
       * الشاشة نفسها مرتين باسمين لا يعرف الفرق بينهما. موضعها قسم
       * المخازن حيث تُراجَع أسعار الأصناف.
       */
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
      { label: "طلبات النواقص والتوريد", path: "/inv/requisitions", permission: "inv.requisition.create" },
      { label: "صرف أدوية لمريض", path: "/inv/dispense", permission: "inv.dispense.patient" },
      { label: "حركات المخزون", path: "/inv/movements", permission: "inv.movements.view" },
      { label: "الأصناف والمخزون", path: "/inv/items", permission: "inv.items.view" },
      { label: "مطابقة فواتير الموردين", path: "/inv/invoice-matching", permission: "fin.supplier.invoice" },
      { label: "مراجعة وتسعير الأصناف", path: "/inv/price-reviews", permission: "pricing.manage" },
      { label: "المستودعات والفروع", path: "/inv/warehouses", permission: "inv.warehouse.view" },

      /*
       * مجموعة فرعية مطوية: عمليات يحتاجها أمين المخزن يوميًا لكنها كانت
       * **غائبة عن القائمة تمامًا** — الجرد الفعلي والتسويات وتتبّع الصلاحية
       * كانت بمسارات بلا رابط، فلم يكن أمين المخزن يصل إليها من أصله.
       * (أثر جانبي لاختصار الروابط من 13 إلى 5.)
       *
       * تُطوى افتراضيًا فلا تُطيل القائمة على غير أصحابها، وتظهر لمن يملك
       * `inv.operations.view` وحدهم.
       */
      {
        label: "عمليات المخزون التفصيلية",
        permission: "inv.operations.view",
        collapsible: true,
        children: [
          { label: "الجرد الفعلي", path: "/inv/counts", permission: "inv.count.manage" },
          { label: "التسويات المخزنية", path: "/inv/adjustments", permission: "inv.adjustment.create" },
          { label: "تتبّع الصلاحية", path: "/inv/expiry", permission: "inv.operations.view" },
          { label: "التشغيلات", path: "/inv/batches", permission: "inv.operations.view" },
          { label: "أرصدة المخزون", path: "/inv/balances", permission: "inv.operations.view" },
          { label: "إذن إضافة", path: "/inv/receipts", permission: "inv.receipt.create" },
          { label: "إذن صرف", path: "/inv/issues", permission: "inv.issue.create" },
          { label: "تحويل مخزني", path: "/inv/transfers", permission: "inv.transfer.create" },
          { label: "تصنيفات الأصناف", path: "/inv/categories", permission: "inv.item.manage" },
        ],
      },
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

/* ============================================================================
   شغلي النهاردة — اختصارات الدور

   ═══════════════════════════════════════════════════════════════════════════
    القائمة المفلترة وحدها لا تكفي.

    موظفة الاستقبال تُسأل عشرين مرة في الساعة سؤالًا واحدًا: «فيه أوضة
    فاضية؟». أن تجد الجواب خلف قسم مطوي اسمه «الاستقبال والغرف» يعني فتح
    مجموعة ثم قراءة أربعة عناوين ثم الضغط — ثلاث خطوات لسؤال واحد يتكرر
    كل ثلاث دقائق.

    فأعلى الشريط اختصارات الدور: أزرار كبيرة لأكثر شاشتين أو ثلاث يستعملها
    صاحب الدور فعلًا، مرئية دائمًا بلا طيّ. والأقسام تحتها كما هي للباقي —
    فيبقى اسم القسم واحدًا لكل الأدوار، والتدريب والتوثيق مشتركين.

    القاعدة: **ثلاثة اختصارات كحد أقصى.** أربعة تعني أننا لم نقرر.
   ═══════════════════════════════════════════════════════════════════════════
   ============================================================================ */

/**
 * اختصارات كل دور — مرتبة بالأهم أولًا.
 *
 * كل اختصار يحمل صلاحيته: الدور قد يُعدَّل من شاشة الأدوار، فلا نفترض أن
 * صاحب الدور يملك ما في قائمته. ما لا يملكه لا يُعرض.
 */
export const ROLE_SHORTCUTS = {
  reception: [
    { label: "إشغال الغرف", hint: "الفاضي والمشغول", path: "/reception/occupancy", icon: "hospital", permission: "reception.occupancy.view" },
    { label: "سداد حساب", hint: "استعلام وتحصيل", path: "/reception", icon: "wallet", permission: "reception.view" },
    { label: "سجل المرضى", hint: "بحث وتسجيل", path: "/patients", icon: "users", permission: "patients.view" },
  ],

  nurse: [
    { label: "صرف أدوية لمريض", hint: "غرفة ← أصناف ← تم", path: "/inv/dispense", icon: "inventory", permission: "inv.dispense.patient" },
    { label: "إشغال الغرف", hint: "مرضى القسم", path: "/reception/occupancy", icon: "hospital", permission: "reception.occupancy.view" },
    { label: "طلب نواقص", hint: "احتياج القسم", path: "/inv/requisitions", icon: "inbox", permission: "inv.requisition.create" },
  ],

  pharmacy: [
    { label: "صرف أدوية لمريض", hint: "غرفة ← أصناف ← تم", path: "/inv/dispense", icon: "inventory", permission: "inv.dispense.patient" },
    { label: "طلبات النواقص", hint: "طلب واستلام", path: "/inv/requisitions", icon: "inbox", permission: "inv.requisition.create" },
    { label: "الجرد الفعلي", hint: "عدّ ومطابقة", path: "/inv/counts", icon: "columns", permission: "inv.count.manage" },
  ],

  inv: [
    { label: "طلبات النواقص", hint: "شحن للفروع", path: "/inv/requisitions", icon: "inbox", permission: "inv.requisition.create" },
    { label: "إذن إضافة", hint: "استلام من مورد", path: "/inv/receipts", icon: "download", permission: "inv.receipt.create" },
    { label: "الجرد الفعلي", hint: "عدّ ومطابقة", path: "/inv/counts", icon: "columns", permission: "inv.count.manage" },
  ],

  fin: [
    { label: "مطابقة فواتير الموردين", hint: "استلامات تنتظر سعرًا", path: "/inv/invoice-matching", icon: "money", permission: "fin.supplier.invoice" },
    { label: "فواتير العملاء", hint: "إصدار ومتابعة", path: "/fin/customer-invoices", icon: "billing", permission: "fin.view" },
    { label: "الخزائن والبنوك", hint: "الحركة النقدية", path: "/fin/cash-boxes", icon: "wallet", permission: "fin.view" },
  ],

  gl: [
    { label: "قيود اليومية", hint: "مراجعة وترحيل", path: "/gl/journal", icon: "accounting", permission: "gl.view" },
    { label: "مراجعة وتسعير الأصناف", hint: "اعتماد هوامش الربح", path: "/inv/price-reviews", icon: "money", permission: "pricing.manage" },
    { label: "ميزان المراجعة", hint: "التوازن اللحظي", path: "/gl/trial-balance", icon: "reports", permission: "gl.trialbalance.view" },
  ],

  hr: [
    { label: "الحضور والانصراف", hint: "تسجيل ومتابعة", path: "/hr/attendance", icon: "clock", permission: "hr.attendance.view" },
    { label: "طلبات الإجازات", hint: "بانتظار الاعتماد", path: "/hr/leaves", icon: "calendar", permission: "hr.view" },
    { label: "مسيّرات الرواتب", hint: "تشغيل واعتماد", path: "/hr/payroll", icon: "money", permission: "hr.payroll.view" },
  ],

  billing: [
    { label: "فواتير المرضى", hint: "إصدار ومتابعة", path: "/patients/invoices", icon: "billing", permission: "patients.invoices.view" },
    { label: "سندات القبض", hint: "تحصيل", path: "/patients/receipts", icon: "wallet", permission: "patients.receipt" },
    { label: "سجل المرضى", hint: "بحث وحسابات", path: "/patients", icon: "users", permission: "patients.view" },
  ],

  /*
   * مدير النظام بلا اختصارات عمدًا: شغله ليس شاشة يومية متكررة، وقائمة
   * اختصارات له تعني اختيار ثلاث شاشات من أربع وسبعين بلا مبرر.
   */
  admin: [],
};

/** اختصارات دور بعينه — فارغة لدور بلا اختصارات معرَّفة. */
export function shortcutsForRole(roleKey) {
  return ROLE_SHORTCUTS[roleKey] ?? [];
}

/**
 * أول شاشة يفتح عليها الدور.
 *
 * أول اختصار في قائمته — فيبدأ يومه على ما يستعمله فعلًا لا على لوحة تحكم
 * عامة يمر عليها ثم يغادرها.
 */
export function landingPathForRole(roleKey) {
  return ROLE_SHORTCUTS[roleKey]?.[0]?.path ?? "/";
}

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
      /*
       * المجموعة الفرعية المطوية ليست شاشة — هي حاوية. نُسطّح أبناءها
       * بدلها، وإلا دخلت القائمة مدخلًا بلا `path` فيُسجَّل الراوتر مسارًا
       * فارغًا ويفشل فحص «كل مسار يشاور على ملف موجود».
       */
      if (child.children) {
        for (const grandchild of child.children) {
          out.push({
            ...grandchild,
            module: entry.key,
            moduleLabel: entry.label,
            groupLabel: child.label,
          });
        }
        continue;
      }

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

/**
 * كتالوج الحالات.
 *
 * docs/02-UI-UX-REQUIREMENTS.md يطلب «حالات بصرية متسقة». الاتساق لا يتحقق
 * بالاتفاق الشفهي: أي حالة تُعرض في الواجهة يجب أن تُسجَّل هنا أولاً، ومكوّن
 * `StatusBadge` يرفض ما ليس في هذا الكتالوج بدل أن يخترع لونًا.
 *
 * `tone` هو التصنيف البصري، و`StatusBadge` يترجمه إلى فئات Tailwind.
 */

/** @typedef {"neutral"|"info"|"success"|"warning"|"danger"|"muted"} Tone */

export const STATUSES = {
  /* --- حالات عامة للمستندات --- */
  draft: { label: "مسوّدة", tone: "neutral" },
  pending: { label: "قيد الانتظار", tone: "warning" },
  pending_approval: { label: "بانتظار الاعتماد", tone: "warning" },
  approved: { label: "معتمد", tone: "success" },
  rejected: { label: "مرفوض", tone: "danger" },
  cancelled: { label: "ملغى", tone: "muted" },
  archived: { label: "مؤرشف", tone: "muted" },
  active: { label: "نشط", tone: "success" },
  inactive: { label: "غير نشط", tone: "muted" },
  completed: { label: "مكتمل", tone: "success" },
  in_progress: { label: "جاري التنفيذ", tone: "info" },
  scheduled: { label: "مجدول", tone: "info" },

  /* --- التسوية المالية (فواتير العملاء والموردين) --- */
  paid: { label: "مسدَّدة", tone: "success" },
  partially_paid: { label: "مسدَّدة جزئيًا", tone: "warning" },
  unpaid: { label: "غير مسدَّدة", tone: "danger" },
  /** صافي المسدَّد تجاوز الإجمالي — رصيد لصالح الطرف الآخر، تُشتق لا تُكتب. */
  overpaid: { label: "سداد زائد", tone: "info" },
  overdue: { label: "متأخرة", tone: "danger" },
  due_soon: { label: "تستحق قريبًا", tone: "warning" },
  settled: { label: "مُسوّاة", tone: "success" },

  /* --- قيود اليومية ودورة الترحيل --- */
  posted: { label: "مُرحَّل", tone: "success" },
  unposted: { label: "غير مُرحَّل", tone: "neutral" },
  reversed: { label: "مُعكَّس", tone: "muted" },
  reversal: { label: "قيد عكسي", tone: "info" },
  balanced: { label: "متوازن", tone: "success" },
  unbalanced: { label: "غير متوازن", tone: "danger" },

  /* --- الفترات والسنوات المالية --- */
  open: { label: "مفتوحة", tone: "info" },
  closing: { label: "قيد الإغلاق", tone: "warning" },
  closed: { label: "مغلقة", tone: "muted" },
  locked: { label: "مُقفلة", tone: "danger" },

  /* --- الخزينة والبنوك --- */
  reconciled: { label: "مُطابَق", tone: "success" },
  unreconciled: { label: "غير مُطابَق", tone: "warning" },
  cleared: { label: "محصَّل بنكيًا", tone: "success" },
  outstanding: { label: "معلَّق", tone: "warning" },
  bounced: { label: "مرتجع", tone: "danger" },

  /* --- الأصول الثابتة --- */
  in_service: { label: "في الخدمة", tone: "success" },
  fully_depreciated: { label: "مُستهلك بالكامل", tone: "muted" },
  disposed: { label: "مُستبعد", tone: "muted" },
  under_maintenance: { label: "تحت الصيانة", tone: "warning" },

  /* --- المخازن --- */
  available: { label: "متاح", tone: "success" },
  low_stock: { label: "رصيد منخفض", tone: "warning" },
  out_of_stock: { label: "نفد", tone: "danger" },
  over_stock: { label: "فوق الحد الأقصى", tone: "info" },
  reserved: { label: "محجوز", tone: "info" },
  near_expiry: { label: "قارب الانتهاء", tone: "warning" },
  expired: { label: "منتهي الصلاحية", tone: "danger" },
  counting: { label: "جرد جارٍ", tone: "info" },
  counted: { label: "تم الجرد", tone: "success" },

  /* --- الموارد البشرية: التوظيف والحضور --- */
  probation: { label: "تحت التجربة", tone: "warning" },
  employed: { label: "على رأس العمل", tone: "success" },
  suspended: { label: "موقوف", tone: "warning" },
  terminated: { label: "منتهية خدمته", tone: "muted" },
  resigned: { label: "مستقيل", tone: "muted" },
  present: { label: "حاضر", tone: "success" },
  late: { label: "متأخر", tone: "warning" },
  absent: { label: "غائب", tone: "danger" },
  on_leave: { label: "في إجازة", tone: "info" },
  half_day: { label: "نصف يوم", tone: "warning" },
  day_off: { label: "راحة أسبوعية", tone: "muted" },
  holiday: { label: "عطلة رسمية", tone: "muted" },

  /* --- الموارد البشرية: الرواتب --- */
  calculated: { label: "محسوب", tone: "info" },
  paid_out: { label: "مصروف", tone: "success" },
  partially_recovered: { label: "مُستردّ جزئيًا", tone: "warning" },
  recovered: { label: "مُستردّ بالكامل", tone: "success" },
};

/** @returns {{ label: string, tone: Tone, known: boolean }} */
export function describeStatus(key) {
  const found = STATUSES[key];

  if (found) return { ...found, known: true };

  // حالة غير مسجّلة: نُظهرها كما هي ونُنبّه في الـ console بدل الصمت.
  if (key) {
    console.warn(
      `[statuses] حالة غير مسجّلة: "${key}". أضفها إلى js/core/statuses.js قبل استخدامها.`,
    );
  }

  return { label: key ? String(key) : "—", tone: "neutral", known: false };
}

/** خيارات جاهزة لقوائم الفلترة. */
export function statusOptions(keys) {
  return keys.map((key) => ({ value: key, label: describeStatus(key).label }));
}

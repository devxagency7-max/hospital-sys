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
  /* --- الحالات الأساسية المطلوبة في المواصفات --- */
  draft: { label: "مسوّدة", tone: "neutral" },
  pending: { label: "قيد الانتظار", tone: "warning" },
  approved: { label: "معتمد", tone: "success" },
  rejected: { label: "مرفوض", tone: "danger" },
  paid: { label: "مدفوعة", tone: "success" },
  partially_paid: { label: "مدفوعة جزئيًا", tone: "warning" },
  unpaid: { label: "غير مدفوعة", tone: "danger" },
  cancelled: { label: "ملغاة", tone: "muted" },
  active: { label: "نشط", tone: "success" },
  inactive: { label: "غير نشط", tone: "muted" },
  expired: { label: "منتهي الصلاحية", tone: "danger" },

  /* --- حالات تشغيلية --- */
  scheduled: { label: "مجدول", tone: "info" },
  in_progress: { label: "جاري التنفيذ", tone: "info" },
  completed: { label: "مكتمل", tone: "success" },
  no_show: { label: "لم يحضر", tone: "muted" },
  waiting: { label: "في الانتظار", tone: "warning" },

  /* --- حالات المخزون --- */
  available: { label: "متاح", tone: "success" },
  low_stock: { label: "رصيد منخفض", tone: "warning" },
  out_of_stock: { label: "نفد", tone: "danger" },
  near_expiry: { label: "قارب الانتهاء", tone: "warning" },

  /* --- حالات محاسبية --- */
  posted: { label: "مُرحَّل", tone: "success" },
  unposted: { label: "غير مُرحَّل", tone: "neutral" },
  overdue: { label: "متأخرة", tone: "danger" },
  closed: { label: "مغلقة", tone: "muted" },
  open: { label: "مفتوحة", tone: "info" },

  /* --- حالات الفاتورة الإلكترونية (ETA) --- */
  not_submitted: { label: "لم تُرسل", tone: "neutral" },
  submitted: { label: "مُرسلة", tone: "info" },
  accepted: { label: "مقبولة", tone: "success" },
  invalid: { label: "مرفوضة من المنظومة", tone: "danger" },
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

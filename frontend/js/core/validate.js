/**
 * تحقّق النماذج من جهة العميل.
 *
 * الغرض تجربة مستخدم فورية فقط. التحقق الملزِم — الأرصدة، أرقام الفواتير،
 * توازن القيود — مسؤولية الباك-إند في Phase 7 (docs/07-FRONTEND-RULES.md).
 * لا تبنِ قاعدة عمل مالية هنا.
 */

const EGYPT_MOBILE = /^01[0125]\d{8}$/;
const EGYPT_NATIONAL_ID = /^[23]\d{13}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const isBlank = (value) =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

/** قواعد جاهزة. كل قاعدة تُعيد رسالة خطأ عربية أو null. */
export const rules = {
  required: (message = "هذا الحقل مطلوب.") => (value) => (isBlank(value) ? message : null),

  minLength: (min, message) => (value) =>
    !isBlank(value) && String(value).trim().length < min
      ? message ?? `لا يقل عن ${min} أحرف.`
      : null,

  maxLength: (max, message) => (value) =>
    !isBlank(value) && String(value).length > max ? message ?? `لا يزيد عن ${max} حرفًا.` : null,

  number: (message = "أدخل رقمًا صحيحًا.") => (value) =>
    !isBlank(value) && !Number.isFinite(Number(value)) ? message : null,

  min: (min, message) => (value) =>
    !isBlank(value) && Number(value) < min ? message ?? `لا تقل القيمة عن ${min}.` : null,

  max: (max, message) => (value) =>
    !isBlank(value) && Number(value) > max ? message ?? `لا تزيد القيمة عن ${max}.` : null,

  /** المبالغ المالية: غير سالبة وبحد أقصى منزلتين عشريتين. */
  money: (message = "أدخل مبلغًا صحيحًا (منزلتان عشريتان كحد أقصى).") => (value) => {
    if (isBlank(value)) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return message;
    return Math.round(numeric * 100) !== numeric * 100 ? message : null;
  },

  /** كمية مخزنية: عدد صحيح غير سالب. */
  quantity: (message = "أدخل كمية صحيحة.") => (value) => {
    if (isBlank(value)) return null;
    const numeric = Number(value);
    return !Number.isInteger(numeric) || numeric < 0 ? message : null;
  },

  phone: (message = "رقم موبايل مصري غير صحيح (مثال: 01012345678).") => (value) =>
    !isBlank(value) && !EGYPT_MOBILE.test(String(value).replace(/\s/g, "")) ? message : null,

  nationalId: (message = "الرقم القومي يجب أن يكون 14 رقمًا.") => (value) =>
    !isBlank(value) && !EGYPT_NATIONAL_ID.test(String(value).replace(/\s/g, "")) ? message : null,

  email: (message = "بريد إلكتروني غير صحيح.") => (value) =>
    !isBlank(value) && !EMAIL.test(String(value).trim()) ? message : null,

  date: (message = "تاريخ غير صحيح.") => (value) =>
    !isBlank(value) && Number.isNaN(new Date(value).getTime()) ? message : null,

  pastDate: (message = "لا يمكن أن يكون التاريخ في المستقبل.") => (value) => {
    if (isBlank(value)) return null;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed > new Date() ? message : null;
  },

  /** مقارنة حقلين — مثل «تاريخ إلى» بعد «تاريخ من». */
  notBefore: (otherField, message) => (value, form) => {
    if (isBlank(value) || isBlank(form?.[otherField])) return null;
    return new Date(value) < new Date(form[otherField])
      ? message ?? "التاريخ لا يمكن أن يسبق تاريخ البداية."
      : null;
  },

  oneOf: (allowed, message) => (value) =>
    !isBlank(value) && !allowed.includes(value) ? message ?? "قيمة غير مسموحة." : null,

  custom: (predicate, message) => (value, form) => (predicate(value, form) ? null : message),
};

/**
 * يتحقق من كائن نموذج مقابل مخطط قواعد.
 *
 *   const schema = { name: [rules.required()], phone: [rules.required(), rules.phone()] };
 *   const { valid, errors } = validate(form, schema);
 *
 * @returns {{ valid: boolean, errors: Record<string,string> }}
 */
export function validate(form, schema) {
  const errors = {};

  for (const [field, fieldRules] of Object.entries(schema)) {
    for (const rule of [].concat(fieldRules)) {
      const message = rule(form?.[field], form);
      if (message) {
        // أول خطأ لكل حقل فقط — عرض ثلاث رسائل تحت حقل واحد يُربك.
        errors[field] = message;
        break;
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** يتحقق من حقل واحد — للتحقق الفوري عند مغادرة الحقل. */
export function validateField(field, value, schema, form = {}) {
  for (const rule of [].concat(schema[field] ?? [])) {
    const message = rule(value, { ...form, [field]: value });
    if (message) return message;
  }
  return null;
}

/**
 * تنسيق العرض — مكان واحد لكل رقم وتاريخ يراه المستخدم.
 *
 * التنسيق المتسق ليس تجميلاً هنا: الفاتورة التي تُعرض بـ 1,200.50 في الجدول
 * ثم 1200.5 في التقرير تُقرأ كخطأ في البيانات.
 */

import { LOCALE } from "./config.js";

const nf = (options) => new Intl.NumberFormat(LOCALE.numberLocale, options);

const CURRENCY = nf({
  style: "decimal",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DECIMAL = nf({ maximumFractionDigits: 2 });
const INTEGER = nf({ maximumFractionDigits: 0 });
const PERCENT = nf({ style: "percent", maximumFractionDigits: 1 });

const COMPACT = nf({ notation: "compact", maximumFractionDigits: 1 });

const DATE = new Intl.DateTimeFormat(LOCALE.dateLocale, {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: LOCALE.timeZone,
});

const DATE_LONG = new Intl.DateTimeFormat(LOCALE.dateLocale, {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: LOCALE.timeZone,
});

const DATE_TIME = new Intl.DateTimeFormat(LOCALE.dateLocale, {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: LOCALE.timeZone,
});

const TIME = new Intl.DateTimeFormat(LOCALE.dateLocale, {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: LOCALE.timeZone,
});

const RELATIVE = new Intl.RelativeTimeFormat(LOCALE.language, { numeric: "auto" });

/** شرطة قصيرة بدل فراغ — تميّز «لا قيمة» عن «خلية لم تُحمَّل». */
export const EMPTY = "—";

function parseDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isNumeric(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

/** مبلغ مالي مع رمز العملة: «1,200.50 ج.م». */
export function currency(value, { symbol = true } = {}) {
  if (!isNumeric(value)) return EMPTY;
  const formatted = CURRENCY.format(Number(value));
  return symbol ? `${formatted} ${LOCALE.currencyLabel}` : formatted;
}

/** مبلغ بدون رمز — للأعمدة التي يحمل رأسها رمز العملة. */
export function amount(value) {
  return currency(value, { symbol: false });
}

export function decimal(value) {
  return isNumeric(value) ? DECIMAL.format(Number(value)) : EMPTY;
}

export function integer(value) {
  return isNumeric(value) ? INTEGER.format(Number(value)) : EMPTY;
}

/** يأخذ كسرًا (0.125) ويعرضه نسبة (12.5%). */
export function percent(value) {
  return isNumeric(value) ? PERCENT.format(Number(value)) : EMPTY;
}

/** صيغة مختصرة للأرقام الكبيرة في بطاقات المؤشرات: «12.4 ألف». */
export function compact(value) {
  return isNumeric(value) ? COMPACT.format(Number(value)) : EMPTY;
}

export function date(value) {
  const parsed = parseDate(value);
  return parsed ? DATE.format(parsed) : EMPTY;
}

export function dateLong(value) {
  const parsed = parseDate(value);
  return parsed ? DATE_LONG.format(parsed) : EMPTY;
}

export function dateTime(value) {
  const parsed = parseDate(value);
  return parsed ? DATE_TIME.format(parsed) : EMPTY;
}

export function time(value) {
  const parsed = parseDate(value);
  return parsed ? TIME.format(parsed) : EMPTY;
}

/** «قبل 3 أيام» — للسجلات والتدقيق. */
export function relativeTime(value) {
  const parsed = parseDate(value);
  if (!parsed) return EMPTY;

  const diffSeconds = (parsed.getTime() - Date.now()) / 1000;
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];

  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return RELATIVE.format(Math.round(diffSeconds / seconds), unit);
    }
  }

  return RELATIVE.format(Math.round(diffSeconds), "second");
}

/** `YYYY-MM-DD` — صيغة التبادل مع الـ API وقيمة حقول input[type=date]. */
export function toISODate(value) {
  const parsed = parseDate(value);
  if (!parsed) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** العمر بالسنوات من تاريخ الميلاد — يُعرض بجانب اسم المريض. */
export function age(dateOfBirth) {
  const born = parseDate(dateOfBirth);
  if (!born) return EMPTY;

  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const monthDelta = now.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) years -= 1;

  if (years < 0) return EMPTY;
  if (years === 0) return "أقل من سنة";
  if (years === 1) return "سنة";
  if (years === 2) return "سنتان";
  if (years <= 10) return `${INTEGER.format(years)} سنوات`;
  return `${INTEGER.format(years)} سنة`;
}

/* --------------------------------------------------------------------------
   عزل الاتجاه (bidi)
   -------------------------------------------------------------------------- */

const LRI = "⁦"; // LEFT-TO-RIGHT ISOLATE
const PDI = "⁩"; // POP DIRECTIONAL ISOLATE

/**
 * يعزل نصًا كمقطع LTR داخل فقرة عربية.
 *
 * ضروري لأي قيمة تحتوي فاصلًا داخليًا — مثل «0101 234 5678». المسافة محايدة
 * اتجاهيًا، فتتبع اتجاه الفقرة وتقلب ترتيب المجموعات بصريًا إلى
 * «5678 234 0101»، وهو رقم مختلف تمامًا في عين القارئ. حروف العزل غير مرئية
 * وهي الآلية القياسية في Unicode لهذه الحالة.
 *
 * `Intl` يفعل الشيء نفسه تلقائيًا للتواريخ (يُدرج U+200F)، لذلك لا تحتاج
 * دوال التاريخ هنا إلى عزل يدوي.
 */
export function ltrIsolate(value) {
  return `${LRI}${value}${PDI}`;
}

/**
 * يُنظّف قيمة معروضة للتصدير: يزيل حروف التحكم الاتجاهي ويُعيد المسافات غير
 * الفاصلة إلى مسافات عادية. استدعِها في طبقة التصدير (CSV/Excel) وإلا ظهرت
 * رموز غريبة في الملف المُصدَّر.
 */
export function stripBidi(value) {
  return String(value ?? "")
    .replace(/[‎‏؜⁦-⁩]/g, "")
    .replace(/ /g, " ");
}

/**
 * رقم هاتف مصري: 01012345678 → 0101 234 5678.
 *
 * الفاصل مسافة غير فاصلة (U+00A0) لا مسافة عادية، لسببين معًا:
 *   - منع الالتفاف: العمود الضيق كان يكسر الرقم على ثلاثة أسطر.
 *   - توحيد المقطع: NBSP فاصل مشترك (CS) بين رقمين، فتبقى المجموعات الثلاث
 *     مقطعًا رقميًا واحدًا لا ثلاثة مقاطع يُعيد ترتيبها اتجاه الفقرة.
 */
export function phone(value) {
  if (!value) return EMPTY;

  const digits = String(value).replace(/\D/g, "");
  if (digits.length !== 11) return String(value);

  const grouped = `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return ltrIsolate(grouped);
}

/** حجم ملف للمرفقات. */
export function fileSize(bytes) {
  if (!isNumeric(bytes)) return EMPTY;

  const units = ["بايت", "ك.ب", "م.ب", "ج.ب"];
  let size = Number(bytes);
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }

  return `${DECIMAL.format(size)} ${units[unit]}`;
}

/** الأحرف الأولى للصورة الرمزية. */
export function initials(name) {
  if (!name) return "؟";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "؟";
  return parts.slice(0, 2).map((part) => part[0]).join("");
}

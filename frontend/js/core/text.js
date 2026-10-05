/**
 * معالجة النص العربي.
 *
 * البحث العربي الحرفي يفشل عمليًا: من يكتب «احمد» لا يجد «أحمد»، ومن يكتب
 * «فاطمه» لا يجد «فاطمة». التطبيع هنا يجعل البحث يتصرف كما يتوقعه المستخدم،
 * ويُستخدم في البحث داخل الجداول وفي طبقة البيانات التجريبية معًا حتى لا
 * يختلف السلوك بينهما.
 */

/** علامات التشكيل والتطويل. */
const DIACRITICS = /[ً-ٰٟۖ-ۭـ]/g;

const EQUIVALENTS = [
  [/[أإآٱ]/g, "ا"],
  [/[ىی]/g, "ي"],
  [/ة/g, "ه"],
  [/[ؤ]/g, "و"],
  [/[ئ]/g, "ي"],
];

/** الأرقام الهندية ← اللاتينية، حتى يجد «١٠٠١» الصنف رقم 1001. */
const EASTERN_DIGITS = /[٠-٩۰-۹]/g;

function latinizeDigits(value) {
  return value.replace(EASTERN_DIGITS, (digit) => {
    const code = digit.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/** يُطبّع نصًا للمقارنة. المخرج للبحث فقط — لا تعرضه للمستخدم. */
export function normalize(value) {
  if (value === null || value === undefined) return "";

  let out = latinizeDigits(String(value)).toLowerCase().replace(DIACRITICS, "");
  for (const [pattern, replacement] of EQUIVALENTS) out = out.replace(pattern, replacement);

  return out.replace(/\s+/g, " ").trim();
}

/**
 * هل يحتوي النص على كل كلمات الاستعلام؟
 *
 * بالكلمات لا بالنص الكامل: «احمد خليل» يطابق «أحمد محمود خليل». البحث
 * بالتطابق الحرفي الكامل كان سيفشل، وهو الأسلوب الذي يشتكي منه المستخدمون.
 */
export function matchesQuery(haystack, query) {
  const needle = normalize(query);
  if (!needle) return true;

  const target = normalize(haystack);
  return needle.split(" ").every((word) => target.includes(word));
}

/** يبحث في عدة حقول من كائن. */
export function matchesFields(record, fields, query) {
  if (!normalize(query)) return true;
  const haystack = fields.map((field) => record?.[field] ?? "").join(" ");
  return matchesQuery(haystack, query);
}

/**
 * مقارنة عربية صحيحة للترتيب.
 * `localeCompare` الافتراضية ترتب الحروف العربية بترتيب الـ code points لا
 * بالترتيب الأبجدي المتوقع، فنمرر الـ locale صراحةً.
 */
const collator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" });

export function compareValues(a, b) {
  if (a === b) return 0;

  // القيم الفارغة تذهب للآخر دائمًا، في كلا اتجاهي الترتيب.
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty) return bEmpty ? 0 : 1;
  if (bEmpty) return -1;

  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);

  return collator.compare(String(a), String(b));
}

/** يقصّ نصًا طويلاً مع إضافة علامة الحذف. */
export function truncate(value, maxLength = 80) {
  const text = String(value ?? "");
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

/** يحوّل نصًا إلى معرّف صالح لـ slug / data attribute. */
export function slugify(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

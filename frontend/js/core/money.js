/**
 * حساب المبالغ المالية.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  كل عملية حسابية على مبلغ تمر من هنا. ممنوع `a + b` مباشرة على المبالغ.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * السبب: `0.1 + 0.2 === 0.30000000000000004`. الانحراف لا يُرى في مبلغ واحد،
 * لكنه يتراكم في جمع مئات الفواتير — قياس فعلي على البيانات الحالية أعطى
 * انحرافًا قدره 9.31e-10 في مجموع 225 فاتورة. ومع نمو البيانات يصل الانحراف
 * إلى قرش كامل، فيظهر ميزان لا يتوازن ولا يُعرف سببه.
 *
 * الحل: كل الحساب الداخلي بالقروش كأعداد صحيحة، والتحويل إلى جنيهات عند
 * العرض فقط. العدد الصحيح في JavaScript دقيق حتى 2^53، أي ما يفوق 90 ألف
 * مليار جنيه — هامش كافٍ بفارق هائل.
 */

/** عدد الوحدات الصغرى في الوحدة الكبرى (قرش في الجنيه). */
const MINOR_UNITS = 100;

/**
 * يحوّل مبلغًا (جنيه) إلى عدد صحيح من القروش.
 *
 * `Math.round(1.005 * 100)` تُعطي 100 لا 101 بسبب التمثيل الثنائي، لذلك
 * نصحّح بـ EPSILON قبل التقريب.
 */
export function toMinor(value) {
  if (value === null || value === undefined || value === "") return 0;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;

  const scaled = numeric * MINOR_UNITS;
  return Math.round(scaled + Math.sign(scaled) * Number.EPSILON * Math.abs(scaled));
}

/** يحوّل قروشًا (عدد صحيح) إلى جنيهات للعرض أو للإرسال في الـ API. */
export function toMajor(minor) {
  return Math.round(minor) / MINOR_UNITS;
}

/** يجمع مبالغ بالجنيه ويُعيد النتيجة بالجنيه، دون انحراف. */
export function sum(values) {
  return toMajor(values.reduce((total, value) => total + toMinor(value), 0));
}

/** يجمع حقلاً من مصفوفة سجلات. */
export function sumBy(rows, field) {
  return toMajor(rows.reduce((total, row) => total + toMinor(row?.[field]), 0));
}

/** جمع مبلغين. */
export function add(a, b) {
  return toMajor(toMinor(a) + toMinor(b));
}

/** طرح مبلغين. */
export function subtract(a, b) {
  return toMajor(toMinor(a) - toMinor(b));
}

/**
 * ضرب مبلغ في كمية أو نسبة.
 * الضرب يتم على القروش ثم يُقرَّب — فسعر 33.33 × 3 يعطي 99.99 بالضبط.
 */
export function multiply(amount, factor) {
  const numeric = Number(factor);
  if (!Number.isFinite(numeric)) return 0;
  return toMajor(Math.round(toMinor(amount) * numeric));
}

/** نسبة من مبلغ: `rate` كسر (0.14 = 14%). */
export function percentOf(amount, rate) {
  return multiply(amount, rate);
}

/** يُقرّب مبلغًا إلى منزلتين — للقيم القادمة من مصدر خارجي. */
export function round(value) {
  return toMajor(toMinor(value));
}

/** مقارنة دقيقة بين مبلغين (تتجاوز مشكلة === على الأعداد العشرية). */
export function equals(a, b) {
  return toMinor(a) === toMinor(b);
}

/** يُعيد -1 / 0 / 1. */
export function compare(a, b) {
  const left = toMinor(a);
  const right = toMinor(b);
  return left === right ? 0 : left < right ? -1 : 1;
}

export const isZero = (value) => toMinor(value) === 0;
export const isPositive = (value) => toMinor(value) > 0;
export const isNegative = (value) => toMinor(value) < 0;

/** أكبر وأصغر — لتقييد المبالغ (مثل منع رصيد سالب). */
export const max = (a, b) => (compare(a, b) >= 0 ? round(a) : round(b));
export const min = (a, b) => (compare(a, b) <= 0 ? round(a) : round(b));

/**
 * يوزّع مبلغًا على عدة حصص دون ضياع قرش.
 *
 * قسمة 100 على 3 تعطي 33.33 ثلاث مرات = 99.99، فيضيع قرش. هذه الدالة توزّع
 * الباقي على الحصص الأولى، فيبقى المجموع مساويًا للأصل بالضبط. تُستخدم عند
 * توزيع خصم أو ضريبة على بنود فاتورة.
 */
export function allocate(amount, parts) {
  if (parts < 1) return [];

  const totalMinor = toMinor(amount);
  const base = Math.trunc(totalMinor / parts);
  const remainder = totalMinor - base * parts;

  return Array.from({ length: parts }, (_unused, index) =>
    toMajor(base + (index < Math.abs(remainder) ? Math.sign(remainder) : 0)),
  );
}

/**
 * يوزّع مبلغًا بالتناسب مع أوزان (مثل توزيع خصم على البنود حسب قيمتها).
 * المجموع الناتج يساوي المبلغ الأصلي بالضبط.
 */
export function allocateByWeight(amount, weights) {
  const totalMinor = toMinor(amount);
  const weightMinor = weights.map(toMinor);
  const weightTotal = weightMinor.reduce((total, weight) => total + weight, 0);

  if (weightTotal === 0) return allocate(amount, weights.length);

  const shares = weightMinor.map((weight) =>
    Math.trunc((totalMinor * weight) / weightTotal),
  );

  // الباقي من القسمة الصحيحة يُضاف قرشًا قرشًا للحصص الأكبر.
  let remainder = totalMinor - shares.reduce((total, share) => total + share, 0);
  const order = weightMinor
    .map((weight, index) => ({ weight, index }))
    .sort((a, b) => b.weight - a.weight);

  let cursor = 0;
  while (remainder !== 0 && order.length) {
    shares[order[cursor % order.length].index] += Math.sign(remainder);
    remainder -= Math.sign(remainder);
    cursor += 1;
  }

  return shares.map(toMajor);
}

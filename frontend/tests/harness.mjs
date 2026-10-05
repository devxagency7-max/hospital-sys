/**
 * مُشغّل اختبارات صغير بلا اعتماديات.
 *
 * لم نُضف Jest أو Vitest عمدًا: المشروع كله بلا حزم في المتصفح، وإضافة إطار
 * اختبار بمئات الاعتماديات لأجل دوال خالصة مبالغة. Node وحده يكفي.
 */

let passed = 0;
let failed = 0;
const failures = [];
let currentSection = "";

export function section(title) {
  currentSection = title;
  console.log(`\n  ${title}`);
}

export function assert(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`    ✓ ${name}`);
  } else {
    failed += 1;
    failures.push(`${currentSection} › ${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`    ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/**
 * مقارنة مبالغ.
 * تقارن بالقروش كأعداد صحيحة لا بهامش تقريبي: المقارنة بـ epsilon تُخفي
 * انحرافًا حقيقيًا قدره نصف قرش، وهو بالضبط نوع الخطأ الذي نبحث عنه.
 */
export function assertMoney(name, actual, expected) {
  const toMinor = (value) => Math.round(Number(value) * 100);
  const ok = toMinor(actual) === toMinor(expected);
  assert(name, ok, ok ? "" : `المتوقع ${expected} والناتج ${actual}`);
}

export function assertEqual(name, actual, expected) {
  const ok = actual === expected;
  assert(name, ok, ok ? "" : `المتوقع ${JSON.stringify(expected)} والناتج ${JSON.stringify(actual)}`);
}

export function assertThrows(name, fn, matcher) {
  try {
    fn();
    assert(name, false, "لم يرمِ أي خطأ");
  } catch (error) {
    assert(name, matcher ? matcher(error) : true, matcher ? `خطأ غير متوقع: ${error.message}` : "");
  }
}

export function report() {
  const total = passed + failed;
  console.log(`\n  ${"─".repeat(46)}`);

  if (failed === 0) {
    console.log(`  ✅ ${total} فحصًا — كلها ناجحة.\n`);
    process.exit(0);
  }

  console.log(`  ❌ ${failed} فاشل من ${total}:\n`);
  for (const failure of failures) console.log(`     • ${failure}`);
  console.log("");
  process.exit(1);
}

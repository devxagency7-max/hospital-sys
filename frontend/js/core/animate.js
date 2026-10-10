/**
 * حركات رقمية صغيرة — عداد تصاعدي لبطاقات المؤشرات.
 *
 * الهدف شعور لا بهرجة: رقم الإيرادات يرتفع إلى قيمته الحقيقية خلال نصف
 * ثانية بدل أن يظهر فجأة — إحساس أن الصفحة «تحسب أمامك» لا أن البيانات
 * قُحِمَت. يحترم `prefers-reduced-motion` بتخطي الحركة فورًا إلى القيمة
 * النهائية، لا بتعطيلها بصمت (القيمة الصحيحة يجب أن تصل دائمًا).
 */

/** true لو طلب المستخدم تقليل الحركة — يُفحص حيًا، لا يُخزَّن مرة واحدة. */
function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** منحنى تباطؤ لطيف قرب النهاية — easeOutExpo. */
function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - 2 ** (-10 * t);
}

/**
 * يُحرّك رقمًا من `from` إلى `to` عبر استدعاءات `onUpdate` متتالية.
 *
 * دالة خالصة في منطقها: لا تلمس DOM بنفسها، فتبقى قابلة للاختبار في Node.
 * المستدعي (مكوّن العدّاد) هو من يكتب الرقم في الصفحة داخل `onUpdate`.
 *
 * @param {object} options
 * @param {number} options.from
 * @param {number} options.to
 * @param {number} [options.duration=700]  مللي ثانية
 * @param {(value:number) => void} options.onUpdate
 * @param {() => void} [options.onComplete]
 * @returns {() => void} دالة إلغاء — تستدعيها عند تفكيك المكوّن فتمنع تحديث
 *          عنصر لم يعد في الصفحة.
 */
export function tweenNumber({ from, to, duration = 700, onUpdate, onComplete }) {
  if (prefersReducedMotion() || !Number.isFinite(from) || !Number.isFinite(to) || duration <= 0) {
    onUpdate(to);
    onComplete?.();
    return () => {};
  }

  let frame;
  let cancelled = false;
  const start = performance.now();

  function step(now) {
    if (cancelled) return;

    const elapsed = now - start;
    const progress = Math.min(1, elapsed / duration);
    const value = from + (to - from) * easeOutExpo(progress);

    onUpdate(value);

    if (progress < 1) {
      frame = requestAnimationFrame(step);
    } else {
      onUpdate(to); // يضمن القيمة النهائية بالضبط، لا تقريبًا قريبًا منها
      onComplete?.();
    }
  }

  frame = requestAnimationFrame(step);

  return () => {
    cancelled = true;
    if (frame) cancelAnimationFrame(frame);
  };
}

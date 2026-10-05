/**
 * ناقل أحداث عام.
 *
 * للتواصل بين أجزاء لا يعرف بعضها بعضًا — مثلاً: الراوتر يُعلن تغيّر المسار
 * فيحدّث الشريط الجانبي عنصره النشط، دون أن يستورد أحدهما الآخر.
 *
 * لا تستخدمه لتمرير بيانات بين دالتين متجاورتين؛ المعامل العادي أوضح.
 */

const listeners = new Map();

/** يشترك في حدث. يُعيد دالة لإلغاء الاشتراك. */
export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => off(event, handler);
}

export function off(event, handler) {
  listeners.get(event)?.delete(handler);
}

/** يشترك مرة واحدة ثم يلغي نفسه. */
export function once(event, handler) {
  const unsubscribe = on(event, (payload) => {
    unsubscribe();
    handler(payload);
  });
  return unsubscribe;
}

/**
 * يُطلق حدثًا.
 * خطأ في مستمع لا يمنع بقية المستمعين — ويُسجَّل بدل أن يُهمل بصمت.
 */
export function emit(event, payload) {
  const handlers = listeners.get(event);
  if (!handlers?.size) return;

  for (const handler of [...handlers]) {
    try {
      handler(payload);
    } catch (error) {
      console.error(`[events] فشل مستمع الحدث "${event}":`, error);
    }
  }
}

/** للاختبارات فقط. */
export function clearAll() {
  listeners.clear();
}

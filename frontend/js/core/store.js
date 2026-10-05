/**
 * حالة قابلة للمراقبة.
 *
 * استراتيجية الحالة في هذا المشروع متدرّجة عن قصد:
 *   1. حالة محلية داخل المكوّن  → متغير عادي (الأغلبية)
 *   2. حالة مشتركة بين مكوّنات شاشة واحدة → `createStore` هنا
 *   3. حالة عامة للتطبيق → `appState` أدناه
 *
 * لا نحتاج أكثر من ذلك. إضافة مكتبة حالة كاملة لشاشات CRUD مبالغة.
 */

/**
 * ينشئ مخزنًا صغيرًا.
 *
 *   const store = createStore({ page: 1 });
 *   store.subscribe((state) => rerender(state));
 *   store.set({ page: 2 });
 */
export function createStore(initialState = {}) {
  let state = { ...initialState };
  const subscribers = new Set();

  function notify(previous) {
    for (const subscriber of [...subscribers]) {
      try {
        subscriber(state, previous);
      } catch (error) {
        console.error("[store] فشل مشترك:", error);
      }
    }
  }

  return {
    get() {
      return state;
    },

    /** دمج جزئي — يقبل كائنًا أو دالة تستلم الحالة السابقة. */
    set(patch) {
      const previous = state;
      const next = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...next };

      // لا نُخطر على تحديث لا يغيّر شيئًا — يوفّر إعادة رسم الجداول الكبيرة.
      const changed = Object.keys(next ?? {}).some((key) => previous[key] !== state[key]);
      if (changed) notify(previous);
    },

    /** استبدال كامل — لإعادة التهيئة. */
    reset(nextState = initialState) {
      const previous = state;
      state = { ...nextState };
      notify(previous);
    },

    subscribe(subscriber, { immediate = false } = {}) {
      subscribers.add(subscriber);
      if (immediate) subscriber(state, state);
      return () => subscribers.delete(subscriber);
    },

    /** يُستدعى عند تفكيك الشاشة لتجنّب تسريب المشتركين. */
    destroy() {
      subscribers.clear();
    },
  };
}

/**
 * حالة التطبيق العامة — ما يحتاجه الإطار (الشريط الجانبي/الهيدر) فقط.
 * لا تضع بيانات شاشة هنا.
 */
export const appState = createStore({
  sidebarCollapsed: readPreference("sidebarCollapsed", false),
  mobileNavOpen: false,
  /** عدد الطلبات الجارية — يشغّل شريط التقدّم العلوي. */
  pendingRequests: 0,
});

/* --------------------------------------------------------------------------
   تفضيلات محلية
   localStorage قد يُرفض (تصفّح خاص / سياسة مؤسسية)، لذلك كل وصول محمي.
   -------------------------------------------------------------------------- */

const STORAGE_PREFIX = "hospital-erp:";

export function readPreference(key, fallback = null) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writePreference(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // التفضيلات تحسين لا أكثر؛ فشل الحفظ لا يوقف شيئًا.
  }
}

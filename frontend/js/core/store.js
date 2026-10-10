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

/* --------------------------------------------------------------------------
   تفضيلات محلية
   localStorage قد يُرفض (تصفّح خاص / سياسة مؤسسية)، لذلك كل وصول محمي.

   يجب أن يسبق هذا القسم appState أدناه: appState يستدعي readPreference في
   مهّئ كائنه الحرفي، وهو استدعاء متزامن يُنفَّذ فورًا عند تقييم الوحدة — لو
   بقي STORAGE_PREFIX (ثابت const) معرَّفًا بعد appState نصيًا، فإن استدعاء
   readPreference سيقع داخل "المنطقة الميتة زمنيًا" لذلك الثابت ويرمي
   ReferenceError، والذي يبتلعه try/catch في readPreference بصمت ويُعيد
   القيمة الافتراضية دائمًا — تفضيل محفوظ فعليًا في localStorage يبدو وكأنه
   غير موجود أبدًا. باگ فعلي حقيقي اكتُشف أثناء تطوير نظام السمات (كل تفضيل
   عبر readPreference كان متأثرًا، بما فيها sidebarCollapsed من Phase 1 —
   لم يظهر العطل من قبل لأن قيمته الافتراضية الخاطئة وقيمته الصحيحة الشائعة
   كانتا كلتاهما "false" في معظم الاختبارات اليدوية).
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

/**
 * حالة التطبيق العامة — ما يحتاجه الإطار (الشريط الجانبي/الهيدر) فقط.
 * لا تضع بيانات شاشة هنا.
 */
export const appState = createStore({
  sidebarCollapsed: readPreference("sidebarCollapsed", false),
  mobileNavOpen: false,
  /** عدد الطلبات الجارية — يشغّل شريط التقدّم العلوي. */
  pendingRequests: 0,
  /** "dark" | "light" | "system" — التطبيق الفعلي عبر js/core/theme.js. */
  themePreference: readPreference("themePreference", "light"),
  /** طبقة الخلفية القابلة للتخصيص — راجع js/core/background-studio.js. */
  backgroundStudio: readPreference("backgroundStudio", null),
});

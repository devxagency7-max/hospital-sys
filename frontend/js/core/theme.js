/**
 * نظام السمات (داكن / فاتح / النظام).
 *
 * التطبيق الفعلي للسمة على <html> يحدث مرتين بتصميم:
 *   1. سكربت inline صغير في index.html، يعمل قبل تحميل أي JS modules —
 *      يمنع "وميض السمة الخطأ" (FOUC) عند تحميل صفحة بتفضيل فاتح بينما
 *      الخلفية الافتراضية في index.html داكنة.
 *   2. هذه الوحدة، التي تتولى التبديل التفاعلي بعد الإقلاع وتُبقي السمة
 *      متزامنة مع تفضيل نظام التشغيل عند اختيار "النظام".
 *
 * كل الألوان تبقى معرَّفة حصرًا في tailwind.src.css عبر `:root[data-theme]`؛
 * هذه الوحدة لا تكتب ولا تعرف أي قيمة لون — فقط تضبط السمة الفعّالة.
 */

import { appState, writePreference } from "./store.js";

export const THEMES = ["dark", "light", "system"];

const media = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

function systemTheme() {
  return media?.matches === false ? "light" : "dark";
}

/** السمة الفعلية المطبَّقة فعليًا على الصفحة (لا "system" أبدًا — تُحل دائمًا). */
export function resolveTheme(preference) {
  return preference === "system" ? systemTheme() : preference;
}

function apply(preference) {
  const effective = resolveTheme(preference);
  document.documentElement.dataset.theme = effective;
  document.documentElement.style.colorScheme = effective;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = effective === "light" ? "#f4f6fb" : "#0a0e17";
}

/** تهيئة لمرة واحدة عند الإقلاع — تُسجَّل في app.js. */
export function initTheme() {
  apply(appState.get().themePreference);

  appState.subscribe((next, previous) => {
    if (next.themePreference !== previous.themePreference) apply(next.themePreference);
  });

  // السمة "النظام" يجب أن تتبع تغيّر تفضيل نظام التشغيل فورًا، لا بعد انتقال.
  media?.addEventListener("change", () => {
    if (appState.get().themePreference === "system") apply("system");
  });
}

export function setTheme(preference) {
  if (!THEMES.includes(preference)) return;
  writePreference("themePreference", preference);
  appState.set({ themePreference: preference });
}

export function currentThemePreference() {
  return appState.get().themePreference;
}

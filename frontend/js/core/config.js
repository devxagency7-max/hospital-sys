/**
 * إعدادات التطبيق — نقطة واحدة لكل ثابت عام.
 *
 * مطور الباك-إند: تحويل الواجهة من البيانات التجريبية إلى API حقيقي يحتاج
 * تعديل `API.mode` و `API.baseUrl` هنا فقط. راجع docs/11-FRONTEND-CONVENTIONS.md.
 */

export const APP = {
  name: "Hospital ERP",
  /** اسم المستشفى — يظهر في الهيدر وترويسة كل تقرير مطبوع. */
  organization: "مستشفى النيل التخصصي",
  version: "0.1.0",
  /** مرحلة التنفيذ الحالية حسب docs/08-IMPLEMENTATION-PLAN.md. */
  phase: 0,
};

export const API = {
  /**
   * 'mock' = الطلبات تُخدَم من js/mock عبر js/api/mock-adapter.js
   * 'live' = الطلبات تذهب فعلًا إلى baseUrl عبر fetch
   */
  mode: "mock",
  baseUrl: "/api/v1",
  timeoutMs: 20000,
};

export const MOCK = {
  /** تأخير صناعي (ms) حتى تُرى حالات التحميل فعلًا أثناء التطوير. */
  latencyMs: [120, 420],
  /**
   * نسبة فشل عشوائي للطلبات (0 = معطّل). ارفعها مؤقتًا لاختبار حالات الخطأ.
   * لا تترك قيمة غير صفرية في commit.
   */
  failureRate: 0,
};

export const LOCALE = {
  language: "ar",
  direction: "rtl",
  /**
   * نستخدم 'ar-EG-u-nu-latn' لا 'ar-EG' المجردة: الأرقام الهندية (٠١٢) تكسر
   * محاذاة الأعمدة المالية وتُربك النسخ إلى Excel. النص عربي والأرقام لاتينية.
   */
  numberLocale: "ar-EG-u-nu-latn",
  dateLocale: "ar-EG-u-nu-latn",
  currency: "EGP",
  currencyLabel: "ج.م",
  timeZone: "Africa/Cairo",
};

export const TABLE = {
  defaultPageSize: 25,
  pageSizeOptions: [10, 25, 50, 100],
  /** مهلة الكتابة قبل تنفيذ البحث (ms). */
  searchDebounceMs: 280,
};

export const UI = {
  toastDurationMs: 4500,
  /** تحت هذا العرض (px) يتحول الشريط الجانبي إلى درج منبثق. */
  mobileBreakpoint: 1024,
};

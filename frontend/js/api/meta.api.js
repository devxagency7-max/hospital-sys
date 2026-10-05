/**
 * بيانات وصفية عن طبقة البيانات نفسها.
 *
 * سبب وجود هذا الملف: صفحة نظام التصميم كانت تستورد `mock-adapter.js` مباشرة
 * لعرض قائمة الـ endpoints. هذا كسر للقاعدة المعمارية — صفحة تعرف أن البيانات
 * تجريبية. وعند حذف طبقة الـ mock في Phase 7 كانت الصفحة ستنكسر.
 *
 * الآن الصفحة تسأل طبقة الـ API، وطبقة الـ API هي وحدها التي تعرف من أين تأتي
 * الإجابة. في الوضع الحقيقي تُعيد قائمة فارغة بدل أن تنهار.
 */

import { API } from "../core/config.js";

/**
 * يصف الوضع الحالي لطبقة البيانات.
 * @returns {{ mode: string, baseUrl: string, isMock: boolean }}
 */
export function describeDataLayer() {
  return {
    mode: API.mode,
    baseUrl: API.baseUrl,
    isMock: API.mode === "mock",
  };
}

/**
 * قائمة الـ endpoints التي تتوقعها الواجهة.
 *
 * في الوضع التجريبي تُقرأ من جدول المسارات المسجَّل. في الوضع الحقيقي لا
 * تملك الواجهة هذه المعرفة — الخادم هو المرجع — فتُعيد قائمة فارغة.
 *
 * الاستيراد الديناميكي مقصود: في الوضع الحقيقي لا يُحمَّل ملف الـ mock أصلًا.
 *
 * @returns {Promise<string[]>}
 */
export async function describeEndpoints() {
  if (API.mode !== "mock") return [];

  const { registeredEndpoints } = await import("./mock-adapter.js");
  return registeredEndpoints();
}

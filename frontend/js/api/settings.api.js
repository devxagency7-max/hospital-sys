/**
 * واجهة بيانات الإعدادات: المنشأة، التفضيلات، خريطة الربط المحاسبي، الإشعارات.
 */

import { http, fetchList } from "./http.js";
import { invalidateLookups } from "./lookups.api.js";

export async function getCompanyInfo() {
  const payload = await http.get("/settings/company");
  return payload.data;
}

export async function updateCompanyInfo(data) {
  const payload = await http.put("/settings/company", data);
  return payload.data;
}

export async function getPreferences() {
  const payload = await http.get("/settings/preferences");
  return payload.data;
}

export async function updatePreferences(data) {
  const payload = await http.put("/settings/preferences", data);
  return payload.data;
}

/**
 * خريطة الربط المحاسبي: المفتاح ووصفه والحساب المرتبط وهل هو مُعَد.
 *
 * المفتاح غير المُعَد يُعطّل كل عملية تحتاجه — ولذلك `isConfigured` جزء من
 * الاستجابة لا شيء تستنتجه الشاشة.
 */
export async function getPostingMap() {
  const payload = await http.get("/settings/posting-map");
  return payload.data;
}

export async function updatePostingMap(map) {
  const payload = await http.put("/settings/posting-map", map);
  // الربط يُغيّر سلوك كل ترحيل تالٍ — نُفرّغ قوائم الحسابات المخزَّنة.
  invalidateLookups("accounts");
  return payload.data;
}

export function listNotificationPreferences(params = {}) {
  return fetchList("/settings/notifications", params);
}

/**
 * واجهة بيانات المخزون.
 */

import { http, fetchList } from "./http.js";

export function listItems(params = {}) {
  return fetchList("/inventory/items", params);
}

export async function getItem(id) {
  const payload = await http.get(`/inventory/items/${id}`);
  return payload.data;
}

export function listBatches(params = {}) {
  return fetchList("/inventory/batches", params);
}

export function listMovements(params = {}) {
  return fetchList("/inventory/movements", params);
}

/**
 * تنبيهات المخزون: رصيد منخفض، نافد، منتهي الصلاحية، قارب الانتهاء.
 * @returns {Promise<{ lowStock: object[], outOfStock: object[], expired: object[], nearExpiry: object[] }>}
 */
export async function getAlerts() {
  const payload = await http.get("/inventory/alerts");
  return payload.data;
}

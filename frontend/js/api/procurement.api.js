/**
 * عقد المشتريات والمطابقة الثلاثية (أمر الشراء ↔ الاستلام ↔ الفاتورة).
 */

import { http, fetchList } from "./http.js";

/**
 * إذون الإضافة المستلمة التي تنتظر سعر فاتورة المورد — لوحة عمل المحاسب.
 */
export function listReceiptsAwaitingPrice(params = {}) {
  return fetchList("/procurement/awaiting-price", params);
}

/** سجل المطابقات المنفَّذة. `onlyExceptions` يقصره على ما فيه فروق. */
export function listPurchaseMatches(params = {}) {
  return fetchList("/procurement/matches", params);
}

/** تفاصيل مطابقة واحدة مع قيدها وحركتها. */
export async function getPurchaseMatch(id) {
  const payload = await http.get(`/procurement/matches/${encodeURIComponent(id)}`);
  return payload.data;
}

/**
 * معاينة الفروق قبل الاعتماد — لا أثر لها.
 * تُظهر فرق الكمية وفرق السعر والاستثناءات الرقابية.
 */
export async function previewMatch(movementId, data) {
  const path = `/procurement/receipts/${encodeURIComponent(movementId)}/preview-match`;
  const payload = await http.post(path, data);
  return payload.data;
}

/**
 * اعتماد المطابقة: يُسعِّر الاستلام، يُقفل الاستحقاق، ويُثبت مديونية المورد.
 * فرق السعر فوق حد المراجعة يتطلب `varianceReason`.
 */
export async function matchSupplierInvoice(movementId, data) {
  const path = `/procurement/receipts/${encodeURIComponent(movementId)}/match`;
  const payload = await http.post(path, data);
  return payload.data;
}

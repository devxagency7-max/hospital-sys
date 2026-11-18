/**
 * عقد الصرف للمريض — الجسر بين المخزون وحساب المريض.
 */

import { http, fetchList } from "./http.js";

/**
 * الأصناف المتاحة للصرف من مخزن، برصيدها المتاح وسعر بيعها المعتمد.
 * @param {{warehouseId:number, chargeableOnly?:boolean, search?:string}} params
 */
export function listDispensableItems(params = {}) {
  return fetchList("/dispensing/items", params);
}

/** سجل ما صُرف لمريض، مع تكلفته وسعر تحميله وهامش كل بند. */
export function listPatientDispenses(params = {}) {
  return fetchList("/dispensing/patient-log", params);
}

/**
 * صرف صنف واحد لمريض — حركة مخزنية بالتكلفة + تحميل بسعر البيع المعتمد.
 */
export async function dispenseItemToPatient(data) {
  const payload = await http.post("/dispensing/to-patient", data);
  return payload.data;
}

/**
 * صرف سلة أصناف لمريض واحد في عملية واحدة.
 *
 * الفشل الجزئي معلَن في `failed[]` — لا يُخفى ولا يُلغي ما نجح.
 */
export async function dispenseBasketToPatient(data) {
  const payload = await http.post("/dispensing/basket", data);
  return payload.data;
}

/** بنود الصرف القابلة للاسترجاع — غير المفوترة وحدها، في نطاق مخزن المستخدم. */
export function listReturnableDispenses(params = {}) {
  return fetchList("/dispensing/returnable", params);
}

/**
 * استرجاع كمية من بند صُرف: ترجع للرف بتكلفتها الأصلية، وتُرفع عن حساب
 * المريض. بند مفوتر يُرفض — يُعالج بإشعار دائن.
 */
export async function returnDispensedToPatient(data) {
  const payload = await http.post("/dispensing/return", data);
  return payload.data;
}

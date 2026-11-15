/**
 * عقد شرائح التعريفة والعملات وأسعار الصرف.
 */

import { http, fetchList } from "./http.js";

/* ==========================================================================
   شرائح التعريفة
   ========================================================================== */

/** شرائح التعريفة (نقدي · تأمين · وافد · عاملون). */
export function listTariffTiers(params = {}) {
  return fetchList("/pricing/tiers", params);
}

/** جدول سعر خدمة في كل الشرائح، مع مصدر كل سعر (مُعلَن أم محسوب). */
export async function getServicePriceMatrix(serviceId) {
  const payload = await http.get(`/pricing/services/${encodeURIComponent(serviceId)}/matrix`);
  return payload.data;
}

/** شريحة المريض وعملته — تُعرض في ترويسة الفاتورة والاستقبال. */
export async function getPatientTariffProfile(patientId) {
  const payload = await http.get(`/pricing/patients/${encodeURIComponent(patientId)}/profile`);
  return payload.data;
}

/**
 * عرض سعر سلة خدمات لمريض قبل إصدار الفاتورة.
 * @param {{patientId:number, lines:{serviceId:number, quantity?:number}[], date?:string}} data
 */
export async function quoteForPatient(data) {
  const payload = await http.post("/pricing/quote", data);
  return payload.data;
}

/* ==========================================================================
   أسعار الصرف
   ========================================================================== */

/** أسعار الصرف المُعلَنة + السعر الساري لكل عملة اليوم. */
export function listExchangeRates(params = {}) {
  return fetchList("/fx/rates", params);
}

/** السعر الساري لعملة في تاريخ — لا سعر بعد تاريخ المستند أبدًا. */
export async function getExchangeRate(params = {}) {
  const payload = await http.get("/fx/rate", params);
  return payload.data;
}

/**
 * إعلان سعر صرف جديد.
 * يسري على الحركات القادمة فقط — لا يُعدِّل مستندًا صادرًا.
 */
export async function declareExchangeRate(data) {
  const payload = await http.post("/fx/rates", data);
  return payload.data;
}

/** فرق العملة بين إصدار مستند وتحصيله. */
export async function computeExchangeDifference(data) {
  const payload = await http.post("/fx/difference", data);
  return payload.data;
}

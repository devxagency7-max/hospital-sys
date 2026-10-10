/**
 * واجهة بيانات إعدادات النظام والمستشفى.
 */

import { http, fetchList } from "./http.js";

export async function getHospitalInfo() {
  const payload = await http.get("/settings/hospital");
  return payload.data;
}

export async function updateHospitalInfo(data) {
  const payload = await http.put("/settings/hospital", data);
  return payload.data;
}

export function listClinics(params = {}) {
  return fetchList("/settings/clinics", params);
}

export function listTaxes(params = {}) {
  return fetchList("/settings/taxes", params);
}

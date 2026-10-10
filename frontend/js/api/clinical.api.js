/**
 * واجهة بيانات الخدمات الإكلينيكية (المختبر والأشعة).
 */

import { http, fetchList } from "./http.js";

export function listLabRequests(params = {}) {
  return fetchList("/laboratory/requests", params);
}

export async function updateLabRequest(id, patch) {
  const payload = await http.put(`/laboratory/requests/${id}`, patch);
  return payload.data;
}

export function listRadiologyRequests(params = {}) {
  return fetchList("/radiology/requests", params);
}

export async function updateRadiologyRequest(id, patch) {
  const payload = await http.put(`/radiology/requests/${id}`, patch);
  return payload.data;
}

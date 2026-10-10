/**
 * واجهة بيانات موديول الصيدلية.
 */

import { http, fetchList } from "./http.js";

export function listPrescriptions(params = {}) {
  return fetchList("/pharmacy/prescriptions", params);
}

export async function dispensePrescription(id) {
  const payload = await http.post(`/pharmacy/prescriptions/${id}/dispense`);
  return payload.data;
}

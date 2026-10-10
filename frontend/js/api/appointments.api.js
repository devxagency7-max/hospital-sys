/**
 * واجهة بيانات موديول المواعيد والعيادات.
 */

import { http, fetchList } from "./http.js";

export function listAppointments(params = {}) {
  return fetchList("/appointments", params);
}

export function listAppointmentQueue(params = {}) {
  return fetchList("/appointments/queue", params);
}

export async function createAppointment(appointment) {
  const payload = await http.post("/appointments", appointment);
  return payload.data;
}

export async function updateAppointment(id, patch) {
  const payload = await http.put(`/appointments/${id}`, patch);
  return payload.data;
}

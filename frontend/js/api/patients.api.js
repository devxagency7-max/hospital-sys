/**
 * واجهة بيانات المرضى.
 *
 * الشاشات تستدعي هذا الملف فقط — لا تعرف عنوان URL ولا شكل الاستجابة الخام.
 * هذه هي الطبقة التي تحمي 105 شاشة من أي تغيير في الـ API.
 */

import { http, fetchList } from "./http.js";

/**
 * قائمة المرضى — مُرقَّمة.
 * @param {object} params { page, perPage, search, sort, order, status, gender, governorate }
 */
export function listPatients(params = {}) {
  return fetchList("/patients", params);
}

export async function getPatient(id) {
  const payload = await http.get(`/patients/${id}`);
  return payload.data;
}

export async function createPatient(patient) {
  const payload = await http.post("/patients", patient);
  return payload.data;
}

export async function updatePatient(id, patch) {
  const payload = await http.put(`/patients/${id}`, patch);
  return payload.data;
}

/** أرشفة لا حذف — سجل المريض مرتبط بفواتير. */
export async function archivePatient(id) {
  const payload = await http.del(`/patients/${id}`);
  return payload.data;
}

/**
 * كشف حساب المريض الكامل.
 * يُعيد كل الأقسام في طلب واحد؛ تقرير كشف الحساب يعتمد عليها مجتمعة ولا يُصدَّر
 * إن سقط قسم منها (docs/05-REPORTING-SPECIFICATION.md).
 */
export async function getPatientAccount(id) {
  const payload = await http.get(`/patients/${id}/account`);
  return payload.data;
}

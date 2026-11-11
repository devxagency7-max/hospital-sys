/**
 * واجهة برمجة تطبيقات الاستقبال وخدمة المرضى:
 * استعلام حسابات المرضى السريعة، عرض البنود الإجمالية، سندات قبض الاستقبال،
 * وملخصات السداد المعتمدة لموظفي المكاتب الأمامية.
 */

import { http, fetchList } from "./http.js";

/** استعلام قائمة المرضى للبحث السريع في الاستقبال */
export function listReceptionPatients(params = {}) {
  return fetchList("/reception/patients", params);
}

/** جلب كشف الحساب الملخص للاستقبال لمريض محدد (مع تفاصيل العمليات الداخلية للعرض فقط) */
export async function getReceptionPatientSummary(patientId) {
  const payload = await http.get(`/reception/patients/${encodeURIComponent(patientId)}/summary`);
  return payload.data;
}

/** تسجيل سند قبض / دفعة نقدية سريعة بالاستقبال */
export async function createReceptionReceipt(data) {
  const payload = await http.post("/reception/receipts", data);
  return payload.data;
}

/** استعراض سجل المقبوضات والتحصيلات بالاستقبال */
export function listReceptionReceipts(params = {}) {
  return fetchList("/reception/receipts", params);
}

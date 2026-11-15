/**
 * عقد الغرف والأسرّة ودفتر استحقاق الإقامة.
 *
 * الشاشة تستدعي بالاسم ولا تعرف المسار — نقطة التبديل للباك-إند الحقيقي
 * هي js/api/http.js وحدها.
 */

import { http, fetchList } from "./http.js";

/* ==========================================================================
   الوحدات القابلة للحجز (غرف وأسرّة)
   ========================================================================== */

/**
 * قائمة الوحدات.
 * @param {{status?:string, category?:string, floor?:string, roomTypeId?:number, search?:string}} params
 */
export function listRooms(params = {}) {
  return fetchList("/rooms", params);
}

/**
 * لوحة الإشغال مجمَّعة بالدور — المصدر الذي تبني عليه شاشة الاستقبال شبكتها.
 * @returns {Promise<{floors: object[], summary: object}>}
 */
export async function getOccupancyBoard(params = {}) {
  const payload = await http.get("/rooms/occupancy-board", params);
  return payload.data;
}

/** أنواع الوحدات مع تعريفتها اليومية وعدد الفاضي من كل نوع. */
export function listRoomTypes(params = {}) {
  return fetchList("/rooms/types", params);
}

/** بطاقة وحدة واحدة: تعريفتها، شاغلها الحالي، وسجل من شغلها قبله. */
export async function getRoom(id) {
  const payload = await http.get(`/rooms/${encodeURIComponent(id)}`);
  return payload.data;
}

/**
 * تغيير حالة وحدة — للتنظيف والصيانة والإعلان عن الجهوزية فقط.
 * الإشغال لا يُضبط من هنا: هو نتيجة حجز أو خروج.
 */
export async function setRoomStatus(id, data = {}) {
  const payload = await http.post(`/rooms/${encodeURIComponent(id)}/status`, data);
  return payload.data;
}

/* ==========================================================================
   دفتر استحقاق خدمات الإقامة
   ========================================================================== */

/** سطور الاستحقاق — بفلترة بالإقامة أو المريض أو البند. */
export function listAdmissionCharges(params = {}) {
  return fetchList("/patients/admission-charges", params);
}

/** ملخص تكلفة إقامة — مشتق جمعًا لسطور الدفتر. */
export async function getAdmissionCostSummary(admissionId) {
  const path = `/patients/admissions/${encodeURIComponent(admissionId)}/cost-summary`;
  const payload = await http.get(path);
  return payload.data;
}

/**
 * تشغيل محرك الاستحقاق اليومي على كل الإقامات القائمة.
 * آمن التكرار: نفس اليوم لا يُحمَّل مرتين.
 */
export async function runDailyBedCharges(data = {}) {
  const payload = await http.post("/patients/admission-charges/run-daily", data);
  return payload.data;
}

/** إلحاق الليالي الناقصة لإقامة — من الدخول حتى اليوم. */
export async function backfillAdmissionCharges(admissionId) {
  const path = `/patients/admissions/${encodeURIComponent(admissionId)}/backfill-charges`;
  const payload = await http.post(path, {});
  return payload.data;
}

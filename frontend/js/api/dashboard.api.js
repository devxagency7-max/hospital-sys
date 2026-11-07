/**
 * واجهة بيانات لوحة التحكم.
 *
 * طلب واحد يُعيد كل مؤشرات اللوحة. البديل — طلب لكل بطاقة — يعني عشرين طلبًا
 * متوازيًا ولوحة تُبنى على مراحل متقطعة أمام المستخدم.
 */

import { http } from "./http.js";

export async function getSummary() {
  const payload = await http.get("/dashboard/summary");
  return payload.data;
}

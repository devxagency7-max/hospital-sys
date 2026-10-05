/**
 * واجهة بيانات لوحة التحكم.
 */

import { http } from "./http.js";

/**
 * ملخص لوحة التحكم في طلب واحد.
 * @returns {Promise<{ asOf: string, patients: object, revenue: object, invoices: object, inventory: object, approvals: object }>}
 */
export async function getSummary() {
  const payload = await http.get("/dashboard/summary");
  return payload.data;
}

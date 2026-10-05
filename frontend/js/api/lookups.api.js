/**
 * القوائم المرجعية (الأقسام، الأطباء، المخازن…).
 *
 * هذه القوائم تُطلب في كل شاشة فيها فلتر تقريبًا، وهي شبه ثابتة، فنُخزّنها
 * مؤقتًا في الذاكرة. بدون ذلك تُجلب قائمة الأقسام عشرات المرات في الجلسة.
 */

import { http } from "./http.js";

/** @type {Map<string, Promise<object[]>>} */
const cache = new Map();

function cached(key, path) {
  if (!cache.has(key)) {
    const request = http
      .get(path)
      .then((payload) => payload.data)
      .catch((error) => {
        // لا نُخزّن طلبًا فاشلاً، وإلا بقي الخطأ حتى إعادة تحميل الصفحة.
        cache.delete(key);
        throw error;
      });

    cache.set(key, request);
  }

  return cache.get(key);
}

export const getDepartments = () => cached("departments", "/lookups/departments");
export const getDoctors = () => cached("doctors", "/lookups/doctors");
export const getServices = () => cached("services", "/lookups/services");
export const getWarehouses = () => cached("warehouses", "/lookups/warehouses");
export const getSuppliers = () => cached("suppliers", "/lookups/suppliers");
export const getItemCategories = () => cached("categories", "/lookups/categories");
export const getUnits = () => cached("units", "/lookups/units");
export const getPaymentMethods = () => cached("paymentMethods", "/lookups/payment-methods");
export const getGovernorates = () => cached("governorates", "/lookups/governorates");

/** يُفرَّغ بعد تعديل البيانات المرجعية من شاشة الإعدادات. */
export function invalidateLookups(key) {
  if (key) cache.delete(key);
  else cache.clear();
}

/** يحوّل قائمة مرجعية إلى خيارات `<select>`. */
export function toOptions(rows, { value = "id", label = "name" } = {}) {
  return rows.map((row) => ({ value: row[value], label: row[label] }));
}

/**
 * القوائم المرجعية (الحسابات، مراكز التكلفة، العملاء، الأصناف، المخازن…).
 *
 * هذه القوائم تُطلب في كل شاشة فيها فلتر تقريبًا، وهي شبه ثابتة، فنُخزّنها
 * مؤقتًا في الذاكرة. بدون ذلك تُجلب قائمة الحسابات عشرات المرات في الجلسة.
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

/* --- المحاسبة --- */
export const getAccounts = () => cached("accounts", "/lookups/accounts");
export const getCostCenters = () => cached("costCenters", "/lookups/cost-centers");
export const getPeriods = () => cached("periods", "/lookups/periods");
export const getDocumentSources = () => cached("documentSources", "/lookups/document-sources");

/* --- المحاسبة المالية --- */
export const getCustomers = () => cached("customers", "/lookups/customers");
export const getSuppliers = () => cached("suppliers", "/lookups/suppliers");
export const getCashBoxes = () => cached("cashBoxes", "/lookups/cash-boxes");
export const getBankAccounts = () => cached("bankAccounts", "/lookups/bank-accounts");
export const getTaxes = () => cached("taxes", "/lookups/taxes");
export const getAssetCategories = () => cached("assetCategories", "/lookups/asset-categories");
export const getPaymentMethods = () => cached("paymentMethods", "/lookups/payment-methods");

/* --- الموارد البشرية --- */
export const getDepartments = () => cached("departments", "/lookups/departments");
export const getPositions = () => cached("positions", "/lookups/positions");
export const getShifts = () => cached("shifts", "/lookups/shifts");
export const getEmployees = () => cached("employees", "/lookups/employees");

/* --- المخازن --- */
export const getItems = () => cached("items", "/lookups/items");
export const getWarehouses = () => cached("warehouses", "/lookups/warehouses");
export const getItemCategories = () => cached("categories", "/lookups/categories");
export const getUnits = () => cached("units", "/lookups/units");

/* --- عام --- */
export const getGovernorates = () => cached("governorates", "/lookups/governorates");

/* --- أسماء بديلة شائعة --- */
export const getCustomersLookup = getCustomers;
export const getSuppliersLookup = getSuppliers;
export const getEmployeesLookup = getEmployees;
export const getItemsLookup = getItems;
export const getTaxesLookup = getTaxes;

/**
 * يُفرَّغ بعد تعديل البيانات المرجعية.
 *
 * ضرورة لا تحسين: إضافة حساب من شاشة الدليل يجب أن تُظهره في قائمة اختيار
 * الحساب في شاشة القيود فورًا، لا بعد إعادة تحميل الصفحة.
 */
export function invalidateLookups(key) {
  if (key) cache.delete(key);
  else cache.clear();
}

/** يحوّل قائمة مرجعية إلى خيارات `<select>`. */
export function toOptions(rows, { value = "id", label = "name" } = {}) {
  return (rows ?? []).map((row) => ({ value: row[value], label: row[label] }));
}

/**
 * خيارات الحسابات بصيغة «الكود — الاسم».
 *
 * الاسم وحده لا يكفي في دليل فيه «مبيعات محلية» و«مبيعات تصدير» تحت أب
 * واحد: الكود هو ما يُميّز الحساب فعلًا عند الاختيار السريع.
 */
export function toAccountOptions(accounts) {
  return (accounts ?? []).map((account) => ({
    value: account.id,
    label: `${account.code} — ${account.name}`,
  }));
}

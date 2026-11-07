/**
 * واجهة بيانات المخازن:
 * الأصناف، المخازن، الأرصدة، الحركات، التشغيلات، التقييم، الجرد.
 */

import { http, fetchList } from "./http.js";

/* ==========================================================================
   الأصناف والتصنيفات
   ========================================================================== */

export function listItems(params = {}) {
  return fetchList("/inv/items", params);
}

/** الصنف بأرصدته في كل مخزن وحركاته وطبقات تكلفته. */
export async function getItem(id) {
  const payload = await http.get(`/inv/items/${encodeURIComponent(id)}`);
  return payload.data;
}

export async function createItem(item) {
  const payload = await http.post("/inv/items", item);
  return payload.data;
}

export async function updateItem(id, patch) {
  const payload = await http.put(`/inv/items/${encodeURIComponent(id)}`, patch);
  return payload.data;
}

export function listCategories(params = {}) {
  return fetchList("/inv/categories", params);
}

export function listUnits(params = {}) {
  return fetchList("/inv/units", params);
}

/* ==========================================================================
   المخازن
   ========================================================================== */

export function listWarehouses(params = {}) {
  return fetchList("/inv/warehouses", params);
}

export async function getWarehouse(id) {
  const payload = await http.get(`/inv/warehouses/${encodeURIComponent(id)}`);
  return payload.data;
}

/* ==========================================================================
   الأرصدة
   ========================================================================== */

export function listBalances(params = {}) {
  return fetchList("/inv/balances", params);
}

/** رصيد (صنف × مخزن) محسوبًا من الحركات: المتاح والمحجوز ومتوسط التكلفة. */
export async function getBalance({ itemId, warehouseId }) {
  const payload = await http.get("/inv/balance", { itemId, warehouseId });
  return payload.data;
}

/* ==========================================================================
   الحركات
   ========================================================================== */

export function listMovements(params = {}) {
  return fetchList("/inv/movements", params);
}

/** كشف حركة صنف برصيد وقيمة متحركين. */
export async function getItemMovementHistory(params = {}) {
  const payload = await http.get("/inv/movements/history", params);
  return payload.data;
}

/** إذن إضافة. التكلفة إلزامية — بها يُقيَّم المخزون لاحقًا. */
export async function createReceipt(receipt) {
  const payload = await http.post("/inv/receipts", receipt);
  return payload.data;
}

/**
 * إذن صرف. التكلفة **لا تُمرَّر** — يحسبها محرك التقييم من الطبقات،
 * ويُعيدها في `cost` لتعرضها الشاشة.
 */
export async function createIssue(issue) {
  const payload = await http.post("/inv/issues", issue);
  return payload.data;
}

/** تحويل مخزني. يُنشئ حركتين بنفس المرجع ولا يُنتج إيرادًا. */
export async function createTransfer(transfer) {
  const payload = await http.post("/inv/transfers", transfer);
  return payload.data;
}

/** تسوية مخزنية. تُسجَّل معلَّقة ولا تؤثر على الرصيد قبل اعتمادها. */
export async function createAdjustment(adjustment) {
  const payload = await http.post("/inv/adjustments", adjustment);
  return payload.data;
}

export async function approveAdjustment(id) {
  const payload = await http.post(`/inv/adjustments/${encodeURIComponent(id)}/approve`, {});
  return payload.data;
}

/* ==========================================================================
   التشغيلات والصلاحية
   ========================================================================== */

export function listBatches(params = {}) {
  return fetchList("/inv/batches", params);
}

/** المنتهي والقارب على الانتهاء، بقيمة التعرُّض. */
export async function getExpiryReport(params = {}) {
  const payload = await http.get("/inv/expiry", params);
  return payload.data;
}

/* ==========================================================================
   التقييم
   ========================================================================== */

export async function getValuation(params = {}) {
  const payload = await http.get("/inv/valuation", params);
  return payload.data;
}

/** مقارنة FIFO بالمتوسط المرجّح على صنف واحد — بأرقام المنشأة نفسها. */
export async function compareCostingMethods(params = {}) {
  const payload = await http.get("/inv/valuation/compare", params);
  return payload.data;
}

export async function getLowStockReport() {
  const payload = await http.get("/inv/low-stock");
  return payload.data;
}

/** تنبيهات المخزون: نافد، منخفض، منتهي الصلاحية، قارب الانتهاء. */
export async function getAlerts() {
  const payload = await http.get("/inv/alerts");
  return payload.data;
}

/* ==========================================================================
   الجرد الفعلي
   ========================================================================== */

export function listStockCounts(params = {}) {
  return fetchList("/inv/counts", params);
}

export async function getStockCount(id) {
  const payload = await http.get(`/inv/counts/${encodeURIComponent(id)}`);
  return payload.data;
}

/** يبدأ الجرد ويُجمّد الأرصدة الدفترية لحظة البدء. */
export async function startStockCount(id) {
  const payload = await http.post(`/inv/counts/${encodeURIComponent(id)}/start`, {});
  return payload.data;
}

/** يُغلق الجرد ويُنشئ تسوية لكل فرق. */
export async function closeStockCount(id, payload_) {
  const payload = await http.post(`/inv/counts/${encodeURIComponent(id)}/close`, payload_);
  return payload.data;
}

/**
 * واجهة بيانات المحاسبة المالية:
 * العملاء، الموردون، الخزينة، البنوك، الأصول الثابتة، الضرائب، القوائم المالية.
 */

import { http, fetchList } from "./http.js";

/* ==========================================================================
   العملاء
   ========================================================================== */

export function listCustomers(params = {}) {
  return fetchList("/fin/customers", params);
}

export async function getCustomer(id) {
  const payload = await http.get(`/fin/customers/${encodeURIComponent(id)}`);
  return payload.data;
}

/** كشف حساب العميل: فواتيره وتحصيلاته وإشعاراته ورصيده وحد ائتمانه. */
export async function getCustomerAccount(id) {
  const payload = await http.get(`/fin/customers/${encodeURIComponent(id)}/account`);
  return payload.data;
}

export async function createCustomer(customer) {
  const payload = await http.post("/fin/customers", customer);
  return payload.data;
}

export async function updateCustomer(id, patch) {
  const payload = await http.put(`/fin/customers/${encodeURIComponent(id)}`, patch);
  return payload.data;
}

/* ==========================================================================
   فواتير العملاء والتحصيلات
   ========================================================================== */

export function listCustomerInvoices(params = {}) {
  return fetchList("/fin/customer-invoices", params);
}

export async function getCustomerInvoice(id) {
  const payload = await http.get(`/fin/customer-invoices/${encodeURIComponent(id)}`);
  return payload.data;
}

/**
 * يُصدر فاتورة عميل.
 * @returns {Promise<{ invoice:object, journalEntry:object, warnings:string[] }>}
 */
export async function createCustomerInvoice(invoice) {
  const payload = await http.post("/fin/customer-invoices", invoice);
  return payload.data;
}

export function listReceipts(params = {}) {
  return fetchList("/fin/receipts", params);
}

export async function createReceipt(receipt) {
  const payload = await http.post("/fin/receipts", receipt);
  return payload.data;
}

export function listCreditNotes(params = {}) {
  return fetchList("/fin/credit-notes", params);
}

export async function approveCreditNote(id) {
  const payload = await http.post(`/fin/credit-notes/${encodeURIComponent(id)}/approve`, {});
  return payload.data;
}

/* ==========================================================================
   الموردون
   ========================================================================== */

export function listSuppliers(params = {}) {
  return fetchList("/fin/suppliers", params);
}

export async function getSupplier(id) {
  const payload = await http.get(`/fin/suppliers/${encodeURIComponent(id)}`);
  return payload.data;
}

export async function getSupplierAccount(id) {
  const payload = await http.get(`/fin/suppliers/${encodeURIComponent(id)}/account`);
  return payload.data;
}

export async function createSupplier(supplier) {
  const payload = await http.post("/fin/suppliers", supplier);
  return payload.data;
}

export async function updateSupplier(id, patch) {
  const payload = await http.put(`/fin/suppliers/${encodeURIComponent(id)}`, patch);
  return payload.data;
}

export function listSupplierInvoices(params = {}) {
  return fetchList("/fin/supplier-invoices", params);
}

export async function getSupplierInvoice(id) {
  const payload = await http.get(`/fin/supplier-invoices/${encodeURIComponent(id)}`);
  return payload.data;
}

export function listSupplierPayments(params = {}) {
  return fetchList("/fin/supplier-payments", params);
}

export async function createSupplierPayment(payment) {
  const payload = await http.post("/fin/supplier-payments", payment);
  return payload.data;
}

/* ==========================================================================
   تقادم الذمم
   ========================================================================== */

export async function getReceivablesAging(params = {}) {
  const payload = await http.get("/fin/receivables/aging", params);
  return payload.data;
}

export async function getPayablesAging(params = {}) {
  const payload = await http.get("/fin/payables/aging", params);
  return payload.data;
}

/* ==========================================================================
   الخزينة
   ========================================================================== */

export function listCashBoxes(params = {}) {
  return fetchList("/fin/cash-boxes", params);
}

export async function getCashBox(id) {
  const payload = await http.get(`/fin/cash-boxes/${encodeURIComponent(id)}`);
  return payload.data;
}

export function listCashMovements(params = {}) {
  return fetchList("/fin/cash-movements", params);
}

/** إيصال قبض أو صرف نقدي. `direction` تأخذ "in" أو "out". */
export async function createCashVoucher(voucher) {
  const payload = await http.post("/fin/cash-movements", voucher);
  return payload.data;
}

export function listCashReconciliations(params = {}) {
  return fetchList("/fin/cash-reconciliations", params);
}

/**
 * تحويل بين خزينتين أو بين خزينة وبنك.
 * `fromType` و `toType` يأخذان "cash" أو "bank".
 */
export async function createTransfer(transfer) {
  const payload = await http.post("/fin/transfers", transfer);
  return payload.data;
}

/* ==========================================================================
   البنوك
   ========================================================================== */

export function listBankAccounts(params = {}) {
  return fetchList("/fin/bank-accounts", params);
}

export async function getBankAccount(id) {
  const payload = await http.get(`/fin/bank-accounts/${encodeURIComponent(id)}`);
  return payload.data;
}

export function listBankTransactions(params = {}) {
  return fetchList("/fin/bank-transactions", params);
}

export function listBankReconciliations(params = {}) {
  return fetchList("/fin/bank-reconciliations", params);
}

export async function reconcileBank(payload_) {
  const payload = await http.post("/fin/bank-reconciliations", payload_);
  return payload.data;
}

/* ==========================================================================
   الأصول الثابتة والإهلاك
   ========================================================================== */

export function listAssets(params = {}) {
  return fetchList("/fin/assets", params);
}

export async function getAsset(id) {
  const payload = await http.get(`/fin/assets/${encodeURIComponent(id)}`);
  return payload.data;
}

export async function getAssetRegister() {
  const payload = await http.get("/fin/assets/register");
  return payload.data;
}

export function listAssetCategories(params = {}) {
  return fetchList("/fin/asset-categories", params);
}

export async function disposeAsset(id, disposal) {
  const payload = await http.post(`/fin/assets/${encodeURIComponent(id)}/dispose`, disposal);
  return payload.data;
}

export function listDepreciationRuns(params = {}) {
  return fetchList("/fin/depreciation/runs", params);
}

/** معاينة تشغيل الإهلاك — ما سيُهلك وما سيُستثنى ولماذا. */
export async function previewDepreciation(params = {}) {
  const payload = await http.get("/fin/depreciation/preview", params);
  return payload.data;
}

export async function runDepreciation(options = {}) {
  const payload = await http.post("/fin/depreciation/run", options);
  return payload.data;
}

/* ==========================================================================
   الضرائب
   ========================================================================== */

export function listTaxes(params = {}) {
  return fetchList("/fin/taxes", params);
}

export function listTaxReturns(params = {}) {
  return fetchList("/fin/tax-returns", params);
}

export async function createTax(tax) {
  const payload = await http.post("/fin/taxes", tax);
  return payload.data;
}

export async function updateTax(id, patch) {
  const payload = await http.put(`/fin/taxes/${encodeURIComponent(id)}`, patch);
  return payload.data;
}

/* ==========================================================================
   القوائم المالية
   ========================================================================== */

export async function getIncomeStatement(params = {}) {
  const payload = await http.get("/fin/statements/income", params);
  return payload.data;
}

export async function getBalanceSheet(params = {}) {
  const payload = await http.get("/fin/statements/balance-sheet", params);
  return payload.data;
}

export async function getCashFlowStatement(params = {}) {
  const payload = await http.get("/fin/statements/cash-flow", params);
  return payload.data;
}

/** المطابقة بين الأستاذ المساعد والحسابات الرقابية. */
export async function getReconciliationSummary() {
  const payload = await http.get("/fin/reconciliation-summary");
  return payload.data;
}

/**
 * واجهة بيانات المحاسبة العامة.
 *
 * الشاشات تستدعي هذه الدوال بالاسم ولا تعرف شكل المسار أبدًا — وهذا ما يجعل
 * تحويل التطبيق إلى باك-إند حقيقي تعديلًا في ملف واحد (js/core/config.js).
 */

import { http, fetchList } from "./http.js";

/* ==========================================================================
   دليل الحسابات
   ========================================================================== */

export function listAccounts(params = {}) {
  return fetchList("/gl/accounts", params);
}

/** الدليل بشكل شجري مع الأرصدة المُجمَّعة ومشاكل السلامة. */
export async function getAccountsTree(params = {}) {
  const payload = await http.get("/gl/accounts/tree", params);
  return payload.data;
}

/** الحسابات التفصيلية القابلة للترحيل — لكل قائمة اختيار حساب. */
export async function getPostableAccounts() {
  const payload = await http.get("/gl/accounts/postable");
  return payload.data;
}

export async function getAccount(id) {
  const payload = await http.get(`/gl/accounts/${encodeURIComponent(id)}`);
  return payload.data;
}

export async function createAccount(account) {
  const payload = await http.post("/gl/accounts", account);
  return payload.data;
}

export async function updateAccount(id, patch) {
  const payload = await http.put(`/gl/accounts/${encodeURIComponent(id)}`, patch);
  return payload.data;
}

/* ==========================================================================
   قيود اليومية
   ========================================================================== */

export function listJournalEntries(params = {}) {
  return fetchList("/gl/journal", params);
}

export async function getJournalEntry(id) {
  const payload = await http.get(`/gl/journal/${encodeURIComponent(id)}`);
  return payload.data;
}

/** ينشئ قيدًا يدويًا. `submit: true` يُقدّمه للمراجعة فورًا. */
export async function createJournalEntry(entry) {
  const payload = await http.post("/gl/journal", entry);
  return payload.data;
}

export async function submitJournalEntry(id) {
  const payload = await http.post(`/gl/journal/${encodeURIComponent(id)}/submit`, {});
  return payload.data;
}

export async function approveJournalEntry(id) {
  const payload = await http.post(`/gl/journal/${encodeURIComponent(id)}/approve`, {});
  return payload.data;
}

export async function postJournalEntry(id) {
  const payload = await http.post(`/gl/journal/${encodeURIComponent(id)}/post`, {});
  return payload.data;
}

/** يعكس قيدًا مُرحَّلًا. السبب إلزامي. */
export async function reverseJournalEntry(id, { reason, date } = {}) {
  const payload = await http.post(`/gl/journal/${encodeURIComponent(id)}/reverse`, { reason, date });
  return payload.data;
}

/* ==========================================================================
   دفتر الأستاذ وميزان المراجعة
   ========================================================================== */

/** كشف حساب تفصيلي برصيد متحرك. */
export async function getGeneralLedger(params = {}) {
  const payload = await http.get("/gl/ledger", params);
  return payload.data;
}

export async function getTrialBalance(params = {}) {
  const payload = await http.get("/gl/trial-balance", params);
  return payload.data;
}

/* ==========================================================================
   الفترات والسنوات المالية
   ========================================================================== */

export function listFiscalYears(params = {}) {
  return fetchList("/gl/fiscal-years", params);
}

export function listPeriods(params = {}) {
  return fetchList("/gl/periods", params);
}

export async function closePeriod(id) {
  const payload = await http.post(`/gl/periods/${encodeURIComponent(id)}/close`, {});
  return payload.data;
}

export async function reopenPeriod(id, { reason } = {}) {
  const payload = await http.post(`/gl/periods/${encodeURIComponent(id)}/reopen`, { reason });
  return payload.data;
}

/** معاينة إغلاق السنة المالية — ما سيحدث دون تنفيذه. */
export async function getYearClosingPreview(fiscalYearId) {
  const payload = await http.get(`/gl/fiscal-years/${encodeURIComponent(fiscalYearId)}/closing-preview`);
  return payload.data;
}

/* ==========================================================================
   مراكز التكلفة
   ========================================================================== */

export function listCostCenters(params = {}) {
  return fetchList("/gl/cost-centers", params);
}

export async function getCostCenterAnalysis(params = {}) {
  const payload = await http.get("/gl/cost-centers/analysis", params);
  return payload.data;
}

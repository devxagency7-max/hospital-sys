/**
 * واجهة بيانات موديول المحاسبة العامة.
 */

import { http, fetchList } from "./http.js";

export function listAccounts(params = {}) {
  return fetchList("/accounting/accounts", params);
}

export async function createAccount(account) {
  const payload = await http.post("/accounting/accounts", account);
  return payload.data;
}

export function listJournalEntries(params = {}) {
  return fetchList("/accounting/journal", params);
}

export async function createJournalEntry(entry) {
  const payload = await http.post("/accounting/journal", entry);
  return payload.data;
}

export function listCashBoxes(params = {}) {
  return fetchList("/accounting/cash", params);
}

export function listBankAccounts(params = {}) {
  return fetchList("/accounting/banks", params);
}

export function listCostCenters(params = {}) {
  return fetchList("/accounting/cost-centers", params);
}

export function listAccountingPeriods(params = {}) {
  return fetchList("/accounting/periods", params);
}

export async function getTrialBalance() {
  const payload = await http.get("/accounting/trial-balance");
  return payload.data;
}

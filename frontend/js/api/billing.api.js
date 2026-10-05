/**
 * واجهة بيانات الفواتير والمدفوعات.
 */

import { http, fetchList } from "./http.js";

export function listInvoices(params = {}) {
  return fetchList("/invoices", params);
}

export async function getInvoice(id) {
  const payload = await http.get(`/invoices/${id}`);
  return payload.data;
}

export function listPayments(params = {}) {
  return fetchList("/payments", params);
}

export function listRefunds(params = {}) {
  return fetchList("/refunds", params);
}

/** الفواتير غير المسدَّدة كاملة، مرتبة بتاريخ الاستحقاق. */
export function listOutstanding(params = {}) {
  return fetchList("/billing/outstanding", params);
}

/* --------------------------------------------------------------------------
   عمليات الكتابة — غير منفَّذة في طبقة البيانات التجريبية بعد.
   `http` يرمي NOT_IMPLEMENTED، فتُظهر الشاشة خطأً صريحًا بدل نجاح وهمي.
   تُنفَّذ مع شاشات Phase 1.
   -------------------------------------------------------------------------- */

export async function createInvoice(invoice) {
  const payload = await http.post("/invoices", invoice);
  return payload.data;
}

export async function recordPayment(invoiceId, payment) {
  const payload = await http.post(`/invoices/${invoiceId}/payments`, payment);
  return payload.data;
}

export async function createRefund(refund) {
  const payload = await http.post("/refunds", refund);
  return payload.data;
}

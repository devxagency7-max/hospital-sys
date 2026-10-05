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

/**
 * إشعارات الدائن — تصحيح لقيمة فاتورة بعد إصدارها، منفصلة عن المرتجعات.
 * راجع docs/12-BILLING-DOMAIN-MODEL.md للفرق بين المفهومين.
 */
export function listCreditNotes(params = {}) {
  return fetchList("/credit-notes", params);
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

/**
 * يصدر إشعار دائن على فاتورة — لا على مبلغ مُسدَّد.
 * خطأ شائع عند البناء: استدعاء `createRefund` لتصحيح قيمة فاتورة لم تُقدَّم
 * خدمتها كاملة. ذاك تصحيح لجانب الفاتورة، لا لجانب التحصيل — هذه الدالة له.
 */
export async function createCreditNote(creditNote) {
  const payload = await http.post("/credit-notes", creditNote);
  return payload.data;
}

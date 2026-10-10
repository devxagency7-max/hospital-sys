/**
 * واجهة بيانات موديول المشتريات والموردين.
 */

import { http, fetchList } from "./http.js";

export function listPurchaseRequests(params = {}) {
  return fetchList("/purchasing/requests", params);
}

export function listPurchaseOrders(params = {}) {
  return fetchList("/purchasing/orders", params);
}

export function listSupplierInvoices(params = {}) {
  return fetchList("/purchasing/invoices", params);
}

export function listSuppliers(params = {}) {
  return fetchList("/purchasing/suppliers", params);
}

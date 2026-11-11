/**
 * واجهة برمجة تطبيقات حسابات المرضى والخدمات الطبية:
 * المرضى، الإقامة (غرف، عناية مركزة، عمليات)، الفواتير، سندات القبض والدفعات، ودليل الخدمات.
 */

import { http, fetchList } from "./http.js";

/* ==========================================================================
   المرضى
   ========================================================================== */

export function listPatients(params = {}) {
  return fetchList("/patients", params);
}

export async function getPatient(id) {
  const payload = await http.get(`/patients/${encodeURIComponent(id)}`);
  return payload.data;
}

export async function createPatient(data) {
  const payload = await http.post("/patients", data);
  return payload.data;
}

export async function updatePatient(id, patch) {
  const payload = await http.put(`/patients/${encodeURIComponent(id)}`, patch);
  return payload.data;
}

export async function getPatientStatement(id) {
  const payload = await http.get(`/patients/${encodeURIComponent(id)}/statement`);
  return payload.data;
}

export async function getPatientStats() {
  const payload = await http.get("/patients/stats");
  return payload.data;
}

export async function getInsuranceProviders() {
  const payload = await http.get("/patients/insurance-providers");
  return payload.data;
}

/* ==========================================================================
   دليل الخدمات الطبية
   ========================================================================== */

export function listServices(params = {}) {
  return fetchList("/patients/services/list", params);
}

export async function getService(id) {
  const payload = await http.get(`/patients/services/${encodeURIComponent(id)}`);
  return payload.data;
}

export async function createService(data) {
  const payload = await http.post("/patients/services", data);
  return payload.data;
}

/* ==========================================================================
   الإقامة وحالات العناية والعمليات
   ========================================================================== */

export function listAdmissions(params = {}) {
  return fetchList("/patients/admissions/list", params);
}

export async function getAdmission(id) {
  const payload = await http.get(`/patients/admissions/${encodeURIComponent(id)}`);
  return payload.data;
}

export async function createAdmission(data) {
  const payload = await http.post("/patients/admissions", data);
  return payload.data;
}

export async function dischargeAdmission(id, data = {}) {
  const payload = await http.post(`/patients/admissions/${encodeURIComponent(id)}/discharge`, data);
  return payload.data;
}

/* ==========================================================================
   فواتير المرضى
   ========================================================================== */

export function listPatientInvoices(params = {}) {
  return fetchList("/patients/invoices/list", params);
}

export async function getPatientInvoice(id) {
  const payload = await http.get(`/patients/invoices/${encodeURIComponent(id)}`);
  return payload.data;
}

export async function createPatientInvoice(data) {
  const payload = await http.post("/patients/invoices", data);
  return payload.data;
}

/* ==========================================================================
   سندات القبض والدفعات
   ========================================================================== */

export function listPatientReceipts(params = {}) {
  return fetchList("/patients/receipts/list", params);
}

export async function createPatientReceipt(data) {
  const payload = await http.post("/patients/receipts", data);
  return payload.data;
}

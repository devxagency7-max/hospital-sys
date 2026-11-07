/**
 * واجهة بيانات الموارد البشرية:
 * الموظفون، الهيكل التنظيمي، الحضور، الإجازات، السلف، الرواتب.
 */

import { http, fetchList } from "./http.js";

/* ==========================================================================
   الموظفون
   ========================================================================== */

export function listEmployees(params = {}) {
  return fetchList("/hr/employees", params);
}

/** ملف الموظف الكامل: بياناته وأرصدة إجازاته وحضوره وسلفه وقسائمه. */
export async function getEmployee(id) {
  const payload = await http.get(`/hr/employees/${encodeURIComponent(id)}`);
  return payload.data;
}

export async function createEmployee(employee) {
  const payload = await http.post("/hr/employees", employee);
  return payload.data;
}

export async function updateEmployee(id, patch) {
  const payload = await http.put(`/hr/employees/${encodeURIComponent(id)}`, patch);
  return payload.data;
}

/* ==========================================================================
   الهيكل التنظيمي
   ========================================================================== */

export function listDepartments(params = {}) {
  return fetchList("/hr/departments", params);
}

export function listPositions(params = {}) {
  return fetchList("/hr/positions", params);
}

export function listShifts(params = {}) {
  return fetchList("/hr/shifts", params);
}

/** الهيكل التنظيمي بأعداد الموظفين وتكلفة العمالة لكل إدارة. */
export async function getOrganizationChart() {
  const payload = await http.get("/hr/org-chart");
  return payload.data;
}

/* ==========================================================================
   الحضور
   ========================================================================== */

export function listAttendance(params = {}) {
  return fetchList("/hr/attendance", params);
}

export async function getAttendanceReport(params = {}) {
  const payload = await http.get("/hr/attendance/report", params);
  return payload.data;
}

/** يصحّح سجل حضور. السبب إلزامي، والتصحيح مرفوض بعد اعتماد مسيّر الشهر. */
export async function correctAttendance(id, correction) {
  const payload = await http.put(`/hr/attendance/${encodeURIComponent(id)}`, correction);
  return payload.data;
}

export function listHolidays(params = {}) {
  return fetchList("/hr/holidays", params);
}

/* ==========================================================================
   الإجازات
   ========================================================================== */

export async function getLeaveTypes() {
  const payload = await http.get("/hr/leave-types");
  return payload.data;
}

export function listLeaveRequests(params = {}) {
  return fetchList("/hr/leave-requests", params);
}

/** @returns {Promise<{ request:object, balance:object }>} الرصيد يُعاد مع الطلب. */
export async function createLeaveRequest(request) {
  const payload = await http.post("/hr/leave-requests", request);
  return payload.data;
}

export async function approveLeaveRequest(id) {
  const payload = await http.post(`/hr/leave-requests/${encodeURIComponent(id)}/approve`, {});
  return payload.data;
}

export async function rejectLeaveRequest(id, { reason } = {}) {
  const payload = await http.post(`/hr/leave-requests/${encodeURIComponent(id)}/reject`, { reason });
  return payload.data;
}

export async function getLeaveBalances(params = {}) {
  const payload = await http.get("/hr/leave-balances", params);
  return payload.data;
}

/* ==========================================================================
   السلف
   ========================================================================== */

export function listAdvances(params = {}) {
  return fetchList("/hr/advances", params);
}

export async function createAdvance(advance) {
  const payload = await http.post("/hr/advances", advance);
  return payload.data;
}

/* ==========================================================================
   الرواتب
   ========================================================================== */

export function listPayrollRuns(params = {}) {
  return fetchList("/hr/payroll/runs", params);
}

/** المسيّر بقسائمه وتوزيعه على الإدارات وقيديه المحاسبيين. */
export async function getPayrollRun(id) {
  const payload = await http.get(`/hr/payroll/runs/${encodeURIComponent(id)}`);
  return payload.data;
}

/** يُشغّل أو يُعيد تشغيل مسيّر فترة. مرفوض بعد الاعتماد. */
export async function processPayroll(options = {}) {
  const payload = await http.post("/hr/payroll/process", options);
  return payload.data;
}

/** يعتمد المسيّر ويُرحّله محاسبيًا في عملية واحدة. */
export async function approvePayroll(id) {
  const payload = await http.post(`/hr/payroll/runs/${encodeURIComponent(id)}/approve`, {});
  return payload.data;
}

export async function payPayroll(id, options = {}) {
  const payload = await http.post(`/hr/payroll/runs/${encodeURIComponent(id)}/pay`, options);
  return payload.data;
}

export function listPayslips(params = {}) {
  return fetchList("/hr/payslips", params);
}

export async function getPayslip(id) {
  const payload = await http.get(`/hr/payslips/${encodeURIComponent(id)}`);
  return payload.data;
}

export async function getPayrollSettings() {
  const payload = await http.get("/hr/payroll/settings");
  return payload.data;
}

export async function updatePayrollSettings(settings) {
  const payload = await http.put("/hr/payroll/settings", settings);
  return payload.data;
}

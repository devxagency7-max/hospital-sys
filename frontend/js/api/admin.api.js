/**
 * واجهة بيانات الإدارة والنظام: المستخدمون، الأدوار، سجل التدقيق.
 */

import { http, fetchList } from "./http.js";

export function listUsers(params = {}) {
  return fetchList("/admin/users", params);
}

export async function getUser(id) {
  const payload = await http.get(`/admin/users/${encodeURIComponent(id)}`);
  return payload.data;
}

export async function createUser(user) {
  const payload = await http.post("/admin/users", user);
  return payload.data;
}

export async function updateUser(id, patch) {
  const payload = await http.put(`/admin/users/${encodeURIComponent(id)}`, patch);
  return payload.data;
}

export function listRoles(params = {}) {
  return fetchList("/admin/roles", params);
}

/** كتالوج الصلاحيات مُجمَّعًا حسب النطاق — لشاشة إدارة الأدوار. */
export async function getPermissionCatalog() {
  const payload = await http.get("/admin/permissions");
  return payload.data;
}

export function listAuditLogs(params = {}) {
  return fetchList("/admin/audit", params);
}

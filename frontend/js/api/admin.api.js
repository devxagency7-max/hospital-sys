/**
 * واجهة بيانات إدارة المستخدمين وسجل التدقيق.
 */

import { http, fetchList } from "./http.js";

export function listUsers(params = {}) {
  return fetchList("/users", params);
}

export async function createUser(user) {
  const payload = await http.post("/users", user);
  return payload.data;
}

export async function listRoles() {
  const payload = await http.get("/users/roles");
  return payload.data;
}

export function listAuditLogs(params = {}) {
  return fetchList("/audit", params);
}

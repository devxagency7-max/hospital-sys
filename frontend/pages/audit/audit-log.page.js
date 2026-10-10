/**
 * سجل التدقيق والرقابة الأمنية (Audit Log)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { badge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { listAuditLogs } from "../../js/api/admin.api.js";

export default function auditLogPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "سجل التدقيق والرقابة الأمنية الشامل (Audit Trail)",
    description: "تسجيل تفصيلي لكافة الحركات الحساسة وعمليات الدخول والتعديل لحماية أمن النظام.",
  });
  container.appendChild(header);

  const table = dataTable({
    id: "system-audit-log-table",
    fetch: listAuditLogs,
    searchPlaceholder: "بحث بالمستخدم، الحدث، الموديول، أو عنوان IP…",
    columns: [
      {
        key: "timestamp",
        label: "التاريخ والوقت",
        render: (row) => ref(row.timestamp, { class: "font-mono text-muted text-xs" }),
      },
      {
        key: "user",
        label: "المستخدم المنفِّذ",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.user),
      },
      {
        key: "action",
        label: "نوع الحركة",
        render: (row) => badge(row.action, { tone: row.action.includes("دخول") ? "info" : "brand", size: "sm" }),
      },
      {
        key: "module",
        label: "الموديول",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.module),
      },
      {
        key: "details",
        label: "تفاصيل العملية",
        render: (row) => el("span", { class: "text-ink text-xs" }, row.details),
      },
      {
        key: "ip",
        label: "عنوان IP",
        render: (row) => ref(row.ip, { class: "font-mono text-[11px] text-muted" }),
      },
    ],
  });

  container.appendChild(table.element);
  return container;
}

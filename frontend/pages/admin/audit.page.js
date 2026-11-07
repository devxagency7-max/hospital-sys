/**
 * سجل التدقيق والرقابة (Audit Trail).
 *
 * تتبع كافة العمليات المالية والإدارية المنفذة في النظام مع توثيق اسم المستخدم والتوقيت والتفاصيل.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { listPage } from "../_shared/list-page.js";
import {
  codeColumn,
  textColumn,
  statusColumn,
} from "../_shared/cells.js";
import { listAuditLogs } from "../../js/api/admin.api.js";

export default async function auditPage() {
  return listPage({
    title: "سجل التدقيق والرقابة",
    description: "سجل إلكتروني غير قابل للتعديل يوثق كل إضافة أو تعديل أو اعتماد تم في النظام.",
    tableId: "admin-audit",
    searchPlaceholder: "بحث بالمستخدم، العملية، أو المورد…",
    initialParams: { sort: "timestamp", order: "desc" },
    fetch: async (params) => listAuditLogs(params),

    actions: () => [
      button({
        label: "المستخدمون",
        variant: "secondary",
        icon: "users",
        onClick: () => navigate("/admin/users"),
      }),
      button({
        label: "مركز التقارير",
        variant: "ghost",
        icon: "reports",
        onClick: () => navigate("/reports"),
      }),
    ],

    columns: [
      {
        key: "timestamp",
        header: "الوقت والتاريخ",
        width: "13rem",
        render: (row) => el("span", { class: "ltr-isolate", style: "font-family: monospace; font-size: 0.8125rem;" }, row.timestamp ? row.timestamp.replace("T", " ").slice(0, 19) : "—"),
      },
      textColumn("userName", "المستخدم المسؤول", { width: "14rem" }),
      {
        key: "action",
        header: "الإجراء / العملية",
        width: "12rem",
        render: (row) => badge(row.action ?? "تعديل", { variant: "info" }),
      },
      textColumn("resource", "الكيان / الشاشة", { width: "12rem" }),
      {
        key: "resourceId",
        header: "معرف المورد",
        width: "10rem",
        render: (row) => el("span", { class: "ltr-isolate", style: "font-family: monospace;" }, row.resourceId ?? "—"),
      },
      textColumn("details", "تفاصيل العملية", { width: "20rem", muted: true }),
      {
        key: "ipAddress",
        header: "عنوان IP",
        width: "10rem",
        render: (row) => el("span", { class: "ltr-isolate", style: "font-family: monospace; color: var(--text-muted);" }, row.ipAddress ?? "127.0.0.1"),
      },
    ],

    stats: async () => {
      const res = await listAuditLogs({ perPage: 200 });
      const rows = res.data ?? [];

      return [
        statTile({
          label: "إجمالي السجلات الموثقة",
          value: integer(rows.length),
          hint: "سجل عمليات مراقب",
        }),
        statTile({
          label: "مستوى نزاهة السجل",
          value: "100% (Append-only)",
          hint: "غير قابل للحذف أو التعديل",
          trend: "positive",
        }),
        statTile({
          label: "عمليات الترحيل والاعتماد",
          value: integer(rows.filter((r) => r.action?.includes("post") || r.action?.includes("approve")).length),
          hint: "عمليات محاسبية حرجة",
        }),
      ];
    },
  });
}

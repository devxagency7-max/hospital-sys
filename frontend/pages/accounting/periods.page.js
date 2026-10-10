/**
 * الفترات المحاسبية (Accounting Periods)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { statusBadge } from "../../components/common/badge.js";
import { date } from "../../js/core/format.js";
import { listAccountingPeriods } from "../../js/api/accounting.api.js";
import { toast } from "../../components/feedback/toast.js";

export default function accountingPeriodsPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "الفترات والسنوات المالية",
    description: "إدارة وإغلاق الفترات الربع سنوية وترحيل الأرصدة إلى حسابات الأرباح والخسائر.",
  });
  container.appendChild(header);

  const table = dataTable({
    id: "accounting-periods",
    fetch: listAccountingPeriods,
    searchPlaceholder: "بحث بالفترة…",
    columns: [
      {
        key: "name",
        label: "الفترة المالية",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.name),
      },
      {
        key: "startDate",
        label: "تاريخ البدء",
        render: (row) => date(row.startDate),
      },
      {
        key: "endDate",
        label: "تاريخ الانتهاء",
        render: (row) => date(row.endDate),
      },
      {
        key: "entriesCount",
        label: "عدد القيود المسجلة",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-medium text-ink tabular" }, String(row.entriesCount)),
      },
      {
        key: "status",
        label: "الحالة",
        render: (row) => statusBadge(row.status === "closed" ? "cancelled" : "active"),
      },
      {
        key: "closedBy",
        label: "أُغلقت بواسطة",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.closedBy || "—"),
      },
    ],
    rowActions: (row) =>
      row.status === "active"
        ? button({
            label: "إغلاق الفترة",
            variant: "danger",
            size: "sm",
            onClick: () => toast.warning("يتطلب إغلاق الفترة تدقيق ومراجعة كل القيود المسودة أولاً"),
          })
        : null,
  });

  container.appendChild(table.element);
  return container;
}

/**
 * مراكز التكلفة (Cost Centers)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { currency } from "../../js/core/format.js";
import { listCostCenters } from "../../js/api/accounting.api.js";
import { toast } from "../../components/feedback/toast.js";

export default function costCentersPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "مراكز التكلفة والأقسام الإنتاجية",
    description: "توزيع المصروفات والإيرادات على الأقسام الطبية والخدمية لتقييم كفاءة التشغيل.",
    actions: [
      button({
        label: "إضافة مركز تكلفة",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("إضافة مركز تكلفة جديد"),
      }),
    ],
  });
  container.appendChild(header);

  const table = dataTable({
    id: "cost-centers",
    fetch: listCostCenters,
    searchPlaceholder: "بحث بكود أو اسم مركز التكلفة أو المدير المسؤول…",
    columns: [
      {
        key: "code",
        label: "رمز المركز",
        render: (row) => ref(row.code, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "name",
        label: "اسم مركز التكلفة",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.name),
      },
      {
        key: "manager",
        label: "المشرف / المدير المسؤول",
        render: (row) => el("span", { class: "text-muted" }, row.manager),
      },
      {
        key: "budget",
        label: "الموازنة التقديرية",
        numeric: true,
        render: (row) => el("span", { class: "font-mono text-muted tabular" }, currency(row.budget)),
      },
      {
        key: "actualCost",
        label: "المصروف الفعلي",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-rose-600 tabular" }, currency(row.actualCost)),
      },
      {
        key: "revenue",
        label: "الإيراد المحقق",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-emerald-600 tabular" }, currency(row.revenue)),
      },
      {
        key: "status",
        label: "الحالة",
        render: (row) => statusBadge("active"),
      },
    ],
  });

  container.appendChild(table.element);
  return container;
}

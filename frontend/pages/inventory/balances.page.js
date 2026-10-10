/**
 * أرصدة المخزون اللحظية (Stock Balances)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { currency } from "../../js/core/format.js";
import { listItems } from "../../js/api/inventory.api.js";

export default function stockBalancesPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "أرصدة المخزون اللحظية",
    description: "الأرصدة الفعلية المتوفرة والمحجوزة وحدود إعادة الطلب لكافة الأصناف.",
  });
  container.appendChild(header);

  const table = dataTable({
    id: "stock-balances",
    fetch: listItems,
    searchPlaceholder: "بحث بكود الصنف أو الاسم…",
    columns: [
      {
        key: "code",
        label: "كود الصنف",
        render: (row) => ref(row.code, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "name",
        label: "اسم الصنف",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.name),
      },
      {
        key: "category",
        label: "التصنيف",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.category),
      },
      {
        key: "quantityOnHand",
        label: "الرصيد الفعلي في المخزن",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-ink tabular" }, String(row.quantityOnHand ?? 0)),
      },
      {
        key: "reorderLevel",
        label: "حد إعادة الطلب",
        numeric: true,
        render: (row) => el("span", { class: "font-mono text-muted tabular" }, String(row.reorderLevel ?? 20)),
      },
      {
        key: "valuation",
        label: "إجمالي القيمة التقديرية",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-semibold text-emerald-600 tabular" }, currency((row.quantityOnHand || 0) * (row.unitCost || 0))),
      },
      {
        key: "status",
        label: "الحالة",
        render: (row) => statusBadge(row.status),
      },
    ],
  });

  container.appendChild(table.element);
  return container;
}

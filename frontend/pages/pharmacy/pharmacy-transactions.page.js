/**
 * حركات الصيدلية اليومية (Pharmacy Transactions)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { badge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date } from "../../js/core/format.js";
import { listMovements } from "../../js/api/inventory.api.js";

export default function pharmacyTransactionsPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "سجل الحركات اليومية للصيدلية",
    description: "كافة عمليات الصرف للمرضى، الاستلام من المخزن الرئيسي، والإرجاع اليومي.",
  });
  container.appendChild(header);

  const table = dataTable({
    id: "pharmacy-transactions-table",
    fetch: listMovements,
    searchPlaceholder: "بحث برقم الحركة أو اسم الدواء أو الصيدلي…",
    columns: [
      {
        key: "reference",
        label: "رقم الحركة",
        render: (row) => ref(row.reference, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "date",
        label: "التاريخ",
        render: (row) => date(row.date),
      },
      {
        key: "itemName",
        label: "المستحضر الدوائي",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.itemName),
      },
      {
        key: "quantity",
        label: "الكمية المصروفة",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold tabular" }, String(row.quantity)),
      },
      {
        key: "type",
        label: "النوع",
        render: (row) => badge(row.type === "issue" ? "صرف علاج" : "توريد من المخزن", {
          tone: row.type === "issue" ? "info" : "success",
        }),
      },
      {
        key: "performedBy",
        label: "الصيدلي المسؤول",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.performedBy || "مينا سمير"),
      },
    ],
  });

  container.appendChild(table.element);
  return container;
}

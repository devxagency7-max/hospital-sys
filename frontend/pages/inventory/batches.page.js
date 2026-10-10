/**
 * تشغيلات الأدوية والمستلزمات (Batches / Lot Tracking)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date } from "../../js/core/format.js";
import { listBatches } from "../../js/api/inventory.api.js";

export default function batchesPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "سجل التشغيلات (Lots & Batches)",
    description: "تتبع أرقام التشغيلات، تواريخ الإنتاج والانتهاء، والمورد الأصلي لكل دفعة.",
  });
  container.appendChild(header);

  const table = dataTable({
    id: "inventory-batches",
    fetch: listBatches,
    searchPlaceholder: "بحث برقم التشغيلة أو اسم الصنف…",
    columns: [
      {
        key: "batchNumber",
        label: "رقم التشغيلة",
        render: (row) => ref(row.batchNumber, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "itemName",
        label: "اسم الصنف",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.itemName),
      },
      {
        key: "quantity",
        label: "الكمية المتبقية",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-ink tabular" }, String(row.quantity)),
      },
      {
        key: "productionDate",
        label: "تاريخ الإنتاج",
        render: (row) => date(row.productionDate),
      },
      {
        key: "expiryDate",
        label: "تاريخ الانتهاء",
        render: (row) => date(row.expiryDate),
      },
      {
        key: "status",
        label: "حالة التشغيلة",
        render: (row) => statusBadge(row.status || "in_stock"),
      },
    ],
  });

  container.appendChild(table.element);
  return container;
}

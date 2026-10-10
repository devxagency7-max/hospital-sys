/**
 * تشغيلات الأدوية بالصيدلية (Pharmacy Batches)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date } from "../../js/core/format.js";
import { listBatches } from "../../js/api/inventory.api.js";

export default function pharmacyBatchesPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "تشغيلات وأرقام تشغيل الأدوية",
    description: "مطابقة تشغيلات الأدوية المصروفة لتتبع دفعات التصنيع عند الحاجة للسحب الطبي.",
  });
  container.appendChild(header);

  const table = dataTable({
    id: "pharmacy-batches-table",
    fetch: listBatches,
    searchPlaceholder: "بحث برقم التشغيلة أو الدواء…",
    columns: [
      {
        key: "batchNumber",
        label: "رقم التشغيلة",
        render: (row) => ref(row.batchNumber, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "itemName",
        label: "اسم المستحضر الدوائي",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.itemName),
      },
      {
        key: "quantity",
        label: "الكمية الحالية",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold tabular" }, String(row.quantity)),
      },
      {
        key: "expiryDate",
        label: "تاريخ الانتهاء",
        render: (row) => date(row.expiryDate),
      },
      {
        key: "status",
        label: "الحالة",
        render: (row) => statusBadge(row.status || "in_stock"),
      },
    ],
  });

  container.appendChild(table.element);
  return container;
}

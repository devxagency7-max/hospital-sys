/**
 * مخزون الصيدلية الداخلية (Pharmacy Stock)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { currency } from "../../js/core/format.js";
import { listItems } from "../../js/api/inventory.api.js";

export default function pharmacyStockPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "مخزون الأدوية في الصيدلية",
    description: "الأرصدة المتوفرة على الأرفف في الصيدلية الداخلية والخارجية وحدود الأمان.",
  });
  container.appendChild(header);

  const table = dataTable({
    id: "pharmacy-stock-table",
    fetch: (p) => listItems({ ...p, category: "أدوية" }),
    searchPlaceholder: "بحث باسم الدواء أو الكود…",
    columns: [
      {
        key: "code",
        label: "كود الدواء",
        render: (row) => ref(row.code, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "name",
        label: "الاسم التجاري والعلمي",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.name),
      },
      {
        key: "unit",
        label: "الشكل الدوائي",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.unit),
      },
      {
        key: "quantityOnHand",
        label: "الرصيد المتاح بالصيدلية",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-ink tabular" }, String(row.quantityOnHand ?? 0)),
      },
      {
        key: "unitPrice",
        label: "سعر البيع للجمهور",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-emerald-600 tabular" }, currency(row.unitPrice)),
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

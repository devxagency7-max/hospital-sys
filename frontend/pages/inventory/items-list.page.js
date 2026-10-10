/**
 * دليل الأصناف والمخزون (Items List)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { currency } from "../../js/core/format.js";
import { listItems } from "../../js/api/inventory.api.js";
import { toast } from "../../components/feedback/toast.js";

export default function itemsListPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "دليل الأصناف والمستلزمات الطبية",
    description: "الأدوية، المستلزمات الطبية، كواشف المختبر، وأفلام الأشعة مع الأرصدة وأسعار البيع والتكلفة.",
    actions: [
      button({
        label: "إضافة صنف جديد",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("إضافة صنف جديد إلى المخزن"),
      }),
    ],
  });
  container.appendChild(header);

  const table = dataTable({
    id: "inventory-items-list",
    fetch: listItems,
    searchPlaceholder: "بحث بكود الصنف أو الاسم أو التصنيف…",
    filters: [
      {
        key: "status",
        label: "حالة الرصيد",
        options: [
          { value: "", label: "الكل" },
          { value: "in_stock", label: "متوفر" },
          { value: "low_stock", label: "منخفض" },
          { value: "out_of_stock", label: "نافد" },
        ],
      },
    ],
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
        key: "unit",
        label: "الوحدة",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.unit),
      },
      {
        key: "quantityOnHand",
        label: "الرصيد الفعلي",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-ink tabular" }, String(row.quantityOnHand ?? 0)),
      },
      {
        key: "unitCost",
        label: "سعر التكلفة",
        numeric: true,
        render: (row) => el("span", { class: "font-mono text-muted tabular" }, currency(row.unitCost)),
      },
      {
        key: "unitPrice",
        label: "سعر البيع",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-semibold text-emerald-600 tabular" }, currency(row.unitPrice)),
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

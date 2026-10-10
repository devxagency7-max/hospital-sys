/**
 * حركات المخزون (Stock Movements)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { badge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date } from "../../js/core/format.js";
import { listMovements } from "../../js/api/inventory.api.js";

const TYPE_CONFIG = {
  receipt: { label: "إضافة مخزنية", tone: "success" },
  issue: { label: "صرف استهلاك", tone: "danger" },
  transfer: { label: "تحويل مخزني", tone: "info" },
  adjustment: { label: "تسوية جردية", tone: "warning" },
};

export default function stockMovementsPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "سجل حركات المخزون والبطاقة المخزنية",
    description: "تتبع كافة أذون الإضافة والصرف والتحويل بين المستودعات وتسويات الجرد.",
  });
  container.appendChild(header);

  const table = dataTable({
    id: "stock-movements",
    fetch: listMovements,
    searchPlaceholder: "بحث برقم المرجع أو اسم الصنف أو المنفِّذ…",
    columns: [
      {
        key: "reference",
        label: "رقم الحركة / الإذن",
        render: (row) => ref(row.reference, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "date",
        label: "التاريخ",
        render: (row) => date(row.date),
      },
      {
        key: "itemName",
        label: "الصنف",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.itemName),
      },
      {
        key: "type",
        label: "نوع الحركة",
        render: (row) => {
          const cfg = TYPE_CONFIG[row.type] || { label: row.type, tone: "neutral" };
          return badge(cfg.label, { tone: cfg.tone, size: "sm" });
        },
      },
      {
        key: "quantity",
        label: "الكمية",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-ink tabular" }, String(row.quantity)),
      },
      {
        key: "warehouseName",
        label: "المخزن",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.warehouseName || "المخزن الرئيسي"),
      },
      {
        key: "performedBy",
        label: "المسؤول / المنفّذ",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.performedBy || "—"),
      },
    ],
  });

  container.appendChild(table.element);
  return container;
}

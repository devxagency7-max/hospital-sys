/**
 * سجل الخصومات وإشعارات الدائن (Discounts & Credit Notes)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date, currency } from "../../js/core/format.js";
import { listCreditNotes } from "../../js/api/billing.api.js";

export default function discountsListPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "سجل الخصومات وإشعارات الدائن المعتمدة",
    description: "إشعارات الدائن والتخفيضات المصرح بها على الفواتير الطبية ورسوم العمليات.",
  });
  container.appendChild(header);

  const table = dataTable({
    id: "discounts-list",
    fetch: listCreditNotes,
    searchPlaceholder: "بحث برقم إشعار الدائن أو المريض أو السبب…",
    columns: [
      {
        key: "creditNoteNumber",
        label: "رقم إشعار الدائن",
        render: (row) => ref(row.creditNoteNumber, { class: "font-mono font-bold text-amber-600" }),
      },
      {
        key: "patientName",
        label: "المريض",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.patientName),
      },
      {
        key: "date",
        label: "التاريخ",
        render: (row) => date(row.date),
      },
      {
        key: "amount",
        label: "قيمة الخصم / الإشعار",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-amber-600 text-sm tabular" }, currency(row.amount)),
      },
      {
        key: "reason",
        label: "السبب والمبرر",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.reason),
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

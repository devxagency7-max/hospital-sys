/**
 * سجل المرتجعات المالية (Refunds List)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date, currency } from "../../js/core/format.js";
import { listRefunds } from "../../js/api/billing.api.js";

export default function refundsListPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "سجل استرداد الأموال والمرتجعات",
    description: "المبالغ المالية المستردة للمرضى بعد إلغاء أو تعديل الفواتير الصادرة.",
  });
  container.appendChild(header);

  const table = dataTable({
    id: "refunds-list",
    fetch: listRefunds,
    searchPlaceholder: "بحث برقم المرتجع أو الفاتورة أو المريض أو السبب…",
    columns: [
      {
        key: "refundNumber",
        label: "رقم المرتجع",
        render: (row) => ref(row.refundNumber, { class: "font-mono font-bold text-rose-600" }),
      },
      {
        key: "patientName",
        label: "المريض",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.patientName),
      },
      {
        key: "date",
        label: "تاريخ الاسترداد",
        render: (row) => date(row.date),
      },
      {
        key: "amount",
        label: "المبلغ المسترد",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-rose-600 text-sm tabular" }, currency(row.amount)),
      },
      {
        key: "reason",
        label: "سبب الاسترداد",
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

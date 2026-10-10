/**
 * الفواتير والأرصدة المستحقة (Outstanding Invoices)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date, currency } from "../../js/core/format.js";
import { listOutstanding } from "../../js/api/billing.api.js";
import { navigate } from "../../js/core/router.js";

export default function outstandingPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "الفواتير والأرصدة المستحقة للتحصيل",
    description: "الفواتير غير المسددة أو المسددة جزئيًا ومواعيد استحقاقها للمتابعة مع المرضى.",
  });
  container.appendChild(header);

  const table = dataTable({
    id: "outstanding-invoices",
    fetch: listOutstanding,
    searchPlaceholder: "بحث برقم الفاتورة أو اسم المريض أو الطبيب…",
    columns: [
      {
        key: "invoiceNumber",
        label: "رقم الفاتورة",
        render: (row) => ref(row.invoiceNumber, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "patientName",
        label: "المريض",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.patientName),
      },
      {
        key: "dueDate",
        label: "تاريخ الاستحقاق",
        render: (row) => date(row.dueDate || row.date),
      },
      {
        key: "total",
        label: "إجمالي الفاتورة",
        numeric: true,
        render: (row) => el("span", { class: "font-mono text-muted tabular" }, currency(row.total)),
      },
      {
        key: "paid",
        label: "المسدد",
        numeric: true,
        render: (row) => el("span", { class: "font-mono text-emerald-600 tabular" }, currency(row.paid)),
      },
      {
        key: "outstanding",
        label: "المتبقي للتحصيل",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-rose-600 text-sm tabular" }, currency(row.outstanding)),
      },
      {
        key: "status",
        label: "الحالة",
        render: (row) => statusBadge(row.status),
      },
    ],
    rowActions: (row) =>
      button({
        label: "تحصيل فوري",
        variant: "primary",
        size: "sm",
        onClick: () => navigate("/billing/payments"),
      }),
  });

  container.appendChild(table.element);
  return container;
}

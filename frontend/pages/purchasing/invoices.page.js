/**
 * فواتير الموردين (Supplier Invoices)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date, currency } from "../../js/core/format.js";
import { listSupplierInvoices } from "../../js/api/purchasing.api.js";

export default function supplierInvoicesPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "فواتير ومطالبات الموردين",
    description: "فواتير الشراء المستلمة من الموردين بعد مطابقتها مع أوامر الشراء وأذون الاستلام.",
  });
  container.appendChild(header);

  const table = dataTable({
    id: "purchasing-invoices",
    fetch: listSupplierInvoices,
    searchPlaceholder: "بحث برقم الفاتورة أو المورد…",
    columns: [
      {
        key: "invoiceNumber",
        label: "رقم الفاتورة",
        render: (row) => ref(row.invoiceNumber, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "poNumber",
        label: "أمر الشراء",
        render: (row) => ref(row.poNumber, { class: "font-mono text-muted text-xs" }),
      },
      {
        key: "supplierName",
        label: "الشركة الموردة",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.supplierName),
      },
      {
        key: "date",
        label: "تاريخ الفاتورة",
        render: (row) => date(row.date),
      },
      {
        key: "dueDate",
        label: "تاريخ الاستحقاق",
        render: (row) => date(row.dueDate),
      },
      {
        key: "totalAmount",
        label: "القيمة الإجمالية",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-ink tabular" }, currency(row.totalAmount)),
      },
      {
        key: "status",
        label: "حالة السداد",
        render: (row) => statusBadge(row.status),
      },
    ],
  });

  container.appendChild(table.element);
  return container;
}

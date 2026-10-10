/**
 * قائمة الفواتير (Invoices List)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date, currency } from "../../js/core/format.js";
import { listInvoices } from "../../js/api/billing.api.js";
import { navigate } from "../../js/core/router.js";
import { toast } from "../../components/feedback/toast.js";

export default function invoicesListPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "سجل الفواتير والمطالبات",
    description: "إدارة الفواتير الطبية، فواتير الإقامة والعمليات، وحالات السداد والتحصيل.",
    actions: [
      button({
        label: "إنشاء فاتورة جديدة",
        variant: "primary",
        icon: "plus",
        onClick: () => navigate("/billing/invoices/new"),
      }),
    ],
  });
  container.appendChild(header);

  const table = dataTable({
    id: "invoices-list",
    fetch: listInvoices,
    searchPlaceholder: "بحث برقم الفاتورة، كود المريض، أو اسم الطبيب…",
    filters: [
      {
        key: "status",
        label: "حالة الفاتورة",
        options: [
          { value: "", label: "الكل" },
          { value: "paid", label: "مسددة بالكامل" },
          { value: "partially_paid", label: "مسددة جزئيًا" },
          { value: "unpaid", label: "غير مسددة" },
          { value: "cancelled", label: "ملغاة" },
        ],
      },
    ],
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
        key: "doctorName",
        label: "الطبيب",
        render: (row) => el("span", { class: "text-muted" }, row.doctorName || "—"),
      },
      {
        key: "date",
        label: "تاريخ الإصدار",
        render: (row) => date(row.date),
      },
      {
        key: "total",
        label: "الإجمالي",
        numeric: true,
        render: (row) => el("span", { class: "font-mono text-muted tabular" }, currency(row.total)),
      },
      {
        key: "paid",
        label: "المسدد",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-semibold text-emerald-600 tabular" }, currency(row.paid)),
      },
      {
        key: "outstanding",
        label: "المتبقي",
        numeric: true,
        render: (row) =>
          row.outstanding > 0
            ? el("span", { class: "font-mono font-bold text-rose-600 tabular" }, currency(row.outstanding))
            : el("span", { class: "font-mono text-emerald-600 tabular" }, "0.00 ج.م"),
      },
      {
        key: "status",
        label: "الحالة",
        render: (row) => statusBadge(row.status),
      },
    ],
    rowActions: (row) => [
      button({
        label: "طباعة",
        variant: "ghost",
        size: "sm",
        icon: "download",
        onClick: () => {
          toast.success(`جارٍ طباعة الفاتورة ${row.invoiceNumber}`);
          window.print();
        },
      }),
      button({
        label: "تحصيل",
        variant: "subtle",
        size: "sm",
        onClick: () => navigate("/billing/payments"),
      }),
    ],
  });

  container.appendChild(table.element);
  return container;
}

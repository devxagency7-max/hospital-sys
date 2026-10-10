/**
 * الموردون والدائنون (Payables)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { currency } from "../../js/core/format.js";
import { listSupplierInvoices } from "../../js/api/purchasing.api.js";
import { toast } from "../../components/feedback/toast.js";

export default function payablesPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "الموردون والدائنون (حسابات الدفع)",
    description: "متابعة فواتير التوريدات والمستحقات المالية للشركات الموردة للأدوية والمعدات.",
    actions: [
      button({
        label: "سداد دفعة لمورد",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("اختر الفاتورة المطلوبة لتسجيل أمر الدفع"),
      }),
    ],
  });
  container.appendChild(header);

  const table = dataTable({
    id: "payables",
    fetch: listSupplierInvoices,
    searchPlaceholder: "بحث برقم الفاتورة أو اسم المورد…",
    columns: [
      {
        key: "invoiceNumber",
        label: "رقم فاتورة المورد",
        render: (row) => ref(row.invoiceNumber, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "supplierName",
        label: "الشركة / المورد",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.supplierName),
      },
      {
        key: "totalAmount",
        label: "قيمة الفاتورة",
        numeric: true,
        render: (row) => el("span", { class: "font-mono text-muted tabular" }, currency(row.totalAmount)),
      },
      {
        key: "paidAmount",
        label: "المسدد",
        numeric: true,
        render: (row) => el("span", { class: "font-mono text-emerald-600 tabular" }, currency(row.paidAmount)),
      },
      {
        key: "due",
        label: "المستحق المتبقي",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-rose-600 tabular" }, currency(row.totalAmount - row.paidAmount)),
      },
      {
        key: "status",
        label: "الحالة",
        render: (row) => statusBadge(row.status),
      },
    ],
    rowActions: (row) =>
      button({
        label: "سداد",
        variant: "subtle",
        size: "sm",
        onClick: () => toast.success(`تم فتح شاشة سداد للمورد: ${row.supplierName}`),
      }),
  });

  container.appendChild(table.element);
  return container;
}

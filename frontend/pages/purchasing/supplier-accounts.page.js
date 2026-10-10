/**
 * كشف حساب ومستحقات الموردين (Supplier Accounts)
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

export default function supplierAccountsPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "أرصدة وحسابات الموردين والدائنين",
    description: "كشف حساب إجمالي التوريدات، المدفوعات المسددة بشيكات أو تحويلات، والرصيد الدائن المتبقي.",
  });
  container.appendChild(header);

  const table = dataTable({
    id: "supplier-accounts-table",
    fetch: listSupplierInvoices,
    searchPlaceholder: "بحث برقم الفاتورة أو المورد…",
    columns: [
      {
        key: "supplierName",
        label: "الشركة الموردة",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.supplierName),
      },
      {
        key: "invoiceNumber",
        label: "رقم الفاتورة",
        render: (row) => ref(row.invoiceNumber, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "totalAmount",
        label: "إجمالي المفوتر",
        numeric: true,
        render: (row) => el("span", { class: "font-mono text-muted tabular" }, currency(row.totalAmount)),
      },
      {
        key: "paidAmount",
        label: "المسدد للمورد",
        numeric: true,
        render: (row) => el("span", { class: "font-mono text-emerald-600 tabular" }, currency(row.paidAmount)),
      },
      {
        key: "due",
        label: "المستحق المتبقي (رصيد دائن)",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-rose-600 tabular" }, currency(row.totalAmount - row.paidAmount)),
      },
      {
        key: "status",
        label: "حالة السداد",
        render: (row) => statusBadge(row.status),
      },
    ],
    rowActions: (row) =>
      button({
        label: "طباعة كشف الحساب",
        variant: "ghost",
        size: "sm",
        onClick: () => {
          toast.success(`جارٍ طباعة كشف حساب: ${row.supplierName}`);
          window.print();
        },
      }),
  });

  container.appendChild(table.element);
  return container;
}

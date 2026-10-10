/**
 * العملاء والمدينون (Receivables)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { currency } from "../../js/core/format.js";
import { listOutstanding } from "../../js/api/billing.api.js";
import { navigate } from "../../js/core/router.js";

export default function receivablesPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "العملاء والمدينون (حسابات القبض)",
    description: "متابعة المديونيات المستحقة على المرضى وشركات التأمين الصحي والجهات المتعاقدة.",
    actions: [
      button({
        label: "تحصيل دفعة",
        variant: "primary",
        icon: "plus",
        onClick: () => navigate("/billing/payments"),
      }),
    ],
  });
  container.appendChild(header);

  const table = dataTable({
    id: "receivables",
    fetch: listOutstanding,
    searchPlaceholder: "بحث برقم الفاتورة أو اسم المريض…",
    columns: [
      {
        key: "invoiceNumber",
        label: "رقم الفاتورة",
        render: (row) => ref(row.invoiceNumber, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "patientName",
        label: "العميل / المريض",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.patientName),
      },
      {
        key: "total",
        label: "إجمالي الفاتورة",
        numeric: true,
        render: (row) => el("span", { class: "font-mono text-muted tabular" }, currency(row.total)),
      },
      {
        key: "paid",
        label: "المُسدَّد",
        numeric: true,
        render: (row) => el("span", { class: "font-mono text-emerald-600 tabular" }, currency(row.paid)),
      },
      {
        key: "outstanding",
        label: "المبلغ المستحق (المديونية)",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-rose-600 tabular" }, currency(row.outstanding)),
      },
      {
        key: "status",
        label: "حالة السداد",
        render: (row) => statusBadge(row.status),
      },
    ],
    rowActions: (row) =>
      button({
        label: "كشف حساب",
        variant: "ghost",
        size: "sm",
        onClick: () => navigate(`/patients/accounts`),
      }),
  });

  container.appendChild(table.element);
  return container;
}

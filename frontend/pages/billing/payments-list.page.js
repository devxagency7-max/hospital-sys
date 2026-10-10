/**
 * سجل المدفوعات والمقبوضات (Payments List)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date, currency } from "../../js/core/format.js";
import { listPayments } from "../../js/api/billing.api.js";
import { toast } from "../../components/feedback/toast.js";

const METHOD_LABELS = {
  cash: "نقدي",
  card: "بطاقة بنكية",
  transfer: "تحويل بنكي",
  insurance: "تأمين",
};

export default function paymentsListPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "سجل المدفوعات والمتحصلات",
    description: "إيصالات السداد النقدية والإلكترونية الصادرة للمرضى مع تفاصيل طرق الدفع.",
    actions: [
      button({
        label: "تسجيل دفعة جديدة",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("اختر الفاتورة المراد تحصيلها من شاشة الفواتير"),
      }),
    ],
  });
  container.appendChild(header);

  const table = dataTable({
    id: "payments-list",
    fetch: listPayments,
    searchPlaceholder: "بحث برقم الإيصال أو المرجع…",
    columns: [
      {
        key: "reference",
        label: "رقم الإيصال / المرجع",
        render: (row) => ref(row.reference, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "date",
        label: "تاريخ السداد",
        render: (row) => date(row.date),
      },
      {
        key: "amount",
        label: "المبلغ المحصل",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-emerald-600 text-sm tabular" }, currency(row.amount)),
      },
      {
        key: "method",
        label: "طريقة الدفع",
        render: (row) => badge(METHOD_LABELS[row.method] || row.method, { tone: "info" }),
      },
      {
        key: "invoiceId",
        label: "رقم الفاتورة",
        render: (row) => ref(`INV-${row.invoiceId}`, { class: "font-mono text-muted" }),
      },
    ],
    rowActions: (row) =>
      button({
        label: "طباعة إيصال",
        variant: "ghost",
        size: "sm",
        onClick: () => {
          toast.success(`جارٍ طباعة إيصال السداد ${row.reference}`);
          window.print();
        },
      }),
  });

  container.appendChild(table.element);
  return container;
}

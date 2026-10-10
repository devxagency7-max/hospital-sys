/**
 * طلبات الشراء الداخلية (Purchase Requests)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date, currency } from "../../js/core/format.js";
import { listPurchaseRequests } from "../../js/api/purchasing.api.js";
import { toast } from "../../components/feedback/toast.js";

export default function purchaseRequestsPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "طلبات الشراء والاحتياجات",
    description: "طلبات توفير الأدوية والمستلزمات الطبية المرفوعة من الأقسام للاعتماد المالي والإداري.",
    actions: [
      button({
        label: "تقديم طلب شراء جديد",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("تقديم طلب شراء جديد"),
      }),
    ],
  });
  container.appendChild(header);

  const table = dataTable({
    id: "purchase-requests",
    fetch: listPurchaseRequests,
    searchPlaceholder: "بحث برقم الطلب أو القسم أو مقدم الطلب…",
    columns: [
      {
        key: "requestNumber",
        label: "رقم الطلب",
        render: (row) => ref(row.requestNumber, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "department",
        label: "القسم الطالب",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.department),
      },
      {
        key: "requestedBy",
        label: "مقدم الطلب",
        render: (row) => el("span", { class: "text-muted" }, row.requestedBy),
      },
      {
        key: "date",
        label: "تاريخ الطلب",
        render: (row) => date(row.date),
      },
      {
        key: "itemsCount",
        label: "عدد البنود",
        numeric: true,
        render: (row) => el("span", { class: "font-mono text-ink tabular" }, String(row.itemsCount)),
      },
      {
        key: "estimatedTotal",
        label: "القيمة التقديرية",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-ink tabular" }, currency(row.estimatedTotal)),
      },
      {
        key: "priority",
        label: "الأولوية",
        render: (row) => badge(row.priority === "urgent" ? "عاجل" : "عادي", {
          tone: row.priority === "urgent" ? "danger" : "neutral",
        }),
      },
      {
        key: "status",
        label: "الحالة",
        render: (row) => badge(row.status === "approved" ? "معتمد" : "قيد المراجعة", {
          tone: row.status === "approved" ? "success" : "warning",
        }),
      },
    ],
  });

  container.appendChild(table.element);
  return container;
}

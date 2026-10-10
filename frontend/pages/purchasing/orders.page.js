/**
 * أوامر الشراء الصادرة للموردين (Purchase Orders)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date, currency } from "../../js/core/format.js";
import { listPurchaseOrders } from "../../js/api/purchasing.api.js";
import { toast } from "../../components/feedback/toast.js";

export default function purchaseOrdersPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "أوامر الشراء المعتمدة (Purchase Orders)",
    description: "أوامر التوريد الرسمية الصادرة للشركات الموردة مع متابعة مواعيد الشحن والاستلام.",
    actions: [
      button({
        label: "إصدار أمر شراء جديد",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("إصدار أمر شراء رسمي"),
      }),
    ],
  });
  container.appendChild(header);

  const table = dataTable({
    id: "purchase-orders",
    fetch: listPurchaseOrders,
    searchPlaceholder: "بحث برقم أمر الشراء أو اسم المورد…",
    columns: [
      {
        key: "orderNumber",
        label: "رقم أمر الشراء",
        render: (row) => ref(row.orderNumber, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "supplierName",
        label: "المورد",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.supplierName),
      },
      {
        key: "date",
        label: "تاريخ الإصدار",
        render: (row) => date(row.date),
      },
      {
        key: "deliveryDate",
        label: "تاريخ التوريد المتوقع",
        render: (row) => date(row.deliveryDate),
      },
      {
        key: "totalAmount",
        label: "إجمالي الأمر",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-ink tabular" }, currency(row.totalAmount)),
      },
      {
        key: "status",
        label: "حالة التوريد",
        render: (row) =>
          badge(
            row.status === "delivered" ? "تم الاستلام" : row.status === "in_transit" ? "قيد الشحن" : "معتمد للتوريد",
            { tone: row.status === "delivered" ? "success" : row.status === "in_transit" ? "info" : "warning" },
          ),
      },
    ],
  });

  container.appendChild(table.element);
  return container;
}

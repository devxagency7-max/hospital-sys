/**
 * فواتير الموردين (المشتريات).
 *
 * متابعة فواتير الموردين، أرصدة الاستحقاق، ومواعيد السداد.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import { listPage } from "../_shared/list-page.js";
import {
  codeColumn,
  dateColumn,
  textColumn,
  moneyColumn,
  statusColumn,
  totalCell,
} from "../_shared/cells.js";
import { listSupplierInvoices } from "../../js/api/finance.api.js";

export default async function supplierInvoicesPage() {
  return listPage({
    title: "فواتير الموردين",
    description: "إدارة فواتير مشتريات البضائع والخدمات ومتابعة مواعيد الاستحقاق والدفع.",
    tableId: "fin-supplier-invoices",
    searchPlaceholder: "بحث برقم الفاتورة، رقم فاتورة المورد، أو اسم المورد…",
    initialParams: { sort: "date", order: "desc" },
    fetch: async (params) => listSupplierInvoices(params),

    actions: () => [
      button({
        label: "مدفوعات الموردين",
        variant: "secondary",
        icon: "billing",
        onClick: () => navigate("/fin/supplier-payments"),
      }),
      button({
        label: "تقارير الذمم",
        variant: "ghost",
        icon: "reports",
        onClick: () => navigate("/reports/receivables"),
      }),
    ],

    columns: [
      codeColumn("invoiceNumber", "رقم الفاتورة بالنظام", { width: "12rem" }),
      codeColumn("supplierInvoiceNumber", "رقم فاتورة المورد", { width: "12rem" }),
      dateColumn("date", "تاريخ الفاتورة"),
      dateColumn("dueDate", "تاريخ الاستحقاق"),
      textColumn("supplierName", "المورد", { width: "18rem" }),
      moneyColumn("total", "إجمالي الفاتورة"),
      moneyColumn("remaining", "المتبقي للسداد", { signed: false }),
      statusColumn(),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 5 },
            { value: totalCell(money.sumBy(rows, "total")), numeric: true },
            { value: totalCell(money.sumBy(rows, "remaining")), numeric: true },
            { value: "", colspan: 1 },
          ]
        : null,

    stats: async () => {
      const res = await listSupplierInvoices({ perPage: 200 });
      const rows = res.data ?? [];
      const totalAmount = money.sumBy(rows, "total");
      const remainingAmount = money.sumBy(rows, "remaining");
      const overdueCount = rows.filter((r) => r.status === "overdue" || (r.remaining > 0 && r.dueDate && new Date(r.dueDate) < new Date())).length;

      return [
        statTile({
          label: "إجمالي فواتير المشتريات",
          value: amount(totalAmount),
          hint: `${integer(rows.length)} فاتورة`,
        }),
        statTile({
          label: "المتبقي غير المسدد",
          value: amount(remainingAmount),
          hint: "ذمم مستحقة للموردين",
          trend: "negative",
        }),
        statTile({
          label: "الفواتير المتأخرة",
          value: integer(overdueCount),
          hint: "تجاوزت تاريخ الاستحقاق",
          trend: overdueCount > 0 ? "negative" : "positive",
        }),
      ];
    },
  });
}

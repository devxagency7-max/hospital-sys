/**
 * فواتير العملاء.
 *
 * حالة التسوية (مسدَّدة / جزئيًا / غير مسدَّدة) مُشتقّة من الأرقام لا مُدخَلة،
 * فلا تتناقض بين الجدول وكشف الحساب — راجع js/domain/invoicing.js.
 */

import { el } from "../../js/core/dom.js";
import { buttonGroup, iconButton, button } from "../../components/common/button.js";
import { statTile } from "../../components/common/card.js";
import { badge } from "../../components/common/badge.js";
import { amount, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { statusOptions } from "../../js/core/statuses.js";
import * as money from "../../js/core/money.js";
import { listPage } from "../_shared/list-page.js";
import { moneyColumn, dateColumn, statusColumn, codeColumn, textColumn, totalCell } from "../_shared/cells.js";
import { listCustomerInvoices } from "../../js/api/finance.api.js";
import { getCustomers, toOptions } from "../../js/api/lookups.api.js";
import { daysOverdue } from "../../js/domain/aging.js";

const TODAY = new Date().toISOString().slice(0, 10);

export default async function customerInvoicesPage() {
  const customers = await getCustomers();

  return listPage({
    title: "فواتير العملاء",
    description: "الفواتير الصادرة وحالة تسويتها. الفاتورة الصادرة سجل ثابت — تصحيحها بإشعار دائن.",
    tableId: "fin-customer-invoices",
    searchPlaceholder: "بحث برقم الفاتورة أو اسم العميل…",
    initialParams: { sort: "date", order: "desc" },
    fetch: listCustomerInvoices,

    actions: () => [
      button({
        label: "إصدار فاتورة",
        variant: "primary",
        icon: "plus",
        permission: "fin.customer.invoice",
        onClick: () => navigate("/fin/customer-invoices/new"),
      }),
    ],

    filters: [
      { key: "status", label: "حالة التسوية", options: statusOptions(["unpaid", "partially_paid", "paid", "overpaid"]) },
      { key: "customerId", label: "العميل", options: toOptions(customers) },
    ],

    columns: [
      codeColumn("invoiceNumber", "رقم الفاتورة", { width: "9.5rem" }),
      dateColumn("date", "التاريخ"),
      textColumn("customerName", "العميل", { width: "14rem", sortable: true }),
      {
        key: "dueDate",
        label: "الاستحقاق",
        width: "8.5rem",
        sortable: true,
        render: (row) => {
          const days = daysOverdue(row, TODAY);
          const overdue = days > 0 && money.isPositive(row.remaining);

          return el(
            "div",
            { class: "flex flex-col gap-0.5" },
            el("span", { class: "num text-xs" }, String(row.dueDate ?? "—")),
            /* التأخر يُحسب على الاستحقاق والمتبقي معًا: فاتورة مسدَّدة
               تجاوز استحقاقها ليست متأخرة — الدين انتهى. */
            overdue
              ? badge(`متأخرة ${integer(days)} يوم`, { tone: "danger", size: "sm" })
              : days <= 0 && money.isPositive(row.remaining)
                ? el("span", { class: "text-[10px] text-faint" }, `بعد ${integer(-days)} يوم`)
                : null,
          );
        },
      },
      moneyColumn("subtotal", "قبل الضريبة", { hidden: true }),
      moneyColumn("tax", "الضريبة", { hidden: true }),
      moneyColumn("total", "الإجمالي"),
      moneyColumn("paid", "المسدَّد"),
      moneyColumn("remaining", "المتبقي"),
      statusColumn(),
      textColumn("paymentTermsLabel", "الشروط", { width: "7rem", muted: true, hidden: true }),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 4 },
            { value: totalCell(money.sumBy(rows, "subtotal")), numeric: true },
            { value: totalCell(money.sumBy(rows, "tax")), numeric: true },
            { value: totalCell(money.sumBy(rows, "total")), numeric: true },
            { value: totalCell(money.sumBy(rows, "paid")), numeric: true },
            { value: totalCell(money.sumBy(rows, "remaining")), numeric: true },
            { value: "", colspan: 3 },
          ]
        : null,

    onRowClick: (row) => navigate(`/fin/customer-invoices/${row.id}`),

    rowActions: (row) =>
      buttonGroup(
        iconButton("eye", { label: "تفاصيل الفاتورة", onClick: () => navigate(`/fin/customer-invoices/${row.id}`) }),
        money.isPositive(row.remaining)
          ? iconButton("money", {
              label: "تسجيل تحصيل",
              permission: "fin.customer.receipt",
              onClick: () => navigate(`/fin/receipts?invoiceId=${row.id}`),
            })
          : null,
      ),

    stats: async () => {
      const [all, unpaid, partial, paid] = await Promise.all([
        listCustomerInvoices({ perPage: 200 }),
        listCustomerInvoices({ perPage: 1, status: "unpaid" }),
        listCustomerInvoices({ perPage: 1, status: "partially_paid" }),
        listCustomerInvoices({ perPage: 1, status: "paid" }),
      ]);

      const rows = all.data;
      const overdue = rows.filter((row) => money.isPositive(row.remaining) && daysOverdue(row, TODAY) > 0);

      return [
        statTile({ label: "إجمالي الفواتير", value: integer(all.meta.total), tone: "neutral", icon: "fileText" }),
        statTile({ label: "قيمة المفوتر", value: amount(money.sumBy(rows, "total")), tone: "info", icon: "receipt" }),
        statTile({ label: "المتبقي", value: amount(money.sumBy(rows, "remaining")), tone: "warning", icon: "clock" }),
        statTile({
          label: "متأخرة",
          value: integer(overdue.length),
          hint: overdue.length ? amount(money.sumBy(overdue, "remaining")) : null,
          tone: overdue.length ? "danger" : "success",
          icon: "alertTriangle",
        }),
        statTile({
          label: "مسدَّدة بالكامل",
          value: integer(paid.meta.total),
          hint: `${integer(unpaid.meta.total)} غير مسدَّدة · ${integer(partial.meta.total)} جزئيًا`,
          tone: "success",
          icon: "checkCircle",
        }),
      ];
    },
  });
}

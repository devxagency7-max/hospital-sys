/**
 * إشعارات الدائن للعملاء (مردودات ومسموحات المبيعات).
 *
 * متابعة إشعارات الدائن، مراجعتها، واعتمادها محاسبيًا لتسوية فواتير العملاء.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import { toast } from "../../components/common/toast.js";
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
import { listCreditNotes, approveCreditNote } from "../../js/api/finance.api.js";

export default async function creditNotesPage() {
  return listPage({
    title: "إشعارات الدائن للعملاء",
    description: "إدارة مردودات المبيعات والخصومات اللاحقة واعتماد إشعارات الخصم.",
    tableId: "fin-credit-notes",
    searchPlaceholder: "بحث برقم الإشعار، رقم الفاتورة، أو اسم العميل…",
    initialParams: { sort: "date", order: "desc" },
    fetch: async (params) => listCreditNotes(params),

    actions: () => [
      button({
        label: "فواتير العملاء",
        variant: "secondary",
        icon: "billing",
        onClick: () => navigate("/fin/customer-invoices"),
      }),
      button({
        label: "التحصيلات",
        variant: "ghost",
        icon: "check",
        onClick: () => navigate("/fin/receipts"),
      }),
    ],

    columns: [
      codeColumn("creditNoteNumber", "رقم الإشعار", { width: "12rem" }),
      dateColumn("date", "التاريخ"),
      textColumn("invoiceNumber", "رقم الفاتورة الأصلية", { width: "12rem" }),
      textColumn("customerName", "العميل", { width: "18rem" }),
      textColumn("reason", "السبب / البيان", { width: "16rem", muted: true }),
      moneyColumn("amount", "مبلغ الإشعار"),
      statusColumn(),
      {
        key: "actions",
        header: "الإجراءات",
        width: "9rem",
        render: (row) => {
          if (row.status === "pending_approval" || row.status === "draft") {
            return button({
              label: "اعتماد وترحيل",
              variant: "primary",
              size: "small",
              icon: "check",
              onClick: async () => {
                try {
                  await approveCreditNote(row.id);
                  toast.success(`تم اعتماد إشعار الدائن ${row.creditNoteNumber} بنجاح.`);
                  navigate("/fin/credit-notes");
                } catch (err) {
                  toast.error(err.message ?? "تعذر اعتماد الإشعار.");
                }
              },
            });
          }
          return el("span", { style: "color: var(--text-muted); font-size: 0.8125rem;" }, "معتمد ومرحل");
        },
      },
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 5 },
            { value: totalCell(money.sumBy(rows, "amount")), numeric: true },
            { value: "", colspan: 2 },
          ]
        : null,

    stats: async () => {
      const res = await listCreditNotes({ perPage: 200 });
      const rows = res.data ?? [];

      return [
        statTile({
          label: "إجمالي إشعارات الدائن",
          value: amount(money.sumBy(rows, "amount")),
          hint: `${integer(rows.length)} إشعار مسجل`,
        }),
        statTile({
          label: "الإشعارات المعتمدة",
          value: amount(money.sumBy(rows.filter((r) => r.status === "approved"), "amount")),
          hint: "تم تسويتها مع الفواتير",
          trend: "positive",
        }),
        statTile({
          label: "في انتظار الاعتماد",
          value: integer(rows.filter((r) => r.status === "pending_approval" || r.status === "draft").length),
          hint: "تتطلب موافقة المدير المالي",
          trend: "neutral",
        }),
      ];
    },
  });
}

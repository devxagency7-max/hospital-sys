/**
 * التحصيلات وسندات القبض من العملاء.
 *
 * إدارة مدفوعات العملاء، سندات القبض النقدية والبنكية، وربطها بالفواتير.
 */

import { el, clear } from "../../js/core/dom.js";
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
import { listReceipts, createReceipt, listCustomerInvoices } from "../../js/api/finance.api.js";
import { openModal } from "../../components/common/modal.js";

const METHOD_LABELS = {
  cash: "نقدي (خزينة)",
  bank_transfer: "تحويل بنكي",
  cheque: "شيك بنكي",
  credit_card: "بطاقة دفع",
};

export default async function receiptsPage() {
  return listPage({
    title: "التحصيلات وسندات القبض",
    description: "متابعة مقبوضات العملاء، تسوية الفواتير، وحركات إيداع الخزينة والبنوك.",
    tableId: "fin-receipts",
    searchPlaceholder: "بحث برقم السند، رقم الفاتورة، أو اسم العميل…",
    initialParams: { sort: "date", order: "desc" },
    fetch: async (params) => listReceipts(params),

    actions: () => [
      button({
        label: "+ سند قبض جديد",
        variant: "primary",
        icon: "check",
        onClick: () => openNewReceiptModal(),
      }),
      button({
        label: "فواتير العملاء",
        variant: "secondary",
        icon: "billing",
        onClick: () => navigate("/fin/customer-invoices"),
      }),
    ],

    columns: [
      codeColumn("receiptNumber", "رقم السند", { width: "11rem" }),
      dateColumn("date", "تاريخ القبض"),
      textColumn("invoiceNumber", "رقم الفاتورة", { width: "11rem" }),
      textColumn("customerName", "العميل", { width: "18rem" }),
      {
        key: "method",
        header: "طريقة السداد",
        render: (row) =>
          badge(METHOD_LABELS[row.method] ?? row.method ?? "تحويل بنكي", { variant: "info" }),
      },
      moneyColumn("amount", "المبلغ المحصَّل"),
      textColumn("reference", "المرجع / الشيك", { width: "12rem", muted: true }),
      statusColumn(),
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
      const res = await listReceipts({ perPage: 200 });
      const rows = res.data ?? [];
      const totalAmount = money.sumBy(rows, "amount");

      return [
        statTile({
          label: "إجمالي التحصيلات",
          value: amount(totalAmount),
          hint: `${integer(rows.length)} سند قبض`,
          trend: "positive",
        }),
        statTile({
          label: "التحصيلات النقدية",
          value: amount(money.sumBy(rows.filter((r) => r.method === "cash"), "amount")),
          hint: "خزائن الشركة",
        }),
        statTile({
          label: "التحصيلات البنكية",
          value: amount(money.sumBy(rows.filter((r) => r.method !== "cash"), "amount")),
          hint: "حوالات وشيكات",
        }),
      ];
    },
  });

  async function openNewReceiptModal() {
    const invRes = await listCustomerInvoices({ perPage: 100 });
    const unpaidInvoices = (invRes.data ?? []).filter((inv) => inv.remaining > 0);

    if (!unpaidInvoices.length) {
      toast.info("لا توجد فواتير عملاء غير مسددة حالياً.");
      return;
    }

    const form = el("div", { style: "display: flex; flex-direction: column; gap: 1rem; padding: 0.5rem 0;" });

    // اختيار الفاتورة
    const invSelect = el("select", {
      class: "form-select",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });
    unpaidInvoices.forEach((inv) => {
      const opt = el(
        "option",
        { value: inv.id },
        `${inv.invoiceNumber ?? inv.number} — ${inv.customerName} (المتبقي: ${amount(inv.remaining)})`
      );
      invSelect.appendChild(opt);
    });

    // المبلغ
    const amountInput = el("input", {
      type: "number",
      min: "0.01",
      step: "0.01",
      class: "form-input",
      value: unpaidInvoices[0]?.remaining ?? "",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    invSelect.addEventListener("change", (e) => {
      const selected = unpaidInvoices.find((inv) => String(inv.id) === String(e.target.value));
      if (selected) amountInput.value = selected.remaining;
    });

    // طريقة الدفع
    const methodSelect = el("select", {
      class: "form-select",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });
    [
      { id: "bank_transfer", label: "تحويل بنكي" },
      { id: "cash", label: "نقدي (خزينة)" },
      { id: "cheque", label: "شيك بنكي" },
    ].forEach((m) => {
      methodSelect.appendChild(el("option", { value: m.id }, m.label));
    });

    // التاريخ
    const dateInput = el("input", {
      type: "date",
      class: "form-input",
      value: new Date().toISOString().split("T")[0],
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    // المرجع
    const refInput = el("input", {
      type: "text",
      placeholder: "رقم التحويل البنكي أو رقم الشيك…",
      class: "form-input",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "الفاتورة المسددة *"), invSelect));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "مبلغ التحصيل *"), amountInput));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "طريقة التحصيل *"), methodSelect));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "تاريخ التحصيل *"), dateInput));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "المرجع / رقم الإشعار"), refInput));

    const modal = openModal({
      title: "تسجيل سند قبض عميل",
      content: form,
      actions: [
        button({
          label: "إلغاء",
          variant: "ghost",
          onClick: () => modal.close(),
        }),
        button({
          label: "تأكيد القبض والترحيل",
          variant: "primary",
          icon: "check",
          onClick: async () => {
            const amt = parseFloat(amountInput.value);
            if (!amt || amt <= 0) {
              toast.warning("يرجى إدخال مبلغ صحيح.");
              return;
            }
            try {
              await createReceipt({
                invoiceId: invSelect.value,
                amount: amt,
                method: methodSelect.value,
                date: dateInput.value,
                reference: refInput.value,
              });
              toast.success("تم تسجيل سند القبض بنجاح وتحديث رصيد الفاتورة.");
              modal.close();
              navigate("/fin/receipts");
            } catch (err) {
              toast.error(err.message ?? "تعذر تسجيل سند القبض.");
            }
          },
        }),
      ],
    });
  }
}

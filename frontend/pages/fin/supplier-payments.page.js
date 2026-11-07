/**
 * مدفوعات الموردين (سندات الصرف).
 *
 * متابعة سندات صرف النقدية والشيكات والتحويلات البنكية للموردين.
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
import { listSupplierPayments, createSupplierPayment, listSupplierInvoices } from "../../js/api/finance.api.js";
import { openModal } from "../../components/common/modal.js";

const METHOD_LABELS = {
  cash: "نقدي (خزينة)",
  bank_transfer: "تحويل بنكي",
  cheque: "شيك بنكي",
};

export default async function supplierPaymentsPage() {
  return listPage({
    title: "مدفوعات الموردين",
    description: "إدارة سندات الصرف للموردين وتسوية فواتير المشتريات ومصادقات الأرصدة.",
    tableId: "fin-supplier-payments",
    searchPlaceholder: "بحث برقم السند، الفاتورة، أو اسم المورد…",
    initialParams: { sort: "date", order: "desc" },
    fetch: async (params) => listSupplierPayments(params),

    actions: () => [
      button({
        label: "+ سند صرف جديد",
        variant: "primary",
        icon: "check",
        onClick: () => openNewPaymentModal(),
      }),
      button({
        label: "فواتير الموردين",
        variant: "secondary",
        icon: "billing",
        onClick: () => navigate("/fin/supplier-invoices"),
      }),
    ],

    columns: [
      codeColumn("paymentNumber", "رقم السند", { width: "11rem" }),
      dateColumn("date", "تاريخ الصرف"),
      textColumn("invoiceNumber", "رقم الفاتورة", { width: "11rem" }),
      textColumn("supplierName", "المورد", { width: "18rem" }),
      {
        key: "method",
        header: "طريقة السداد",
        render: (row) =>
          badge(METHOD_LABELS[row.method] ?? row.method ?? "تحويل بنكي", { variant: "info" }),
      },
      moneyColumn("amount", "المبلغ المدفوع"),
      textColumn("reference", "رقم الشيك / الحوالة", { width: "12rem", muted: true }),
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
      const res = await listSupplierPayments({ perPage: 200 });
      const rows = res.data ?? [];
      const totalPaid = money.sumBy(rows, "amount");

      return [
        statTile({
          label: "إجمالي مدفوعات الموردين",
          value: amount(totalPaid),
          hint: `${integer(rows.length)} سند صرف`,
          trend: "neutral",
        }),
        statTile({
          label: "المدفوعات البنكية",
          value: amount(money.sumBy(rows.filter((r) => r.method !== "cash"), "amount")),
          hint: "حوالات وشيكات",
        }),
        statTile({
          label: "المدفوعات النقدية",
          value: amount(money.sumBy(rows.filter((r) => r.method === "cash"), "amount")),
          hint: "خزائن الشركة",
        }),
      ];
    },
  });

  async function openNewPaymentModal() {
    const invRes = await listSupplierInvoices({ perPage: 100 });
    const unpaidInvoices = (invRes.data ?? []).filter((inv) => inv.remaining > 0);

    if (!unpaidInvoices.length) {
      toast.info("لا توجد فواتير موردين غير مسددة حالياً.");
      return;
    }

    const form = el("div", { style: "display: flex; flex-direction: column; gap: 1rem; padding: 0.5rem 0;" });

    const invSelect = el("select", {
      class: "form-select",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });
    unpaidInvoices.forEach((inv) => {
      const opt = el(
        "option",
        { value: inv.id },
        `${inv.invoiceNumber ?? inv.number} — ${inv.supplierName} (المتبقي: ${amount(inv.remaining)})`
      );
      invSelect.appendChild(opt);
    });

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

    const dateInput = el("input", {
      type: "date",
      class: "form-input",
      value: new Date().toISOString().split("T")[0],
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    const refInput = el("input", {
      type: "text",
      placeholder: "رقم التحويل أو الشيك البنكي…",
      class: "form-input",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "فاتورة المورد *"), invSelect));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "مبلغ الصرف *"), amountInput));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "طريقة الصرف *"), methodSelect));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "تاريخ الصرف *"), dateInput));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "المرجع / رقم السند الورقي"), refInput));

    const modal = openModal({
      title: "تسجيل سند صرف لمورد",
      content: form,
      actions: [
        button({
          label: "إلغاء",
          variant: "ghost",
          onClick: () => modal.close(),
        }),
        button({
          label: "تأكيد الصرف والترحيل",
          variant: "primary",
          icon: "check",
          onClick: async () => {
            const amt = parseFloat(amountInput.value);
            if (!amt || amt <= 0) {
              toast.warning("يرجى إدخال مبلغ صحيح.");
              return;
            }
            try {
              await createSupplierPayment({
                invoiceId: invSelect.value,
                amount: amt,
                method: methodSelect.value,
                date: dateInput.value,
                reference: refInput.value,
              });
              toast.success("تم تسجيل سند الصرف بنجاح وتحديث رصيد الفاتورة.");
              modal.close();
              navigate("/fin/supplier-payments");
            } catch (err) {
              toast.error(err.message ?? "تعذر تسجيل سند الصرف.");
            }
          },
        }),
      ],
    });
  }
}

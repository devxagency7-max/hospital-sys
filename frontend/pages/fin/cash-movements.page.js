/**
 * الحركات النقدية (سندات القبض والصرف بالخزائن).
 *
 * إدارة المقبوضات والمدفوعات النقدية المباشرة وحركات الخزينة.
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
import { listCashMovements, createCashVoucher, listCashBoxes } from "../../js/api/finance.api.js";
import { openModal } from "../../components/common/modal.js";

export default async function cashMovementsPage() {
  return listPage({
    title: "الحركات النقدية",
    description: "سندات القبض والصرف النقدي اليومية ومتابعة حركة السيولة في الخزائن.",
    tableId: "fin-cash-movements",
    searchPlaceholder: "بحث برقم السند، البيان، أو اسم الخزينة…",
    initialParams: { sort: "date", order: "desc" },
    fetch: async (params) => listCashMovements(params),

    actions: () => [
      button({
        label: "+ سند حركة نقدية جديد",
        variant: "primary",
        icon: "check",
        onClick: () => openNewVoucherModal(),
      }),
      button({
        label: "الخزائن النقدية",
        variant: "secondary",
        icon: "billing",
        onClick: () => navigate("/fin/cash-boxes"),
      }),
      button({
        label: "التحويلات بين الحسابات",
        variant: "ghost",
        icon: "reports",
        onClick: () => navigate("/fin/transfers"),
      }),
    ],

    columns: [
      codeColumn("voucherNumber", "رقم السند", { width: "11rem" }),
      dateColumn("date", "التاريخ"),
      textColumn("cashBoxName", "الخزينة", { width: "14rem" }),
      {
        key: "direction",
        header: "نوع الحركة",
        width: "8rem",
        render: (row) => {
          const isIn = row.direction === "in" || row.type === "receipt";
          return badge(isIn ? "قبض نقدية (+)" : "صرف نقدية (-)", {
            variant: isIn ? "success" : "danger",
          });
        },
      },
      textColumn("category", "التصنيف / البند", { width: "13rem" }),
      textColumn("description", "البيان / الشرح", { width: "18rem", muted: true }),
      moneyColumn("amount", "المبلغ", { signed: false }),
      statusColumn(),
    ],

    summaryRow: (rows) => {
      if (!rows.length) return null;
      const inSum = money.sumBy(rows.filter((r) => r.direction === "in" || r.type === "receipt"), "amount");
      const outSum = money.sumBy(rows.filter((r) => r.direction === "out" || r.type === "payment"), "amount");
      return [
        { value: `مجموع الصفحة (${integer(rows.length)}) — مقبوضات: ${amount(inSum)} | مدفوعات: ${amount(outSum)}`, colspan: 6 },
        { value: totalCell(money.subtract(inSum, outSum), { signed: true }), numeric: true },
        { value: "", colspan: 1 },
      ];
    },

    stats: async () => {
      const res = await listCashMovements({ perPage: 200 });
      const rows = res.data ?? [];
      const totalIn = money.sumBy(rows.filter((r) => r.direction === "in" || r.type === "receipt"), "amount");
      const totalOut = money.sumBy(rows.filter((r) => r.direction === "out" || r.type === "payment"), "amount");
      const net = money.subtract(totalIn, totalOut);

      return [
        statTile({
          label: "إجمالي المقبوضات النقدية",
          value: amount(totalIn),
          hint: "إيداعات وتحصيلات",
          trend: "positive",
        }),
        statTile({
          label: "إجمالي المدفوعات النقدية",
          value: amount(totalOut),
          hint: "مصروفات وسداد",
          trend: "negative",
        }),
        statTile({
          label: "صافي التدفق النقدي",
          value: amount(net),
          hint: "الفارق بين الداخل والخارج",
          trend: net >= 0 ? "positive" : "negative",
        }),
      ];
    },
  });

  async function openNewVoucherModal() {
    const boxesRes = await listCashBoxes();
    const boxes = boxesRes.data ?? [];

    const form = el("div", { style: "display: flex; flex-direction: column; gap: 1rem; padding: 0.5rem 0;" });

    const boxSelect = el("select", {
      class: "form-select",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });
    boxes.forEach((b) => {
      boxSelect.appendChild(el("option", { value: b.id }, `${b.code} - ${b.name}`));
    });

    const dirSelect = el("select", {
      class: "form-select",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });
    dirSelect.appendChild(el("option", { value: "in" }, "قبض نقدية (إيداع بالخزينة)"));
    dirSelect.appendChild(el("option", { value: "out" }, "صرف نقدية (سحب من الخزينة)"));

    const amountInput = el("input", {
      type: "number",
      min: "0.01",
      step: "0.01",
      placeholder: "0.00",
      class: "form-input",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    const categoryInput = el("input", {
      type: "text",
      placeholder: "مثل: مبيعات نقدية، عهدة مؤقتة، مصروفات نثرية…",
      class: "form-input",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    const descInput = el("input", {
      type: "text",
      placeholder: "تفاصيل وبيان السند…",
      class: "form-input",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    const dateInput = el("input", {
      type: "date",
      class: "form-input",
      value: new Date().toISOString().split("T")[0],
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "الخزينة *"), boxSelect));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "نوع الحركة *"), dirSelect));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "المبلغ *"), amountInput));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "البند / التصنيف"), categoryInput));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "البيان"), descInput));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "التاريخ *"), dateInput));

    const modal = openModal({
      title: "تسجيل سند حركة نقدية",
      content: form,
      actions: [
        button({
          label: "إلغاء",
          variant: "ghost",
          onClick: () => modal.close(),
        }),
        button({
          label: "حفظ السند والترحيل",
          variant: "primary",
          icon: "check",
          onClick: async () => {
            const amt = parseFloat(amountInput.value);
            if (!amt || amt <= 0) {
              toast.warning("يرجى إدخال مبلغ صحيح.");
              return;
            }
            try {
              await createCashVoucher({
                cashBoxId: boxSelect.value,
                direction: dirSelect.value,
                amount: amt,
                category: categoryInput.value || "حركة عامة",
                description: descInput.value || "سند نقدية",
                date: dateInput.value,
              });
              toast.success("تم تسجيل السند النقدي بنجاح وتحديث رصيد الخزينة.");
              modal.close();
              navigate("/fin/cash-movements");
            } catch (err) {
              toast.error(err.message ?? "تعذر تسجيل السند.");
            }
          },
        }),
      ],
    });
  }
}

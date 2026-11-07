/**
 * سجل الأصول الثابتة.
 *
 * إدارة الأصول الثابتة بالمنشأة، تتبع تكلفة الاقتناء، مجمع الإهلاك، وصافي القيمة الدفترية والتصرف/الاستبعاد.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import { toast } from "../../components/common/toast.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import { listPage } from "../_shared/list-page.js";
import {
  codeColumn,
  nameColumn,
  dateColumn,
  textColumn,
  moneyColumn,
  statusColumn,
  totalCell,
} from "../_shared/cells.js";
import { listAssets, disposeAsset } from "../../js/api/finance.api.js";
import { openModal } from "../../components/common/modal.js";

export default async function assetsPage() {
  return listPage({
    title: "الأصول الثابتة",
    description: "إدارة سجل الأصول ومتابعة الإهلاك ومجمع الإهلاك وصافي القيمة الدفترية.",
    tableId: "fin-assets",
    searchPlaceholder: "بحث بكود الأصل، اسمه، أو تصنيفه…",
    initialParams: { sort: "code", order: "asc" },
    fetch: async (params) => listAssets(params),

    actions: () => [
      button({
        label: "الإهلاك الدوري",
        variant: "secondary",
        icon: "reports",
        onClick: () => navigate("/fin/depreciation"),
      }),
      button({
        label: "دليل الحسابات",
        variant: "ghost",
        icon: "inventory",
        onClick: () => navigate("/gl/accounts"),
      }),
    ],

    columns: [
      codeColumn("code", "كود الأصل", { width: "10rem" }),
      nameColumn("name", "nameEn", "اسم الأصل", { width: "18rem" }),
      textColumn("categoryName", "تصنيف الأصل", { width: "13rem" }),
      dateColumn("purchaseDate", "تاريخ الاقتناء"),
      moneyColumn("purchaseCost", "تكلفة الاقتناء"),
      moneyColumn("accumulatedDepreciation", "مجمع الإهلاك"),
      moneyColumn("bookValue", "صافي القيمة الدفترية"),
      statusColumn(),
      {
        key: "actions",
        header: "الإجراءات",
        width: "8rem",
        render: (row) => {
          if (row.status === "active") {
            return button({
              label: "استبعاد / بيع",
              variant: "ghost",
              size: "small",
              onClick: () => openDisposalModal(row),
            });
          }
          return el("span", { style: "color: var(--text-muted); font-size: 0.8125rem;" }, "مستبعد");
        },
      },
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 4 },
            { value: totalCell(money.sumBy(rows, "purchaseCost")), numeric: true },
            { value: totalCell(money.sumBy(rows, "accumulatedDepreciation")), numeric: true },
            { value: totalCell(money.sumBy(rows, "bookValue")), numeric: true },
            { value: "", colspan: 2 },
          ]
        : null,

    stats: async () => {
      const res = await listAssets({ perPage: 200 });
      const rows = res.data ?? [];
      const totalCost = money.sumBy(rows, "purchaseCost");
      const totalAccDep = money.sumBy(rows, "accumulatedDepreciation");
      const netBook = money.sumBy(rows, "bookValue");

      return [
        statTile({
          label: "إجمالي التكلفة التاريخية للأصول",
          value: amount(totalCost),
          hint: `${integer(rows.length)} أصل مسجل`,
        }),
        statTile({
          label: "مجمع الإهلاك المتراكم",
          value: amount(totalAccDep),
          hint: "إجمالي ما استُهلك دفترياً",
          trend: "neutral",
        }),
        statTile({
          label: "صافي القيمة الدفترية",
          value: amount(netBook),
          hint: "القيمة الحالية للأصول",
          trend: "positive",
        }),
      ];
    },
  });

  function openDisposalModal(asset) {
    const form = el("div", { style: "display: flex; flex-direction: column; gap: 1rem; padding: 0.5rem 0;" });

    form.appendChild(
      el(
        "div",
        { style: "background: var(--bg-secondary); padding: 0.75rem; border-radius: 0.375rem; font-size: 0.875rem;" },
        el("div", null, `الأصل: ${asset.code} - ${asset.name}`),
        el("div", null, `صافي القيمة الدفترية الحالية: ${amount(asset.bookValue)}`)
      )
    );

    const proceedInput = el("input", {
      type: "number",
      min: "0",
      step: "0.01",
      value: "0",
      class: "form-input",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    const dateInput = el("input", {
      type: "date",
      value: new Date().toISOString().split("T")[0],
      class: "form-input",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    const reasonInput = el("input", {
      type: "text",
      placeholder: "مثل: بيع كخردة، إهلاك كلي، تخريد…",
      class: "form-input",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "قيمة البيع / المتحصلات (إن وجدت)"), proceedInput));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "تاريخ الاستبعاد *"), dateInput));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "سبب الاستبعاد *"), reasonInput));

    const modal = openModal({
      title: "استبعاد أصل ثابت",
      content: form,
      actions: [
        button({
          label: "إلغاء",
          variant: "ghost",
          onClick: () => modal.close(),
        }),
        button({
          label: "تأكيد الاستبعاد وترحيل أرباح/خسائر البيع",
          variant: "danger",
          onClick: async () => {
            const proceed = parseFloat(proceedInput.value) || 0;
            try {
              await disposeAsset(asset.id, {
                proceedAmount: proceed,
                date: dateInput.value,
                reason: reasonInput.value || "استبعاد أصل",
              });
              toast.success("تم استبعاد الأصل الثابت وترحيل قيود التخريد والأرباح/الخسائر الرأسمالية.");
              modal.close();
              navigate("/fin/assets");
            } catch (err) {
              toast.error(err.message ?? "تعذر استبعاد الأصل.");
            }
          },
        }),
      ],
    });
  }
}

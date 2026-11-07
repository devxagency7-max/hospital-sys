/**
 * سلف الموظفين.
 *
 * إدارة طلبات السلف النقدية وجدولة الأقساط الشهرية وخصمها التلقائي من مسيّر الرواتب.
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
import { listAdvances, createAdvance } from "../../js/api/hr.api.js";
import { getEmployeesLookup } from "../../js/api/lookups.api.js";
import { openModal } from "../../components/common/modal.js";

export default async function advancesPage() {
  return listPage({
    title: "سلف الموظفين",
    description: "إدارة سلف العاملين ومتابعة سداد الأقساط الشهرية المخصومة من الرواتب.",
    tableId: "hr-advances",
    searchPlaceholder: "بحث برقم السلفة، كود الموظف، أو اسمه…",
    initialParams: { sort: "requestDate", order: "desc" },
    fetch: async (params) => listAdvances(params),

    actions: () => [
      button({
        label: "+ طلب سلفة جديد",
        variant: "primary",
        icon: "check",
        onClick: () => openNewAdvanceModal(),
      }),
      button({
        label: "مسيّرات الرواتب",
        variant: "secondary",
        icon: "billing",
        onClick: () => navigate("/hr/payroll"),
      }),
    ],

    columns: [
      codeColumn("advanceNumber", "رقم السلفة", { width: "11rem" }),
      dateColumn("requestDate", "تاريخ الطلب"),
      codeColumn("employeeCode", "كود الموظف", { width: "10rem" }),
      textColumn("employeeName", "الموظف", { width: "16rem" }),
      moneyColumn("amount", "مبلغ السلفة"),
      {
        key: "installmentsCount",
        header: "عدد الأقساط",
        width: "9rem",
        render: (row) => el("span", null, `${row.installmentsCount ?? 1} شهر`),
      },
      moneyColumn("monthlyInstallment", "القسط الشهري"),
      moneyColumn("remainingBalance", "المتبقي للسداد", { signed: false }),
      statusColumn(),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 4 },
            { value: totalCell(money.sumBy(rows, "amount")), numeric: true },
            { value: "", colspan: 1 },
            { value: totalCell(money.sumBy(rows, "monthlyInstallment")), numeric: true },
            { value: totalCell(money.sumBy(rows, "remainingBalance")), numeric: true },
            { value: "", colspan: 1 },
          ]
        : null,

    stats: async () => {
      const res = await listAdvances({ perPage: 200 });
      const rows = res.data ?? [];
      const totalAdvances = money.sumBy(rows, "amount");
      const totalRemaining = money.sumBy(rows, "remainingBalance");
      const activeCount = rows.filter((r) => r.status === "active").length;

      return [
        statTile({
          label: "إجمالي السلف الممنوحة",
          value: amount(totalAdvances),
          hint: `${integer(rows.length)} سلفة مسجلة`,
        }),
        statTile({
          label: "المتبقي غير المسدد",
          value: amount(totalRemaining),
          hint: "ذمم سلف جارية",
          trend: "neutral",
        }),
        statTile({
          label: "السلف النشطة قيد الخصم",
          value: integer(activeCount),
          hint: "تخصم أقساطها شهرياً من الراتب",
          trend: "positive",
        }),
      ];
    },
  });

  async function openNewAdvanceModal() {
    const employees = await getEmployeesLookup();

    const form = el("div", { style: "display: flex; flex-direction: column; gap: 1rem; padding: 0.5rem 0;" });

    const empSelect = el("select", {
      class: "form-select",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });
    employees.forEach((e) => empSelect.appendChild(el("option", { value: e.id }, `${e.code} - ${e.name}`)));

    const amountInput = el("input", {
      type: "number",
      min: "100",
      step: "100",
      placeholder: "0.00",
      class: "form-input",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    const installmentsInput = el("input", {
      type: "number",
      min: "1",
      max: "24",
      value: "6",
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
      placeholder: "سبب طلب السلفة…",
      class: "form-input",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "الموظف *"), empSelect));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "مبلغ السلفة *"), amountInput));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "عدد أقساط السداد (أشهر) *"), installmentsInput));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "تاريخ الطلب *"), dateInput));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "السبب"), reasonInput));

    const modal = openModal({
      title: "تسجيل سلفة موظف جديدة",
      content: form,
      actions: [
        button({
          label: "إلغاء",
          variant: "ghost",
          onClick: () => modal.close(),
        }),
        button({
          label: "اعتماد السلفة وجدولة الأقساط",
          variant: "primary",
          icon: "check",
          onClick: async () => {
            const amt = parseFloat(amountInput.value);
            const inst = parseInt(installmentsInput.value, 10);
            if (!amt || amt <= 0 || !inst || inst <= 0) {
              toast.warning("يرجى إدخال مبلغ وأقساط صحيحة.");
              return;
            }
            try {
              await createAdvance({
                employeeId: empSelect.value,
                amount: amt,
                installmentsCount: inst,
                requestDate: dateInput.value,
                reason: reasonInput.value || "سلفة نقدية",
              });
              toast.success("تم تسجيل السلفة واعتمادها بنجاح.");
              modal.close();
              navigate("/hr/advances");
            } catch (err) {
              toast.error(err.message ?? "تعذر تسجيل السلفة.");
            }
          },
        }),
      ],
    });
  }
}

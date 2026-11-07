/**
 * التحويلات بين الحسابات النقدية والبنكية.
 *
 * إدارة وتوثيق التحويلات الداخلية بين الخزائن والحسابات البنكية (إيداع نقدية، تغذية خزينة، تحويل بين بنكين).
 */

import { el, clear } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, date } from "../../js/core/format.js";
import { toast } from "../../components/common/toast.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import {
  createTransfer,
  listCashBoxes,
  listBankAccounts,
  listCashMovements,
} from "../../js/api/finance.api.js";

export default async function transfersPage() {
  const [cashBoxesRes, bankAccountsRes, movementsRes] = await Promise.all([
    listCashBoxes(),
    listBankAccounts(),
    listCashMovements({ perPage: 50 }),
  ]);

  const cashBoxes = cashBoxesRes.data ?? [];
  const bankAccounts = bankAccountsRes.data ?? [];

  const container = el("div", { class: "page-container page-transfers", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "التحويلات بين الحسابات"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "تحويل السيولة بين الخزائن النقدية والحسابات البنكية وتوليد القيود المحاسبية التلقائية.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem;" },
      button({
        label: "الخزائن النقدية",
        variant: "secondary",
        icon: "billing",
        onClick: () => navigate("/fin/cash-boxes"),
      }),
      button({
        label: "الحسابات البنكية",
        variant: "ghost",
        icon: "inventory",
        onClick: () => navigate("/fin/banks"),
      })
    )
  );

  // بطاقات الإحصاءات السريعة
  const totalCashBalance = money.sumBy(cashBoxes, "currentBalance");
  const totalBankBalance = money.sumBy(bankAccounts, "currentBalance");

  const statsRow = el(
    "div",
    { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;" },
    statTile({
      label: "إجمالي أرصدة الخزائن النقدية",
      value: amount(totalCashBalance),
      hint: `${cashBoxes.length} خزينة نشطة`,
    }),
    statTile({
      label: "إجمالي أرصدة الحسابات البنكية",
      value: amount(totalBankBalance),
      hint: `${bankAccounts.length} حساب بنكي`,
    }),
    statTile({
      label: "إجمالي السيولة المتاحة",
      value: amount(money.add(totalCashBalance, totalBankBalance)),
      hint: "نقدية وما في حكمها",
      trend: "positive",
    })
  );

  // نموذج تنفيذ تحويل جديد
  const transferCard = el(
    "div",
    {
      class: "surface-card",
      style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 2rem;",
    },
    el("h2", { style: "font-size: 1.125rem; font-weight: 700; margin-bottom: 1.25rem; color: var(--text-primary);" }, "إجراء تحويل مالي جديد")
  );

  const transferFormGrid = el("div", {
    style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;",
  });

  // من حساب
  const fromTypeSelect = el("select", {
    class: "form-select",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); margin-bottom: 0.5rem;",
  });
  fromTypeSelect.appendChild(el("option", { value: "cash" }, "خزينة نقدية"));
  fromTypeSelect.appendChild(el("option", { value: "bank" }, "حساب بنكي"));

  const fromEntitySelect = el("select", {
    class: "form-select",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });

  function populateFromEntities() {
    clear(fromEntitySelect);
    if (fromTypeSelect.value === "cash") {
      cashBoxes.forEach((b) => {
        fromEntitySelect.appendChild(el("option", { value: b.id }, `${b.name} (${amount(b.currentBalance)})`));
      });
    } else {
      bankAccounts.forEach((b) => {
        fromEntitySelect.appendChild(el("option", { value: b.id }, `${b.bankName} - ${b.accountNumber} (${amount(b.currentBalance)})`));
      });
    }
  }
  fromTypeSelect.addEventListener("change", populateFromEntities);
  populateFromEntities();

  transferFormGrid.appendChild(
    el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.375rem;" }, "تحويل من حساب *"), fromTypeSelect, fromEntitySelect)
  );

  // إلى حساب
  const toTypeSelect = el("select", {
    class: "form-select",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); margin-bottom: 0.5rem;",
  });
  toTypeSelect.appendChild(el("option", { value: "bank" }, "حساب بنكي (إيداع)"));
  toTypeSelect.appendChild(el("option", { value: "cash" }, "خزينة نقدية (تغذية)"));

  const toEntitySelect = el("select", {
    class: "form-select",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });

  function populateToEntities() {
    clear(toEntitySelect);
    if (toTypeSelect.value === "cash") {
      cashBoxes.forEach((b) => {
        toEntitySelect.appendChild(el("option", { value: b.id }, `${b.name} (${amount(b.currentBalance)})`));
      });
    } else {
      bankAccounts.forEach((b) => {
        toEntitySelect.appendChild(el("option", { value: b.id }, `${b.bankName} - ${b.accountNumber} (${amount(b.currentBalance)})`));
      });
    }
  }
  toTypeSelect.addEventListener("change", populateToEntities);
  populateToEntities();

  transferFormGrid.appendChild(
    el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.375rem;" }, "تحويل إلى حساب *"), toTypeSelect, toEntitySelect)
  );

  // المبلغ
  const amountInput = el("input", {
    type: "number",
    min: "0.01",
    step: "0.01",
    placeholder: "0.00",
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  transferFormGrid.appendChild(
    el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.375rem;" }, "المبلغ المحوَّل *"), amountInput)
  );

  // التاريخ
  const dateInput = el("input", {
    type: "date",
    value: new Date().toISOString().split("T")[0],
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  transferFormGrid.appendChild(
    el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.375rem;" }, "تاريخ التحويل *"), dateInput)
  );

  transferCard.appendChild(transferFormGrid);

  // بيان وملاحظات
  const descInput = el("input", {
    type: "text",
    placeholder: "بيان التحويل وسببه (مثال: إيداع نقدية المبيعات بالبنك الأهلي)…",
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); margin-bottom: 1.25rem;",
  });
  transferCard.appendChild(
    el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.375rem;" }, "البيان / الملاحظات"), descInput)
  );

  const submitBtn = button({
    label: "تنفيذ التحويل وترحيل القيد آلياً",
    variant: "primary",
    icon: "check",
    onClick: async () => {
      const amt = parseFloat(amountInput.value);
      if (!amt || amt <= 0) {
        toast.warning("يرجى إدخال مبلغ تحويل صحيح أكبر من صفر.");
        return;
      }
      if (fromTypeSelect.value === toTypeSelect.value && fromEntitySelect.value === toEntitySelect.value) {
        toast.warning("لا يمكن التحويل من الحساب إلى نفسه.");
        return;
      }

      try {
        await createTransfer({
          fromType: fromTypeSelect.value,
          fromId: fromEntitySelect.value,
          toType: toTypeSelect.value,
          toId: toEntitySelect.value,
          amount: amt,
          date: dateInput.value,
          description: descInput.value || "تحويل سيولة داخلية",
        });

        toast.success("تم تنفيذ التحويل بنجاح وترحيل القيد المحاسبي بين الحسابين.");
        navigate("/fin/transfers");
      } catch (err) {
        toast.error(err.message ?? "تعذر تنفيذ التحويل.");
      }
    },
  });
  transferCard.appendChild(submitBtn);

  container.appendChild(header);
  container.appendChild(statsRow);
  container.appendChild(transferCard);

  return container;
}

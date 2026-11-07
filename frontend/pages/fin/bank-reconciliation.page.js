/**
 * المطابقة البنكية ومذكرة التسوية.
 *
 * مطابقة كشف الحساب البنكي الوارد من البنك مع الحركات المسجلة دفترياً
 * وحساب الفروق والشيكات تحت التحصيل والمصروفات البنكية.
 */

import { el, clear } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, date, integer } from "../../js/core/format.js";
import { toast } from "../../components/common/toast.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import {
  listBankAccounts,
  listBankTransactions,
  listBankReconciliations,
  reconcileBank,
} from "../../js/api/finance.api.js";

export default async function bankReconciliationPage() {
  const [banksRes, historyRes] = await Promise.all([
    listBankAccounts(),
    listBankReconciliations({ perPage: 20 }),
  ]);

  const banks = banksRes.data ?? [];
  let selectedBankId = banks[0]?.id;
  const history = historyRes.data ?? [];

  const container = el("div", { class: "page-container page-bank-reconciliation", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "المطابقة البنكية"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "مطابقة حركات كشوف البنوك مع القيود الدفترية وإعداد مذكرات التسوية الشهرية.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem;" },
      button({
        label: "الحسابات البنكية",
        variant: "secondary",
        icon: "billing",
        onClick: () => navigate("/fin/banks"),
      }),
      button({
        label: "التحويلات بين الحسابات",
        variant: "ghost",
        icon: "reports",
        onClick: () => navigate("/fin/transfers"),
      })
    )
  );

  // اختيار البنك
  const selectorBar = el(
    "div",
    {
      class: "surface-card",
      style: "padding: 1rem 1.25rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;",
    },
    el(
      "div",
      { style: "display: flex; align-items: center; gap: 1rem;" },
      el("label", { style: "font-weight: 600; color: var(--text-primary); font-size: 0.9375rem;" }, "الحساب البنكي:"),
      (() => {
        const select = el("select", {
          class: "form-select",
          style: "padding: 0.5rem 1rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary); min-width: 18rem; font-weight: 500;",
        });
        banks.forEach((b) => {
          const opt = el("option", { value: b.id }, `${b.bankName} - ${b.accountNumber} (${b.currency ?? "EGP"})`);
          if (b.id === selectedBankId) opt.selected = true;
          select.appendChild(opt);
        });
        select.addEventListener("change", (e) => {
          selectedBankId = e.target.value;
          renderBankSession();
        });
        return select;
      })()
    ),
    el("div", { style: "color: var(--text-muted); font-size: 0.8125rem;" }, "حدد الحركات المطابقة لكشف البنك واضغط اعتماد لحفظ مذكرة التسوية")
  );

  const sessionHost = el("div", { class: "reconciliation-session-host" });

  async function renderBankSession() {
    clear(sessionHost);
    sessionHost.appendChild(
      el("div", { style: "padding: 2.5rem; text-align: center; color: var(--text-muted);" }, "جاري تحميل بيانات البنك والحركات المعلقة…")
    );

    const bank = banks.find((b) => String(b.id) === String(selectedBankId));
    if (!bank) return;

    const txRes = await listBankTransactions({ bankAccountId: bank.id, perPage: 100 });
    const allTx = txRes.data ?? [];
    const unreconciledTx = allTx.filter((t) => !t.reconciled);

    clear(sessionHost);

    // بطاقات الأرصدة
    const bookBalance = bank.currentBalance ?? bank.balance ?? 0;
    const statsGrid = el(
      "div",
      { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;" },
      statTile({
        label: "الرصيد الدفتري المسجل",
        value: amount(bookBalance),
        hint: "رصيد حساب الأستاذ",
        trend: "neutral",
      }),
      statTile({
        label: "الحركات غير المطابقة",
        value: integer(unreconciledTx.length),
        hint: "معلقة دفترياً",
      }),
      statTile({
        label: "إجمالي قيمة المعلقات",
        value: amount(money.sumBy(unreconciledTx, "amount")),
        hint: "تحت التحصيل أو الصرف",
      })
    );
    sessionHost.appendChild(statsGrid);

    // نموذج إدخال كشف البنك والمطابقة
    const formCard = el(
      "div",
      {
        class: "surface-card",
        style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem;",
      },
      el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, "إدخال بيانات كشف الحساب البنكي")
    );

    const formGrid = el("div", {
      style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;",
    });

    const statementDateInput = el("input", {
      type: "date",
      class: "form-input",
      value: new Date().toISOString().split("T")[0],
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });
    formGrid.appendChild(
      el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.375rem;" }, "تاريخ كشف البنك *"), statementDateInput)
    );

    const statementBalanceInput = el("input", {
      type: "number",
      step: "0.01",
      class: "form-input",
      value: bookBalance,
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); font-weight: 600;",
    });
    formGrid.appendChild(
      el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.375rem;" }, "الرصيد الفعلي في كشف البنك *"), statementBalanceInput)
    );

    formCard.appendChild(formGrid);

    // جدول الحركات المعلقة
    const selectedTxIds = new Set(unreconciledTx.map((t) => String(t.id)));

    formCard.appendChild(
      el(
        "div",
        { style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;" },
        el("h4", { style: "font-weight: 600; margin: 0; font-size: 0.9375rem;" }, "الحركات الدفترية غير المطابقة"),
        el("span", { style: "color: var(--text-muted); font-size: 0.8125rem;" }, "قم بتعليم الحركات الظاهرة في كشف البنك")
      )
    );

    const tableHost = el("div", { style: "margin-bottom: 1.5rem; overflow-x: auto;" });
    const table = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
    const thead = el(
      "thead",
      null,
      el(
        "tr",
        { style: "background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);" },
        el("th", { style: "padding: 0.5rem; width: 3rem; text-align: center;" }, "مطابق"),
        el("th", { style: "padding: 0.5rem 0.75rem; text-align: right;" }, "التاريخ"),
        el("th", { style: "padding: 0.5rem 0.75rem; text-align: right;" }, "النوع"),
        el("th", { style: "padding: 0.5rem 0.75rem; text-align: right;" }, "البيان"),
        el("th", { style: "padding: 0.5rem 0.75rem; text-align: right;" }, "المرجع"),
        el("th", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, "المبلغ")
      )
    );
    const tbody = el("tbody", null);

    if (!unreconciledTx.length) {
      tbody.appendChild(
        el("tr", null, el("td", { colspan: 6, style: "padding: 2rem; text-align: center; color: var(--text-muted);" }, "كافة حركات هذا الحساب مطابقة ومعتمدة."))
      );
    } else {
      unreconciledTx.forEach((tx) => {
        const isIn = tx.direction === "in" || tx.type === "deposit";
        const tr = el(
          "tr",
          { style: "border-bottom: 1px solid var(--border-color);" },
          el(
            "td",
            { style: "padding: 0.5rem; text-align: center;" },
            (() => {
              const chk = el("input", { type: "checkbox" });
              chk.checked = selectedTxIds.has(String(tx.id));
              chk.addEventListener("change", (e) => {
                if (e.target.checked) selectedTxIds.add(String(tx.id));
                else selectedTxIds.delete(String(tx.id));
              });
              return chk;
            })()
          ),
          el("td", { style: "padding: 0.5rem 0.75rem; font-size: 0.875rem;" }, tx.date),
          el("td", { style: "padding: 0.5rem 0.75rem;" }, badge(isIn ? "إيداع" : "سحب", { variant: isIn ? "success" : "danger" })),
          el("td", { style: "padding: 0.5rem 0.75rem; font-size: 0.875rem;" }, tx.description ?? tx.partyName ?? "—"),
          el("td", { style: "padding: 0.5rem 0.75rem; font-size: 0.875rem; color: var(--text-muted);" }, tx.reference ?? "—"),
          el("td", { style: "padding: 0.5rem 0.75rem; text-align: left; font-weight: 600;" }, el("span", { class: "ltr-isolate" }, amount(tx.amount)))
        );
        tbody.appendChild(tr);
      });
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    tableHost.appendChild(table);
    formCard.appendChild(tableHost);

    // زر الحفظ
    const reconcileBtn = button({
      label: "اعتماد وحفظ مذكرة المطابقة البنكية",
      variant: "primary",
      icon: "check",
      onClick: async () => {
        const stmtBal = parseFloat(statementBalanceInput.value);
        if (isNaN(stmtBal)) {
          toast.warning("يرجى إدخال رصيد كشف البنك.");
          return;
        }

        try {
          const res = await reconcileBank({
            bankAccountId: bank.id,
            statementDate: statementDateInput.value,
            statementBalance: stmtBal,
            matchedTransactionIds: Array.from(selectedTxIds),
          });

          if (res.difference && !money.isZero(res.difference)) {
            toast.warning(`تم حفظ المطابقة مع وجود فارق تسوية قدره ${amount(res.difference)}.`);
          } else {
            toast.success("تمت المطابقة بنجاح — الرصيد الدفتري يطابق كشف البنك تماماً.");
          }

          renderBankSession();
        } catch (err) {
          toast.error(err.message ?? "تعذر حفظ المطابقة.");
        }
      },
    });
    formCard.appendChild(reconcileBtn);

    sessionHost.appendChild(formCard);
  }

  // جدول سجل المطابقات السابقة
  const historyCard = el(
    "div",
    {
      class: "surface-card",
      style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
    },
    el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, "سجل المطابقات البنكية المعتمدة")
  );

  const historyTable = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
  const hHead = el(
    "thead",
    null,
    el(
      "tr",
      { style: "background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);" },
      el("th", { style: "padding: 0.5rem 0.75rem; text-align: right;" }, "البنك"),
      el("th", { style: "padding: 0.5rem 0.75rem; text-align: right;" }, "تاريخ الكشف"),
      el("th", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, "رصيد الكشف"),
      el("th", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, "الرصيد الدفتري"),
      el("th", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, "الفارق"),
      el("th", { style: "padding: 0.5rem 0.75rem; text-align: center;" }, "الحالة")
    )
  );
  const hBody = el("tbody", null);

  if (!history.length) {
    hBody.appendChild(
      el("tr", null, el("td", { colspan: 6, style: "padding: 2rem; text-align: center; color: var(--text-muted);" }, "لا توجد مطابقات بنكية سابقة."))
    );
  } else {
    history.forEach((h) => {
      const isMatched = money.isZero(h.difference ?? 0);
      const row = el(
        "tr",
        { style: "border-bottom: 1px solid var(--border-color);" },
        el("td", { style: "padding: 0.5rem 0.75rem; font-weight: 600;" }, h.bankName ?? "البنك الأهلي"),
        el("td", { style: "padding: 0.5rem 0.75rem;" }, h.statementDate),
        el("td", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(h.statementBalance))),
        el("td", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(h.bookBalance))),
        el("td", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(h.difference ?? 0))),
        el("td", { style: "padding: 0.5rem 0.75rem; text-align: center;" }, badge(isMatched ? "مطابق تماماً" : "يوجد فرق", { variant: isMatched ? "success" : "warning" }))
      );
      hBody.appendChild(row);
    });
  }

  historyTable.appendChild(hHead);
  historyTable.appendChild(hBody);
  historyCard.appendChild(historyTable);

  container.appendChild(header);
  container.appendChild(selectorBar);
  container.appendChild(sessionHost);
  container.appendChild(historyCard);

  renderBankSession();

  return container;
}

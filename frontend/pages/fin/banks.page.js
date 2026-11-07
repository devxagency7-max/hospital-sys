/**
 * الحسابات البنكية.
 *
 * الحركة «غير المُطابَقة» لم تُؤكَّد في كشف البنك بعد — وهي ليست خطأً بل
 * الحالة الطبيعية لشيك صادر لم يُصرف. الشاشة تُفرِّق بين الرصيد الدفتري
 * ورصيد كشف البنك بدل خلطهما في رقم واحد.
 */

import { el } from "../../js/core/dom.js";
import { buttonGroup, iconButton, button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { alert } from "../../components/feedback/alert.js";
import { amount, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { ltr } from "../../components/common/value.js";
import * as money from "../../js/core/money.js";
import { listPage } from "../_shared/list-page.js";
import { moneyColumn, textColumn, countColumn, dateColumn, statusColumn, codeColumn } from "../_shared/cells.js";
import { listBankAccounts } from "../../js/api/finance.api.js";

const TYPE_LABELS = { current: "جاري", savings: "توفير", payroll: "رواتب", loan: "قرض" };

export default async function banksPage() {
  return listPage({
    title: "الحسابات البنكية",
    description: "أرصدة الحسابات البنكية وحركاتها وحالة مطابقتها مع كشوف البنوك.",
    tableId: "fin-banks",
    searchPlaceholder: "بحث باسم البنك أو رقم الحساب أو الآيبان…",
    fetch: listBankAccounts,

    actions: () => [
      button({
        label: "المطابقة البنكية",
        variant: "primary",
        icon: "checkCircle",
        permission: "fin.bank.reconcile",
        onClick: () => navigate("/fin/bank-reconciliation"),
      }),
      button({
        label: "الحركات",
        variant: "secondary",
        icon: "columns",
        onClick: () => navigate("/fin/cash-movements"),
      }),
    ],

    before: async () => {
      const { data } = await listBankAccounts({ perPage: 50 });
      const overdrawn = data.filter((row) => row.isOverdrawn);
      if (!overdrawn.length) return null;

      return alert({
        tone: "danger",
        title: `${integer(overdrawn.length)} حساب بنكي برصيد سالب`,
        message: overdrawn.map((row) => `${row.bankName}: ${amount(row.balance)}`).join(" · "),
      });
    },

    columns: [
      {
        key: "bankName",
        label: "البنك والحساب",
        alwaysVisible: true,
        sortable: true,
        render: (row) =>
          el(
            "div",
            { class: "min-w-0" },
            el("div", { class: "text-ink truncate-1" }, row.bankName),
            el(
              "div",
              { class: "flex items-center gap-1.5 mt-0.5" },
              ltr(row.accountNumber, { mono: true, class: "text-[10px] text-faint" }),
              badge(TYPE_LABELS[row.type] ?? row.type, { size: "sm" }),
            ),
          ),
      },
      textColumn("accountName", "اسم الحساب", { width: "16rem", muted: true, hidden: true }),
      textColumn("branch", "الفرع", { width: "10rem", muted: true }),
      codeColumn("iban", "الآيبان", { width: "15rem", hidden: true }),
      moneyColumn("openingBalance", "افتتاحي", { hidden: true }),
      moneyColumn("balance", "الرصيد الدفتري", { signed: true }),
      moneyColumn("overdraftLimit", "حد السحب", { hidden: true }),
      moneyColumn("available", "المتاح"),
      {
        key: "unreconciledCount",
        label: "غير مُطابَق",
        numeric: true,
        width: "8rem",
        render: (row) =>
          row.unreconciledCount
            ? el(
                "div",
                { class: "flex flex-col items-end gap-0.5" },
                badge(`${integer(row.unreconciledCount)} حركة`, { tone: "warning", size: "sm" }),
                el("span", { class: "text-[10px] text-faint tabular" }, amount(row.unreconciledAmount)),
              )
            : badge("مُطابَق", { tone: "success", size: "sm" }),
      },
      countColumn("transactionsCount", "الحركات", { hidden: true }),
      dateColumn("lastReconciledAt", "آخر مطابقة"),
      statusColumn(),
    ],

    onRowClick: (row) => navigate(`/fin/banks/${row.id}`),

    rowActions: (row) =>
      buttonGroup(
        iconButton("eye", { label: "كشف الحساب", onClick: () => navigate(`/fin/banks/${row.id}`) }),
        iconButton("checkCircle", {
          label: "مطابقة",
          permission: "fin.bank.reconcile",
          onClick: () => navigate(`/fin/bank-reconciliation?bankAccountId=${row.id}`),
        }),
      ),

    stats: async () => {
      const { data } = await listBankAccounts({ perPage: 50 });
      const unreconciled = data.reduce((total, row) => total + row.unreconciledCount, 0);

      return [
        statTile({ label: "إجمالي الأرصدة", value: amount(money.sumBy(data, "balance")), tone: "brand", icon: "building" }),
        statTile({ label: "المتاح (مع حد السحب)", value: amount(money.sumBy(data, "available")), tone: "info", icon: "wallet" }),
        statTile({ label: "حسابات نشطة", value: integer(data.filter((r) => r.status === "active").length), tone: "neutral", icon: "columns" }),
        statTile({
          label: "حركات غير مُطابَقة",
          value: integer(unreconciled),
          hint: unreconciled ? "لم تظهر في كشف البنك بعد" : "كل الحركات مُطابَقة",
          tone: unreconciled ? "warning" : "success",
          icon: "clock",
        }),
        statTile({
          label: "حسابات برصيد سالب",
          value: integer(data.filter((r) => r.isOverdrawn).length),
          tone: data.some((r) => r.isOverdrawn) ? "danger" : "success",
          icon: "alertTriangle",
        }),
      ];
    },
  });
}

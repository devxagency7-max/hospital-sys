/**
 * كشف الحساب البنكي ومعاملاته (Bank Account Statement).
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, date, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { exportStyledExcel, printReport } from "../_shared/print.js";
import { getBankAccount } from "../../js/api/finance.api.js";

export default async function bankDetailPage(context) {
  const accountId = context.params?.id;
  const bank = await getBankAccount(accountId);
  const transactions = bank.transactions || [];

  const container = el("div", { class: "flex flex-col gap-6 p-4 md:p-6" });

  const topNav = el(
    "div",
    { class: "flex items-center justify-between flex-wrap gap-3" },
    el(
      "div",
      { class: "flex items-center gap-2" },
      button({
        label: "العودة للحسابات البنكية",
        variant: "ghost",
        icon: "chevronStart",
        onClick: () => navigate("/fin/banks"),
      }),
      el("span", { class: "text-muted" }, "/"),
      el("span", { class: "font-semibold text-ink" }, `حساب: ${bank.bankName}`),
      badge(bank.status === "active" ? "حساب نشط" : "معطل", {
        tone: bank.status === "active" ? "success" : "neutral",
      }),
    ),
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap" },
      button({
        label: "تصدير كشف الحساب Excel",
        variant: "secondary",
        icon: "download",
        onClick: () => exportBankExcel(bank),
      }),
      button({
        label: "طباعة كشف الحساب (PDF)",
        variant: "primary",
        icon: "print",
        onClick: () => printBankPdf(bank),
      }),
      button({
        label: "المطابقة البنكية",
        variant: "secondary",
        icon: "check",
        onClick: () => navigate("/fin/bank-reconciliation"),
      }),
    ),
  );

  const heroCard = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm" },
    el(
      "div",
      { class: "flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-subtle pb-4 mb-4" },
      el(
        "div",
        { class: "flex items-center gap-4" },
        el(
          "div",
          {
            class: "w-16 h-16 rounded-xl flex items-center justify-center font-bold text-2xl text-white shadow-sm",
            style: "background: linear-gradient(135deg, #1e3a8a, #0284c7);",
          },
          "🏦",
        ),
        el(
          "div",
          { class: "flex flex-col" },
          el("h2", { class: "text-lg font-bold text-ink" }, bank.bankName),
          el(
            "div",
            { class: "flex items-center gap-2 mt-1 text-xs text-muted flex-wrap" },
            el("span", { class: "font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded" }, bank.code),
            el("span", {}, "·"),
            el("span", {}, `رقم الحساب: ${bank.accountNumber || "—"}`),
            el("span", {}, "·"),
            el("span", {}, `الآيبان (IBAN): ${bank.iban || "—"}`),
          ),
        ),
      ),
      el(
        "div",
        { class: "flex items-center gap-3 flex-wrap" },
        badge(`العملة: ${bank.currency || "EGP"}`, { tone: "brand" }),
        badge(bank.isReconciled ? "مطابق دفترياً" : "بانتظار المطابقة", {
          tone: bank.isReconciled ? "success" : "warning",
        }),
      ),
    ),
    el(
      "div",
      { class: "grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs" },
      infoBox("الرصيد الدفتري الحالي", amount(bank.balance || 0), "text-brand-700 dark:text-brand-400 font-bold text-base"),
      infoBox("اسم الفرع / البنك", bank.bankName || "—", "text-ink"),
      infoBox("كود الحساب العام بالدليل", bank.accountCode || "1121", "font-mono"),
    ),
  );

  const totalDeposits = transactions.filter((t) => (t.amount || 0) > 0).reduce((s, t) => s + (t.amount || 0), 0);
  const totalWithdrawals = transactions.filter((t) => (t.amount || 0) < 0).reduce((s, t) => s + Math.abs(t.amount || 0), 0);

  const statsSection = el(
    "div",
    { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" },
    statTile({
      label: "الرصيد البنكي الحالي",
      value: amount(bank.balance || 0),
      tone: "brand",
      icon: "bank",
    }),
    statTile({
      label: "إجمالي الإيداعات والتحويلات الواردة",
      value: amount(totalDeposits),
      tone: "success",
      icon: "money",
    }),
    statTile({
      label: "إجمالي السحوبات والتحويلات الصادرة",
      value: amount(totalWithdrawals),
      tone: "warning",
      icon: "receipt",
    }),
    statTile({
      label: "إجمالي العمليات المنفذة",
      value: integer(transactions.length),
      tone: "info",
      icon: "activity",
    }),
  );

  const transactionsCard = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm overflow-hidden flex flex-col gap-3" },
    el(
      "div",
      { class: "flex items-center justify-between" },
      el("h3", { class: "text-sm font-bold text-ink" }, "كشف المعاملات والحركات البنكية"),
      badge(`حركات: ${transactions.length}`, { tone: "brand" }),
    ),
    renderTransactionsTable(transactions),
  );

  container.append(topNav, heroCard, statsSection, transactionsCard);
  return container;
}

function infoBox(label, valText, extraClass = "") {
  return el(
    "div",
    { class: "flex flex-col gap-1 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-subtle" },
    el("span", { class: "text-muted text-[11px]" }, label),
    el("span", { class: `font-semibold text-sm ${extraClass}` }, valText),
  );
}

function renderTransactionsTable(transactions) {
  const table = el("table", { class: "w-full border-collapse text-right text-xs" });

  const thead = el(
    "thead",
    {},
    el(
      "tr",
      { class: "border-b border-subtle bg-slate-50 dark:bg-slate-800/40 text-muted" },
      el("th", { class: "p-3 font-semibold text-center w-28" }, "التاريخ"),
      el("th", { class: "p-3 font-semibold text-center w-32" }, "المرجع / الشيك"),
      el("th", { class: "p-3 font-semibold" }, "البيان وتفاصيل العملية"),
      el("th", { class: "p-3 font-semibold text-left w-32" }, "إيداع (وارد)"),
      el("th", { class: "p-3 font-semibold text-left w-32" }, "سحب (صادر)"),
      el("th", { class: "p-3 font-semibold text-left w-32" }, "الرصيد بعد الحركة"),
    ),
  );

  const tbody = el("tbody", {});
  if (!transactions.length) {
    tbody.appendChild(
      el("tr", {}, el("td", { colspan: 6, class: "p-6 text-center text-muted" }, "لا توجد معاملات مسجلة لهذا الحساب.")),
    );
  } else {
    transactions.forEach((t) => {
      const isDeposit = (t.amount || 0) > 0;
      tbody.appendChild(
        el(
          "tr",
          { class: "border-b border-subtle hover:bg-slate-50/50 dark:hover:bg-slate-800/20" },
          el("td", { class: "p-3 text-center text-muted" }, date(t.date)),
          el("td", { class: "p-3 text-center font-mono font-bold text-ink" }, t.reference || t.checkNumber || "—"),
          el("td", { class: "p-3 text-ink font-medium" }, t.description || "معاملة بنكية"),
          el("td", { class: "p-3 text-left font-mono font-bold text-success-700 dark:text-success-400" }, isDeposit ? amount(t.amount) : "—"),
          el("td", { class: "p-3 text-left font-mono font-bold text-warning-700 dark:text-warning-400" }, !isDeposit ? amount(Math.abs(t.amount)) : "—"),
          el("td", { class: "p-3 text-left font-mono text-ink" }, t.balanceAfter ? amount(t.balanceAfter) : "—"),
        ),
      );
    });
  }

  table.append(thead, tbody);
  return el("div", { class: "overflow-x-auto" }, table);
}

function exportBankExcel(bank) {
  const headers = [
    { label: "التاريخ", align: "center" },
    { label: "المرجع / الشيك", align: "center" },
    { label: "البيان", align: "right" },
    { label: "إيداع (ج.م)", align: "left" },
    { label: "سحب (ج.م)", align: "left" },
  ];

  const rows = (bank.transactions || []).map((t) => [
    date(t.date),
    t.reference || t.checkNumber || "—",
    t.description || "—",
    (t.amount || 0) > 0 ? t.amount : 0,
    (t.amount || 0) < 0 ? Math.abs(t.amount) : 0,
  ]);

  const totalDeposits = (bank.transactions || []).filter((t) => (t.amount || 0) > 0).reduce((s, t) => s + (t.amount || 0), 0);
  const totalWithdrawals = (bank.transactions || []).filter((t) => (t.amount || 0) < 0).reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  const totals = ["الإجمالي", "—", `حركات: ${rows.length}`, totalDeposits, totalWithdrawals];

  exportStyledExcel({
    title: `كشف حساب بنكي — ${bank.bankName}`,
    period: `رقم الحساب: ${bank.accountNumber || ""} · الرصيد الحالي: ${amount(bank.balance || 0)}`,
    headers,
    rows,
    totals,
  });
}

function printBankPdf(bank) {
  const headers = [
    { label: "التاريخ", align: "center" },
    { label: "المرجع", align: "center" },
    { label: "البيان", align: "right" },
    { label: "إيداع", align: "left" },
    { label: "سحب", align: "left" },
  ];

  const rows = (bank.transactions || []).map((t) => [
    date(t.date),
    t.reference || t.checkNumber || "—",
    t.description || "—",
    (t.amount || 0) > 0 ? amount(t.amount) : "—",
    (t.amount || 0) < 0 ? amount(Math.abs(t.amount)) : "—",
  ]);

  const totalDeposits = (bank.transactions || []).filter((t) => (t.amount || 0) > 0).reduce((s, t) => s + (t.amount || 0), 0);
  const totalWithdrawals = (bank.transactions || []).filter((t) => (t.amount || 0) < 0).reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  const totals = ["الإجمالي", "—", `حركات: ${rows.length}`, amount(totalDeposits), amount(totalWithdrawals)];

  printReport({
    title: `كشف حساب بنكي — ${bank.bankName}`,
    subtitle: `مستشفى أمان الحياة — رقم الحساب: ${bank.accountNumber}`,
    period: `تاريخ التقرير: ${date(new Date().toISOString())} · الرصيد: ${amount(bank.balance || 0)}`,
    headers,
    rows,
    totals,
    signatures: ["المسؤول البنكي", "رئيس قسم الحسابات", "المدير المالي"],
  });
}

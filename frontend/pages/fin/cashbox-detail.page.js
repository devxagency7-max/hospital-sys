/**
 * كشف الخزينة النقدية وحركاتها (Cash Box Detail & Statement).
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, date, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { exportStyledExcel, printReport } from "../_shared/print.js";
import { getCashBox } from "../../js/api/finance.api.js";

export default async function cashboxDetailPage(context) {
  const boxId = context.params?.id;
  const box = await getCashBox(boxId);
  const movements = box.movements || [];

  const container = el("div", { class: "flex flex-col gap-6 p-4 md:p-6" });

  const topNav = el(
    "div",
    { class: "flex items-center justify-between flex-wrap gap-3" },
    el(
      "div",
      { class: "flex items-center gap-2" },
      button({
        label: "العودة للخزائن",
        variant: "ghost",
        icon: "chevronStart",
        onClick: () => navigate("/fin/cash-boxes"),
      }),
      el("span", { class: "text-muted" }, "/"),
      el("span", { class: "font-semibold text-ink" }, `خزينة: ${box.name}`),
      badge(box.status === "active" ? "خزينة نشطة" : "مغلقة", {
        tone: box.status === "active" ? "success" : "neutral",
      }),
    ),
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap" },
      button({
        label: "تصدير كشف الخزينة Excel",
        variant: "secondary",
        icon: "download",
        onClick: () => exportCashBoxExcel(box),
      }),
      button({
        label: "طباعة كشف الخزينة (PDF)",
        variant: "primary",
        icon: "print",
        onClick: () => printCashBoxPdf(box),
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
            style: "background: linear-gradient(135deg, #059669, #10b981);",
          },
          "💵",
        ),
        el(
          "div",
          { class: "flex flex-col" },
          el("h2", { class: "text-lg font-bold text-ink" }, box.name),
          el(
            "div",
            { class: "flex items-center gap-2 mt-1 text-xs text-muted flex-wrap" },
            el("span", { class: "font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded" }, box.code),
            el("span", {}, "·"),
            el("span", {}, `أمين العهدة: ${box.custodian?.name || box.custodian || "أمين الخزينة"}`),
            el("span", {}, "·"),
            el("span", {}, `الموقع: ${box.location || "المبنى الرئيسي"}`),
          ),
        ),
      ),
      el(
        "div",
        { class: "flex items-center gap-3 flex-wrap" },
        badge(`الحد الأقصى للرصيد: ${amount(box.maxLimit || 100000)}`, { tone: "info" }),
      ),
    ),
    el(
      "div",
      { class: "grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs" },
      infoBox("الرصيد الفعلي الحالي", amount(box.balance || 0), "text-success-700 dark:text-success-400 font-bold text-base"),
      infoBox("الرصيد الافتتاحي", amount(box.openingBalance || 0), "text-ink"),
      infoBox("آخر جرد ومطابقة", box.lastReconciledAt ? date(box.lastReconciledAt) : "—", "text-muted"),
    ),
  );

  const totalIn = movements.filter((m) => m.direction === "in").reduce((s, m) => s + (m.amount || 0), 0);
  const totalOut = movements.filter((m) => m.direction === "out").reduce((s, m) => s + (m.amount || 0), 0);

  const statsSection = el(
    "div",
    { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" },
    statTile({
      label: "الرصيد النقدي المتوفر",
      value: amount(box.balance || 0),
      tone: "brand",
      icon: "wallet",
    }),
    statTile({
      label: "إجمالي المقبوضات الواردة",
      value: amount(totalIn),
      tone: "success",
      icon: "money",
    }),
    statTile({
      label: "إجمالي المصروفات الصادرة",
      value: amount(totalOut),
      tone: "warning",
      icon: "receipt",
    }),
    statTile({
      label: "إجمالي الحركات النقدية",
      value: integer(movements.length),
      tone: "info",
      icon: "activity",
    }),
  );

  const movementsCard = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm overflow-hidden flex flex-col gap-3" },
    el(
      "div",
      { class: "flex items-center justify-between" },
      el("h3", { class: "text-sm font-bold text-ink" }, "سجل الحركات النقدية اليومية (وارد / صادر)"),
      badge(`حركات: ${movements.length}`, { tone: "brand" }),
    ),
    renderCashMovementsTable(movements),
  );

  container.append(topNav, heroCard, statsSection, movementsCard);
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

function renderCashMovementsTable(movements) {
  const table = el("table", { class: "w-full border-collapse text-right text-xs" });

  const thead = el(
    "thead",
    {},
    el(
      "tr",
      { class: "border-b border-subtle bg-slate-50 dark:bg-slate-800/40 text-muted" },
      el("th", { class: "p-3 font-semibold text-center w-28" }, "التاريخ"),
      el("th", { class: "p-3 font-semibold text-center w-32" }, "رقم الإيصال / السند"),
      el("th", { class: "p-3 font-semibold text-center w-24" }, "النوع"),
      el("th", { class: "p-3 font-semibold" }, "البيان والسبب"),
      el("th", { class: "p-3 font-semibold text-left w-32" }, "مقبوضات (وارد)"),
      el("th", { class: "p-3 font-semibold text-left w-32" }, "مدفوعات (صادر)"),
      el("th", { class: "p-3 font-semibold text-left w-32" }, "الرصيد بعد الحركة"),
    ),
  );

  const tbody = el("tbody", {});
  if (!movements.length) {
    tbody.appendChild(
      el("tr", {}, el("td", { colspan: 7, class: "p-6 text-center text-muted" }, "لا توجد حركات نقدية مسجلة لهذه الخزينة.")),
    );
  } else {
    movements.forEach((m) => {
      const isIn = m.direction === "in";
      tbody.appendChild(
        el(
          "tr",
          { class: "border-b border-subtle hover:bg-slate-50/50 dark:hover:bg-slate-800/20" },
          el("td", { class: "p-3 text-center text-muted" }, date(m.date)),
          el("td", { class: "p-3 text-center font-mono font-bold text-ink" }, m.voucherNumber || m.number || "—"),
          el("td", { class: "p-3 text-center" }, badge(isIn ? "وارد" : "صادر", { tone: isIn ? "success" : "warning", size: "sm" })),
          el("td", { class: "p-3 text-ink font-medium" }, m.description || m.notes || "—"),
          el("td", { class: "p-3 text-left font-mono font-bold text-success-700 dark:text-success-400" }, isIn ? amount(m.amount) : "—"),
          el("td", { class: "p-3 text-left font-mono font-bold text-warning-700 dark:text-warning-400" }, !isIn ? amount(m.amount) : "—"),
          el("td", { class: "p-3 text-left font-mono text-ink" }, m.balanceAfter ? amount(m.balanceAfter) : "—"),
        ),
      );
    });
  }

  table.append(thead, tbody);
  return el("div", { class: "overflow-x-auto" }, table);
}

function exportCashBoxExcel(box) {
  const headers = [
    { label: "التاريخ", align: "center" },
    { label: "رقم السند", align: "center" },
    { label: "نوع الحركة", align: "center" },
    { label: "البيان", align: "right" },
    { label: "وارد (ج.م)", align: "left" },
    { label: "صادر (ج.م)", align: "left" },
  ];

  const rows = (box.movements || []).map((m) => [
    date(m.date),
    m.voucherNumber || m.number || "—",
    m.direction === "in" ? "وارد" : "صادر",
    m.description || "—",
    m.direction === "in" ? m.amount : 0,
    m.direction === "out" ? m.amount : 0,
  ]);

  const totalIn = (box.movements || []).filter((m) => m.direction === "in").reduce((s, m) => s + (m.amount || 0), 0);
  const totalOut = (box.movements || []).filter((m) => m.direction === "out").reduce((s, m) => s + (m.amount || 0), 0);
  const totals = ["الإجمالي", "—", `حركات: ${rows.length}`, `الرصيد: ${amount(box.balance || 0)}`, totalIn, totalOut];

  exportStyledExcel({
    title: `كشف خزينة نقدية — ${box.name}`,
    period: `كود الخزينة: ${box.code} · الرصيد الحالي: ${amount(box.balance || 0)}`,
    headers,
    rows,
    totals,
  });
}

function printCashBoxPdf(box) {
  const headers = [
    { label: "التاريخ", align: "center" },
    { label: "السند", align: "center" },
    { label: "النوع", align: "center" },
    { label: "البيان", align: "right" },
    { label: "وارد", align: "left" },
    { label: "صادر", align: "left" },
  ];

  const rows = (box.movements || []).map((m) => [
    date(m.date),
    m.voucherNumber || m.number || "—",
    m.direction === "in" ? "وارد" : "صادر",
    m.description || "—",
    m.direction === "in" ? amount(m.amount) : "—",
    m.direction === "out" ? amount(m.amount) : "—",
  ]);

  const totalIn = (box.movements || []).filter((m) => m.direction === "in").reduce((s, m) => s + (m.amount || 0), 0);
  const totalOut = (box.movements || []).filter((m) => m.direction === "out").reduce((s, m) => s + (m.amount || 0), 0);
  const totals = ["الإجمالي", "—", `حركات: ${rows.length}`, `الرصيد: ${amount(box.balance || 0)}`, amount(totalIn), amount(totalOut)];

  printReport({
    title: `كشف خزينة نقدية — ${box.name}`,
    subtitle: `مستشفى أمان الحياة — أمين العهدة: ${box.custodian?.name || box.custodian || "أمين الخزينة"}`,
    period: `تاريخ التقرير: ${date(new Date().toISOString())} · الرصيد: ${amount(box.balance || 0)}`,
    headers,
    rows,
    totals,
    signatures: ["أمين الخزينة", "رئيس قسم الخزينة والتحصيل", "المدير المالي"],
  });
}

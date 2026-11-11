/**
 * تفاصيل فاتورة العميل / التأمين (Customer Invoice Detail).
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, date, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { exportStyledExcel, printReport } from "../_shared/print.js";
import { getCustomerInvoice } from "../../js/api/finance.api.js";

const STATUS_MAP = {
  paid: { label: "مسددة بالكامل", tone: "success" },
  partially_paid: { label: "مسددة جزئيًا", tone: "warning" },
  unpaid: { label: "غير مسددة", tone: "danger" },
};

export default async function customerInvoiceDetailPage(context) {
  const invoiceId = context.params?.id;
  let inv;
  try {
    inv = await getCustomerInvoice(invoiceId);
  } catch (err) {
    return el(
      "div",
      { class: "flex flex-col items-center justify-center p-12 text-center gap-4 bg-surface rounded-xl border border-border m-6 shadow-sm" },
      el("div", { class: "text-4xl" }, "🔍"),
      el("h2", { class: "text-lg font-bold text-ink" }, "فاتورة العميل غير موجودة أو تم حذفها"),
      el("p", { class: "text-sm text-muted" }, `لم يتم العثور على فاتورة بالمُعرّف #${invoiceId}`),
      button({
        label: "العودة لفواتير العملاء",
        variant: "primary",
        icon: "chevronStart",
        onClick: () => navigate("/fin/customer-invoices"),
      }),
    );
  }
  const lines = inv.lines || [];
  const receipts = inv.receipts || [];

  const container = el("div", { class: "flex flex-col gap-6 p-4 md:p-6" });

  const topNav = el(
    "div",
    { class: "flex items-center justify-between flex-wrap gap-3" },
    el(
      "div",
      { class: "flex items-center gap-2" },
      button({
        label: "العودة لفواتير العملاء",
        variant: "ghost",
        icon: "chevronStart",
        onClick: () => navigate("/fin/customer-invoices"),
      }),
      el("span", { class: "text-muted" }, "/"),
      el("span", { class: "font-semibold text-ink" }, `فاتورة #${inv.invoiceNumber || inv.number}`),
      badge(STATUS_MAP[inv.status]?.label ?? inv.status, {
        tone: STATUS_MAP[inv.status]?.tone ?? "neutral",
      }),
    ),
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap" },
      button({
        label: "تصدير الفاتورة Excel",
        variant: "secondary",
        icon: "download",
        onClick: () => exportInvoiceExcel(inv),
      }),
      button({
        label: "طباعة الفاتورة (PDF)",
        variant: "primary",
        icon: "print",
        onClick: () => printInvoicePdf(inv),
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
            style: "background: linear-gradient(135deg, #1e3a8a, #0369a1);",
          },
          "📄",
        ),
        el(
          "div",
          { class: "flex flex-col" },
          el("h2", { class: "text-lg font-bold text-ink" }, inv.customerName || inv.partyName || "فاتورة مبيعات / خدمات"),
          el(
            "div",
            { class: "flex items-center gap-2 mt-1 text-xs text-muted flex-wrap" },
            el("span", { class: "font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded" }, inv.invoiceNumber || inv.number),
            el("span", {}, "·"),
            el("span", {}, `تاريخ الإصدار: ${date(inv.date)}`),
            el("span", {}, "·"),
            el("span", {}, `تاريخ الاستحقاق: ${inv.dueDate ? date(inv.dueDate) : "—"}`),
          ),
        ),
      ),
      el(
        "div",
        { class: "flex items-center gap-3 flex-wrap" },
        inv.journalEntry ? badge(`قيد مرتبط #${inv.journalEntry.entryNumber || inv.journalEntry.id}`, { tone: "purple" }) : null,
      ),
    ),
    el(
      "div",
      { class: "grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs" },
      infoBox("إجمالي الفاتورة", amount(inv.total || 0), "text-ink font-bold text-base"),
      infoBox("المبلغ المسدد", amount(inv.paid || (inv.total - (inv.remaining || 0)) || 0), "text-success-700 dark:text-success-400 font-bold"),
      infoBox("المتبقي غير المحصل", amount(inv.remaining || 0), "text-danger-600 font-bold"),
      infoBox("الضريبة والخصم", `ضريبة: ${amount(inv.tax || 0)} · خصم: ${amount(inv.discount || 0)}`, "text-muted"),
    ),
  );

  const statsSection = el(
    "div",
    { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" },
    statTile({
      label: "صافي قيمة الفاتورة",
      value: amount(inv.total || 0),
      tone: "brand",
      icon: "money",
    }),
    statTile({
      label: "التحصيلات المسددة",
      value: amount(inv.paid || 0),
      tone: "success",
      icon: "check",
    }),
    statTile({
      label: "المبلغ المتبقي",
      value: amount(inv.remaining || 0),
      tone: inv.remaining > 0 ? "warning" : "success",
      icon: "clock",
    }),
    statTile({
      label: "عدد البنود والخدمات",
      value: integer(lines.length || 1),
      tone: "info",
      icon: "fileText",
    }),
  );

  const linesCard = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm overflow-hidden flex flex-col gap-3" },
    el(
      "div",
      { class: "flex items-center justify-between" },
      el("h3", { class: "text-sm font-bold text-ink" }, "بنود وتفاصيل الفاتورة"),
      badge(`إجمالي البنود: ${lines.length || 1}`, { tone: "brand" }),
    ),
    renderInvoiceLinesTable(lines, inv),
  );

  container.append(topNav, heroCard, statsSection, linesCard);
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

function renderInvoiceLinesTable(lines, inv) {
  const table = el("table", { class: "w-full border-collapse text-right text-xs" });

  const thead = el(
    "thead",
    {},
    el(
      "tr",
      { class: "border-b border-subtle bg-slate-50 dark:bg-slate-800/40 text-muted" },
      el("th", { class: "p-3 font-semibold text-center w-12" }, "#"),
      el("th", { class: "p-3 font-semibold" }, "بيان الخدمة / الصنف"),
      el("th", { class: "p-3 font-semibold text-center w-28" }, "الكمية"),
      el("th", { class: "p-3 font-semibold text-left w-32" }, "السعر الفردي"),
      el("th", { class: "p-3 font-semibold text-left w-36" }, "الإجمالي"),
    ),
  );

  const tbody = el("tbody", {});
  if (!lines.length) {
    tbody.appendChild(
      el(
        "tr",
        { class: "border-b border-subtle" },
        el("td", { class: "p-3 text-center text-muted" }, "1"),
        el("td", { class: "p-3 font-semibold text-ink" }, inv.notes || "مطالبة خدمات طبية ورعاية"),
        el("td", { class: "p-3 text-center" }, "1"),
        el("td", { class: "p-3 text-left font-mono" }, amount(inv.subtotal || inv.total || 0)),
        el("td", { class: "p-3 text-left font-mono font-bold text-ink" }, amount(inv.total || 0)),
      ),
    );
  } else {
    lines.forEach((l, idx) => {
      tbody.appendChild(
        el(
          "tr",
          { class: "border-b border-subtle hover:bg-slate-50/50 dark:hover:bg-slate-800/20" },
          el("td", { class: "p-3 text-center text-muted" }, String(idx + 1)),
          el("td", { class: "p-3 font-semibold text-ink" }, l.description || l.serviceName || l.itemName || "خدمة طبية"),
          el("td", { class: "p-3 text-center" }, String(l.quantity || 1)),
          el("td", { class: "p-3 text-left font-mono" }, amount(l.unitPrice || l.price || 0)),
          el("td", { class: "p-3 text-left font-mono font-bold text-ink" }, amount(l.total || l.amount || (l.quantity * l.unitPrice) || 0)),
        ),
      );
    });
  }

  table.append(thead, tbody);
  return el("div", { class: "overflow-x-auto" }, table);
}

function exportInvoiceExcel(inv) {
  const headers = [
    { label: "#", align: "center" },
    { label: "البيان", align: "right" },
    { label: "الكمية", align: "center" },
    { label: "سعر الوحدة", align: "left" },
    { label: "الإجمالي (ج.م)", align: "left" },
  ];

  const lines = inv.lines || [];
  const rows = lines.length
    ? lines.map((l, idx) => [idx + 1, l.description || l.serviceName || "خدمة", l.quantity || 1, l.unitPrice || 0, l.total || 0])
    : [[1, inv.notes || "مطالبة خدمات طبية", 1, inv.total || 0, inv.total || 0]];

  const totals = ["الإجمالي العام", "—", "—", "—", inv.total || 0];

  exportStyledExcel({
    title: `فاتورة عميل #${inv.invoiceNumber || inv.number}`,
    period: `العميل: ${inv.customerName || inv.partyName || ""} · تاريخ الإصدار: ${date(inv.date)}`,
    headers,
    rows,
    totals,
  });
}

function printInvoicePdf(inv) {
  const headers = [
    { label: "البيان", align: "right" },
    { label: "الكمية", align: "center" },
    { label: "السعر", align: "left" },
    { label: "الإجمالي", align: "left" },
  ];

  const lines = inv.lines || [];
  const rows = lines.length
    ? lines.map((l) => [l.description || l.serviceName || "خدمة", l.quantity || 1, amount(l.unitPrice || 0), amount(l.total || 0)])
    : [[inv.notes || "مطالبة خدمات طبية", 1, amount(inv.total || 0), amount(inv.total || 0)]];

  const totals = ["الإجمالي", "—", "—", amount(inv.total || 0)];

  printReport({
    title: `فاتورة #${inv.invoiceNumber || inv.number}`,
    subtitle: `مستشفى أمان الحياة — العميل: ${inv.customerName || inv.partyName || ""}`,
    period: `تاريخ الإصدار: ${date(inv.date)} · الاستحقاق: ${inv.dueDate ? date(inv.dueDate) : "فوري"}`,
    headers,
    rows,
    totals,
    signatures: ["المُعِد / المحاسب", "الاعتماد المالي"],
  });
}

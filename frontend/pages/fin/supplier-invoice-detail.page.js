/**
 * تفاصيل فاتورة المورد (Supplier Purchase Invoice Detail).
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, date, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { exportStyledExcel, printReport } from "../_shared/print.js";
import { getSupplierInvoice } from "../../js/api/finance.api.js";

const STATUS_MAP = {
  paid: { label: "مسددة بالكامل", tone: "success" },
  partially_paid: { label: "مسددة جزئيًا", tone: "warning" },
  unpaid: { label: "غير مسددة", tone: "danger" },
};

export default async function supplierInvoiceDetailPage(context) {
  const invoiceId = context.params?.id;
  let inv;
  try {
    inv = await getSupplierInvoice(invoiceId);
  } catch (err) {
    return el(
      "div",
      { class: "flex flex-col items-center justify-center p-12 text-center gap-4 bg-surface rounded-xl border border-border m-6 shadow-sm" },
      el("div", { class: "text-4xl" }, "🔍"),
      el("h2", { class: "text-lg font-bold text-ink" }, "فاتورة المورد غير موجودة أو تم حذفها"),
      el("p", { class: "text-sm text-muted" }, `لم يتم العثور على فاتورة بالمُعرّف #${invoiceId}`),
      button({
        label: "العودة لفواتير الموردين",
        variant: "primary",
        icon: "chevronStart",
        onClick: () => navigate("/fin/supplier-invoices"),
      }),
    );
  }
  const payments = inv.payments || [];

  const container = el("div", { class: "flex flex-col gap-6 p-4 md:p-6" });

  const topNav = el(
    "div",
    { class: "flex items-center justify-between flex-wrap gap-3" },
    el(
      "div",
      { class: "flex items-center gap-2" },
      button({
        label: "العودة لفواتير الموردين",
        variant: "ghost",
        icon: "chevronStart",
        onClick: () => navigate("/fin/supplier-invoices"),
      }),
      el("span", { class: "text-muted" }, "/"),
      el("span", { class: "font-semibold text-ink" }, `فاتورة مورد #${inv.invoiceNumber || inv.number}`),
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
        onClick: () => exportSupplierInvoiceExcel(inv),
      }),
      button({
        label: "طباعة الفاتورة (PDF)",
        variant: "primary",
        icon: "print",
        onClick: () => printSupplierInvoicePdf(inv),
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
            style: "background: linear-gradient(135deg, #0f766e, #0e7490);",
          },
          "📑",
        ),
        el(
          "div",
          { class: "flex flex-col" },
          el("h2", { class: "text-lg font-bold text-ink" }, inv.supplierName || inv.partyName || "فاتورة توريد ومشتريات"),
          el(
            "div",
            { class: "flex items-center gap-2 mt-1 text-xs text-muted flex-wrap" },
            el("span", { class: "font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded" }, inv.invoiceNumber || inv.number),
            el("span", {}, "·"),
            el("span", {}, `رقم فاتورة المورد: ${inv.supplierInvoiceNumber || "—"}`),
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
      infoBox("إجمالي الفاتورة المستحق", amount(inv.total || 0), "text-ink font-bold text-base"),
      infoBox("المبلغ المسدد للمورد", amount(inv.paid || (inv.total - (inv.remaining || 0)) || 0), "text-success-700 dark:text-success-400 font-bold"),
      infoBox("المتبقي غير المسدد", amount(inv.remaining || 0), "text-danger-600 font-bold"),
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
      label: "المدفوعات المسددة",
      value: amount(inv.paid || 0),
      tone: "success",
      icon: "check",
    }),
    statTile({
      label: "المبلغ المتبقي للمورد",
      value: amount(inv.remaining || 0),
      tone: inv.remaining > 0 ? "danger" : "success",
      icon: "clock",
    }),
    statTile({
      label: "عدد سندات الصرف المرتبطة",
      value: integer(payments.length),
      tone: "info",
      icon: "receipt",
    }),
  );

  const paymentsCard = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm overflow-hidden flex flex-col gap-3" },
    el(
      "div",
      { class: "flex items-center justify-between" },
      el("h3", { class: "text-sm font-bold text-ink" }, "سجل المدفوعات وسندات الصرف المسددة"),
      badge(`مدفوعات: ${payments.length}`, { tone: "success" }),
    ),
    renderPaymentsTable(payments),
  );

  container.append(topNav, heroCard, statsSection, paymentsCard);
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

function renderPaymentsTable(payments) {
  const table = el("table", { class: "w-full border-collapse text-right text-xs" });

  const thead = el(
    "thead",
    {},
    el(
      "tr",
      { class: "border-b border-subtle bg-slate-50 dark:bg-slate-800/40 text-muted" },
      el("th", { class: "p-3 font-semibold text-center w-36" }, "رقم السند"),
      el("th", { class: "p-3 font-semibold text-center w-32" }, "تاريخ السداد"),
      el("th", { class: "p-3 font-semibold text-center w-36" }, "طريقة الدفع"),
      el("th", { class: "p-3 font-semibold text-left w-36" }, "المبلغ المسدد"),
      el("th", { class: "p-3 font-semibold" }, "البيان / المستند"),
    ),
  );

  const tbody = el("tbody", {});
  if (!payments.length) {
    tbody.appendChild(
      el("tr", {}, el("td", { colspan: 5, class: "p-6 text-center text-muted" }, "لا توجد مدفوعات مسجلة لهذه الفاتورة حتى الآن.")),
    );
  } else {
    payments.forEach((p) => {
      tbody.appendChild(
        el(
          "tr",
          { class: "border-b border-subtle hover:bg-slate-50/50 dark:hover:bg-slate-800/20" },
          el("td", { class: "p-3 text-center font-mono font-bold text-ink" }, p.number || p.paymentNumber || "—"),
          el("td", { class: "p-3 text-center text-muted" }, date(p.date)),
          el("td", { class: "p-3 text-center text-muted" }, p.method || "تحويل بنكي"),
          el("td", { class: "p-3 text-left font-mono font-bold text-success-700 dark:text-success-400" }, amount(p.amount || 0)),
          el("td", { class: "p-3 text-muted" }, p.notes || "سداد جزء من الفاتورة"),
        ),
      );
    });
  }

  table.append(thead, tbody);
  return el("div", { class: "overflow-x-auto" }, table);
}

function exportSupplierInvoiceExcel(inv) {
  const headers = [
    { label: "البيان", align: "right" },
    { label: "القيمة", align: "right" },
  ];

  const rows = [
    ["رقم الفاتورة بالنظام", inv.invoiceNumber || inv.number],
    ["رقم فاتورة المورد", inv.supplierInvoiceNumber || "—"],
    ["المورد", inv.supplierName || inv.partyName || "—"],
    ["تاريخ الفاتورة", date(inv.date)],
    ["تاريخ الاستحقاق", inv.dueDate ? date(inv.dueDate) : "—"],
    ["إجمالي الفاتورة (ج.م)", inv.total || 0],
    ["المبلغ المسدد (ج.م)", inv.paid || 0],
    ["المتبقي للمورد (ج.م)", inv.remaining || 0],
  ];

  exportStyledExcel({
    title: `فاتورة مورد #${inv.invoiceNumber || inv.number}`,
    period: `المورد: ${inv.supplierName || inv.partyName || ""} · تاريخ الفاتورة: ${date(inv.date)}`,
    headers,
    rows,
  });
}

function printSupplierInvoicePdf(inv) {
  const headers = [
    { label: "البند", align: "right" },
    { label: "التفاصيل", align: "right" },
  ];

  const rows = [
    ["رقم الفاتورة بالنظام", inv.invoiceNumber || inv.number],
    ["رقم فاتورة المورد", inv.supplierInvoiceNumber || "—"],
    ["اسم المورد", inv.supplierName || inv.partyName || "—"],
    ["تاريخ الفاتورة", date(inv.date)],
    ["إجمالي المستحق", amount(inv.total || 0)],
    ["المسدد", amount(inv.paid || 0)],
    ["المتبقي غير المسدد", amount(inv.remaining || 0)],
  ];

  printReport({
    title: `فاتورة توريد #${inv.invoiceNumber || inv.number}`,
    subtitle: `مستشفى أمان الحياة — المورد: ${inv.supplierName || inv.partyName || ""}`,
    period: `تاريخ الإصدار: ${date(inv.date)} · المتبقي: ${amount(inv.remaining || 0)}`,
    headers,
    rows,
    signatures: ["أمين المخزن", "محاسب الموردين", "المدير المالي"],
  });
}

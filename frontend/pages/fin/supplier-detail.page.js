/**
 * كشف حساب المورد (Medical Supplier Statement & Account).
 *
 * كشف الحساب المالي لموردي الأدوية والمستلزمات الطبية والأجهزة، فواتير الشراء،
 * سندات الصرف والمدفوعات، والرصيد المتبقي للمورد.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, date, integer, phone as formatPhone } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { exportStyledExcel, printReport } from "../_shared/print.js";
import { getSupplierAccount } from "../../js/api/finance.api.js";

const INVOICE_STATUS_MAP = {
  paid: { label: "مسددة بالكامل", tone: "success" },
  partially_paid: { label: "مسددة جزئيًا", tone: "warning" },
  unpaid: { label: "غير مسددة", tone: "danger" },
};

export default async function supplierDetailPage(context) {
  const supplierId = context.params?.id;
  const accountData = await getSupplierAccount(supplierId);
  const party = accountData.party || {};
  const summary = accountData.summary || {};

  const container = el("div", { class: "flex flex-col gap-6 p-4 md:p-6" });

  // 1. شريط التنقل العلوي والأزرار
  const topNav = el(
    "div",
    { class: "flex items-center justify-between flex-wrap gap-3" },
    el(
      "div",
      { class: "flex items-center gap-2" },
      button({
        label: "العودة لقائمة الموردين",
        variant: "ghost",
        icon: "chevronStart",
        onClick: () => navigate("/fin/suppliers"),
      }),
      el("span", { class: "text-muted" }, "/"),
      el("span", { class: "font-semibold text-ink" }, `كشف حساب: ${party.name}`),
      badge("مورد أدوية ومستلزمات", { tone: "brand" }),
    ),
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap" },
      button({
        label: "تصدير كشف الحساب Excel",
        variant: "secondary",
        icon: "download",
        onClick: () => exportSupplierExcel(party, accountData),
      }),
      button({
        label: "طباعة كشف الحساب (PDF)",
        variant: "primary",
        icon: "print",
        onClick: () => printSupplierPdf(party, accountData),
      }),
    ),
  );

  // 2. بطاقة المورد التعريفية (Hero Card)
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
            style: "background: linear-gradient(135deg, #0f766e, #0d9488);",
          },
          "🏭",
        ),
        el(
          "div",
          { class: "flex flex-col" },
          el("h2", { class: "text-lg font-bold text-ink" }, party.name),
          el(
            "div",
            { class: "flex items-center gap-2 mt-1 text-xs text-muted flex-wrap" },
            el("span", { class: "font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded" }, party.code),
            el("span", {}, "·"),
            el("span", {}, `السجل التجاري/الضريبي: ${party.taxId || "—"}`),
            el("span", {}, "·"),
            el("span", {}, `الهاتف: ${party.phone ? formatPhone(party.phone) : "—"}`),
          ),
        ),
      ),
      el(
        "div",
        { class: "flex items-center gap-3 flex-wrap" },
        badge(party.status === "active" ? "مورد معتمد" : "موقوف", {
          tone: party.status === "active" ? "success" : "danger",
        }),
      ),
    ),
    el(
      "div",
      { class: "grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs" },
      infoBox("إجمالي مشتريات التوريد", amount(summary.totalInvoiced || 0), "text-ink font-bold"),
      infoBox("إجمالي المدفوعات المسددة", amount(summary.totalPaid || 0), "text-success-700 dark:text-success-400 font-bold"),
      infoBox("الرصيد المستحق للمورد", amount(summary.currentBalance || 0), "text-danger-600 font-bold"),
    ),
  );

  // 3. بطاقات المؤشرات (Stat Cards)
  const statsSection = el(
    "div",
    { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" },
    statTile({
      label: "الرصيد المستحق للمورد",
      value: amount(summary.currentBalance || 0),
      tone: summary.currentBalance > 0 ? "danger" : "success",
      icon: "money",
    }),
    statTile({
      label: "إجمالي فواتير التوريد",
      value: integer((accountData.invoices || []).length),
      tone: "brand",
      icon: "inventory",
    }),
    statTile({
      label: "سندات الصرف والمدفوعات",
      value: integer((accountData.receipts || []).length),
      tone: "info",
      icon: "receipt",
    }),
    statTile({
      label: "فواتير بانتظار السداد",
      value: integer((accountData.invoices || []).filter((i) => i.status !== "paid").length),
      tone: (accountData.invoices || []).some((i) => i.status !== "paid") ? "warning" : "success",
      icon: "clock",
    }),
  );

  // 4. جدول فواتير المورد
  const invoicesCard = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm overflow-hidden flex flex-col gap-3" },
    el(
      "div",
      { class: "flex items-center justify-between" },
      el("h3", { class: "text-sm font-bold text-ink" }, "سجل فواتير التوريد والمشتريات"),
      badge(`إجمالي الفواتير: ${(accountData.invoices || []).length}`, { tone: "brand" }),
    ),
    renderInvoicesTable(accountData.invoices || []),
  );

  // 5. جدول مدفوعات المورد
  const paymentsCard = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm overflow-hidden flex flex-col gap-3" },
    el(
      "div",
      { class: "flex items-center justify-between" },
      el("h3", { class: "text-sm font-bold text-ink" }, "سجل سندات الصرف والمدفوعات المسددة للمورد"),
      badge(`إجمالي السندات: ${(accountData.receipts || []).length}`, { tone: "success" }),
    ),
    renderPaymentsTable(accountData.receipts || []),
  );

  container.append(topNav, heroCard, statsSection, invoicesCard, paymentsCard);
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

function renderInvoicesTable(invoices) {
  const table = el("table", { class: "w-full border-collapse text-right text-xs" });

  const thead = el(
    "thead",
    {},
    el(
      "tr",
      { class: "border-b border-subtle bg-slate-50 dark:bg-slate-800/40 text-muted" },
      el("th", { class: "p-3 font-semibold text-center w-36" }, "رقم الفاتورة"),
      el("th", { class: "p-3 font-semibold text-center w-32" }, "تاريخ الفاتورة"),
      el("th", { class: "p-3 font-semibold text-left w-36" }, "قيمة الفاتورة"),
      el("th", { class: "p-3 font-semibold text-left w-36" }, "المسدد"),
      el("th", { class: "p-3 font-semibold text-left w-36" }, "المتبقي"),
      el("th", { class: "p-3 font-semibold text-center w-32" }, "الحالة"),
    ),
  );

  const tbody = el("tbody", {});
  if (!invoices.length) {
    tbody.appendChild(
      el("tr", {}, el("td", { colspan: 6, class: "p-6 text-center text-muted" }, "لا توجد فواتير توريد مسجلة.")),
    );
  } else {
    invoices.forEach((inv) => {
      const statusInfo = INVOICE_STATUS_MAP[inv.status] || { label: inv.status, tone: "neutral" };
      tbody.appendChild(
        el(
          "tr",
          { class: "border-b border-subtle hover:bg-slate-50/50 dark:hover:bg-slate-800/20" },
          el("td", { class: "p-3 text-center font-mono font-bold text-ink" }, inv.invoiceNumber || inv.number || "—"),
          el("td", { class: "p-3 text-center text-muted" }, date(inv.date || inv.issueDate)),
          el("td", { class: "p-3 text-left font-mono font-bold text-ink" }, amount(inv.total || inv.amount || 0)),
          el("td", { class: "p-3 text-left font-mono text-success-700 dark:text-success-400" }, amount(inv.paid || (inv.total - (inv.remaining || 0)) || 0)),
          el("td", { class: "p-3 text-left font-mono font-bold text-danger-600" }, amount(inv.remaining || 0)),
          el("td", { class: "p-3 text-center" }, badge(statusInfo.label, { tone: statusInfo.tone, size: "sm" })),
        ),
      );
    });
  }

  table.append(thead, tbody);
  return el("div", { class: "overflow-x-auto" }, table);
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
      el("th", { class: "p-3 font-semibold text-center w-32" }, "تاريخ الصرف"),
      el("th", { class: "p-3 font-semibold text-center w-36" }, "طريقة السداد"),
      el("th", { class: "p-3 font-semibold text-left w-36" }, "المبلغ المسدد"),
      el("th", { class: "p-3 font-semibold" }, "البيان / المستند"),
    ),
  );

  const tbody = el("tbody", {});
  if (!payments.length) {
    tbody.appendChild(
      el("tr", {}, el("td", { colspan: 5, class: "p-6 text-center text-muted" }, "لا توجد سندات صرف مسجلة لهذا المورد.")),
    );
  } else {
    payments.forEach((p) => {
      tbody.appendChild(
        el(
          "tr",
          { class: "border-b border-subtle hover:bg-slate-50/50 dark:hover:bg-slate-800/20" },
          el("td", { class: "p-3 text-center font-mono font-bold text-ink" }, p.receiptNumber || p.number || p.paymentNumber || "—"),
          el("td", { class: "p-3 text-center text-muted" }, date(p.date)),
          el("td", { class: "p-3 text-center text-muted" }, p.method || p.paymentMethod || "تحويل بنكي"),
          el("td", { class: "p-3 text-left font-mono font-bold text-success-700 dark:text-success-400" }, amount(p.amount || 0)),
          el("td", { class: "p-3 text-muted" }, p.notes || p.description || "—"),
        ),
      );
    });
  }

  table.append(thead, tbody);
  return el("div", { class: "overflow-x-auto" }, table);
}

function exportSupplierExcel(party, accountData) {
  const headers = [
    { label: "رقم الفاتورة", align: "center" },
    { label: "تاريخ الفاتورة", align: "center" },
    { label: "قيمة الفاتورة", align: "left" },
    { label: "المسدد", align: "left" },
    { label: "المتبقي للمورد", align: "left" },
  ];

  const rows = (accountData.invoices || []).map((i) => [
    i.invoiceNumber || i.number || "—",
    date(i.date || i.issueDate),
    i.total || i.amount || 0,
    (i.total || i.amount || 0) - (i.remaining || 0),
    i.remaining || 0,
  ]);

  const summary = accountData.summary || {};
  const totals = ["الإجمالي العام", "—", summary.totalInvoiced || 0, summary.totalPaid || 0, summary.currentBalance || 0];

  exportStyledExcel({
    title: `كشف حساب مورد — ${party.name}`,
    period: `كود المورد: ${party.code}`,
    headers,
    rows,
    totals,
  });
}

function printSupplierPdf(party, accountData) {
  const headers = [
    { label: "رقم الفاتورة", align: "center" },
    { label: "التاريخ", align: "center" },
    { label: "قيمة الفاتورة", align: "left" },
    { label: "المسدد", align: "left" },
    { label: "المتبقي", align: "left" },
  ];

  const rows = (accountData.invoices || []).map((i) => [
    i.invoiceNumber || i.number || "—",
    date(i.date || i.issueDate),
    amount(i.total || i.amount || 0),
    amount((i.total || i.amount || 0) - (i.remaining || 0)),
    amount(i.remaining || 0),
  ]);

  const summary = accountData.summary || {};
  const totals = ["الإجمالي", "—", amount(summary.totalInvoiced || 0), amount(summary.totalPaid || 0), amount(summary.currentBalance || 0)];

  printReport({
    title: `كشف حساب مورد — ${party.name}`,
    subtitle: `مستشفى أمان الحياة — كود: ${party.code}`,
    period: `الرصيد المستحق: ${amount(summary.currentBalance || 0)}`,
    headers,
    rows,
    totals,
    signatures: ["محاسب الموردين", "رئيس قسم الحسابات", "المدير المالي"],
  });
}

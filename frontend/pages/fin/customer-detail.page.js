/**
 * كشف حساب العميل / شركة التأمين (Customer / Insurance Statement).
 *
 * كشف الحساب المالي لشركات التأمين الطبي والعملاء، الفواتير الصادرة،
 * سندات التحصيل والدفعات، والرصيد المتبقي وحد الائتمان.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, date, integer, phone as formatPhone } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { exportStyledExcel, printReport } from "../_shared/print.js";
import { getCustomerAccount } from "../../js/api/finance.api.js";

const INVOICE_STATUS_MAP = {
  paid: { label: "مسددة بالكامل", tone: "success" },
  partially_paid: { label: "مسددة جزئيًا", tone: "warning" },
  unpaid: { label: "غير مسددة", tone: "danger" },
};

export default async function customerDetailPage(context) {
  const customerId = context.params?.id;
  const accountData = await getCustomerAccount(customerId);
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
        label: "العودة لقائمة العملاء",
        variant: "ghost",
        icon: "chevronStart",
        onClick: () => navigate("/fin/customers"),
      }),
      el("span", { class: "text-muted" }, "/"),
      el("span", { class: "font-semibold text-ink" }, `كشف حساب: ${party.name}`),
      badge(party.customerType === "insurance" ? "شركة تأمين طبي" : "عميل نقدي / جهة", { tone: "purple" }),
    ),
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap" },
      button({
        label: "تصدير كشف الحساب Excel",
        variant: "secondary",
        icon: "download",
        onClick: () => exportCustomerExcel(party, accountData),
      }),
      button({
        label: "طباعة كشف الحساب (PDF)",
        variant: "primary",
        icon: "print",
        onClick: () => printCustomerPdf(party, accountData),
      }),
    ),
  );

  // 2. بطاقة العميل التعريفية (Hero Card)
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
            style: "background: linear-gradient(135deg, #1e3a8a, #7c3aed);",
          },
          "🏢",
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
            el("span", {}, `السجل/الضريبي: ${party.taxId || "—"}`),
            el("span", {}, "·"),
            el("span", {}, `الهاتف: ${party.phone ? formatPhone(party.phone) : "—"}`),
          ),
        ),
      ),
      el(
        "div",
        { class: "flex items-center gap-3 flex-wrap" },
        badge(`حد الائتمان: ${amount(accountData.creditLimit || 0)}`, { tone: "info" }),
        badge(accountData.overLimit ? "تجاوز حد الائتمان!" : "ائتمان سليم", {
          tone: accountData.overLimit ? "danger" : "success",
        }),
      ),
    ),
    el(
      "div",
      { class: "grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs" },
      infoBox("إجمالي الفواتير الصادرة", amount(summary.totalInvoiced || 0), "text-ink font-bold"),
      infoBox("إجمالي المسدد والمحصل", amount(summary.totalPaid || 0), "text-success-700 dark:text-success-400 font-bold"),
      infoBox("الرصيد المتبقي المستحق", amount(summary.currentBalance || 0), "text-brand-700 dark:text-brand-400 font-bold"),
      infoBox("الائتمان المتاح", amount(accountData.availableCredit || 0), "text-muted"),
    ),
  );

  // 3. بطاقات المؤشرات (Stat Cards)
  const statsSection = el(
    "div",
    { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" },
    statTile({
      label: "الرصيد المتبقي المستحق",
      value: amount(summary.currentBalance || 0),
      tone: summary.currentBalance > 0 ? "warning" : "success",
      icon: "money",
    }),
    statTile({
      label: "إجمالي الفواتير",
      value: integer((accountData.invoices || []).length),
      tone: "brand",
      icon: "billing",
    }),
    statTile({
      label: "سندات التحصيل",
      value: integer((accountData.receipts || []).length),
      tone: "info",
      icon: "receipt",
    }),
    statTile({
      label: "فواتير غير مسددة",
      value: integer((accountData.invoices || []).filter((i) => i.status !== "paid").length),
      tone: (accountData.invoices || []).some((i) => i.status !== "paid") ? "danger" : "success",
      icon: "clock",
    }),
  );

  // 4. جدول فواتير العميل / شركة التأمين
  const invoicesCard = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm overflow-hidden flex flex-col gap-3" },
    el(
      "div",
      { class: "flex items-center justify-between" },
      el("h3", { class: "text-sm font-bold text-ink" }, "سجل الفواتير والمطالبات المالية"),
      badge(`إجمالي الفواتير: ${(accountData.invoices || []).length}`, { tone: "brand" }),
    ),
    renderInvoicesTable(accountData.invoices || []),
  );

  // 5. جدول سندات التحصيل
  const receiptsCard = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm overflow-hidden flex flex-col gap-3" },
    el(
      "div",
      { class: "flex items-center justify-between" },
      el("h3", { class: "text-sm font-bold text-ink" }, "سجل سندات التحصيل والدفعات الواردة"),
      badge(`إجمالي السندات: ${(accountData.receipts || []).length}`, { tone: "success" }),
    ),
    renderReceiptsTable(accountData.receipts || []),
  );

  container.append(topNav, heroCard, statsSection, invoicesCard, receiptsCard);
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
      el("th", { class: "p-3 font-semibold text-center w-32" }, "تاريخ الإصدار"),
      el("th", { class: "p-3 font-semibold text-left w-36" }, "إجمالي الفاتورة"),
      el("th", { class: "p-3 font-semibold text-left w-36" }, "المسدد"),
      el("th", { class: "p-3 font-semibold text-left w-36" }, "المتبقي"),
      el("th", { class: "p-3 font-semibold text-center w-32" }, "الحالة"),
    ),
  );

  const tbody = el("tbody", {});
  if (!invoices.length) {
    tbody.appendChild(
      el("tr", {}, el("td", { colspan: 6, class: "p-6 text-center text-muted" }, "لا توجد فواتير مسجلة لهذا العميل.")),
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

function renderReceiptsTable(receipts) {
  const table = el("table", { class: "w-full border-collapse text-right text-xs" });

  const thead = el(
    "thead",
    {},
    el(
      "tr",
      { class: "border-b border-subtle bg-slate-50 dark:bg-slate-800/40 text-muted" },
      el("th", { class: "p-3 font-semibold text-center w-36" }, "رقم السند"),
      el("th", { class: "p-3 font-semibold text-center w-32" }, "تاريخ التحصيل"),
      el("th", { class: "p-3 font-semibold text-center w-36" }, "طريقة السداد"),
      el("th", { class: "p-3 font-semibold text-left w-36" }, "المبلغ المحصل"),
      el("th", { class: "p-3 font-semibold" }, "البيان / الملاحظات"),
    ),
  );

  const tbody = el("tbody", {});
  if (!receipts.length) {
    tbody.appendChild(
      el("tr", {}, el("td", { colspan: 5, class: "p-6 text-center text-muted" }, "لا توجد سندات تحصيل مسجلة.")),
    );
  } else {
    receipts.forEach((r) => {
      tbody.appendChild(
        el(
          "tr",
          { class: "border-b border-subtle hover:bg-slate-50/50 dark:hover:bg-slate-800/20" },
          el("td", { class: "p-3 text-center font-mono font-bold text-ink" }, r.receiptNumber || r.number || "—"),
          el("td", { class: "p-3 text-center text-muted" }, date(r.date)),
          el("td", { class: "p-3 text-center text-muted" }, r.method || r.paymentMethod || "نقدي"),
          el("td", { class: "p-3 text-left font-mono font-bold text-success-700 dark:text-success-400" }, amount(r.amount || 0)),
          el("td", { class: "p-3 text-muted" }, r.notes || r.description || "—"),
        ),
      );
    });
  }

  table.append(thead, tbody);
  return el("div", { class: "overflow-x-auto" }, table);
}

function exportCustomerExcel(party, accountData) {
  const headers = [
    { label: "رقم الفاتورة", align: "center" },
    { label: "تاريخ الإصدار", align: "center" },
    { label: "إجمالي الفاتورة", align: "left" },
    { label: "المسدد", align: "left" },
    { label: "المتبقي المستحق", align: "left" },
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
    title: `كشف حساب عميل — ${party.name}`,
    period: `كود العميل: ${party.code} · ${party.customerType === "insurance" ? "تأمين طبي" : ""}`,
    headers,
    rows,
    totals,
  });
}

function printCustomerPdf(party, accountData) {
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
    title: `كشف حساب عميل — ${party.name}`,
    subtitle: `مستشفى أمان الحياة — كود: ${party.code}`,
    period: `الرصيد المستحق: ${amount(summary.currentBalance || 0)}`,
    headers,
    rows,
    totals,
    signatures: ["المحاسب المسؤول", "رئيس قسم الحسابات", "المدير المالي"],
  });
}

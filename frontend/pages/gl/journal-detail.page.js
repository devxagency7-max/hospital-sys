/**
 * تفاصيل قيد اليومية (Journal Entry Detail).
 *
 * عرض ترويسة القيد، أطراف القيد المتوازنة (مدين / دائن)، مراكز التكلفة، مسار الحساب،
 * سجل التدقيق والمراجعة، مع إمكانية الترحيل، العكس، والطباعة والتصدير.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, date, dateTime, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { exportStyledExcel, printReport } from "../_shared/print.js";
import { toast } from "../../components/feedback/toast.js";
import {
  getJournalEntry,
  postJournalEntry,
  reverseJournalEntry,
} from "../../js/api/accounting.api.js";

const STATUS_MAP = {
  posted: { label: "مُرحَّل", tone: "success" },
  draft: { label: "مسوّدة", tone: "neutral" },
  reversed: { label: "معكوس", tone: "danger" },
};

export default async function journalDetailPage(context) {
  const entryId = context.params?.id;
  const entry = await getJournalEntry(entryId);

  const container = el("div", { class: "flex flex-col gap-6 p-4 md:p-6" });

  // 1. شريط التنقل العلوي والأزرار
  const topNav = el(
    "div",
    { class: "flex items-center justify-between flex-wrap gap-3" },
    el(
      "div",
      { class: "flex items-center gap-2" },
      button({
        label: "العودة لقيود اليومية",
        variant: "ghost",
        icon: "chevronStart",
        onClick: () => navigate("/gl/journal"),
      }),
      el("span", { class: "text-muted" }, "/"),
      el("span", { class: "font-semibold text-ink" }, `قيد يومية #${entry.entryNumber}`),
      badge(STATUS_MAP[entry.status]?.label ?? entry.status, {
        tone: STATUS_MAP[entry.status]?.tone ?? "neutral",
      }),
    ),
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap" },
      button({
        label: "تصدير Excel",
        variant: "secondary",
        icon: "download",
        onClick: () => exportJournalExcel(entry),
      }),
      button({
        label: "طباعة سند القيد (PDF)",
        variant: "primary",
        icon: "print",
        onClick: () => printJournalPdf(entry),
      }),
      entry.status === "draft"
        ? button({
            label: "ترحيل القيد للأستاذ",
            variant: "success",
            icon: "check",
            permission: "gl.journal.post",
            onClick: async () => {
              try {
                await postJournalEntry(entry.id);
                toast.success("تم ترحيل القيد بنجاح.");
                navigate(`/gl/journal/${entry.id}`);
              } catch (e) {
                toast.error(e.message || "فشل ترحيل القيد.");
              }
            },
          })
        : null,
      entry.status === "posted" && entry.isReversible
        ? button({
            label: "عكس القيد",
            variant: "danger",
            icon: "alertTriangle",
            permission: "gl.journal.reverse",
            onClick: async () => {
              const reason = prompt("يرجى كتابة سبب عكس القيد:");
              if (!reason) return;
              try {
                await reverseJournalEntry(entry.id, { reason, date: new Date().toISOString().slice(0, 10) });
                toast.success("تم عكس القيد بنجاح.");
                navigate(`/gl/journal/${entry.id}`);
              } catch (e) {
                toast.error(e.message || "فشل عكس القيد.");
              }
            },
          })
        : null,
    ),
  );

  // 2. بطاقات المؤشرات (Stat Cards)
  const statsSection = el(
    "div",
    { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" },
    statTile({
      label: "إجمالي المدين",
      value: amount(entry.totalDebit),
      tone: "brand",
      icon: "accounting",
    }),
    statTile({
      label: "إجمالي الدائن",
      value: amount(entry.totalCredit),
      tone: "info",
      icon: "accounting",
    }),
    statTile({
      label: "عدد بنود القيد",
      value: integer(entry.lines?.length ?? 0),
      tone: "purple",
      icon: "fileText",
    }),
    statTile({
      label: "توازن القيد",
      value: entry.totalDebit === entry.totalCredit ? "متوازن (0.00)" : "غير متوازن!",
      tone: entry.totalDebit === entry.totalCredit ? "success" : "danger",
      icon: "check",
    }),
  );

  // 3. ترويسة بيانات القيد (Entry Header Card)
  const headerCard = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm" },
    el(
      "div",
      { class: "border-b border-subtle pb-3 mb-4" },
      el("h2", { class: "text-base font-bold text-ink" }, "بيانات وترويسة القيد المحاسبي"),
      el("p", { class: "text-xs text-muted mt-0.5" }, "المعلومات الأساسية والفترة المالية ووثيقة المصدر."),
    ),
    el(
      "div",
      { class: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs" },
      infoItem("رقم القيد", entry.entryNumber, true),
      infoItem("تاريخ القيد", date(entry.date)),
      infoItem("الفترة المحاسبية", entry.periodName || "—"),
      infoItem("المصدر", entry.sourceLabel || "يدوي"),
      infoItem("المُعد / المنشئ", entry.createdBy || "—"),
      infoItem("تاريخ الإنشاء", entry.createdAt ? dateTime(entry.createdAt) : "—"),
      infoItem("المعتمد / المرحل", entry.postedBy || entry.approvedBy || "—"),
      infoItem("تاريخ الترحيل", entry.postedAt ? dateTime(entry.postedAt) : "—"),
    ),
    entry.description
      ? el(
          "div",
          { class: "mt-4 pt-3 border-t border-subtle text-xs" },
          el("span", { class: "font-semibold text-muted ml-2" }, "شرح القيد / البيان العام:"),
          el("span", { class: "text-ink font-medium" }, entry.description),
        )
      : null,
    entry.notes
      ? el(
          "div",
          { class: "mt-2 text-xs text-muted" },
          el("span", { class: "font-semibold text-muted ml-2" }, "ملاحظات إضافية:"),
          el("span", {}, entry.notes),
        )
      : null,
  );

  // 4. جدول أطراف القيد (Lines Table)
  const linesCard = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm overflow-hidden flex flex-col gap-3" },
    el(
      "div",
      { class: "flex items-center justify-between flex-wrap gap-2" },
      el("h3", { class: "text-sm font-bold text-ink" }, "بنود وأطراف القيد المحاسبي"),
      badge(
        `إجمالي القيد: ${amount(entry.totalDebit)} ج.م`,
        { tone: "brand" },
      ),
    ),
    el(
      "div",
      { class: "overflow-x-auto" },
      renderLinesTable(entry.lines || [], entry.totalDebit, entry.totalCredit),
    ),
  );

  container.append(topNav, statsSection, headerCard, linesCard);
  return container;
}

function infoItem(label, valueText, isCode = false) {
  return el(
    "div",
    { class: "flex flex-col gap-1" },
    el("span", { class: "text-muted" }, label),
    el("span", { class: `text-ink font-semibold ${isCode ? "font-mono" : ""}` }, valueText || "—"),
  );
}

function renderLinesTable(lines, totalDebit, totalCredit) {
  const table = el("table", { class: "w-full border-collapse text-right text-xs" });

  const thead = el(
    "thead",
    {},
    el(
      "tr",
      { class: "border-b border-subtle bg-slate-50 dark:bg-slate-800/40 text-muted" },
      el("th", { class: "p-3 font-semibold w-12 text-center" }, "#"),
      el("th", { class: "p-3 font-semibold w-28 text-center" }, "كود الحساب"),
      el("th", { class: "p-3 font-semibold" }, "اسم الحساب / التبويب الشجري"),
      el("th", { class: "p-3 font-semibold" }, "البيان التفصيلي"),
      el("th", { class: "p-3 font-semibold w-36" }, "مركز التكلفة"),
      el("th", { class: "p-3 font-semibold w-32 text-left" }, "مدين"),
      el("th", { class: "p-3 font-semibold w-32 text-left" }, "دائن"),
    ),
  );

  const tbody = el("tbody", {});

  lines.forEach((line, idx) => {
    tbody.appendChild(
      el(
        "tr",
        { class: "border-b border-subtle hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors" },
        el("td", { class: "p-3 text-center text-muted" }, String(idx + 1)),
        el("td", { class: "p-3 text-center font-mono font-bold text-ink" }, line.accountCode),
        el(
          "td",
          { class: "p-3" },
          el("div", { class: "font-semibold text-ink" }, line.accountName),
          line.accountPath ? el("div", { class: "text-[11px] text-muted truncate max-w-md" }, line.accountPath) : null,
        ),
        el("td", { class: "p-3 text-muted" }, line.description || "—"),
        el("td", { class: "p-3 text-muted" }, line.costCenterName || "—"),
        el(
          "td",
          { class: "p-3 text-left font-mono font-bold text-ink" },
          line.debit ? amount(line.debit) : "—",
        ),
        el(
          "td",
          { class: "p-3 text-left font-mono font-bold text-ink" },
          line.credit ? amount(line.credit) : "—",
        ),
      ),
    );
  });

  const tfoot = el(
    "tfoot",
    {},
    el(
      "tr",
      { class: "border-t-2 border-line-strong bg-slate-100 dark:bg-slate-800 font-bold text-ink text-xs" },
      el("td", { colspan: 5, class: "p-3 text-right" }, "الإجمالي العام المتوازن:"),
      el("td", { class: "p-3 text-left font-mono text-brand-700 dark:text-brand-400" }, amount(totalDebit)),
      el("td", { class: "p-3 text-left font-mono text-brand-700 dark:text-brand-400" }, amount(totalCredit)),
    ),
  );

  table.append(thead, tbody, tfoot);
  return table;
}

function exportJournalExcel(entry) {
  const headers = [
    { label: "#", align: "center" },
    { label: "كود الحساب", align: "center" },
    { label: "اسم الحساب", align: "right" },
    { label: "البيان التفصيلي", align: "right" },
    { label: "مركز التكلفة", align: "center" },
    { label: "مدين (ج.م)", align: "left" },
    { label: "دائن (ج.م)", align: "left" },
  ];

  const rows = (entry.lines || []).map((l, idx) => [
    idx + 1,
    l.accountCode,
    l.accountName,
    l.description || "—",
    l.costCenterName || "—",
    l.debit || 0,
    l.credit || 0,
  ]);

  const totals = [
    "الإجمالي المتوازن",
    "—",
    `عدد البنود: ${rows.length}`,
    "—",
    "—",
    entry.totalDebit,
    entry.totalCredit,
  ];

  exportStyledExcel({
    title: `سند قيد يومية #${entry.entryNumber}`,
    period: `تاريخ القيد: ${date(entry.date)} · ${entry.periodName || ""}`,
    headers,
    rows,
    totals,
  });
}

function printJournalPdf(entry) {
  const headers = [
    { label: "كود الحساب", align: "center" },
    { label: "اسم الحساب", align: "right" },
    { label: "البيان التفصيلي", align: "right" },
    { label: "مركز التكلفة", align: "center" },
    { label: "مدين", align: "left" },
    { label: "دائن", align: "left" },
  ];

  const rows = (entry.lines || []).map((l) => [
    l.accountCode,
    l.accountName,
    l.description || "—",
    l.costCenterName || "—",
    l.debit ? amount(l.debit) : "—",
    l.credit ? amount(l.credit) : "—",
  ]);

  const totals = ["الإجمالي العام", "—", `بنود: ${rows.length}`, "—", amount(entry.totalDebit), amount(entry.totalCredit)];

  printReport({
    title: `سند قيد يومية #${entry.entryNumber}`,
    subtitle: entry.description || "قيد محاسبي معتمد بنظام الإدارة المالية لمستشفى أمان الحياة",
    period: `تاريخ القيد: ${date(entry.date)} · الفترة: ${entry.periodName || ""}`,
    headers,
    rows,
    totals,
    signatures: ["المُعِد / المحاسب", "المراجعة والتدقيق", "الاعتماد المالي"],
  });
}

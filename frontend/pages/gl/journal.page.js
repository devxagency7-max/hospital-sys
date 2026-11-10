/**
 * قيود اليومية — القائمة ودورة الحياة.
 *
 * دورة القيد: مسوّدة → بانتظار الاعتماد → معتمد → مُرحَّل، والمُرحَّل يُعكَس
 * ولا يُعدَّل. أزرار الصف تعكس الحالة الفعلية لا تُخمّنها.
 */

import { el } from "../../js/core/dom.js";
import { buttonGroup, iconButton, button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { textarea } from "../../components/forms/fields.js";
import { currency, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { statusOptions } from "../../js/core/statuses.js";
import * as money from "../../js/core/money.js";
import { listPage, runAction, confirmThenRun } from "../_shared/list-page.js";
import { moneyColumn, dateColumn, statusColumn, codeColumn, textColumn, totalCell } from "../_shared/cells.js";
import { formModal, value } from "../_shared/forms.js";
import {
  listJournalEntries,
  submitJournalEntry,
  approveJournalEntry,
  postJournalEntry,
  reverseJournalEntry,
} from "../../js/api/accounting.api.js";
import { getDocumentSources, getPeriods, toOptions } from "../../js/api/lookups.api.js";

export default async function journalPage() {
  const [sources, periods] = await Promise.all([getDocumentSources(), getPeriods()]);

  return listPage({
    title: "قيود اليومية",
    description:
      "كل حركة محاسبية في النظام. القيود الآلية مُولَّدة من مستندات الموديولات وتحمل مرجعها.",
    tableId: "gl-journal",
    searchPlaceholder: "بحث برقم القيد أو الوصف أو المرجع…",
    initialParams: { sort: "date", order: "desc" },
    fetch: listJournalEntries,

    actions: () => [
      button({
        label: "إنشاء قيد يدوي",
        variant: "primary",
        icon: "plus",
        permission: "gl.journal.create",
        onClick: () => navigate("/gl/journal/new"),
      }),
    ],

    filters: [
      {
        key: "status",
        label: "الحالة",
        options: statusOptions(["draft", "pending_approval", "approved", "posted", "reversed"]),
      },
      { key: "sourceType", label: "المصدر", options: toOptions(sources) },
      { key: "periodId", label: "الفترة", options: toOptions(periods) },
    ],

    columns: [
      codeColumn("entryNumber", "رقم القيد", { width: "9.5rem" }),
      dateColumn("date", "التاريخ"),
      {
        key: "description",
        label: "الوصف",
        alwaysVisible: true,
        render: (row) =>
          el(
            "div",
            { class: "min-w-0" },
            el("div", { class: "text-ink truncate-1" }, row.description),
            el(
              "div",
              { class: "flex items-center gap-1.5 mt-1" },
              /* القيد الآلي يُوسَم بمصدره: من يقرأ الدفتر يحتاج أن يعرف
                 أي مستند أنشأ القيد قبل أن يسأل عن سببه. */
              row.isAutomatic
                ? badge(row.sourceLabel, { tone: "info", size: "sm" })
                : badge("يدوي", { tone: "neutral", size: "sm" }),
              row.isReversal ? badge("قيد عكسي", { tone: "purple", size: "sm" }) : null,
              row.reference
                ? el("span", { class: "text-[11px] text-faint font-mono" }, row.reference)
                : null,
            ),
          ),
      },
      textColumn("periodName", "الفترة", { width: "8rem", muted: true }),
      { key: "linesCount", label: "سطور", numeric: true, width: "4.5rem" },
      moneyColumn("totalDebit", "مدين"),
      moneyColumn("totalCredit", "دائن"),
      statusColumn(),
      textColumn("createdBy", "أنشأه", { width: "11rem", muted: true, hidden: true }),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: "مجموع الصفحة", colspan: 4 },
            { value: integer(rows.reduce((total, row) => total + (row.linesCount ?? 0), 0)), numeric: true },
            { value: totalCell(money.sumBy(rows, "totalDebit")), numeric: true },
            { value: totalCell(money.sumBy(rows, "totalCredit")), numeric: true },
            { value: "", colspan: 2 },
          ]
        : null,

    onRowClick: (row) => navigate(`/gl/journal/${row.id}`),

    rowActions: (row, context) =>
      buttonGroup(
        iconButton("eye", {
          label: "عرض القيد",
          onClick: () => navigate(`/gl/journal/${row.id}`),
        }),

        row.status === "draft"
          ? iconButton("upload", {
              label: "تقديم للمراجعة",
              permission: "gl.journal.create",
              onClick: () =>
                runAction(() => submitJournalEntry(row.id), {
                  success: `قُدِّم القيد ${row.entryNumber} للمراجعة.`,
                  context,
                }),
            })
          : null,

        ["draft", "pending_approval"].includes(row.status)
          ? iconButton("check", {
              label: "اعتماد",
              variant: "ghost",
              permission: "gl.journal.approve",
              onClick: () =>
                runAction(() => approveJournalEntry(row.id), {
                  success: `اعتُمد القيد ${row.entryNumber}.`,
                  context,
                }),
            })
          : null,

        row.status === "approved"
          ? iconButton("checkCircle", {
              label: "ترحيل",
              variant: "ghost",
              permission: "gl.journal.post",
              onClick: () =>
                confirmThenRun(
                  {
                    title: `ترحيل القيد ${row.entryNumber}؟`,
                    message:
                      "القيد المُرحَّل يدخل الأرصدة ولا يُعدَّل ولا يُحذف بعدها. " +
                      "التصحيح يكون بقيد عكسي.",
                    confirmLabel: "ترحيل",
                    tone: "primary",
                  },
                  () => postJournalEntry(row.id),
                  { success: `رُحِّل القيد ${row.entryNumber}.`, context },
                ),
            })
          : null,

        row.isReversible
          ? iconButton("refresh", {
              label: "عكس القيد",
              variant: "danger-ghost",
              permission: "gl.journal.reverse",
              onClick: () => openReverseModal(row, context),
            })
          : null,
      ),

    stats: async () => {
      /*
       * المؤشرات تُحسب على **كل** القيود لا على صفحة الجدول: «12 قيد معلَّق»
       * يجب أن يكون عددها الحقيقي، لا عدد المعلَّق في الخمسة والعشرين المعروضة.
       */
      const [all, drafts, pending, approved, posted] = await Promise.all([
        listJournalEntries({ perPage: 1 }),
        listJournalEntries({ perPage: 1, status: "draft" }),
        listJournalEntries({ perPage: 1, status: "pending_approval" }),
        listJournalEntries({ perPage: 1, status: "approved" }),
        listJournalEntries({ perPage: 1, status: "posted" }),
      ]);

      return [
        statTile({ label: "إجمالي القيود", value: integer(all.meta.total), tone: "neutral", icon: "fileText" }),
        statTile({ label: "مسوّدات", value: integer(drafts.meta.total), tone: "neutral", icon: "edit" }),
        statTile({
          label: "بانتظار الاعتماد",
          value: integer(pending.meta.total),
          tone: pending.meta.total ? "warning" : "neutral",
          icon: "clock",
        }),
        statTile({
          label: "معتمد لم يُرحَّل",
          value: integer(approved.meta.total),
          tone: approved.meta.total ? "info" : "neutral",
          icon: "check",
        }),
        statTile({ label: "مُرحَّل", value: integer(posted.meta.total), tone: "success", icon: "checkCircle" }),
      ];
    },

    emptyMessage: "لا قيود مطابقة لهذه الفلاتر.",
  });
}

/* ==========================================================================
   نافذة عكس القيد
   ========================================================================== */

function openReverseModal(entry, context) {
  const form = { reason: "", date: new Date().toISOString().slice(0, 10) };

  formModal({
    title: `عكس القيد ${entry.entryNumber}`,
    subtitle: entry.description,
    size: "md",
    submitLabel: "عكس القيد",
    submitVariant: "danger",
    success: `أُنشئ قيد عكسي للقيد ${entry.entryNumber}.`,
    fieldLabels: { reason: "سبب العكس" },

    validate: () => (form.reason.trim() ? {} : { reason: "سبب العكس مطلوب — للتدقيق." }),

    body: () =>
      el(
        "div",
        { class: "space-y-3.5" },
        el(
          "div",
          { class: "rounded-xl border border-line bg-subtle p-3 space-y-1.5 text-xs" },
          el(
            "p",
            { class: "text-ink font-medium" },
            "العكس لا يحذف القيد الأصلي ولا يُعدِّله.",
          ),
          el(
            "p",
            { class: "text-muted leading-relaxed" },
            "يُنشئ قيدًا جديدًا بنفس السطور مع تبديل المدين والدائن، فيصبح صافي أثر " +
              "الاثنين صفرًا ويبقى كلاهما في الدفتر. هذا هو السلوك المحاسبي الصحيح — " +
              "حذف قيد مُرحَّل يُفقد الدفتر قابليته للتدقيق.",
          ),
          el(
            "div",
            { class: "flex items-center gap-4 pt-1.5 border-t border-line mt-2" },
            el("span", { class: "text-muted" }, "قيمة القيد:"),
            el("span", { class: "text-ink font-semibold tabular" }, currency(entry.totalDebit)),
          ),
        ),

        el(
          "div",
          {},
          el("label", { class: "block text-xs font-medium text-ink mb-1.5" }, "سبب العكس *"),
          textarea({
            rows: 3,
            placeholder: "مثال: رُحِّل على مركز تكلفة خاطئ.",
            onInput: value((next) => (form.reason = next)),
          }),
        ),
      ),

    onSubmit: () => reverseJournalEntry(entry.id, { reason: form.reason.trim(), date: form.date }),
    onDone: () => context.reload(),
  });
}

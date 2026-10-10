/**
 * قيود اليومية العامة (Journal Entries)
 */

import { el, cx } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { badge, statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { currency, date } from "../../js/core/format.js";
import { listJournalEntries, createJournalEntry } from "../../js/api/accounting.api.js";
import { openModal } from "../../components/modals/overlay.js";
import { textField } from "../../components/forms/fields.js";
import { toast } from "../../components/feedback/toast.js";

export default function journalEntriesPage() {
  const container = el("div", { class: "space-y-4" });

  let tableInstance = null;

  const header = pageHeader({
    title: "قيود اليومية العامة",
    description: "تسجيل واعتماد ومراجعة كافة القيود المحاسبية وحركات اليومية.",
    actions: [
      button({
        label: "إنشاء قيد جديد",
        variant: "primary",
        icon: "plus",
        onClick: () => showNewJournalModal(() => tableInstance?.reload()),
      }),
    ],
  });
  container.appendChild(header);

  tableInstance = dataTable({
    id: "journal-entries",
    fetch: listJournalEntries,
    searchPlaceholder: "بحث برقم القيد أو البيان أو المُنشئ…",
    columns: [
      {
        key: "entryNumber",
        label: "رقم القيد",
        render: (row) => ref(row.entryNumber, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "date",
        label: "التاريخ",
        render: (row) => date(row.date),
      },
      {
        key: "description",
        label: "البيان / الشرح",
        render: (row) => el("span", { class: "font-medium text-ink" }, row.description),
      },
      {
        key: "debitTotal",
        label: "إجمالي المدين",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-semibold text-ink tabular" }, currency(row.debitTotal)),
      },
      {
        key: "creditTotal",
        label: "إجمالي الدائن",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-semibold text-ink tabular" }, currency(row.creditTotal)),
      },
      {
        key: "status",
        label: "الحالة",
        render: (row) => statusBadge(row.status === "approved" ? "paid" : "pending"),
      },
      {
        key: "createdBy",
        label: "المُسجِّل",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.createdBy || "—"),
      },
    ],
    rowActions: (row) =>
      button({
        label: "عرض السطور",
        variant: "ghost",
        size: "sm",
        onClick: () => showLinesModal(row),
      }),
  });

  container.appendChild(tableInstance.element);
  return container;
}

function showLinesModal(entry) {
  openModal({
    title: `تفاصيل القيد: ${entry.entryNumber}`,
    subtitle: entry.description,
    size: "lg",
    body: () => {
      const rows = (entry.lines || []).map((line) =>
        el(
          "tr",
          { class: "border-b border-line hover:bg-subtle text-xs" },
          el("td", { class: "p-2.5 font-mono" }, line.accountCode),
          el("td", { class: "p-2.5 font-medium text-ink" }, line.accountName),
          el("td", { class: "p-2.5 text-muted" }, line.costCenter || "—"),
          el("td", { class: "p-2.5 font-mono text-end font-semibold text-emerald-600" }, line.debit ? currency(line.debit) : "—"),
          el("td", { class: "p-2.5 font-mono text-end font-semibold text-amber-600" }, line.credit ? currency(line.credit) : "—"),
        ),
      );

      return el(
        "div",
        { class: "space-y-3" },
        el(
          "table",
          { class: "w-full text-right border-collapse" },
          el(
            "thead",
            { class: "bg-subtle text-muted text-xs border-b border-line" },
            el(
              "tr",
              {},
              el("th", { class: "p-2.5" }, "كود الحساب"),
              el("th", { class: "p-2.5" }, "اسم الحساب"),
              el("th", { class: "p-2.5" }, "مركز التكلفة"),
              el("th", { class: "p-2.5 text-end" }, "مدين"),
              el("th", { class: "p-2.5 text-end" }, "دائن"),
            ),
          ),
          el("tbody", {}, ...rows),
        ),
      );
    },
  });
}

function showNewJournalModal(onSaved) {
  let desc = "";
  let amount = "";

  openModal({
    title: "إنشاء قيد يومية جديد",
    size: "md",
    body: (close) =>
      el(
        "div",
        { class: "space-y-3 p-1" },
        textField({
          label: "البيان / سبب القيد",
          required: true,
          placeholder: "مثال: تسوية مصاريف صيانة أجهزة المختبر",
          onInput: (v) => (desc = v),
        }),
        textField({
          label: "المبلغ الإجمالي (ج.م)",
          type: "number",
          required: true,
          placeholder: "0.00",
          onInput: (v) => (amount = v),
        }),
      ),
    footer: (close) => [
      button({ label: "إلغاء", variant: "subtle", onClick: () => close() }),
      button({
        label: "ترحيل القيد",
        variant: "primary",
        onClick: async () => {
          if (!desc.trim() || !amount) {
            toast.warning("يرجى ملء كافة الحقول");
            return;
          }
          const num = Number(amount);
          await createJournalEntry({
            description: desc.trim(),
            debitTotal: num,
            creditTotal: num,
            status: "approved",
            createdBy: "عبدالله محمد (admin)",
            lines: [
              { accountCode: "524", accountName: "صيانة الأجهزة والمعدات", debit: num, credit: 0 },
              { accountCode: "1111", accountName: "الخزينة الرئيسية", debit: 0, credit: num },
            ],
          });
          toast.success("تم إنشاء القيد المحاسبي وترحيله بنجاح");
          close();
          onSaved();
        },
      }),
    ],
  });
}

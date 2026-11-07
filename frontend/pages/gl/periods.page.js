/**
 * الفترات المحاسبية — الإغلاق وإعادة الفتح.
 *
 * الإغلاق مرفوض مع وجود قيد غير مُرحَّل، ومرفوض قبل إغلاق الفترة السابقة.
 * الشاشة تُظهر سبب التعطيل بدل زر معطَّل بلا تفسير.
 */

import { el } from "../../js/core/dom.js";
import { buttonGroup, iconButton } from "../../components/common/button.js";
import { statTile } from "../../components/common/card.js";
import { badge } from "../../components/common/badge.js";
import { textarea } from "../../components/forms/fields.js";
import { amount, integer } from "../../js/core/format.js";
import { can } from "../../js/core/permissions.js";
import { listPage, confirmThenRun } from "../_shared/list-page.js";
import { dateColumn, statusColumn, textColumn, countColumn, moneyColumn } from "../_shared/cells.js";
import { formModal, value } from "../_shared/forms.js";
import { listPeriods, closePeriod, reopenPeriod } from "../../js/api/accounting.api.js";

export default async function periodsPage() {
  return listPage({
    title: "الفترات المحاسبية",
    description:
      "الفترة المغلقة تُجمَّد أرقامها وتُصدَر عنها قوائم مالية. الإغلاق بالترتيب، والترحيل إليها بعده مرفوض.",
    tableId: "gl-periods",
    searchPlaceholder: "بحث باسم الفترة…",
    initialParams: { sort: "number", order: "asc", perPage: 25 },
    fetch: listPeriods,

    filters: [
      {
        key: "status",
        label: "الحالة",
        options: [
          { value: "open", label: "مفتوحة" },
          { value: "closed", label: "مغلقة" },
        ],
      },
    ],

    columns: [
      textColumn("name", "الفترة", { width: "11rem", sortable: true }),
      dateColumn("startDate", "من"),
      dateColumn("endDate", "إلى"),
      countColumn("entriesCount", "القيود"),
      {
        key: "pendingCount",
        label: "غير مُرحَّل",
        numeric: true,
        width: "7rem",
        render: (row) =>
          row.pendingCount
            ? badge(integer(row.pendingCount), { tone: "warning" })
            : el("span", { class: "text-faint" }, "—"),
      },
      moneyColumn("totalDebit", "مدين مُرحَّل"),
      moneyColumn("totalCredit", "دائن مُرحَّل"),
      statusColumn(),
      textColumn("closedBy", "أغلقها", { width: "12rem", muted: true, hidden: true }),
    ],

    rowActions: (row, context) =>
      buttonGroup(
        row.status === "open" && can("gl.period.close")
          ? iconButton("lock", {
              label: row.pendingCount
                ? `لا يمكن الإغلاق: ${integer(row.pendingCount)} قيد غير مُرحَّل`
                : "إغلاق الفترة",
              disabled: row.pendingCount > 0,
              onClick: () =>
                confirmThenRun(
                  {
                    title: `إغلاق «${row.name}»؟`,
                    message:
                      "الفترة المغلقة تُجمَّد أرقامها ويُرفض الترحيل إليها. " +
                      "إعادة الفتح إجراء استثنائي يحتاج سببًا مُسجَّلًا.",
                    detail: `${integer(row.postedCount)} قيد مُرحَّل · مدين ${amount(row.totalDebit)}`,
                    confirmLabel: "إغلاق الفترة",
                  },
                  () => closePeriod(row.id),
                  { success: `أُغلقت الفترة «${row.name}».`, context },
                ),
            })
          : null,

        row.status === "closed" && can("gl.period.manage")
          ? iconButton("refresh", {
              label: "إعادة فتح الفترة",
              variant: "danger-ghost",
              onClick: () => openReopenModal(row, context),
            })
          : null,
      ),

    stats: async () => {
      const all = await listPeriods({ perPage: 100 });
      const rows = all.data;
      const open = rows.filter((row) => row.status === "open");
      const pending = rows.reduce((total, row) => total + (row.pendingCount ?? 0), 0);

      return [
        statTile({ label: "إجمالي الفترات", value: integer(rows.length), tone: "neutral", icon: "calendar" }),
        statTile({ label: "مفتوحة", value: integer(open.length), tone: "info", icon: "folder" }),
        statTile({ label: "مغلقة", value: integer(rows.length - open.length), tone: "success", icon: "lock" }),
        statTile({
          label: "قيود غير مُرحَّلة",
          value: integer(pending),
          hint: pending ? "تمنع إغلاق فتراتها" : "لا مانع للإغلاق",
          tone: pending ? "warning" : "success",
          icon: "clock",
        }),
      ];
    },
  });
}

function openReopenModal(period, context) {
  const form = { reason: "" };

  formModal({
    title: `إعادة فتح «${period.name}»`,
    size: "md",
    submitLabel: "إعادة الفتح",
    submitVariant: "danger",
    success: `أُعيد فتح «${period.name}».`,
    fieldLabels: { reason: "سبب إعادة الفتح" },
    validate: () => (form.reason.trim() ? {} : { reason: "السبب مطلوب — للتدقيق." }),

    body: () =>
      el(
        "div",
        { class: "space-y-3.5" },
        el(
          "p",
          { class: "text-xs text-muted leading-relaxed bg-subtle border border-line rounded-xl p-3" },
          "إعادة الفتح تسمح بالترحيل إلى فترة سبق إصدار قوائم مالية عنها. " +
            "الفترات اللاحقة المغلقة تمنع إعادة الفتح — تُعاد بالترتيب العكسي.",
        ),
        el(
          "div",
          {},
          el("label", { class: "block text-xs font-medium text-ink mb-1.5" }, "سبب إعادة الفتح *"),
          textarea({
            rows: 3,
            placeholder: "مثال: قيد تسوية ضريبية وصل بعد الإغلاق.",
            onInput: value((next) => (form.reason = next)),
          }),
        ),
      ),

    onSubmit: () => reopenPeriod(period.id, { reason: form.reason.trim() }),
    onDone: () => context.reload(),
  });
}

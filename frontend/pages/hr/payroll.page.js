/**
 * مسيّرات الرواتب — التشغيل والاعتماد والصرف.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  السيناريو الأول من التكامل: اعتماد المسيّر يُرحّله محاسبيًا في نفس العملية.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * إعادة التشغيل مسموحة قبل الاعتماد ومرفوضة بعده — المسيّر المعتمد مُرحَّل،
 * وإعادة حسابه تُنتج أرقامًا تخالف القيد الموجود في الدفتر. ومفتاح الترحيل
 * يمنع ترحيل نفس المسيّر مرتين حتى لو اعتُمد مرتين.
 */

import { el } from "../../js/core/dom.js";
import { buttonGroup, iconButton, button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { alert } from "../../components/feedback/alert.js";
import { amount, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { statusOptions } from "../../js/core/statuses.js";
import * as money from "../../js/core/money.js";
import { listPage, runAction, confirmThenRun } from "../_shared/list-page.js";
import { moneyColumn, dateColumn, statusColumn, codeColumn, textColumn, countColumn, totalCell } from "../_shared/cells.js";
import { formModal, selectField, dateFieldWithLabel, value } from "../_shared/forms.js";
import { listPayrollRuns, processPayroll, approvePayroll, payPayroll } from "../../js/api/hr.api.js";
import { getBankAccounts } from "../../js/api/lookups.api.js";

const CURRENT_PERIOD = new Date().toISOString().slice(0, 7);

export default async function payrollPage() {
  const banks = await getBankAccounts();

  return listPage({
    title: "مسيّرات الرواتب",
    description:
      "تشغيل المسيّر يحسب القسائم من الحضور والسلف. الاعتماد يُرحّله محاسبيًا، والصرف يُنشئ قيد الدفع.",
    tableId: "hr-payroll",
    searchPlaceholder: "بحث برقم المسيّر أو الفترة…",
    initialParams: { sort: "period", order: "desc" },
    fetch: listPayrollRuns,

    actions: (context) => [
      button({
        label: "تشغيل مسيّر",
        variant: "primary",
        icon: "refresh",
        permission: "hr.payroll.process",
        onClick: () => openProcessModal(context),
      }),
      button({ label: "قسائم الرواتب", variant: "secondary", icon: "fileText", onClick: () => navigate("/hr/payslips") }),
    ],

    filters: [
      { key: "status", label: "الحالة", options: statusOptions(["calculated", "approved", "paid_out", "cancelled"]) },
    ],

    before: async () => {
      const { data } = await listPayrollRuns({ perPage: 50 });
      const pending = data.filter((row) => row.status === "calculated");
      if (!pending.length) return null;

      return alert({
        tone: "info",
        title: `${integer(pending.length)} مسيّر محسوب بانتظار الاعتماد`,
        message:
          pending.map((row) => `${row.periodLabel}: صافي ${amount(row.totals.netPay)}`).join(" · ") +
          " — الاعتماد يُرحّل القيد المحاسبي في نفس العملية.",
      });
    },

    columns: [
      codeColumn("runNumber", "رقم المسيّر", { width: "9rem" }),
      textColumn("periodLabel", "الفترة", { width: "9rem", sortable: true }),
      countColumn("headcount", "عدد الموظفين"),
      {
        key: "gross",
        label: "الإجمالي",
        numeric: true,
        width: "9rem",
        render: (row) => el("span", { class: "tabular" }, amount(row.totals?.gross ?? 0)),
      },
      {
        key: "deductions",
        label: "الاستقطاعات",
        numeric: true,
        width: "9rem",
        render: (row) => el("span", { class: "tabular" }, amount(row.totals?.totalDeductions ?? 0)),
      },
      {
        key: "netPay",
        label: "الصافي",
        numeric: true,
        width: "9rem",
        render: (row) => el("span", { class: "tabular font-semibold text-ink" }, amount(row.totals?.netPay ?? 0)),
      },
      {
        key: "employerCost",
        label: "تكلفة المنشأة",
        numeric: true,
        width: "9.5rem",
        hidden: true,
        render: (row) => el("span", { class: "tabular" }, amount(row.totals?.employerCost ?? 0)),
      },
      dateColumn("payDate", "موعد الصرف"),
      {
        key: "warningsCount",
        label: "تحذيرات",
        width: "6.5rem",
        align: "center",
        render: (row) =>
          row.warningsCount
            ? badge(integer(row.warningsCount), { tone: "warning", size: "sm" })
            : el("span", { class: "text-faint" }, "—"),
      },
      statusColumn(),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 3 },
            { value: totalCell(money.sum(rows.map((r) => r.totals?.gross ?? 0))), numeric: true },
            { value: totalCell(money.sum(rows.map((r) => r.totals?.totalDeductions ?? 0))), numeric: true },
            { value: totalCell(money.sum(rows.map((r) => r.totals?.netPay ?? 0))), numeric: true },
            { value: "", colspan: 3 },
          ]
        : null,

    onRowClick: (row) => navigate(`/hr/payroll/${row.id}`),

    rowActions: (row, context) =>
      buttonGroup(
        iconButton("eye", { label: "تفاصيل المسيّر", onClick: () => navigate(`/hr/payroll/${row.id}`) }),

        row.status === "calculated"
          ? iconButton("refresh", {
              label: "إعادة التشغيل",
              permission: "hr.payroll.process",
              onClick: () =>
                confirmThenRun(
                  {
                    title: `إعادة تشغيل مسيّر ${row.periodLabel}؟`,
                    message: "تُعاد كل القسائم من الحضور والسلف الحالية. مسموح قبل الاعتماد فقط.",
                    confirmLabel: "إعادة التشغيل",
                    tone: "primary",
                  },
                  () => processPayroll({ period: row.period }),
                  { success: `أُعيد تشغيل مسيّر ${row.periodLabel}.`, context },
                ),
            })
          : null,

        row.status === "calculated"
          ? iconButton("check", {
              label: "اعتماد وترحيل",
              permission: "hr.payroll.approve",
              onClick: () =>
                confirmThenRun(
                  {
                    title: `اعتماد مسيّر ${row.periodLabel}؟`,
                    message:
                      "الاعتماد يُرحّل القيد المحاسبي: مصروف الرواتب والبدلات والإضافي وحصة " +
                      "صاحب العمل مدينة، والصافي والضريبة والتأمينات والسلف دائنة. " +
                      "بعد الاعتماد لا يُعاد حساب المسيّر.",
                    detail: `${integer(row.headcount)} موظف · صافي ${amount(row.totals.netPay)} · تكلفة ${amount(row.totals.employerCost)}`,
                    confirmLabel: "اعتماد وترحيل",
                    tone: "primary",
                  },
                  () => approvePayroll(row.id),
                  { success: `اعتُمد المسيّر ورُحِّل قيده المحاسبي.`, context },
                ),
            })
          : null,

        row.status === "approved"
          ? iconButton("money", {
              label: "صرف الرواتب",
              permission: "hr.payroll.pay",
              onClick: () => openPayModal(row, context, banks),
            })
          : null,
      ),

    stats: async () => {
      const { data, meta } = await listPayrollRuns({ perPage: 50 });
      const current = data.find((row) => row.period === CURRENT_PERIOD);
      const paid = data.filter((row) => row.status === "paid_out");

      return [
        statTile({ label: "إجمالي المسيّرات", value: integer(meta.total), tone: "neutral", icon: "calendar" }),
        statTile({
          label: "مسيّر الشهر",
          value: current ? amount(current.totals.netPay) : "—",
          hint: current ? current.periodLabel : "لم يُشغَّل بعد",
          tone: current ? (current.status === "paid_out" ? "success" : "warning") : "neutral",
          icon: "money",
        }),
        statTile({
          label: "بانتظار الاعتماد",
          value: integer(data.filter((row) => row.status === "calculated").length),
          tone: data.some((row) => row.status === "calculated") ? "warning" : "success",
          icon: "clock",
        }),
        statTile({
          label: "معتمد لم يُصرف",
          value: integer(data.filter((row) => row.status === "approved").length),
          tone: "info",
          icon: "check",
        }),
        statTile({
          label: "إجمالي ما صُرف",
          value: amount(money.sum(paid.map((row) => row.totals.netPay))),
          hint: `${integer(paid.length)} مسيّر مصروف`,
          tone: "success",
          icon: "checkCircle",
        }),
      ];
    },
  });
}

/* ========================================================================== */

function openProcessModal(context) {
  const form = { period: CURRENT_PERIOD };

  /** آخر 14 شهرًا — المسيّر لا يُشغَّل لفترة بعيدة بلا سبب. */
  const periods = Array.from({ length: 14 }, (_u, index) => {
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - index);
    const period = date.toISOString().slice(0, 7);
    return { value: period, label: period };
  });

  formModal({
    title: "تشغيل مسيّر رواتب",
    subtitle: "يحسب القسائم من سجلات الحضور وأقساط السلف المستحقة في الفترة",
    size: "md",
    submitLabel: "تشغيل المسيّر",
    success: "شُغِّل المسيّر. راجعه ثم اعتمده.",

    body: () =>
      el(
        "div",
        { class: "space-y-3.5" },
        selectField({
          label: "الفترة",
          required: true,
          value: form.period,
          options: periods,
          onChange: value((v) => (form.period = v)),
        }),
        el(
          "p",
          { class: "text-xs text-muted leading-relaxed bg-subtle border border-line rounded-xl p-3" },
          "التشغيل لا يُرحّل شيئًا محاسبيًا — القسائم تُحسب فقط. الترحيل يحدث عند " +
            "الاعتماد. وإن كان للفترة مسيّر معتمد بالفعل فسيُرفض التشغيل.",
        ),
      ),

    onSubmit: () => processPayroll({ period: form.period }),
    onDone: async (run) => {
      await context.reload();
      if (run?.id) navigate(`/hr/payroll/${run.id}`);
    },
  });
}

function openPayModal(run, context, banks) {
  const form = {
    bankAccountId: String(banks.find((b) => b.type === "payroll")?.id ?? banks[0]?.id ?? ""),
    date: new Date().toISOString().slice(0, 10),
  };

  formModal({
    title: `صرف رواتب ${run.periodLabel}`,
    subtitle: `صافي ${amount(run.totals.netPay)} لـ ${integer(run.headcount)} موظف`,
    size: "md",
    submitLabel: "صرف الرواتب",
    success: "صُرفت الرواتب ورُحِّل قيد الدفع.",

    body: () =>
      el(
        "div",
        { class: "space-y-3.5" },
        selectField({
          label: "الحساب البنكي",
          required: true,
          value: form.bankAccountId,
          hint: "رصيد غير كافٍ يُرفض — غذِّ الحساب أولًا بتحويل من حساب آخر.",
          options: banks.map((row) => ({
            value: row.id,
            label: `${row.bankName} — ${row.accountNumber}`,
          })),
          onChange: value((v) => (form.bankAccountId = v)),
        }),
        dateFieldWithLabel({
          label: "تاريخ الصرف",
          required: true,
          value: form.date,
          onChange: value((v) => (form.date = v)),
        }),
        el(
          "p",
          { class: "text-xs text-muted leading-relaxed bg-subtle border border-line rounded-xl p-3" },
          "القيد: الرواتب المستحقة مدينة والحساب البنكي دائن — يُقفل الالتزام الذي " +
            "أنشأه قيد الاعتماد. لا مصروف جديد هنا؛ المصروف اعتُرف به عند الاعتماد.",
        ),
      ),

    onSubmit: () => payPayroll(run.id, { bankAccountId: Number(form.bankAccountId), date: form.date }),
    onDone: () => context.reload(),
  });
}

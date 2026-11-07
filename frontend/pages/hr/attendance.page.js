/**
 * الحضور والانصراف.
 *
 * الحالة ودقائق التأخر مُشتقّة من الوردية لا مُدخَلة — راجع `evaluateDay` في
 * js/domain/attendance.js. و«البصمة الناقصة» حالة معلَنة تحتاج تصحيحًا يدويًا
 * موثَّقًا: افتراض أنه عمل اليوم كاملًا أو أنه غائب كلاهما يُنتج راتبًا خاطئًا
 * بلا أثر يدل على سببه.
 */

import { el, cx, clear } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statGrid, statTile } from "../../components/common/card.js";
import { button, iconButton, buttonGroup } from "../../components/common/button.js";
import { badge, statusBadge } from "../../components/common/badge.js";
import { alert } from "../../components/feedback/alert.js";
import { loadingState, errorState, emptyState } from "../../components/feedback/states.js";
import { textarea, textField } from "../../components/forms/fields.js";
import { amount, integer, percent, decimal } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { selectField, formModal, value } from "../_shared/forms.js";
import { progressCell } from "../_shared/cells.js";
import { getAttendanceReport, listAttendance, correctAttendance } from "../../js/api/hr.api.js";
import { getDepartments, getEmployees, toOptions } from "../../js/api/lookups.api.js";

const CURRENT_PERIOD = new Date().toISOString().slice(0, 7);

export default async function attendancePage({ query = {} } = {}) {
  const [departments, employees] = await Promise.all([getDepartments(), getEmployees()]);

  let state = { period: query.period ?? CURRENT_PERIOD, departmentId: query.departmentId ?? "" };
  let report = null;

  const container = el("div", { class: "space-y-4" });
  const statsHost = el("div");
  const warnHost = el("div");
  const bodyHost = el("div", { class: "min-h-[20rem]" });

  /** آخر 12 شهرًا. */
  const periods = Array.from({ length: 12 }, (_u, index) => {
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - index);
    const period = date.toISOString().slice(0, 7);
    return { value: period, label: period };
  });

  container.appendChild(
    pageHeader({
      title: "الحضور والانصراف",
      description: "ملخص شهري لكل موظف: الانتظام والتأخير والغياب والعمل الإضافي.",
      actions: [
        button({ label: "طلبات الإجازات", variant: "secondary", icon: "calendar", onClick: () => navigate("/hr/leaves") }),
        button({ label: "مسيّرات الرواتب", variant: "ghost", onClick: () => navigate("/hr/payroll") }),
      ],
    }),
  );

  container.appendChild(
    el(
      "div",
      { class: "grid gap-3 sm:grid-cols-2 items-end bg-surface/80 p-3 rounded-2xl border border-line" },
      selectField({
        label: "الفترة",
        value: state.period,
        options: periods,
        onChange: value((next) => { state.period = next; load(); }),
      }),
      selectField({
        label: "الإدارة",
        value: state.departmentId,
        placeholder: "كل الإدارات",
        options: toOptions(departments),
        onChange: value((next) => { state.departmentId = next; load(); }),
      }),
    ),
  );

  container.appendChild(statsHost);
  container.appendChild(warnHost);
  container.appendChild(bodyHost);

  function renderStats() {
    clear(statsHost);
    if (!report) return;

    const totals = report.totals;

    statsHost.appendChild(
      statGrid(
        statTile({ label: "موظفون", value: integer(totals.employees), tone: "neutral", icon: "users" }),
        statTile({ label: "أيام حضور", value: integer(totals.presentDays), tone: "success", icon: "checkCircle" }),
        statTile({
          label: "أيام غياب",
          value: integer(totals.absentDays),
          hint: totals.absentDays ? `تكلفة تقديرية ${amount(report.absenceCost)}` : null,
          tone: totals.absentDays ? "danger" : "success",
          icon: "x",
        }),
        statTile({
          label: "أيام تأخير",
          value: integer(totals.lateDays),
          hint: `${integer(totals.lateMinutes)} دقيقة إجمالًا`,
          tone: totals.lateDays ? "warning" : "success",
          icon: "clock",
        }),
        statTile({ label: "أيام إجازة", value: integer(totals.leaveDays), tone: "info", icon: "calendar" }),
        statTile({
          label: "متوسط الانتظام",
          value: percent((totals.averageAttendanceRate ?? 0) * 100),
          tone: (totals.averageAttendanceRate ?? 0) > 0.9 ? "success" : "warning",
          icon: "reports",
        }),
      ),
    );
  }

  function renderWarnings() {
    clear(warnHost);
    if (!report?.totals.incompleteDays) return;

    warnHost.appendChild(
      alert({
        tone: "warning",
        title: `${integer(report.totals.incompleteDays)} سجل ببصمة انصراف مفقودة`,
        message:
          "هذه السجلات تحتاج تصحيحًا يدويًا قبل اعتماد مسيّر الشهر — ساعات العمل فيها " +
          "غير محسوبة، والعمل الإضافي لا يُحتسب بلا وقت انصراف.",
        actions: button({
          label: "عرض السجلات الناقصة",
          variant: "secondary",
          size: "sm",
          onClick: () => openIncompleteModal(state.period, load),
        }),
      }),
    );
  }

  function renderBody() {
    clear(bodyHost);
    if (!report) return;

    if (!report.rows.length) {
      bodyHost.appendChild(emptyState({ title: "لا سجلات", message: "لا سجلات حضور في هذه الفترة." }));
      return;
    }

    const th = (text, extra) => el("th", { class: cx("px-3 py-2 text-[11px] text-muted", extra) }, text);

    bodyHost.appendChild(
      card({
        title: `ملخص الحضور — ${report.periodLabel}`,
        subtitle: "مرتَّب بالأقل انتظامًا أولًا",
        flush: true,
        body: el(
          "div",
          { class: "overflow-x-auto" },
          el(
            "table",
            { class: "w-full border-collapse" },
            el(
              "thead",
              {},
              el(
                "tr",
                { class: "bg-subtle" },
                th("الموظف", "text-start"),
                th("الإدارة", "text-start"),
                th("حضور", "text-end"),
                th("تأخير", "text-end"),
                th("غياب", "text-end"),
                th("إجازة", "text-end"),
                th("نصف يوم", "text-end"),
                th("دقائق التأخير", "text-end"),
                th("إضافي (ساعة)", "text-end"),
                th("ناقص", "text-center"),
                th("الانتظام", "text-start"),
              ),
            ),
            el(
              "tbody",
              {},
              ...report.rows.map((row) =>
                el(
                  "tr",
                  {
                    class: "border-b border-line/60 hover:bg-subtle/60 cursor-pointer transition-colors",
                    onClick: () => navigate(`/hr/employees/${row.employeeId}`),
                  },
                  el(
                    "td",
                    { class: "px-3 py-2 text-xs" },
                    el("div", { class: "text-ink truncate-1" }, row.name),
                    el("div", { class: "text-[10px] text-faint font-mono mt-0.5" }, row.code),
                  ),
                  el("td", { class: "px-3 py-2 text-xs text-muted truncate-1" }, row.departmentName),
                  numCell(row.presentDays),
                  numCell(row.lateDays, row.lateDays ? "text-warning-400" : null),
                  numCell(row.absentDays, row.absentDays ? "text-danger-400" : null),
                  numCell(row.leaveDays),
                  numCell(row.halfDays),
                  numCell(row.lateMinutes),
                  el(
                    "td",
                    { class: "px-3 py-2 text-end tabular text-xs" },
                    decimal(
                      (row.overtimeHours?.weekdayHours ?? 0) +
                        (row.overtimeHours?.weekendHours ?? 0) +
                        (row.overtimeHours?.holidayHours ?? 0),
                    ),
                  ),
                  el(
                    "td",
                    { class: "px-3 py-2 text-center" },
                    row.incompleteDays
                      ? badge(integer(row.incompleteDays), { tone: "warning", size: "sm" })
                      : el("span", { class: "text-faint text-xs" }, "—"),
                  ),
                  el(
                    "td",
                    { class: "px-3 py-2" },
                    progressCell(row.attendanceRate, {
                      tone: row.attendanceRate > 0.95 ? "success" : row.attendanceRate > 0.85 ? "warning" : "danger",
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      }),
    );
  }

  async function load() {
    clear(bodyHost);
    bodyHost.appendChild(loadingState({ message: "جاري حساب الحضور…" }));

    try {
      report = await getAttendanceReport(state);
      renderStats();
      renderWarnings();
      renderBody();
    } catch (error) {
      clear(bodyHost);
      bodyHost.appendChild(errorState({ error, onRetry: load }));
    }
  }

  await load();
  return container;
}

function numCell(value_, extra) {
  return el("td", { class: cx("px-3 py-2 text-end tabular text-xs", extra) }, integer(value_ ?? 0));
}

/* ========================================================================== */

/** سجلات البصمة الناقصة — تصحيحها شرط لاعتماد المسيّر. */
async function openIncompleteModal(period, onDone) {
  const { data } = await listAttendance({ perPage: 100, dateFrom: `${period}-01`, dateTo: `${period}-31` });
  const incomplete = data.filter((row) => row.incomplete);

  formModal({
    title: "سجلات ببصمة انصراف مفقودة",
    subtitle: `${integer(incomplete.length)} سجل في ${period}`,
    size: "lg",
    submitLabel: "إغلاق",
    submitVariant: "secondary",
    onSubmit: async () => undefined,
    onDone,

    body: () =>
      el(
        "div",
        { class: "space-y-1.5 max-h-[26rem] overflow-y-auto" },
        incomplete.length === 0
          ? el("p", { class: "text-xs text-muted py-6 text-center" }, "لا سجلات ناقصة.")
          : null,
        ...incomplete.map((row) => incompleteRow(row, onDone)),
      ),
  });
}

function incompleteRow(row, onDone) {
  const host = el("div", {
    class: "flex items-center justify-between gap-3 p-2.5 rounded-xl border border-line bg-subtle",
  });

  host.append(
    el(
      "div",
      { class: "min-w-0" },
      el("div", { class: "text-xs text-ink truncate-1" }, row.employeeName),
      el(
        "div",
        { class: "flex items-center gap-2 mt-0.5" },
        el("span", { class: "text-[10px] text-faint num" }, row.date),
        el("span", { class: "text-[10px] text-faint num" }, `دخول ${row.checkIn ?? "—"}`),
        statusBadge(row.status, { size: "sm" }),
      ),
    ),
    buttonGroup(
      iconButton("edit", {
        label: "تصحيح",
        permission: "hr.attendance.manage",
        onClick: () => openCorrectModal(row, onDone),
      }),
    ),
  );

  return host;
}

function openCorrectModal(record, onDone) {
  const form = { checkIn: record.checkIn ?? "", checkOut: "", reason: "" };

  formModal({
    title: `تصحيح حضور — ${record.employeeName}`,
    subtitle: record.date,
    size: "md",
    submitLabel: "حفظ التصحيح",
    success: "صُحِّح السجل وأُعيد تقييمه بالوردية.",
    fieldLabels: { checkOut: "وقت الانصراف", reason: "سبب التصحيح" },

    validate: () => {
      const errors = {};
      if (!form.checkOut.trim()) errors.checkOut = "وقت الانصراف مطلوب.";
      if (!form.reason.trim()) errors.reason = "سبب التصحيح مطلوب — للتدقيق.";
      return errors;
    },

    body: () =>
      el(
        "div",
        { class: "space-y-3.5" },
        el(
          "p",
          { class: "text-xs text-muted bg-subtle border border-line rounded-xl p-3 leading-relaxed" },
          "التصحيح يُعيد تقييم اليوم بالوردية: دقائق التأخر وساعات العمل والإضافي " +
            "تُحسب من جديد. التصحيح مرفوض إن كان مسيّر الشهر معتمدًا بالفعل.",
        ),
        el(
          "div",
          { class: "grid gap-3.5 sm:grid-cols-2" },
          textField({
            label: "وقت الدخول",
            value: form.checkIn,
            placeholder: "08:55",
            onInput: value((v) => (form.checkIn = v)),
          }),
          textField({
            label: "وقت الانصراف",
            required: true,
            placeholder: "17:10",
            onInput: value((v) => (form.checkOut = v)),
          }),
        ),
        el(
          "div",
          {},
          el("label", { class: "block text-xs font-medium text-ink mb-1.5" }, "سبب التصحيح *"),
          textarea({
            rows: 2,
            placeholder: "مثال: عطل في جهاز البصمة — أُثبت الانصراف من سجل الأمن.",
            onInput: value((v) => (form.reason = v)),
          }),
        ),
      ),

    onSubmit: () =>
      correctAttendance(record.id, {
        checkIn: form.checkIn.trim() || null,
        checkOut: form.checkOut.trim(),
        reason: form.reason.trim(),
      }),

    onDone,
  });
}

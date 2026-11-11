/**
 * تفاصيل مسيّر الرواتب واعتماده وصرفه (Payroll Run Detail).
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { openModal } from "../../components/common/modal.js";
import { amount, date, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { exportStyledExcel, printReport } from "../_shared/print.js";
import { getPayrollRun, approvePayroll, payPayroll } from "../../js/api/hr.api.js";
import { listBankAccounts } from "../../js/api/finance.api.js";

export default async function payrollDetailPage(context) {
  const runId = context.params?.id;
  const run = await getPayrollRun(runId);
  const payslips = run.payslips || [];

  const container = el("div", { class: "flex flex-col gap-6 p-4 md:p-6" });

  const topNav = el(
    "div",
    { class: "flex items-center justify-between flex-wrap gap-3" },
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap" },
      button({
        label: "العودة لمسيرات الرواتب",
        variant: "ghost",
        icon: "chevronStart",
        onClick: () => navigate("/hr/payroll"),
      }),
      el("span", { class: "text-muted" }, "/"),
      el("span", { class: "font-semibold text-ink" }, `مسيّر: ${run.runNumber} (${run.periodLabel || run.period})`),
      badge(payrollStatusLabel(run.status), { tone: payrollStatusTone(run.status) }),
    ),
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap" },
      button({
        label: "تصدير المسيّر Excel",
        variant: "secondary",
        icon: "download",
        onClick: () => exportPayrollExcel(run),
      }),
      button({
        label: "طباعة كشف المسيّر (PDF)",
        variant: "primary",
        icon: "print",
        onClick: () => printPayrollPdf(run),
      }),
      run.status === "calculated" || run.status === "pending"
        ? button({
            label: "اعتماد وترحيل المسيّر",
            variant: "success",
            icon: "check",
            onClick: async () => {
              if (!confirm("هل أنت متأكد من اعتماد هذا المسيّر وترحيله إلى الحسابات العامة؟")) return;
              try {
                await approvePayroll(run.id);
                navigate(`/hr/payroll/${run.id}`);
              } catch (err) {
                alert(`تعذر الاعتماد: ${err.message || err}`);
              }
            },
          })
        : null,
      run.status === "approved"
        ? button({
            label: "صرف الرواتب بنكيًا",
            variant: "primary",
            icon: "creditCard",
            onClick: () => openPayPayrollModal(run, () => navigate(`/hr/payroll/${run.id}`)),
          })
        : null,
    ),
  );

  const totals = run.totals || {};
  const stats = el(
    "div",
    { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" },
    statTile({
      title: "إجمالي الراتب الأساسي والبدلات",
      value: amount(totals.grossPay ?? 0),
      tone: "primary",
      icon: "trendingUp",
      hint: `${integer(run.headcount ?? payslips.length)} موظف`,
    }),
    statTile({
      title: "إجمالي الاستقطاعات والضرائب",
      value: amount(totals.deductions ?? 0),
      tone: "warning",
      icon: "trendingDown",
      hint: "تأمينات + ضرائب + جزاءات",
    }),
    statTile({
      title: "صافي الرواتب المستحقة للتحويل",
      value: amount(totals.netPay ?? 0),
      tone: "success",
      icon: "wallet",
      hint: run.status === "paid" ? `تم الصرف في ${date(run.paidAt)}` : `تاريخ الصرف المستهدف: ${date(run.payDate)}`,
    }),
    statTile({
      title: "عدد الموظفين والملاحظات",
      value: `${integer(run.headcount ?? payslips.length)} موظف`,
      tone: "neutral",
      icon: "users",
      hint: run.warnings?.length ? `يوجد ${run.warnings.length} تنبيه` : "لا توجد ملاحظات",
    }),
  );

  /* تفاصيل الأقسام */
  const depts = run.byDepartment || [];
  let deptSection = null;
  if (depts.length > 0) {
    deptSection = el(
      "div",
      { class: "rounded-xl border border-border bg-surface p-5 shadow-sm" },
      el("h2", { class: "text-base font-bold text-ink mb-3 pb-2 border-b border-border" }, "توزيع الرواتب حسب الأقسام"),
      el(
        "div",
        { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" },
        depts.map((d) =>
          el(
            "div",
            { class: "p-3 rounded-lg bg-surface-alt/50 border border-border flex items-center justify-between" },
            el(
              "div",
              {},
              el("div", { class: "font-semibold text-ink text-sm" }, d.departmentName),
              el("div", { class: "text-xs text-muted mt-0.5" }, `${d.headcount} موظف`),
            ),
            el(
              "div",
              { class: "text-left" },
              el("div", { class: "font-bold text-success text-sm font-mono" }, amount(d.net ?? d.gross)),
              el("div", { class: "text-xs text-muted" }, `إجمالي: ${amount(d.gross)}`),
            ),
          ),
        ),
      ),
    );
  }

  /* جدول قسائم رواتب الموظفين */
  const payslipsSection = el(
    "div",
    { class: "rounded-xl border border-border bg-surface p-5 shadow-sm" },
    el(
      "div",
      { class: "flex items-center justify-between mb-4 pb-2 border-b border-border flex-wrap gap-2" },
      el("h2", { class: "text-base font-bold text-ink" }, "كشف رواتب الموظفين"),
      el("span", { class: "text-xs text-muted" }, `إجمالي القسائم: ${payslips.length}`),
    ),
    el(
      "div",
      { class: "overflow-x-auto" },
      el(
        "table",
        { class: "w-full text-sm text-right border-collapse" },
        el(
          "thead",
          { class: "bg-surface-alt text-muted text-xs font-semibold border-b border-border" },
          el(
            "tr",
            {},
            el("th", { class: "p-3" }, "رقم القسيمة"),
            el("th", { class: "p-3" }, "اسم الموظف"),
            el("th", { class: "p-3" }, "الوظيفة / القسم"),
            el("th", { class: "p-3 text-left" }, "الأساسي"),
            el("th", { class: "p-3 text-left" }, "البدلات"),
            el("th", { class: "p-3 text-left" }, "إجمالي الراتب"),
            el("th", { class: "p-3 text-left" }, "الاستقطاعات"),
            el("th", { class: "p-3 text-left font-bold" }, "صافي الراتب"),
            el("th", { class: "p-3 text-center" }, "الإجراء"),
          ),
        ),
        el(
          "tbody",
          { class: "divide-y divide-border" },
          payslips.length === 0
            ? el("tr", {}, el("td", { colspan: 9, class: "p-6 text-center text-muted" }, "لا توجد قسائم رواتب في هذا المسيّر"))
            : payslips.map((slip) =>
                el(
                  "tr",
                  { class: "hover:bg-surface-alt/50 transition-colors" },
                  el("td", { class: "p-3 font-semibold text-ink font-mono text-xs" }, slip.payslipNumber || `#${slip.id}`),
                  el(
                    "td",
                    { class: "p-3" },
                    el("div", { class: "font-semibold text-ink" }, slip.employeeName),
                    el("div", { class: "text-xs text-muted" }, slip.employeeCode ? `#${slip.employeeCode}` : ""),
                  ),
                  el(
                    "td",
                    { class: "p-3 text-muted" },
                    el("div", {}, slip.jobTitle || "—"),
                    el("div", { class: "text-xs text-muted" }, slip.departmentName || ""),
                  ),
                  el("td", { class: "p-3 text-left font-mono" }, amount(slip.basicSalary)),
                  el("td", { class: "p-3 text-left font-mono text-muted" }, amount(slip.allowances)),
                  el("td", { class: "p-3 text-left font-mono font-semibold" }, amount(slip.grossPay)),
                  el("td", { class: "p-3 text-left font-mono text-warning" }, amount(slip.deductions)),
                  el("td", { class: "p-3 text-left font-mono font-bold text-success" }, amount(slip.netPay)),
                  el(
                    "td",
                    { class: "p-3 text-center" },
                    button({
                      label: "عرض وطباعة القسيمة",
                      variant: "ghost",
                      size: "sm",
                      icon: "fileText",
                      onClick: () => navigate(`/hr/payslips/${slip.id}`),
                    }),
                  ),
                ),
              ),
        ),
      ),
    ),
  );

  container.append(topNav, stats, deptSection, payslipsSection);
  return container;
}

function payrollStatusLabel(status) {
  switch (status) {
    case "calculated":
    case "pending":
      return "تم الاحتساب — بانتظار الاعتماد";
    case "approved":
      return "معتمد ومرحل — جاهز للصرف";
    case "paid":
      return "تم الصرف بنكيًا";
    default:
      return status ?? "مسودة";
  }
}

function payrollStatusTone(status) {
  switch (status) {
    case "calculated":
    case "pending":
      return "warning";
    case "approved":
      return "primary";
    case "paid":
      return "success";
    default:
      return "neutral";
  }
}

function openPayPayrollModal(run, onDone) {
  const containerEl = el("div", { class: "flex flex-col gap-4 text-sm" });
  const selectBank = el("select", {
    class: "w-full p-2.5 rounded-lg border border-border bg-surface text-ink text-sm",
  });

  listBankAccounts().then((res) => {
    const banks = res.data || res || [];
    selectBank.replaceChildren();
    banks.forEach((b) => {
      const opt = el("option", { value: b.id }, `${b.bankName} (رصيد: ${amount(b.balance)})`);
      selectBank.appendChild(opt);
    });
  });

  const dateInput = el("input", {
    type: "date",
    class: "w-full p-2.5 rounded-lg border border-border bg-surface text-ink text-sm",
    value: new Date().toISOString().slice(0, 10),
  });

  containerEl.append(
    el("p", { class: "text-muted" }, `المبلغ الصافي المطلوب تحويله: ${amount(run.totals?.netPay ?? 0)} جنيه لعدد ${run.headcount} موظف.`),
    el("div", { class: "flex flex-col gap-1" }, el("label", { class: "font-semibold text-ink text-xs" }, "الحساب البنكي للصرف"), selectBank),
    el("div", { class: "flex flex-col gap-1" }, el("label", { class: "font-semibold text-ink text-xs" }, "تاريخ الصرف"), dateInput),
  );

  const modal = openModal({
    title: `صرف مسيّر الرواتب: ${run.runNumber}`,
    content: containerEl,
    actions: [
      button({ label: "إلغاء", variant: "ghost", onClick: () => modal.close() }),
      button({
        label: "تأكيد الصرف والترحيل البنكي",
        variant: "primary",
        onClick: async () => {
          try {
            await payPayroll(run.id, {
              bankAccountId: selectBank.value,
              date: dateInput.value,
            });
            modal.close();
            if (onDone) onDone();
          } catch (err) {
            alert(`تعذر الصرف: ${err.message || err}`);
          }
        },
      }),
    ],
  });
}

function exportPayrollExcel(run) {
  const columns = [
    { key: "num", label: "رقم القسيمة", width: 18 },
    { key: "empCode", label: "كود الموظف", width: 14 },
    { key: "name", label: "اسم الموظف", width: 26 },
    { key: "job", label: "الوظيفة", width: 20 },
    { key: "dept", label: "القسم", width: 18 },
    { key: "basic", label: "الأساسي", width: 15 },
    { key: "allowance", label: "البدلات", width: 15 },
    { key: "gross", label: "الإجمالي", width: 16 },
    { key: "deductions", label: "الاستقطاعات", width: 16 },
    { key: "net", label: "صافي الراتب", width: 18 },
  ];

  const rows = (run.payslips || []).map((slip) => ({
    num: slip.payslipNumber || `#${slip.id}`,
    empCode: slip.employeeCode || "—",
    name: slip.employeeName,
    job: slip.jobTitle || "—",
    dept: slip.departmentName || "—",
    basic: slip.basicSalary,
    allowance: slip.allowances,
    gross: slip.grossPay,
    deductions: slip.deductions,
    net: slip.netPay,
  }));

  exportStyledExcel({
    reportTitle: `كشف مسيّر الرواتب: ${run.runNumber} — ${run.periodLabel || run.period}`,
    sourceName: "إدارة الموارد البشرية وشؤون العاملين",
    columns,
    rows,
    metaInfo: [
      { label: "رقم المسيّر", value: run.runNumber },
      { label: "الفترة", value: run.periodLabel || run.period },
      { label: "عدد العاملين", value: integer(run.headcount) },
      { label: "الحالة", value: payrollStatusLabel(run.status) },
      { label: "إجمالي الأجور", value: amount(run.totals?.grossPay ?? 0) },
      { label: "صافي التحويلات", value: amount(run.totals?.netPay ?? 0) },
    ],
    filename: `Payroll_${run.runNumber}`,
  });
}

function printPayrollPdf(run) {
  const content = el("div", { class: "p-4 space-y-4" },
    el("div", { class: "grid grid-cols-4 gap-3 p-3 bg-gray-50 border rounded text-xs mb-4" },
      el("div", {}, `رقم المسيّر: ${run.runNumber}`),
      el("div", {}, `الفترة: ${run.periodLabel || run.period}`),
      el("div", {}, `عدد العاملين: ${integer(run.headcount)}`),
      el("div", {}, `الحالة: ${payrollStatusLabel(run.status)}`),
      el("div", {}, `إجمالي الأجور: ${amount(run.totals?.grossPay ?? 0)}`),
      el("div", {}, `الاستقطاعات: ${amount(run.totals?.deductions ?? 0)}`),
      el("div", { class: "col-span-2 font-bold text-blue-700" }, `صافي التحويلات للبنك: ${amount(run.totals?.netPay ?? 0)}`),
    ),
    el("table", { class: "w-full text-xs text-right border-collapse border" },
      el("thead", { class: "bg-gray-100 font-bold border-b" },
        el("tr", {},
          el("th", { class: "p-2 border" }, "الموظف"),
          el("th", { class: "p-2 border" }, "الوظيفة / القسم"),
          el("th", { class: "p-2 border text-left" }, "الأساسي"),
          el("th", { class: "p-2 border text-left" }, "البدلات"),
          el("th", { class: "p-2 border text-left" }, "إجمالي الراتب"),
          el("th", { class: "p-2 border text-left" }, "الاستقطاعات"),
          el("th", { class: "p-2 border text-left font-bold" }, "صافي الراتب"),
        )
      ),
      el("tbody", {},
        (run.payslips || []).map((slip) =>
          el("tr", { class: "border-b" },
            el("td", { class: "p-2 border font-semibold" }, slip.employeeName),
            el("td", { class: "p-2 border text-gray-600" }, `${slip.jobTitle || "—"} / ${slip.departmentName || ""}`),
            el("td", { class: "p-2 border text-left font-mono" }, amount(slip.basicSalary)),
            el("td", { class: "p-2 border text-left font-mono" }, amount(slip.allowances)),
            el("td", { class: "p-2 border text-left font-mono" }, amount(slip.grossPay)),
            el("td", { class: "p-2 border text-left font-mono text-red-600" }, amount(slip.deductions)),
            el("td", { class: "p-2 border text-left font-mono font-bold text-green-700" }, amount(slip.netPay)),
          )
        )
      )
    )
  );

  printReport({
    title: `كشف مسيّر الرواتب العام — ${run.runNumber} (${run.periodLabel || run.period})`,
    sourceName: "إدارة الموارد البشرية — الحسابات العامة",
    content,
  });
}

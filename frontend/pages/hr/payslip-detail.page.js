/**
 * قسيمة راتب الموظف الشهرية (Employee Payslip Detail).
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, date, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { exportStyledExcel, printReport } from "../_shared/print.js";
import { getPayslip } from "../../js/api/hr.api.js";

export default async function payslipDetailPage(context) {
  const slipId = context.params?.id;
  const slip = await getPayslip(slipId);
  const emp = slip.employee || {};

  const container = el("div", { class: "flex flex-col gap-6 p-4 md:p-6 max-w-5xl mx-auto" });

  const topNav = el(
    "div",
    { class: "flex items-center justify-between flex-wrap gap-3" },
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap" },
      button({
        label: slip.payrollRunId ? "العودة للمسيّر" : "العودة للموظفين",
        variant: "ghost",
        icon: "chevronStart",
        onClick: () => (slip.payrollRunId ? navigate(`/hr/payroll/${slip.payrollRunId}`) : navigate("/hr/payroll")),
      }),
      el("span", { class: "text-muted" }, "/"),
      el("span", { class: "font-semibold text-ink" }, `قسيمة راتب: ${emp.name || slip.employeeName}`),
      badge(slip.periodLabel || slip.period, { tone: "info" }),
      badge(payslipStatusLabel(slip.status), { tone: payslipStatusTone(slip.status) }),
    ),
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap" },
      button({
        label: "تصدير القسيمة Excel",
        variant: "secondary",
        icon: "download",
        onClick: () => exportSlipExcel(slip),
      }),
      button({
        label: "طباعة مفردات المرتب (PDF)",
        variant: "primary",
        icon: "print",
        onClick: () => printSlipPdf(slip),
      }),
    ),
  );

  const basic = Number(slip.basicSalary ?? slip.basic ?? 0);
  const allowances = Number(slip.allowances ?? 0);
  const bonuses = Number(slip.bonuses ?? 0);
  const overtime = Number(slip.overtime ?? 0);
  const gross = Number(slip.grossPay ?? slip.gross ?? (basic + allowances + bonuses + overtime));

  const empIns = Number(slip.employeeInsurance ?? 0);
  const tax = Number(slip.incomeTax ?? 0);
  const adv = Number(slip.advanceRecovery ?? 0);
  const otherDed = Number(slip.otherDeductions ?? 0);
  const totalDed = Number(slip.totalDeductions ?? slip.deductions ?? (empIns + tax + adv + otherDed));

  const net = Number(slip.netPay ?? (gross - totalDed));

  /* بطاقات الإحصاء */
  const stats = el(
    "div",
    { class: "grid grid-cols-1 sm:grid-cols-3 gap-4" },
    statTile({
      title: "إجمالي الاستحقاقات (Gross)",
      value: amount(gross),
      tone: "primary",
      icon: "trendingUp",
      hint: `أساسي ${amount(basic)} + بدلات ${amount(allowances + bonuses + overtime)}`,
    }),
    statTile({
      title: "إجمالي الاستقطاعات (Deductions)",
      value: amount(totalDed),
      tone: "danger",
      icon: "trendingDown",
      hint: `تأمينات ${amount(empIns)} + ضرائب ${amount(tax)}`,
    }),
    statTile({
      title: "صافي الراتب المستحق (Net Pay)",
      value: amount(net),
      tone: "success",
      icon: "wallet",
      hint: `حساب بنكي: ${emp.bankAccount ? `${emp.bankName} - ${emp.bankAccount}` : "صرف نقدي"}`,
    }),
  );

  /* بيانات الموظف والتعيين */
  const employeeCard = el(
    "div",
    { class: "rounded-xl border border-border bg-surface p-5 shadow-sm" },
    el("h2", { class: "text-base font-bold text-ink mb-4 pb-2 border-b border-border" }, "بيانات الموظف والوظيفة"),
    el(
      "div",
      { class: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm" },
      infoBox("اسم الموظف", emp.name || slip.employeeName),
      infoBox("كود الموظف", emp.code || slip.employeeCode || `#${slip.employeeId}`),
      infoBox("المسمى الوظيفي", emp.jobTitle || slip.jobTitle || "—"),
      infoBox("القسم / الإدارة", emp.departmentName || slip.departmentName || "—"),
      infoBox("تاريخ التعيين", date(emp.hireDate)),
      infoBox("الرقم التأميني", emp.socialInsuranceNumber || "—"),
      infoBox("البنك المحول إليه", emp.bankName || "—"),
      infoBox("رقم الحساب البنكي", emp.bankAccount || "—"),
    ),
  );

  /* جدول مفردات الراتب: استحقاقات واستقطاعات جنبًا إلى جنب */
  const breakdownCard = el(
    "div",
    { class: "rounded-xl border border-border bg-surface p-5 shadow-sm" },
    el("h2", { class: "text-base font-bold text-ink mb-4 pb-2 border-b border-border" }, "تفاصيل مفردات المرتب"),
    el(
      "div",
      { class: "grid grid-cols-1 md:grid-cols-2 gap-6" },
      /* عمود الاستحقاقات */
      el(
        "div",
        { class: "border border-border/80 rounded-xl overflow-hidden" },
        el("div", { class: "bg-success/10 text-success p-3 font-bold text-sm border-b border-border" }, "الاستحقاقات والمكافآت (Earnings)"),
        el(
          "table",
          { class: "w-full text-sm text-right border-collapse" },
          el(
            "tbody",
            { class: "divide-y divide-border" },
            salaryRow("الراتب الأساسي", basic),
            salaryRow("بدل سكن وانتقال", allowances),
            salaryRow("مكافآت وحوافز إنتاج", bonuses),
            salaryRow("أجر ساعات إضافية (Overtime)", overtime),
            el(
              "tr",
              { class: "bg-surface-alt font-bold" },
              el("td", { class: "p-3 text-ink" }, "إجمالي الاستحقاقات"),
              el("td", { class: "p-3 text-left font-mono text-primary font-bold text-base" }, amount(gross)),
            ),
          ),
        ),
      ),
      /* عمود الاستقطاعات */
      el(
        "div",
        { class: "border border-border/80 rounded-xl overflow-hidden" },
        el("div", { class: "bg-danger/10 text-danger p-3 font-bold text-sm border-b border-border" }, "الاستقطاعات والخصميات (Deductions)"),
        el(
          "table",
          { class: "w-full text-sm text-right border-collapse" },
          el(
            "tbody",
            { class: "divide-y divide-border" },
            salaryRow("تأمينات اجتماعية (حصة الموظف 11%)", empIns),
            salaryRow("ضريبة كسب العمل", tax),
            salaryRow("أقساط وسلف مستردة", adv),
            salaryRow("جزاءات واستقطاعات أخرى", otherDed),
            el(
              "tr",
              { class: "bg-surface-alt font-bold" },
              el("td", { class: "p-3 text-ink" }, "إجمالي الاستقطاعات"),
              el("td", { class: "p-3 text-left font-mono text-danger font-bold text-base" }, amount(totalDed)),
            ),
          ),
        ),
      ),
    ),
    /* الصافي النهائي المستحق */
    el(
      "div",
      { class: "mt-6 p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between flex-wrap gap-3" },
      el(
        "div",
        {},
        el("div", { class: "text-xs text-muted font-medium" }, "صافي المبلغ المستحق للصرف"),
        el("div", { class: "text-2xl font-black text-primary font-mono mt-0.5" }, amount(net)),
      ),
      el(
        "div",
        { class: "text-left text-xs text-muted" },
        el("div", {}, `رقم القسيمة: ${slip.payslipNumber || `#${slip.id}`}`),
        el("div", {}, `فترة الراتب: ${slip.periodLabel || slip.period}`),
      ),
    ),
  );

  container.append(topNav, stats, employeeCard, breakdownCard);
  return container;
}

function salaryRow(label, val) {
  return el(
    "tr",
    { class: "hover:bg-surface-alt/40" },
    el("td", { class: "p-3 text-muted text-xs" }, label),
    el("td", { class: "p-3 text-left font-mono text-ink font-semibold" }, amount(val)),
  );
}

function infoBox(label, value) {
  return el(
    "div",
    { class: "flex flex-col gap-1 p-2.5 rounded-lg bg-surface-alt/40 border border-border/50" },
    el("span", { class: "text-xs text-muted font-medium" }, label),
    el("span", { class: "text-sm text-ink font-semibold break-words" }, String(value ?? "—")),
  );
}

function payslipStatusLabel(status) {
  switch (status) {
    case "calculated":
    case "pending":
      return "تم الاحتساب";
    case "approved":
      return "معتمدة";
    case "paid":
      return "تم الصرف";
    default:
      return status ?? "معتمدة";
  }
}

function payslipStatusTone(status) {
  switch (status) {
    case "paid":
      return "success";
    case "approved":
      return "primary";
    default:
      return "warning";
  }
}

function exportSlipExcel(slip) {
  const emp = slip.employee || {};
  const basic = Number(slip.basicSalary ?? slip.basic ?? 0);
  const allowances = Number(slip.allowances ?? 0);
  const bonuses = Number(slip.bonuses ?? 0);
  const overtime = Number(slip.overtime ?? 0);
  const gross = Number(slip.grossPay ?? slip.gross ?? (basic + allowances + bonuses + overtime));

  const empIns = Number(slip.employeeInsurance ?? 0);
  const tax = Number(slip.incomeTax ?? 0);
  const adv = Number(slip.advanceRecovery ?? 0);
  const otherDed = Number(slip.otherDeductions ?? 0);
  const totalDed = Number(slip.totalDeductions ?? slip.deductions ?? (empIns + tax + adv + otherDed));
  const net = Number(slip.netPay ?? (gross - totalDed));

  const columns = [
    { key: "item", label: "البند", width: 30 },
    { key: "type", label: "النوع", width: 16 },
    { key: "amount", label: "المبلغ (جنيه)", width: 20 },
  ];

  const rows = [
    { item: "الراتب الأساسي", type: "استحقاق", amount: basic },
    { item: "بدل انتقال وسكن", type: "استحقاق", amount: allowances },
    { item: "مكافآت وحوافز", type: "استحقاق", amount: bonuses },
    { item: "إضافي ساعات عمل", type: "استحقاق", amount: overtime },
    { item: "تأمينات اجتماعية (حصة الموظف)", type: "استقطاع", amount: empIns },
    { item: "ضريبة كسب العمل", type: "استقطاع", amount: tax },
    { item: "سلف وقروض مستردة", type: "استقطاع", amount: adv },
    { item: "جزاءات واستقطاعات", type: "استقطاع", amount: otherDed },
  ];

  exportStyledExcel({
    reportTitle: `قسيمة راتب: ${emp.name || slip.employeeName} (${slip.periodLabel || slip.period})`,
    sourceName: "الموارد البشرية وشؤون العاملين",
    columns,
    rows,
    metaInfo: [
      { label: "اسم الموظف", value: emp.name || slip.employeeName },
      { label: "كود الموظف", value: emp.code || slip.employeeCode || "—" },
      { label: "الوظيفة", value: emp.jobTitle || "—" },
      { label: "الفترة", value: slip.periodLabel || slip.period },
      { label: "إجمالي الاستحقاق", value: amount(gross) },
      { label: "إجمالي الاستقطاع", value: amount(totalDed) },
      { label: "صافي الراتب", value: amount(net) },
    ],
    filename: `Payslip_${emp.code || slip.id}_${slip.period}`,
  });
}

function printSlipPdf(slip) {
  const emp = slip.employee || {};
  const basic = Number(slip.basicSalary ?? slip.basic ?? 0);
  const allowances = Number(slip.allowances ?? 0);
  const bonuses = Number(slip.bonuses ?? 0);
  const overtime = Number(slip.overtime ?? 0);
  const gross = Number(slip.grossPay ?? slip.gross ?? (basic + allowances + bonuses + overtime));

  const empIns = Number(slip.employeeInsurance ?? 0);
  const tax = Number(slip.incomeTax ?? 0);
  const adv = Number(slip.advanceRecovery ?? 0);
  const otherDed = Number(slip.otherDeductions ?? 0);
  const totalDed = Number(slip.totalDeductions ?? slip.deductions ?? (empIns + tax + adv + otherDed));
  const net = Number(slip.netPay ?? (gross - totalDed));

  const content = el("div", { class: "p-4 space-y-4" },
    el("div", { class: "grid grid-cols-2 gap-3 p-3 bg-gray-50 border rounded text-xs mb-4" },
      el("div", {}, `اسم الموظف: ${emp.name || slip.employeeName}`),
      el("div", {}, `كود الموظف: ${emp.code || slip.employeeCode || "—"}`),
      el("div", {}, `الوظيفة: ${emp.jobTitle || "—"}`),
      el("div", {}, `القسم: ${emp.departmentName || "—"}`),
      el("div", {}, `فترة الراتب: ${slip.periodLabel || slip.period}`),
      el("div", {}, `تاريخ التعيين: ${date(emp.hireDate)}`),
    ),
    el("div", { class: "grid grid-cols-2 gap-4 text-xs" },
      el("div", { class: "border rounded p-3" },
        el("div", { class: "font-bold text-green-700 border-b pb-1 mb-2" }, "الاستحقاقات"),
        el("div", { class: "flex justify-between py-1" }, el("span", {}, "الراتب الأساسي"), el("span", { class: "font-mono" }, amount(basic))),
        el("div", { class: "flex justify-between py-1" }, el("span", {}, "البدلات"), el("span", { class: "font-mono" }, amount(allowances))),
        el("div", { class: "flex justify-between py-1" }, el("span", {}, "المكافآت"), el("span", { class: "font-mono" }, amount(bonuses))),
        el("div", { class: "flex justify-between py-1" }, el("span", {}, "الإضافي"), el("span", { class: "font-mono" }, amount(overtime))),
        el("div", { class: "flex justify-between py-1 border-t font-bold text-blue-700 mt-2" }, el("span", {}, "إجمالي الراتب"), el("span", { class: "font-mono" }, amount(gross))),
      ),
      el("div", { class: "border rounded p-3" },
        el("div", { class: "font-bold text-red-700 border-b pb-1 mb-2" }, "الاستقطاعات"),
        el("div", { class: "flex justify-between py-1" }, el("span", {}, "تأمينات اجتماعية"), el("span", { class: "font-mono" }, amount(empIns))),
        el("div", { class: "flex justify-between py-1" }, el("span", {}, "ضريبة كسب العمل"), el("span", { class: "font-mono" }, amount(tax))),
        el("div", { class: "flex justify-between py-1" }, el("span", {}, "سلف مستردة"), el("span", { class: "font-mono" }, amount(adv))),
        el("div", { class: "flex justify-between py-1" }, el("span", {}, "استقطاعات أخرى"), el("span", { class: "font-mono" }, amount(otherDed))),
        el("div", { class: "flex justify-between py-1 border-t font-bold text-red-700 mt-2" }, el("span", {}, "إجمالي الاستقطاع"), el("span", { class: "font-mono" }, amount(totalDed))),
      ),
    ),
    el("div", { class: "p-3 bg-blue-50 border border-blue-200 rounded flex justify-between items-center text-sm font-bold text-blue-900 mt-4" },
      el("span", {}, "صافي الراتب المحول"),
      el("span", { class: "font-mono text-lg" }, amount(net)),
    )
  );

  printReport({
    title: `قسيمة راتب الموظف — ${emp.name || slip.employeeName}`,
    sourceName: "إدارة الموارد البشرية وشؤون العاملين",
    content,
  });
}

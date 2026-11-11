/**
 * ملف الموظف الكامل (Employee Master Profile).
 *
 * البيانات الشخصية والوظيفية، الرواتب والبدلات، المستندات الرسمية وتواريخ صلاحيتها،
 * أرصدة الإجازات، وسجل الرواتب وقسائم القبض.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, date, integer, phone as formatPhone } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { exportStyledExcel, printReport } from "../_shared/print.js";
import { getEmployee } from "../../js/api/hr.api.js";

const STATUS_MAP = {
  employed: { label: "على رأس العمل", tone: "success" },
  probation: { label: "تحت التجربة", tone: "warning" },
  suspended: { label: "موقوف مؤقتًا", tone: "danger" },
  terminated: { label: "منتهية خدمته", tone: "neutral" },
};

export default async function employeeDetailPage(context) {
  const employeeId = context.params?.id;
  const emp = await getEmployee(employeeId);

  const container = el("div", { class: "flex flex-col gap-6 p-4 md:p-6" });

  // 1. شريط التنقل العلوي والأزرار
  const topNav = el(
    "div",
    { class: "flex items-center justify-between flex-wrap gap-3" },
    el(
      "div",
      { class: "flex items-center gap-2" },
      button({
        label: "العودة لقائمة الموظفين",
        variant: "ghost",
        icon: "chevronStart",
        onClick: () => navigate("/hr/employees"),
      }),
      el("span", { class: "text-muted" }, "/"),
      el("span", { class: "font-semibold text-ink" }, `ملف الموظف: ${emp.name}`),
      badge(STATUS_MAP[emp.status]?.label ?? emp.status, {
        tone: STATUS_MAP[emp.status]?.tone ?? "neutral",
      }),
    ),
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap" },
      button({
        label: "تصدير بيان الموظف Excel",
        variant: "secondary",
        icon: "download",
        onClick: () => exportEmployeeExcel(emp),
      }),
      button({
        label: "طباعة بيان حالة وظيفية (PDF)",
        variant: "primary",
        icon: "print",
        onClick: () => printEmployeePdf(emp),
      }),
    ),
  );

  // 2. بطاقة الموظف التعريفية (Hero Card)
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
            class: "w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl text-white shadow-sm",
            style: "background: linear-gradient(135deg, #1e3a8a, #3b82f6);",
          },
          emp.name.charAt(0),
        ),
        el(
          "div",
          { class: "flex flex-col" },
          el("h2", { class: "text-lg font-bold text-ink" }, emp.name),
          el(
            "div",
            { class: "flex items-center gap-2 mt-1 text-xs text-muted flex-wrap" },
            el("span", { class: "font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded" }, emp.code),
            el("span", {}, "·"),
            el("span", { class: "text-ink font-semibold" }, emp.positionTitle || emp.jobTitle || "موظف"),
            el("span", {}, "·"),
            el("span", {}, `قسم: ${emp.departmentName || "—"}`),
            el("span", {}, "·"),
            el("span", {}, `الوردية: ${emp.shiftName || "الصباحية العامة"}`),
          ),
        ),
      ),
      el(
        "div",
        { class: "flex items-center gap-3 flex-wrap" },
        badge(`التعيين: ${date(emp.hireDate)}`, { tone: "brand" }),
        badge(emp.contractType === "permanent" ? "عقد دائم" : "محدد المدة", { tone: "info" }),
      ),
    ),
    el(
      "div",
      { class: "grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs" },
      infoBox("الراتب الأساسي", amount(emp.basicSalary || 0), "text-ink font-bold"),
      infoBox("إجمالي البدلات", amount(emp.allowancesTotal || (emp.allowances ? Object.values(emp.allowances).reduce((a, b) => a + b, 0) : 0)), "text-brand-700 dark:text-brand-400 font-bold"),
      infoBox("الرقم القومي", emp.nationalId || "—", "font-mono"),
      infoBox("رقم الهاتف", emp.phone ? formatPhone(emp.phone) : "—", "dir-ltr"),
    ),
  );

  // 3. بطاقات المؤشرات (Stat Cards)
  const remainingLeave = emp.leaveBalances?.remaining ?? (emp.leaveEntitlements?.annual || 21);
  const attendanceRate = emp.attendanceSummary?.attendanceRate ?? 96;

  const statsSection = el(
    "div",
    { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" },
    statTile({
      label: "إجمالي الراتب الشامل",
      value: amount((emp.basicSalary || 0) + (emp.allowancesTotal || 0)),
      tone: "brand",
      icon: "money",
    }),
    statTile({
      label: "رصيد الإجازات المتبقي",
      value: `${integer(remainingLeave)} يوم`,
      tone: remainingLeave > 5 ? "success" : "warning",
      icon: "calendar",
    }),
    statTile({
      label: "نسبة الحضور والالتزام",
      value: `${attendanceRate}%`,
      tone: attendanceRate >= 90 ? "success" : "danger",
      icon: "clock",
    }),
    statTile({
      label: "حالة الوثائق والمستندات",
      value: (emp.documents || []).some((d) => d.status === "expired") ? "مستندات منتهية" : "سليمة وموثقة",
      tone: (emp.documents || []).some((d) => d.status === "expired") ? "danger" : "success",
      icon: "fileText",
    }),
  );

  // 4. جدول المستندات الرسمية والرخص الطبية
  const documentsCard = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm overflow-hidden flex flex-col gap-3" },
    el(
      "div",
      { class: "flex items-center justify-between" },
      el("h3", { class: "text-sm font-bold text-ink" }, "المستندات والوثائق الرسمية وتراخيص مزاولة المهنة"),
      badge(`إجمالي الوثائق: ${(emp.documents || []).length}`, { tone: "purple" }),
    ),
    renderDocumentsTable(emp.documents || []),
  );

  // 5. سجل قسائم الرواتب الأخيرة
  const payslipsCard = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm overflow-hidden flex flex-col gap-3" },
    el(
      "div",
      { class: "flex items-center justify-between" },
      el("h3", { class: "text-sm font-bold text-ink" }, "سجل قسائم الرواتب الشهرية والمسيرات"),
      badge(`قسائم مسجلة: ${(emp.payslips || []).length}`, { tone: "brand" }),
    ),
    renderPayslipsTable(emp.payslips || []),
  );

  container.append(topNav, heroCard, statsSection, documentsCard, payslipsCard);
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

function renderDocumentsTable(documents) {
  const table = el("table", { class: "w-full border-collapse text-right text-xs" });

  const thead = el(
    "thead",
    {},
    el(
      "tr",
      { class: "border-b border-subtle bg-slate-50 dark:bg-slate-800/40 text-muted" },
      el("th", { class: "p-3 font-semibold" }, "اسم الوثيقة / الترخيص"),
      el("th", { class: "p-3 font-semibold text-center w-36" }, "رقم الوثيقة"),
      el("th", { class: "p-3 font-semibold text-center w-32" }, "تاريخ الانتهاء"),
      el("th", { class: "p-3 font-semibold text-center w-32" }, "الحالة"),
    ),
  );

  const tbody = el("tbody", {});
  if (!documents.length) {
    tbody.appendChild(
      el("tr", {}, el("td", { colspan: 4, class: "p-6 text-center text-muted" }, "لا توجد مستندات مسجلة لهذا الموظف.")),
    );
  } else {
    documents.forEach((d) => {
      const isExpired = d.status === "expired" || (d.expiryDate && new Date(d.expiryDate) < new Date());
      tbody.appendChild(
        el(
          "tr",
          { class: "border-b border-subtle hover:bg-slate-50/50 dark:hover:bg-slate-800/20" },
          el("td", { class: "p-3 font-semibold text-ink" }, d.name || d.title || "وثيقة رسمية"),
          el("td", { class: "p-3 text-center font-mono text-muted" }, d.number || "—"),
          el("td", { class: "p-3 text-center" }, d.expiryDate ? date(d.expiryDate) : "سارية بدون انتهاء"),
          el("td", { class: "p-3 text-center" }, badge(isExpired ? "منتهية الصلاحية" : "سارية", { tone: isExpired ? "danger" : "success" })),
        ),
      );
    });
  }

  table.append(thead, tbody);
  return el("div", { class: "overflow-x-auto" }, table);
}

function renderPayslipsTable(payslips) {
  const table = el("table", { class: "w-full border-collapse text-right text-xs" });

  const thead = el(
    "thead",
    {},
    el(
      "tr",
      { class: "border-b border-subtle bg-slate-50 dark:bg-slate-800/40 text-muted" },
      el("th", { class: "p-3 font-semibold text-center w-32" }, "الشهر / الفترة"),
      el("th", { class: "p-3 font-semibold text-left w-32" }, "الأساسي"),
      el("th", { class: "p-3 font-semibold text-left w-32" }, "البدلات"),
      el("th", { class: "p-3 font-semibold text-left w-32" }, "الاستقطاعات"),
      el("th", { class: "p-3 font-semibold text-left w-36" }, "صافي الراتب"),
      el("th", { class: "p-3 font-semibold text-center w-28" }, "حالة الصرف"),
    ),
  );

  const tbody = el("tbody", {});
  if (!payslips.length) {
    tbody.appendChild(
      el("tr", {}, el("td", { colspan: 6, class: "p-6 text-center text-muted" }, "لا توجد قسائم رواتب سابقة مسجلة.")),
    );
  } else {
    payslips.forEach((p) => {
      tbody.appendChild(
        el(
          "tr",
          { class: "border-b border-subtle hover:bg-slate-50/50 dark:hover:bg-slate-800/20" },
          el("td", { class: "p-3 text-center font-bold text-ink" }, p.periodName || p.month || "—"),
          el("td", { class: "p-3 text-left font-mono" }, amount(p.basicSalary || 0)),
          el("td", { class: "p-3 text-left font-mono text-brand-600" }, amount(p.allowances || 0)),
          el("td", { class: "p-3 text-left font-mono text-danger-600" }, amount(p.deductions || 0)),
          el("td", { class: "p-3 text-left font-mono font-bold text-success-700 dark:text-success-400" }, amount(p.netSalary || 0)),
          el("td", { class: "p-3 text-center" }, badge(p.status === "paid" ? "تم الصرف" : "معتمد", { tone: "success", size: "sm" })),
        ),
      );
    });
  }

  table.append(thead, tbody);
  return el("div", { class: "overflow-x-auto" }, table);
}

function exportEmployeeExcel(emp) {
  const headers = [
    { label: "البيان", align: "right" },
    { label: "القيمة", align: "right" },
  ];

  const rows = [
    ["كود الموظف", emp.code],
    ["الاسم بالكامل", emp.name],
    ["المسمى الوظيفي", emp.positionTitle || emp.jobTitle || "—"],
    ["القسم / الإدارة", emp.departmentName || "—"],
    ["الرقم القومي", emp.nationalId || "—"],
    ["رقم الهاتف", emp.phone || "—"],
    ["تاريخ التعيين", date(emp.hireDate)],
    ["الراتب الأساسي (ج.م)", emp.basicSalary || 0],
    ["إجمالي البدلات (ج.م)", emp.allowancesTotal || 0],
    ["الراتب الشامل (ج.م)", (emp.basicSalary || 0) + (emp.allowancesTotal || 0)],
  ];

  exportStyledExcel({
    title: `ملف موظف — ${emp.name}`,
    period: `كود الموظف: ${emp.code} · ${emp.departmentName || ""}`,
    headers,
    rows,
  });
}

function printEmployeePdf(emp) {
  const headers = [
    { label: "البند", align: "right" },
    { label: "التفاصيل", align: "right" },
  ];

  const rows = [
    ["الاسم", emp.name],
    ["الوظيفة", emp.positionTitle || emp.jobTitle || "—"],
    ["الإدارة", emp.departmentName || "—"],
    ["تاريخ الالتحاق", date(emp.hireDate)],
    ["الراتب الأساسي", amount(emp.basicSalary || 0)],
    ["الراتب الشامل", amount((emp.basicSalary || 0) + (emp.allowancesTotal || 0))],
  ];

  printReport({
    title: `بيان حالة وظيفية — ${emp.name}`,
    subtitle: `مستشفى أمان الحياة — كود الموظف: ${emp.code}`,
    period: `تاريخ الإصدار: ${date(new Date().toISOString())}`,
    headers,
    rows,
    signatures: ["مدير الموارد البشرية", "المدير المالي", "المدير العام"],
  });
}

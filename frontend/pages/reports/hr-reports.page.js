/**
 * تقارير الموارد البشرية والرواتب.
 *
 * كشوف تكاليف العمالة، ملخص مسيّرات الرواتب، تقارير الحضور والغياب، وأرصدة الإجازات.
 */

import { el, clear } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import {
  getOrganizationChart,
  listPayrollRuns,
  getAttendanceReport,
} from "../../js/api/hr.api.js";
import { getCompanyInfo } from "../../js/api/settings.api.js";
import { printReport } from "../_shared/print.js";

export default async function hrReportsPage() {
  const company = await getCompanyInfo().catch(() => ({ name: "الشركة النموذجية للتجارة والتوزيع" }));

  const [orgData, payrollRes, attData] = await Promise.all([
    getOrganizationChart(),
    listPayrollRuns({ perPage: 12 }),
    getAttendanceReport().catch(() => ({ records: [], totals: {} })),
  ]);

  const departments = orgData.rows ?? [];
  const payrollRuns = payrollRes.data ?? [];

  const container = el("div", { class: "page-container page-hr-reports", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "تقارير الموارد البشرية والرواتب"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "تحليل تكلفة الرواتب، توزيع العمالة على الإدارات ومؤشرات الانضباط والدوام.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem;" },
      button({
        label: "مركز التقارير",
        variant: "secondary",
        icon: "reports",
        onClick: () => navigate("/reports"),
      }),
      button({
        label: "طباعة تقرير تكاليف الإدارات",
        variant: "primary",
        icon: "print",
        onClick: () => triggerPrint(),
      })
    )
  );

  // إحصاءات عامة
  const totalCost = money.sumBy(departments, "payrollCost");
  const totalEmployees = orgData.totals?.headcount ?? 0;

  const statsRow = el(
    "div",
    { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;" },
    statTile({
      label: "إجمالي القوة العاملة",
      value: integer(totalEmployees),
      hint: `${departments.length} إدارة معتمدة`,
      trend: "positive",
    }),
    statTile({
      label: "إجمالي تكلفة الرواتب الشهرية",
      value: amount(totalCost),
      hint: "أجور وتأمينات صاحب العمل",
      trend: "neutral",
    }),
    statTile({
      label: "متوسط تكلفة الموظف",
      value: amount(totalEmployees ? totalCost / totalEmployees : 0),
      hint: "شهرياً",
    })
  );

  // جدول تكلفة العمالة حسب الإدارات
  const deptCard = el(
    "div",
    {
      class: "surface-card",
      style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem;",
    },
    el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, "تحليل تكلفة العمالة وتوزيعها على الإدارات")
  );

  const table = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
  const thead = el(
    "thead",
    null,
    el(
      "tr",
      { style: "background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);" },
      el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "كود الإدارة"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "اسم الإدارة"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "المدير المسؤول"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "عدد الموظفين"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "تكلفة الرواتب الشهرية"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "النسبة من الإجمالي")
    )
  );
  const tbody = el("tbody", null);

  departments.forEach((d) => {
    const cost = d.payrollCost ?? 0;
    const pct = totalCost ? ((cost / totalCost) * 100).toFixed(1) : "0";
    const tr = el(
      "tr",
      { style: "border-bottom: 1px solid var(--border-color);" },
      el("td", { style: "padding: 0.75rem 1rem; font-family: monospace;" }, el("span", { class: "ltr-isolate" }, d.code)),
      el("td", { style: "padding: 0.75rem 1rem; font-weight: 600;" }, d.name),
      el("td", { style: "padding: 0.75rem 1rem;" }, d.managerName ?? "—"),
      el("td", { style: "padding: 0.75rem 1rem; text-align: center; font-weight: 600;" }, integer(d.headcount)),
      el("td", { style: "padding: 0.75rem 1rem; text-align: left; font-weight: 600;" }, el("span", { class: "ltr-isolate" }, amount(cost))),
      el("td", { style: "padding: 0.75rem 1rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, `${pct}%`))
    );
    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  deptCard.appendChild(table);

  // جدول مسيّرات الرواتب السابقة
  const payrollCard = el(
    "div",
    {
      class: "surface-card",
      style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
    },
    el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, "سجل مسيّرات الرواتب المعتمدة")
  );

  const pTable = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
  const pThead = el(
    "thead",
    null,
    el(
      "tr",
      { style: "background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);" },
      el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "فترة المسيّر"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "عدد الموظفين"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "إجمالي الأجور"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "الاستقطاعات"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "صافي الرواتب"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "حالة الاعتماد")
    )
  );
  const pTbody = el("tbody", null);

  payrollRuns.forEach((r) => {
    const row = el(
      "tr",
      { style: "border-bottom: 1px solid var(--border-color);" },
      el("td", { style: "padding: 0.75rem 1rem; font-weight: 700;" }, r.period ?? r.name),
      el("td", { style: "padding: 0.75rem 1rem; text-align: center;" }, integer(r.employeesCount ?? r.employeeCount ?? 0)),
      el("td", { style: "padding: 0.75rem 1rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(r.totalGross ?? r.gross ?? 0))),
      el("td", { style: "padding: 0.75rem 1rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(r.totalDeductions ?? r.deductions ?? 0))),
      el("td", { style: "padding: 0.75rem 1rem; text-align: left; font-weight: 700; color: var(--primary);" }, el("span", { class: "ltr-isolate" }, amount(r.totalNet ?? r.netPay ?? 0))),
      el("td", { style: "padding: 0.75rem 1rem; text-align: center;" }, "معتمد ومُرحَّل")
    );
    pTbody.appendChild(row);
  });

  pTable.appendChild(pThead);
  pTable.appendChild(pTbody);
  payrollCard.appendChild(pTable);

  function triggerPrint() {
    printReport({
      company,
      title: "تقرير تكاليف العمالة وتوزيع الإدارات",
      period: "2026",
      headers: [
        { label: "كود الإدارة", align: "right" },
        { label: "اسم الإدارة", align: "right" },
        { label: "المدير المسؤول", align: "right" },
        { label: "عدد الموظفين", align: "center" },
        { label: "تكلفة الرواتب الشهرية", align: "left" },
      ],
      rows: departments.map((d) => [
        d.code,
        d.name,
        d.managerName ?? "—",
        String(d.headcount),
        amount(d.payrollCost ?? 0),
      ]),
      totals: ["الإجمالي", "", "", String(totalEmployees), amount(totalCost)],
    });
  }

  container.appendChild(header);
  container.appendChild(statsRow);
  container.appendChild(deptCard);
  container.appendChild(payrollCard);

  return container;
}

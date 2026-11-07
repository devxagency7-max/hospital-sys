/**
 * تقارير مراكز التكلفة والربحية.
 *
 * تحليل المصروفات والإيرادات وصافي ربحية مراكز التكلفة التشغيلية والإدارية.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import { getCostCenterAnalysis, listCostCenters } from "../../js/api/accounting.api.js";
import { getCompanyInfo } from "../../js/api/settings.api.js";
import { printReport } from "../_shared/print.js";

export default async function costCentersReportsPage() {
  const [analysis, listRes, company] = await Promise.all([
    getCostCenterAnalysis(),
    listCostCenters({ perPage: 100 }),
    getCompanyInfo().catch(() => ({ name: "الشركة النموذجية للتجارة والتوزيع" })),
  ]);

  const centers = analysis.centers ?? listRes.data ?? [];
  const totalExp = analysis.totalExpenses ?? money.sumBy(centers, "expenses");
  const totalRev = analysis.totalRevenues ?? money.sumBy(centers, "revenues");
  const net = money.subtract(totalRev, totalExp);

  const container = el("div", { class: "page-container page-cost-centers-reports", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "تقارير مراكز التكلفة والربحية"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "تحليل كفاءة الإنفاق وتوزيع الإيرادات والمصروفات على مراكز المسؤولية.")
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
        label: "طباعة التقرير",
        variant: "primary",
        icon: "print",
        onClick: () => triggerPrint(),
      })
    )
  );

  // إحصاءات
  const statsRow = el(
    "div",
    { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;" },
    statTile({
      label: "إجمالي المصروفات المحمّلة",
      value: amount(totalExp),
      hint: `${integer(centers.length)} مركز تكلفة`,
      trend: "negative",
    }),
    statTile({
      label: "إجمالي الإيرادات المحمّلة",
      value: amount(totalRev),
      hint: "مبيعات مباشرة",
      trend: "positive",
    }),
    statTile({
      label: "صافي مساهمة المراكز",
      value: amount(net),
      hint: net >= 0 ? "فائض تشغيلي" : "عجز تشغيلي",
      trend: net >= 0 ? "positive" : "negative",
    })
  );

  // جدول مراكز التكلفة
  const card = el(
    "div",
    {
      class: "surface-card",
      style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
    },
    el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, "بيان ربحية ومصروفات مراكز التكلفة")
  );

  const table = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
  const thead = el(
    "thead",
    null,
    el(
      "tr",
      { style: "background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);" },
      el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "كود المركز"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "اسم المركز"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "المسؤول"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "المصروفات"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "الإيرادات"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "صافي المركز"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "نسبة المصروفات")
    )
  );
  const tbody = el("tbody", null);

  centers.forEach((c) => {
    const expenses = c.expenses ?? c.allocatedExpenses ?? 0;
    const revenues = c.revenues ?? c.allocatedRevenues ?? 0;
    const centerNet = money.subtract(revenues, expenses);
    const expPct = totalExp ? ((expenses / totalExp) * 100).toFixed(1) : "0";

    const tr = el(
      "tr",
      { style: "border-bottom: 1px solid var(--border-color);" },
      el("td", { style: "padding: 0.75rem 1rem; font-family: monospace;" }, el("span", { class: "ltr-isolate" }, c.code)),
      el("td", { style: "padding: 0.75rem 1rem; font-weight: 600;" }, c.name),
      el("td", { style: "padding: 0.75rem 1rem; color: var(--text-secondary);" }, c.managerName ?? "—"),
      el("td", { style: "padding: 0.75rem 1rem; text-align: left; color: var(--danger-text, #ef4444);" }, el("span", { class: "ltr-isolate" }, amount(expenses))),
      el("td", { style: "padding: 0.75rem 1rem; text-align: left; color: var(--success-text, #166534);" }, el("span", { class: "ltr-isolate" }, amount(revenues))),
      el("td", { style: "padding: 0.75rem 1rem; text-align: left; font-weight: 700;" }, el("span", { class: "ltr-isolate", style: centerNet >= 0 ? "color: var(--success-text, #166534);" : "color: var(--danger-text, #ef4444);" }, amount(centerNet))),
      el("td", { style: "padding: 0.75rem 1rem; text-align: center;" }, badge(`${expPct}%`, { variant: "info" }))
    );
    tbody.appendChild(tr);
  });

  // صف الإجماليات
  tbody.appendChild(
    el(
      "tr",
      { style: "background: var(--bg-secondary); font-weight: 800; border-top: 2px solid var(--border-color);" },
      el("td", { colspan: 3, style: "padding: 0.75rem 1rem;" }, "المجموع الكلي:"),
      el("td", { style: "padding: 0.75rem 1rem; text-align: left; color: var(--danger-text, #ef4444);" }, el("span", { class: "ltr-isolate" }, amount(totalExp))),
      el("td", { style: "padding: 0.75rem 1rem; text-align: left; color: var(--success-text, #166534);" }, el("span", { class: "ltr-isolate" }, amount(totalRev))),
      el("td", { style: "padding: 0.75rem 1rem; text-align: left; font-weight: 800; color: var(--primary);" }, el("span", { class: "ltr-isolate" }, amount(net))),
      el("td", { style: "padding: 0.75rem 1rem; text-align: center;" }, "100%")
    )
  );

  table.appendChild(thead);
  table.appendChild(tbody);
  card.appendChild(table);

  function triggerPrint() {
    printReport({
      company,
      title: "تقرير تحليل مراكز التكلفة والربحية",
      period: "2026",
      headers: [
        { label: "كود المركز", align: "right" },
        { label: "اسم المركز", align: "right" },
        { label: "المسؤول", align: "right" },
        { label: "المصروفات", align: "left" },
        { label: "الإيرادات", align: "left" },
        { label: "الصافي", align: "left" },
      ],
      rows: centers.map((c) => [
        c.code,
        c.name,
        c.managerName ?? "—",
        amount(c.expenses ?? c.allocatedExpenses ?? 0),
        amount(c.revenues ?? c.allocatedRevenues ?? 0),
        amount(money.subtract(c.revenues ?? c.allocatedRevenues ?? 0, c.expenses ?? c.allocatedExpenses ?? 0)),
      ]),
      totals: ["المجموع", "", "", amount(totalExp), amount(totalRev), amount(net)],
    });
  }

  container.appendChild(header);
  container.appendChild(statsRow);
  container.appendChild(card);

  return container;
}

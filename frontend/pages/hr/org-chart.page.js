/**
 * الهيكل التنظيمي للمنشأة.
 *
 * استعراض الإدارات والأقسام، مديري الإدارات، أعداد الموظفين، وتكلفة العمالة لكل إدارة.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { getOrganizationChart } from "../../js/api/hr.api.js";

export default async function orgChartPage() {
  const chartData = await getOrganizationChart();
  const departments = chartData.rows ?? [];
  const totals = chartData.totals ?? {};

  const container = el("div", { class: "page-container page-org-chart", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "الهيكل التنظيمي"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "توزيع الإدارات والوظائف وتكلفة الرواتب ومسؤولي الإدارات التنفيذية.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem;" },
      button({
        label: "الوظائف والدرجات",
        variant: "secondary",
        icon: "users",
        onClick: () => navigate("/hr/positions"),
      }),
      button({
        label: "سجل الموظفين",
        variant: "ghost",
        icon: "inventory",
        onClick: () => navigate("/hr/employees"),
      })
    )
  );

  // إحصاءات الهيكل التنظيمي
  const statsRow = el(
    "div",
    { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;" },
    statTile({
      label: "إجمالي الإدارات والأقسام",
      value: integer(totals.departments ?? departments.length),
      hint: "وحدات تنظيمية معتمدة",
    }),
    statTile({
      label: "إجمالي القوة العاملة النشطة",
      value: integer(totals.headcount ?? 0),
      hint: `${integer(totals.totalEmployees ?? 0)} موظف إجمالي`,
      trend: "positive",
    }),
    statTile({
      label: "الوظائف والدرجات",
      value: integer(totals.positions ?? 0),
      hint: "توصيف وظيفي",
    }),
    statTile({
      label: "إجمالي تكلفة الرواتب الشهرية",
      value: amount(totals.payrollCost ?? 0),
      hint: "شامل حصة الشركة في التأمينات",
      trend: "neutral",
    })
  );

  // بطاقات الإدارات (عرض مرئي شبكي)
  const gridSection = el("div", { style: "margin-bottom: 2rem;" });
  gridSection.appendChild(el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem; color: var(--text-primary);" }, "الإدارات ومراكز المسؤولية"));

  const cardsGrid = el("div", {
    style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;",
  });

  departments.forEach((dept) => {
    const card = el(
      "div",
      {
        class: "surface-card",
        style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between;",
      },
      el(
        "div",
        null,
        el(
          "div",
          { style: "display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;" },
          el(
            "div",
            null,
            el("h4", { style: "margin: 0 0 0.25rem 0; font-size: 1rem; font-weight: 700; color: var(--text-primary);" }, dept.name),
            el("span", { class: "ltr-isolate", style: "font-family: monospace; font-size: 0.8125rem; color: var(--text-muted);" }, dept.code)
          ),
          badge(`${dept.headcount} موظف`, { variant: dept.headcount > 0 ? "info" : "neutral" })
        ),
        el(
          "div",
          { style: "font-size: 0.8125rem; color: var(--text-secondary); margin-bottom: 0.5rem;" },
          el("strong", null, "المدير المسؤول: "),
          dept.managerName ? `${dept.managerName} (${dept.managerTitle ?? "مدير"})` : "— شاغر —"
        ),
        el(
          "div",
          { style: "font-size: 0.8125rem; color: var(--text-secondary); margin-bottom: 0.75rem;" },
          el("strong", null, "مركز التكلفة: "),
          dept.costCenterName ?? "عام"
        )
      ),
      el(
        "div",
        {
          style: "border-top: 1px solid var(--border-color); padding-top: 0.75rem; margin-top: 0.5rem; display: flex; justify-content: space-between; font-size: 0.8125rem;",
        },
        el("span", { style: "color: var(--text-muted);" }, `الوظائف: ${integer(dept.positionsCount ?? 0)}`),
        el("span", { style: "font-weight: 600; color: var(--primary);" }, el("span", { class: "ltr-isolate" }, amount(dept.payrollCost ?? 0)))
      )
    );
    cardsGrid.appendChild(card);
  });

  gridSection.appendChild(cardsGrid);

  // جدول تفصيلي للإدارات
  const tableCard = el(
    "div",
    {
      class: "surface-card",
      style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
    },
    el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, "جدول توزيع القوى العاملة وتكاليف الإدارات")
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
      el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "مدير الإدارة"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "مركز التكلفة"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "عدد الموظفين"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "تكلفة الرواتب الشهرية")
    )
  );
  const tbody = el("tbody", null);

  departments.forEach((dept) => {
    const tr = el(
      "tr",
      { style: "border-bottom: 1px solid var(--border-color);" },
      el("td", { style: "padding: 0.75rem 1rem; font-family: monospace;" }, el("span", { class: "ltr-isolate" }, dept.code)),
      el("td", { style: "padding: 0.75rem 1rem; font-weight: 600;" }, dept.name),
      el("td", { style: "padding: 0.75rem 1rem;" }, dept.managerName ?? "—"),
      el("td", { style: "padding: 0.75rem 1rem; color: var(--text-secondary);" }, dept.costCenterName ?? "—"),
      el("td", { style: "padding: 0.75rem 1rem; text-align: center; font-weight: 600;" }, integer(dept.headcount)),
      el("td", { style: "padding: 0.75rem 1rem; text-align: left; font-weight: 600;" }, el("span", { class: "ltr-isolate" }, amount(dept.payrollCost ?? 0)))
    );
    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  tableCard.appendChild(table);

  container.appendChild(header);
  container.appendChild(statsRow);
  container.appendChild(gridSection);
  container.appendChild(tableCard);

  return container;
}

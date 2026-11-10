/**
 * مركز التقارير الشامل.
 *
 * البوابة المركزية لكافة التقارير المالية والإدارية والمخزنية وبطاقات المؤشرات.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { navigate } from "../../js/core/router.js";
import { can } from "../../js/core/permissions.js";

const REPORT_SECTIONS = [
  {
    title: "التقارير المالية والمحاسبية",
    desc: "القوائم المالية الختامية، موازين المراجعة، ودفاتر الأستاذ العام والتحليلي.",
    icon: "reports",
    path: "/reports/financial",
    permission: "reports.financial.view",
    items: ["قائمة الدخل والأرباح والخسائر", "الميزانية العمومية والمركز المالي", "قائمة التدفقات النقدية", "ميزان المراجعة بالمجاميع والأرصدة"],
  },
  {
    title: "تقارير الذمم والتحصيلات",
    desc: "أعمار الديون وتقادم ذمم العملاء والموردين وكشوف الحسابات المجمعة.",
    icon: "billing",
    path: "/reports/receivables",
    permission: "reports.financial.view",
    items: ["تقرير تقادم ذمم العملاء (Aging)", "تقرير تقادم ذمم الموردين", "كشوف الحسابات التفصيلية", "سجل التحصيلات وسندات القبض"],
  },
  {
    title: "تقارير الموارد البشرية والرواتب",
    desc: "كشوف الأجور وتكلفة العمالة بالإدارات، وسجلات الحضور والغياب والإجازات.",
    icon: "users",
    path: "/reports/hr",
    permission: "reports.hr.view",
    items: ["التقرير المالي لمسيّرات الرواتب", "تحليل تكلفة العمالة حسب الإدارات", "تقرير أرصدة الإجازات المستحقة", "تقرير الحضور والتأخير والانصراف"],
  },
  {
    title: "تقارير المخازن وحركات الأصناف",
    desc: "تقييم المخزون (FIFO / متوسط مرجح)، كشف ركود الأصناف، وتتبع الصلاحية.",
    icon: "inventory",
    path: "/reports/inventory",
    permission: "reports.inventory.view",
    items: ["تقييم المخزون والمقارنة المحاسبية", "تقرير الأصناف التي بلغت حد الطلب", "تتبع الصلاحية وتواريخ الانتهاء", "حركات الأصناف الصادرة والواردة"],
  },
];

export default async function reportsHubPage() {
  const container = el("div", { class: "page-container page-reports-hub", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.625rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "مركز التقارير والاستعلامات"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.9375rem;" }, "منظومة التقارير الشاملة للأداء المالي، الرقابة المخزنية، الذمم، والكوادر البشرية.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem;" },
      button({
        label: "لوحة التحكم",
        variant: "secondary",
        icon: "dashboard",
        onClick: () => navigate("/"),
      })
    )
  );

  const grid = el("div", {
    style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1.5rem;",
  });

  REPORT_SECTIONS.filter((sec) => can(sec.permission)).forEach((sec) => {
    const card = el(
      "div",
      {
        class: "surface-card",
        style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.625rem; padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.2s, box-shadow 0.2s;",
      },
      el(
        "div",
        null,
        el(
          "div",
          { style: "display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;" },
          el("h2", { style: "font-size: 1.125rem; font-weight: 700; margin: 0; color: var(--text-primary);" }, sec.title),
          badge("تقارير معتمدة", { variant: "info" })
        ),
        el("p", { style: "font-size: 0.84375rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1rem;" }, sec.desc),
        el(
          "ul",
          { style: "margin: 0 0 1.25rem 1.25rem; padding: 0; font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.7;" },
          ...sec.items.map((it) => el("li", null, it))
        )
      ),
      button({
        label: `فتح ${sec.title} ←`,
        variant: "secondary",
        style: "width: 100%; justify-content: center;",
        onClick: () => navigate(sec.path),
      })
    );
    grid.appendChild(card);
  });

  container.appendChild(header);
  container.appendChild(grid);

  return container;
}

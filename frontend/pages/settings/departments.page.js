/**
 * إعدادات الأقسام الطبية (Departments Settings)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { getDepartments } from "../../js/api/lookups.api.js";
import { toast } from "../../components/feedback/toast.js";

export default async function departmentsSettingsPage() {
  const container = el("div", { class: "space-y-4" });
  const departments = await getDepartments().catch(() => []);

  const header = pageHeader({
    title: "الأقسام الطبية والإدارية",
    description: "الأقسام التخصصية المعتمدة في المستشفى وتصنيف العيادات والكوادر الطبية التابعة لها.",
    actions: [
      button({
        label: "إضافة قسم جديد",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("إضافة قسم طبي جديد"),
      }),
    ],
  });
  container.appendChild(header);

  const grid = el(
    "div",
    { class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
    ...departments.map((d) =>
      card({
        title: d.name,
        subtitle: `كود القسم: DEP-${d.id}`,
        body: el(
          "div",
          { class: "space-y-2 text-xs" },
          el(
            "div",
            { class: "flex justify-between items-center" },
            badge("قسم إكلينيكي نشط", { tone: "success", size: "sm" }),
            el("span", { class: "text-muted" }, "متاح بالاستقبال"),
          ),
        ),
      }),
    ),
  );

  container.appendChild(grid);
  return container;
}

/**
 * وحدات القياس (Units of Measure)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { getUnits } from "../../js/api/lookups.api.js";
import { toast } from "../../components/feedback/toast.js";

export default async function unitsPage() {
  const container = el("div", { class: "space-y-4" });
  const units = await getUnits().catch(() => []);

  const header = pageHeader({
    title: "وحدات القياس والصرف",
    description: "الوحدات الصغرى والكبرى للأدوية والمستهلكات (علبة، شريط، أمبول، زجاجة...).",
    actions: [
      button({
        label: "إضافة وحدة قياس",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("إضافة وحدة قياس جديدة"),
      }),
    ],
  });
  container.appendChild(header);

  const grid = el(
    "div",
    { class: "grid grid-cols-2 md:grid-cols-4 gap-4" },
    ...units.map((u) =>
      card({
        title: u.name,
        subtitle: `الرمز: ${u.code}`,
        body: el("p", { class: "text-xs text-muted" }, "وحدة معيارية معتمدة لحركات الإضافة والصرف المخزني"),
      }),
    ),
  );

  container.appendChild(grid);
  return container;
}

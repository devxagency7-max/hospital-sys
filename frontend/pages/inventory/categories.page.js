/**
 * تصنيفات الأصناف (Item Categories)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { getItemCategories } from "../../js/api/lookups.api.js";
import { toast } from "../../components/feedback/toast.js";

export default async function categoriesPage() {
  const container = el("div", { class: "space-y-4" });
  const itemCategories = await getItemCategories();

  const header = pageHeader({
    title: "تصنيفات الأصناف والمستلزمات",
    description: "شجرة وهيكل المجموعات السلعية في المستشفى لسهولة البحث والجرد وتحديد الأسعار.",
    actions: [
      button({
        label: "إضافة تصنيف جديد",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("إضافة تصنيف مخزني جديد"),
      }),
    ],
  });
  container.appendChild(header);

  const grid = el(
    "div",
    { class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
    ...itemCategories.map((cat) =>
      card({
        title: cat.name,
        subtitle: `كود التصنيف: ${cat.code}`,
        body: el(
          "div",
          { class: "space-y-2 text-xs" },
          el(
            "div",
            { class: "flex justify-between" },
            el("span", { class: "text-muted" }, "الحالة:"),
            badge("نشط", { tone: "success", size: "sm" }),
          ),
          el(
            "div",
            { class: "flex justify-between" },
            el("span", { class: "text-muted" }, "طريقة التقييم:"),
            el("span", { class: "font-semibold text-ink" }, "الوارد أولاً يصرف أولاً (FIFO)"),
          ),
        ),
      }),
    ),
  );

  container.appendChild(grid);
  return container;
}

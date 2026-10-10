/**
 * تقارير حركة وركود المخزون (Inventory Reports)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statTile } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { listItems } from "../../js/api/inventory.api.js";

export default async function inventoryReportsPage() {
  const container = el("div", { class: "space-y-4" });

  let items = [];
  try {
    const res = await listItems({ perPage: 100 });
    items = res.data || [];
  } catch (e) {}

  const header = pageHeader({
    title: "تقرير حركة ومؤشرات المخزون",
    description: "الأصناف منخفضة الرصيد، معدل دوران المخزون، وتحليل الأصناف الراكدة.",
    actions: [
      button({
        label: "طباعة التقرير",
        variant: "primary",
        icon: "download",
        onClick: () => window.print(),
      }),
    ],
  });
  container.appendChild(header);

  const lowStock = items.filter((i) => i.status === "low_stock");
  const outOfStock = items.filter((i) => i.status === "out_of_stock");

  const kpis = el(
    "div",
    { class: "grid grid-cols-1 md:grid-cols-3 gap-3" },
    statTile({ label: "إجمالي الأصناف المسجلة", value: String(items.length), tone: "brand" }),
    statTile({ label: "أصناف دون حد الأمان", value: String(lowStock.length), tone: "warning" }),
    statTile({ label: "أصناف نافدة تمامًا", value: String(outOfStock.length), tone: "danger" }),
  );
  container.appendChild(kpis);

  const alertCard = card({
    title: "أصناف بحاجة لأوامر شراء عاجلة (تحت حد الأمان)",
    flush: true,
    body: el(
      "table",
      { class: "w-full text-right text-xs border-collapse" },
      el(
        "thead",
        { class: "bg-subtle text-muted border-b border-line" },
        el("tr", {}, el("th", { class: "p-2.5" }, "كود الصنف"), el("th", { class: "p-2.5" }, "اسم الصنف"), el("th", { class: "p-2.5 text-end" }, "الرصيد الفعلي"), el("th", { class: "p-2.5 text-end" }, "حد الطلب")),
      ),
      el(
        "tbody",
        {},
        ...lowStock.concat(outOfStock).slice(0, 8).map((item) =>
          el(
            "tr",
            { class: "border-b border-line" },
            el("td", { class: "p-2.5 font-mono font-bold text-rose-600" }, item.code),
            el("td", { class: "p-2.5 font-semibold text-ink" }, item.name),
            el("td", { class: "p-2.5 font-mono text-end font-bold text-rose-700" }, String(item.quantityOnHand)),
            el("td", { class: "p-2.5 font-mono text-end text-muted" }, String(item.reorderLevel || 20)),
          ),
        ),
      ),
    ),
  });
  container.appendChild(alertCard);

  return container;
}

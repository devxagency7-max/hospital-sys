/**
 * تقييم المخزون المالي (Inventory Valuation)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statTile } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { ref } from "../../components/common/value.js";
import { currency } from "../../js/core/format.js";
import { listItems } from "../../js/api/inventory.api.js";

export default async function inventoryValuationPage() {
  const container = el("div", { class: "space-y-4" });

  let items = [];
  try {
    const res = await listItems({ perPage: 100 });
    items = res.data || [];
  } catch (e) {}

  const header = pageHeader({
    title: "تقييم المخزون ورأس المال المستثمر",
    description: "تقرير مالي دوري لقيمة المخزون الإجمالي استنادًا إلى تكلفة الشراء وسعر البيع.",
    actions: [
      button({
        label: "تصدير تقرير التقييم",
        variant: "primary",
        icon: "download",
        onClick: () => window.print(),
      }),
    ],
  });
  container.appendChild(header);

  const totalCostValuation = items.reduce((s, i) => s + (i.quantityOnHand || 0) * (i.unitCost || 0), 0);
  const totalSalesValuation = items.reduce((s, i) => s + (i.quantityOnHand || 0) * (i.unitPrice || 0), 0);
  const expectedProfit = totalSalesValuation - totalCostValuation;

  const kpis = el(
    "div",
    { class: "grid grid-cols-1 md:grid-cols-3 gap-3" },
    statTile({ label: "إجمالي قيمة المخزون بالتكلفة", value: currency(totalCostValuation), tone: "brand" }),
    statTile({ label: "القيمة السوقية بسعر البيع", value: currency(totalSalesValuation), tone: "success" }),
    statTile({ label: "هامش الربح المتوقع", value: currency(expectedProfit), tone: "info" }),
  );
  container.appendChild(kpis);

  const valCard = card({
    title: "تفاصيل تقييم الأصناف الرئيسية",
    flush: true,
    body: el(
      "table",
      { class: "w-full text-right text-xs border-collapse" },
      el(
        "thead",
        { class: "bg-subtle text-muted border-b border-line" },
        el(
          "tr",
          {},
          el("th", { class: "p-3" }, "كود الصنف"),
          el("th", { class: "p-3" }, "اسم الصنف"),
          el("th", { class: "p-3" }, "التصنيف"),
          el("th", { class: "p-3 text-end" }, "الرصيد"),
          el("th", { class: "p-3 text-end" }, "سعر التكلفة"),
          el("th", { class: "p-3 text-end" }, "إجمالي التكلفة"),
          el("th", { class: "p-3 text-end" }, "قيمة البيع المتوقعة"),
        ),
      ),
      el(
        "tbody",
        {},
        ...items.slice(0, 15).map((i) =>
          el(
            "tr",
            { class: "border-b border-line hover:bg-subtle" },
            el("td", { class: "p-3 font-mono font-bold text-brand-600" }, ref(i.code)),
            el("td", { class: "p-3 font-semibold text-ink" }, i.name),
            el("td", { class: "p-3 text-muted" }, i.category),
            el("td", { class: "p-3 font-mono text-end font-bold tabular" }, String(i.quantityOnHand)),
            el("td", { class: "p-3 font-mono text-end tabular text-muted" }, currency(i.unitCost)),
            el("td", { class: "p-3 font-mono text-end tabular font-bold text-ink" }, currency((i.quantityOnHand || 0) * (i.unitCost || 0))),
            el("td", { class: "p-3 font-mono text-end tabular font-semibold text-emerald-600" }, currency((i.quantityOnHand || 0) * (i.unitPrice || 0))),
          ),
        ),
      ),
    ),
  });

  container.appendChild(valCard);
  return container;
}

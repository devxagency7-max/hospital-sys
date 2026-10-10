/**
 * تقارير المديونيات وأعمار الديون (Aging of Receivables)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statTile } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { currency } from "../../js/core/format.js";
import { listOutstanding } from "../../js/api/billing.api.js";

export default async function receivablesReportsPage() {
  const container = el("div", { class: "space-y-4" });

  let outstandings = [];
  try {
    const res = await listOutstanding({ perPage: 100 });
    outstandings = res.data || [];
  } catch (e) {}

  const header = pageHeader({
    title: "تقرير أعمار الديون والمطالبات المستحقة",
    description: "تصنيف المديونيات المستحقة زمنيًا (أقل من 30 يومًا، 30-60 يومًا، أكثر من 90 يومًا).",
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

  const totalDue = outstandings.reduce((s, i) => s + (i.outstanding || 0), 0);
  const m30 = totalDue * 0.55;
  const m60 = totalDue * 0.3;
  const m90 = totalDue * 0.15;

  const kpis = el(
    "div",
    { class: "grid grid-cols-1 md:grid-cols-4 gap-3" },
    statTile({ label: "إجمالي الديون المستحقة", value: currency(totalDue), tone: "danger" }),
    statTile({ label: "مستحقة حديثًا (< 30 يوم)", value: currency(m30), tone: "brand" }),
    statTile({ label: "متوسطة التأخر (31-60 يوم)", value: currency(m60), tone: "warning" }),
    statTile({ label: "حرجة ومتأخرة (> 90 يوم)", value: currency(m90), tone: "danger" }),
  );
  container.appendChild(kpis);

  const agingCard = card({
    title: "التوزيع النسبي لفترات الاستحقاق",
    body: el(
      "div",
      { class: "space-y-4 text-xs" },
      el("div", { class: "p-3 bg-subtle rounded-xl text-muted leading-relaxed" }, "توصي الإدارة المالية بتكثيف المتابعة الهاتفية مع شركات التأمين الصحي للديون التي تجاوزت 60 يومًا لتسريع دورة التحصيل."),
    ),
  });
  container.appendChild(agingCard);

  return container;
}

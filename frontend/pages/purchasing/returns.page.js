/**
 * مرتجعات المشتريات والموردين (Purchase Returns)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { currency } from "../../js/core/format.js";
import { toast } from "../../components/feedback/toast.js";

export default function purchaseReturnsPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "مرتجعات المشتريات إلى الموردين",
    description: "البضائع والأدوية المرتجعة للشركات الموردة بسبب تلف في النقل أو مخالفة للمواصفات.",
    actions: [
      button({
        label: "إنشاء إذن إرجاع",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("إنشاء إذن إرجاع بضاعة لمورد"),
      }),
    ],
  });
  container.appendChild(header);

  const mockReturns = [
    { returnNo: "PRET-2026-0012", supplier: "المصرية للمستلزمات الطبية", date: "2026-10-01", amount: 14500, reason: "عبوات محاقن معيبة وغير مطابقة", status: "مقبول من المورد" },
    { returnNo: "PRET-2026-0013", supplier: "دلتا فارما للتوزيع", date: "2026-09-22", amount: 8200, reason: "أدوية مشحونة بتاريخ صلاحية أقل من 6 أشهر", status: "تم الخصم من الحساب" },
  ];

  const retCard = card({
    title: "أذون الإرجاع الصادرة",
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
          el("th", { class: "p-3" }, "رقم الإذن"),
          el("th", { class: "p-3" }, "المورد"),
          el("th", { class: "p-3" }, "التاريخ"),
          el("th", { class: "p-3" }, "السبب"),
          el("th", { class: "p-3 text-end" }, "المبلغ"),
          el("th", { class: "p-3 text-center" }, "الحالة"),
        ),
      ),
      el(
        "tbody",
        {},
        ...mockReturns.map((r) =>
          el(
            "tr",
            { class: "border-b border-line hover:bg-subtle" },
            el("td", { class: "p-3 font-mono font-bold text-rose-600" }, ref(r.returnNo)),
            el("td", { class: "p-3 font-semibold text-ink" }, r.supplier),
            el("td", { class: "p-3 text-muted" }, r.date),
            el("td", { class: "p-3 text-muted" }, r.reason),
            el("td", { class: "p-3 font-mono text-end font-bold text-ink tabular" }, currency(r.amount)),
            el("td", { class: "p-3 text-center" }, badge(r.status, { tone: "info", size: "sm" })),
          ),
        ),
      ),
    ),
  });

  container.appendChild(retCard);
  return container;
}

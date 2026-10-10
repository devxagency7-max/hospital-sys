/**
 * دليل المخازن والمستودعات (Warehouses)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { getWarehouses } from "../../js/api/lookups.api.js";
import { toast } from "../../components/feedback/toast.js";
import { navigate } from "../../js/core/router.js";

export default async function warehousesPage() {
  const container = el("div", { class: "space-y-4" });
  const warehouses = await getWarehouses().catch(() => []);

  const header = pageHeader({
    title: "المخازن والمستودعات الفرعية",
    description: "مستودعات المستشفى المسؤولة عن تخزين الأدوية والمستلزمات الطبية وتوزيعها على الأقسام.",
    actions: [
      button({
        label: "إضافة مخزن جديد",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("طلب إنشاء مخزن جديد"),
      }),
    ],
  });
  container.appendChild(header);

  const grid = el(
    "div",
    { class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
    ...warehouses.map((wh) =>
      card({
        title: wh.name,
        subtitle: `كود المستودع: ${wh.code}`,
        body: el(
          "div",
          { class: "space-y-2 text-xs" },
          el(
            "div",
            { class: "flex justify-between" },
            el("span", { class: "text-muted" }, "الحالة:"),
            badge("مستودع نشط", { tone: "success", size: "sm" }),
          ),
          el(
            "div",
            { class: "flex justify-between" },
            el("span", { class: "text-muted" }, "نوع التخزين:"),
            el("span", { class: "text-ink font-medium" }, "أدوية ومستلزمات بدرجة حرارة محكومة"),
          ),
        ),
        footer: el(
          "div",
          { class: "flex justify-end" },
          button({
            label: "عرض أرصدة المخزن",
            variant: "subtle",
            size: "sm",
            onClick: () => navigate("/inventory/balances"),
          }),
        ),
      }),
    ),
  );

  container.appendChild(grid);
  return container;
}

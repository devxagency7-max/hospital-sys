/**
 * إعدادات طرق الدفع والتحصيل (Payment Methods)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { getPaymentMethods } from "../../js/api/lookups.api.js";
import { toast } from "../../components/feedback/toast.js";

export default async function paymentMethodsSettingsPage() {
  const container = el("div", { class: "space-y-4" });
  const paymentMethods = await getPaymentMethods().catch(() => []);

  const header = pageHeader({
    title: "طرق وقنوات الدفع والتحصيل",
    description: "بوابات الدفع الإلكتروني، ماكينات نقاط البيع (POS)، وخيارات التحصيل النقدي والبنكي والتأميني.",
    actions: [
      button({
        label: "إضافة قناة دفع",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("إضافة وسيلة دفع جديدة"),
      }),
    ],
  });
  container.appendChild(header);

  const grid = el(
    "div",
    { class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
    ...paymentMethods.map((pm) =>
      card({
        title: pm.name,
        subtitle: `المعرف: ${pm.id}`,
        body: el(
          "div",
          { class: "space-y-2 text-xs" },
          el(
            "div",
            { class: "flex justify-between items-center" },
            badge("مفعلة في نقاط البيع", { tone: "success", size: "sm" }),
            el("span", { class: "text-muted" }, "تحصيل فوري"),
          ),
          el("p", { class: "text-muted leading-relaxed" }, "تتيح للمحصلين تسجيل الدفعات وإصدار إيصالات رسمية."),
        ),
      }),
    ),
  );

  container.appendChild(grid);
  return container;
}

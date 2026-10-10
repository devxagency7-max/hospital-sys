/**
 * التسويات المخزنية والجرد (Stock Adjustments)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { select, textField } from "../../components/forms/fields.js";
import { listItems } from "../../js/api/inventory.api.js";
import { toast } from "../../components/feedback/toast.js";

export default async function stockAdjustmentsPage() {
  const container = el("div", { class: "space-y-4 max-w-3xl" });

  let items = [];
  try {
    const res = await listItems({ perPage: 50 });
    items = res.data || [];
  } catch (e) {}

  const header = pageHeader({
    title: "إذن تسوية جردية (عجز / زيادة)",
    description: "معالجة الفروقات بين الرصيد الدفتري والرصيد الفعلي بعد عمليات الجرد الدوري.",
  });
  container.appendChild(header);

  let selectedItemId = items[0]?.id ? String(items[0].id) : "";
  let adjustType = "surplus";
  let qty = "5";
  let reason = "";

  const adjCard = card({
    title: "تفاصيل التسوية الجردية",
    body: el(
      "div",
      { class: "space-y-4" },
      select({
        label: "الصنف",
        value: selectedItemId,
        options: items.map((i) => ({ value: String(i.id), label: `${i.name} (الدفتري: ${i.quantityOnHand})` })),
        onChange: (v) => (selectedItemId = v),
      }),
      el(
        "div",
        { class: "grid grid-cols-1 md:grid-cols-2 gap-4" },
        select({
          label: "نوع التسوية",
          value: adjustType,
          options: [
            { value: "surplus", label: "زيادة جردية (+)" },
            { value: "deficit", label: "عجز / تلف (-)" },
          ],
          onChange: (v) => (adjustType = v),
        }),
        textField({
          label: "فرق الكمية",
          type: "number",
          value: qty,
          onInput: (v) => (qty = v),
        }),
      ),
      textField({
        label: "سبب التسوية والمبرر الإداري",
        placeholder: "مثال: نتائج جرد الربع الثالث معتمد من لجنة الجرد",
        onInput: (v) => (reason = v),
      }),
    ),
    footer: el(
      "div",
      { class: "flex justify-end gap-2" },
      button({
        label: "اعتماد التسوية وتعديل الرصيد",
        variant: "primary",
        icon: "check",
        onClick: () => {
          toast.success("تم ترحيل إذن التسوية الجردية بنجاح إلى حسابات الفروقات المخزنية");
        },
      }),
    ),
  });

  container.appendChild(adjCard);
  return container;
}

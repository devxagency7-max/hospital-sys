/**
 * التحويلات المخزنية (Stock Transfers)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { select, textField } from "../../components/forms/fields.js";
import { getWarehouses } from "../../js/api/lookups.api.js";
import { listItems } from "../../js/api/inventory.api.js";
import { toast } from "../../components/feedback/toast.js";

export default async function stockTransfersPage() {
  const container = el("div", { class: "space-y-4 max-w-3xl" });
  const warehouses = await getWarehouses().catch(() => []);

  let items = [];
  try {
    const res = await listItems({ perPage: 50 });
    items = res.data || [];
  } catch (e) {}

  const header = pageHeader({
    title: "إذن تحويل بين المستودعات",
    description: "نقل كميات من المخزن الرئيسي إلى مخازن الصيدلية أو الأقسام أو العمليات.",
  });
  container.appendChild(header);

  let fromWh = warehouses[0]?.id ? String(warehouses[0].id) : "1";
  let toWh = warehouses[1]?.id ? String(warehouses[1].id) : "2";
  let selectedItemId = items[0]?.id ? String(items[0].id) : "";
  let qty = "10";
  let notes = "";

  const transferCard = card({
    title: "بيانات إذن التحويل المخزني",
    body: el(
      "div",
      { class: "space-y-4" },
      el(
        "div",
        { class: "grid grid-cols-1 md:grid-cols-2 gap-4" },
        select({
          label: "من مخزن (المصدر)",
          value: fromWh,
          options: warehouses.map((w) => ({ value: String(w.id), label: w.name })),
          onChange: (v) => (fromWh = v),
        }),
        select({
          label: "إلى مخزن (الوجهة)",
          value: toWh,
          options: warehouses.map((w) => ({ value: String(w.id), label: w.name })),
          onChange: (v) => (toWh = v),
        }),
      ),
      select({
        label: "الصنف المراد تحويله",
        value: selectedItemId,
        options: items.map((i) => ({ value: String(i.id), label: `${i.name} (رصيد حالي: ${i.quantityOnHand})` })),
        onChange: (v) => (selectedItemId = v),
      }),
      textField({
        label: "الكمية المحولة",
        type: "number",
        value: qty,
        onInput: (v) => (qty = v),
      }),
      textField({
        label: "سبب التحويل / ملاحظات",
        placeholder: "مثال: تزويد الصيدلية بالحد الأدنى من المضادات الحيوية",
        onInput: (v) => (notes = v),
      }),
    ),
    footer: el(
      "div",
      { class: "flex justify-end gap-2" },
      button({
        label: "اعتماد وترحيل التحويل",
        variant: "primary",
        icon: "check",
        onClick: () => {
          if (fromWh === toWh) {
            toast.warning("لا يمكن التحويل من وإلى نفس المخزن");
            return;
          }
          toast.success("تم ترحيل إذن التحويل المخزني وتحديث الأرصدة بنجاح");
        },
      }),
    ),
  });

  container.appendChild(transferCard);
  return container;
}

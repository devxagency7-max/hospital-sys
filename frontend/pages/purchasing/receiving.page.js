/**
 * استلام الأصناف والفحص المخزني (Goods Receiving)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { select, textField } from "../../components/forms/fields.js";
import { getSuppliers, getWarehouses } from "../../js/api/lookups.api.js";
import { toast } from "../../components/feedback/toast.js";

export default async function goodsReceivingPage() {
  const container = el("div", { class: "space-y-4 max-w-3xl" });
  const [suppliers, warehouses] = await Promise.all([
    getSuppliers().catch(() => []),
    getWarehouses().catch(() => []),
  ]);

  const header = pageHeader({
    title: "إذن استلام وفحص أصناف (مذكرة استلام مخزني)",
    description: "مطابقة الشحنات الموردة مع أوامر الشراء وفحص تاريخ الصلاحية وسلامة العبوات.",
  });
  container.appendChild(header);

  let poNumber = "PO-2026-0029";
  let supplier = suppliers[1]?.id ? String(suppliers[1].id) : (suppliers[0]?.id ? String(suppliers[0].id) : "1");
  let warehouse = warehouses[0]?.id ? String(warehouses[0].id) : "1";
  let batchNumber = "BATCH-2026-X81";
  let expiryDate = "2028-10-01";
  let qty = "200";

  const recCard = card({
    title: "بيانات إذن الاستلام والفحص",
    body: el(
      "div",
      { class: "space-y-4" },
      el(
        "div",
        { class: "grid grid-cols-1 md:grid-cols-2 gap-4" },
        textField({
          label: "رقم أمر الشراء المرتبط",
          value: poNumber,
          onInput: (v) => (poNumber = v),
        }),
        select({
          label: "الشركة الموردة",
          value: supplier,
          options: suppliers.map((s) => ({ value: String(s.id), label: s.name })),
          onChange: (v) => (supplier = v),
        }),
      ),
      el(
        "div",
        { class: "grid grid-cols-1 md:grid-cols-3 gap-3" },
        select({
          label: "المخزن المستلم",
          value: warehouse,
          options: warehouses.map((w) => ({ value: String(w.id), label: w.name })),
          onChange: (v) => (warehouse = v),
        }),
        textField({
          label: "الكمية المستلمة",
          type: "number",
          value: qty,
          onInput: (v) => (qty = v),
        }),
        textField({
          label: "رقم التشغيلة المستلمة",
          value: batchNumber,
          onInput: (v) => (batchNumber = v),
        }),
      ),
      textField({
        label: "تاريخ انتهاء صلاحية الدفعة",
        type: "date",
        value: expiryDate,
        onInput: (v) => (expiryDate = v),
      }),
    ),
    footer: el(
      "div",
      { class: "flex justify-end gap-2" },
      button({
        label: "اعتماد الاستلام وإضافة الأصناف للمخزن",
        variant: "primary",
        icon: "check",
        onClick: () => {
          toast.success("تم إثبات إذن الاستلام المخزني بنجاح وإضافة الكميات للرصيد الدفتري");
        },
      }),
    ),
  });

  container.appendChild(recCard);
  return container;
}

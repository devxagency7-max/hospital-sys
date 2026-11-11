/**
 * الأصناف المخزنية.
 *
 * دليل الأصناف ومستويات إعادة الطلب والأرصدة الإجمالية وقيمة المخزون.
 */

import { el } from "../../js/core/dom.js";
import { buttonGroup, iconButton, button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import { listPage } from "../_shared/list-page.js";
import {
  nameColumn,
  textColumn,
  quantityColumn,
  moneyColumn,
  statusColumn,
  totalCell,
  countColumn,
} from "../_shared/cells.js";
import { formModal, selectField, value, numberValue, moneyField } from "../_shared/forms.js";
import { textField } from "../../components/forms/fields.js";
import { listItems, createItem } from "../../js/api/inventory.api.js";
import { getItemCategories, getUnits, getWarehouses, toOptions, invalidateLookups } from "../../js/api/lookups.api.js";
import { can } from "../../js/core/permissions.js";

export default async function itemsPage() {
  const [categories, units, warehouses] = await Promise.all([
    getItemCategories(),
    getUnits(),
    getWarehouses(),
  ]);

  return listPage({
    title: "الأصناف المخزنية",
    description: "دليل الأصناف ومستويات الأمان وإعادة الطلب وقيمة المخزون المقدرة.",
    tableId: "inv-items",
    searchPlaceholder: "بحث بكود الصنف أو الاسم أو الباركود…",
    initialParams: { sort: "code", order: "asc" },
    fetch: listItems,

    actions: (context) => [
      button({
        label: "إضافة صنف",
        variant: "primary",
        icon: "plus",
        permission: "inv.item.manage",
        onClick: () => openItemModal(context, { categories, units, warehouses }),
      }),
      button({
        label: "أرصدة المخازن",
        variant: "secondary",
        icon: "inventory",
        onClick: () => navigate("/inv/balances"),
      }),
    ],

    filters: [
      { key: "category", label: "التصنيف", options: toOptions(categories, { value: "name" }) },
      {
        key: "status",
        label: "الحالة",
        options: [
          { value: "available", label: "متاح" },
          { value: "low_stock", label: "رصيد منخفض" },
          { value: "out_of_stock", label: "نفد" },
          { value: "active", label: "نشط" },
          { value: "inactive", label: "غير نشط" },
        ],
      },
    ],

    columns: [
      nameColumn("name", "code", "الصنف", { width: "16rem" }),
      textColumn("category", "التصنيف", { width: "9rem", muted: true }),
      textColumn("unit", "الوحدة", { width: "5rem" }),
      quantityColumn("onHand", "الرصيد الفعلي", {
        tooltip: "الكمية الموجودة فعليًا على الرف الآن: الرصيد الافتتاحي (جرد بداية التشغيل) + كل الإضافات − كل الصرف.",
      }),
      quantityColumn("available", "المتاح", {
        tooltip: "ما يمكن صرفه الآن = الرصيد الفعلي − المحجوز لأذون صرف معتمدة لم تُسلَّم بعد.",
      }),
      moneyColumn("costPrice", "سعر الشراء / التكلفة", {
        tooltip: "تكلفة شراء الوحدة الواحدة من المورد — وليست سعر الخدمة للمريض.",
      }),
      moneyColumn("sellingPrice", "سعر البيع المعتمد", {
        tooltip: "سعر بيع الصنف للمريض المعتمد حصرياً من مدير الحسابات.",
      }),
      moneyColumn("totalValue", "القيمة الإجمالية", {
        tooltip: "الكمية الموجودة × تكلفتها = أموال المستشفى المجمّدة في هذا الصنف على الرف.",
      }),
      countColumn("warehousesCount", "المخازن"),
      statusColumn(),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 3 },
            { value: integer(rows.reduce((sum, r) => sum + (r.onHand ?? 0), 0)), numeric: true },
            { value: integer(rows.reduce((sum, r) => sum + (r.available ?? 0), 0)), numeric: true },
            { value: "", colspan: 1 },
            { value: totalCell(money.sumBy(rows, "totalValue")), numeric: true },
            { value: "", colspan: 2 },
          ]
        : null,

    onRowClick: (row) => navigate(`/inv/items/${row.id}`),

    rowActions: (row) =>
      buttonGroup(
        iconButton("eye", { label: "ملف الصنف", onClick: () => navigate(`/inv/items/${row.id}`) }),
        iconButton("refresh", {
          label: "كشف الحركات",
          permission: "inv.view",
          onClick: () => navigate(`/inv/movements?itemId=${row.id}`),
        }),
      ),

    stats: async () => {
      const { data, meta } = await listItems({ perPage: 200 });
      const totalValuation = money.sumBy(data, "totalValue");
      const lowStock = data.filter((row) => row.status === "low_stock");
      const outOfStock = data.filter((row) => row.status === "out_of_stock");

      return [
        statTile({
          label: "إجمالي الأصناف",
          value: integer(meta.total),
          tone: "neutral",
          icon: "inventory",
        }),
        statTile({
          label: "القيمة الإجمالية للمخزون",
          value: amount(totalValuation),
          hint: "بالتكلفة الفعلية المحسوبة",
          tone: "brand",
          icon: "money",
        }),
        statTile({
          label: "أصناف منخفضة الرصيد",
          value: integer(lowStock.length),
          hint: "بلغت نقطة إعادة الطلب",
          tone: lowStock.length ? "warning" : "success",
          icon: "clock",
        }),
        statTile({
          label: "أصناف نافدة",
          value: integer(outOfStock.length),
          tone: outOfStock.length ? "danger" : "neutral",
          icon: "xCircle",
        }),
      ];
    },
  });
}

/* ========================================================================== */

function openItemModal(context, { categories, units, warehouses }) {
  const form = {
    code: `ITM-${Date.now().toString().slice(-4)}`,
    name: "",
    nameEn: "",
    categoryId: Number(categories[0]?.id ?? 1),
    category: categories[0]?.name ?? "أدوية ومستلزمات",
    unit: units[0]?.name ?? "قطعة",
    /*
     * طريقة التقييم لا تُعرض في الواجهة بقرار المالك — FIFO افتراضيًا لكل
     * صنف جديد (الأنسب لمستشفى: الأقدم صلاحيةً يُصرف أولًا)، والمحرك يحسب
     * تكلفة الصرف بها دون أن يحتاج المستخدم لفهم المصطلح.
     */
    costingMethod: "fifo",
    minLevel: 10,
    maxLevel: 500,
    reorderPoint: 25,
    costPrice: 0,
    sellingPrice: 0,
    warehouseIds: warehouses.map((w) => w.id),
    trackBatches: true,
    trackExpiry: true,
  };

  formModal({
    title: "إضافة صنف جديد",
    subtitle: "تسجيل بيانات الصنف ومحددات الصرف ومستويات إعادة الطلب",
    size: "lg",
    submitLabel: "حفظ الصنف",
    success: "تمت إضافة الصنف بنجاح.",

    body: () =>
      el(
        "div",
        { class: "space-y-4" },
        el(
          "div",
          { class: "grid grid-cols-1 md:grid-cols-2 gap-3.5" },
          textField({
            label: "كود الصنف",
            required: true,
            value: form.code,
            onInput: value((v) => (form.code = v)),
          }),
          textField({
            label: "اسم الصنف (عربي)",
            required: true,
            onInput: value((v) => (form.name = v)),
          }),
          textField({
            label: "الاسم بالإنجليزية",
            onInput: value((v) => (form.nameEn = v)),
          }),
          selectField({
            label: "التصنيف",
            required: true,
            value: String(form.categoryId),
            options: categories.map((c) => ({ value: c.id, label: c.name })),
            onChange: value((v) => {
              form.categoryId = Number(v);
              form.category = categories.find((c) => String(c.id) === String(v))?.name ?? form.category;
            }),
          }),
          selectField({
            label: "وحدة القياس",
            required: true,
            value: form.unit,
            options: units.map((u) => ({ value: u.name, label: `${u.name} (${u.code ?? ""})` })),
            onChange: value((v) => (form.unit = v)),
          }),
        ),

        el(
          "div",
          { class: "grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2 border-t border-line" },
          textField({
            label: "الحد الأدنى للأمان",
            type: "number",
            value: String(form.minLevel),
            onInput: numberValue((v) => (form.minLevel = v)),
          }),
          textField({
            label: "نقطة إعادة الطلب",
            type: "number",
            value: String(form.reorderPoint),
            onInput: numberValue((v) => (form.reorderPoint = v)),
          }),
          textField({
            label: "الحد الأقصى للتخزين",
            type: "number",
            value: String(form.maxLevel),
            onInput: numberValue((v) => (form.maxLevel = v)),
          }),
        ),

        el(
          "div",
          { class: "grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2 border-t border-line" },
          moneyField({
            label: "سعر الشراء / التكلفة التقديرية",
            value: form.costPrice,
            onChange: (cents) => (form.costPrice = cents),
          }),
          can("pricing.manage")
            ? moneyField({
                label: "سعر البيع المعتمد للمريض",
                value: form.sellingPrice,
                onChange: (cents) => (form.sellingPrice = cents),
              })
            : el(
                "div",
                { class: "flex flex-col gap-1.5" },
                el("label", { class: "text-xs font-medium text-faint" }, "سعر البيع المعتمد للمريض"),
                el(
                  "div",
                  {
                    class:
                      "px-3 py-2 rounded-[var(--radius-input)] bg-surface-subtle border border-line text-xs flex items-center justify-between",
                  },
                  el("span", { class: "font-semibold text-ink num" }, amount(form.sellingPrice || 0)),
                  el(
                    "span",
                    {
                      class:
                        "text-[10px] text-warning-700 bg-warning-50 border border-warning-200 px-1.5 py-0.5 rounded",
                    },
                    "🔒 خاص بمدير الحسابات",
                  ),
                ),
                el(
                  "p",
                  { class: "text-[11px] text-faint" },
                  "غير مسموح لأمين المخزن بتحديد سعر البيع — يتم تحديده واعتماده حصرياً من مدير الحسابات.",
                ),
              ),
        ),
      ),

    onSubmit: () =>
      createItem({
        ...form,
        name: form.name.trim(),
        nameEn: form.nameEn.trim(),
        inventoryAccountId: 1131,
      }),

    onDone: async () => {
      invalidateLookups("items");
      await context.reload();
    },
  });
}

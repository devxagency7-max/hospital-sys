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
  tagColumn,
  statusColumn,
  totalCell,
  countColumn,
} from "../_shared/cells.js";
import { formModal, selectField, value, numberValue, moneyField } from "../_shared/forms.js";
import { textField } from "../../components/forms/fields.js";
import { listItems, createItem } from "../../js/api/inventory.api.js";
import { getItemCategories, getUnits, getWarehouses, toOptions, invalidateLookups } from "../../js/api/lookups.api.js";

const COSTING_METHODS = {
  fifo: { label: "الوارد أولاً صادر أولاً (FIFO)", tone: "brand" },
  weighted_average: { label: "المتوسط المرجّح", tone: "info" },
};

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
        label: "تقييم المخزون",
        variant: "secondary",
        icon: "reports",
        onClick: () => navigate("/inv/valuation"),
      }),
      button({
        label: "أرصدة المخازن",
        variant: "ghost",
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
      {
        key: "costingMethod",
        label: "طريقة التقييم",
        options: [
          { value: "fifo", label: "FIFO" },
          { value: "weighted_average", label: "متوسط مرجح" },
        ],
      },
    ],

    columns: [
      nameColumn("name", "code", "الصنف", { width: "16rem" }),
      textColumn("category", "التصنيف", { width: "9rem", muted: true }),
      textColumn("unit", "الوحدة", { width: "5rem" }),
      quantityColumn("onHand", "الرصيد الفعلي"),
      quantityColumn("available", "المتاح"),
      moneyColumn("costPrice", "سعر التكلفة"),
      moneyColumn("totalValue", "القيمة الإجمالية"),
      countColumn("warehousesCount", "المخازن"),
      tagColumn("costingMethod", "التقييم", COSTING_METHODS, { width: "8.5rem" }),
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
            { value: "", colspan: 3 },
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
          selectField({
            label: "طريقة التقييم",
            required: true,
            value: form.costingMethod,
            options: [
              { value: "fifo", label: "الوارد أولاً صادر أولاً (FIFO)" },
              { value: "weighted_average", label: "المتوسط المرجّح" },
            ],
            onChange: value((v) => (form.costingMethod = v)),
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
            label: "سعر التكلفة التقديري",
            value: form.costPrice,
            onChange: (cents) => (form.costPrice = cents),
          }),
          moneyField({
            label: "سعر البيع الافتراضي",
            value: form.sellingPrice,
            onChange: (cents) => (form.sellingPrice = cents),
          }),
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

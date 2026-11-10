/**
 * أذون الإضافة المخزنية.
 *
 * استلام الأصناف وإضافتها إلى المستودع بالكمية والتكلفة وطبقات التقييم.
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
  codeColumn,
  nameColumn,
  textColumn,
  quantityColumn,
  moneyColumn,
  dateColumn,
  totalCell,
} from "../_shared/cells.js";
import { formModal, selectField, dateFieldWithLabel, value, numberValue, moneyField } from "../_shared/forms.js";
import { textField } from "../../components/forms/fields.js";
import { listMovements, createReceipt } from "../../js/api/inventory.api.js";
import { getItems, getWarehouses, toOptions, invalidateLookups } from "../../js/api/lookups.api.js";

export default async function receiptsPage() {
  const [items, warehouses] = await Promise.all([
    getItems(),
    getWarehouses(),
  ]);

  return listPage({
    title: "أذون الإضافة المخزنية",
    description: "استلام المخزون وإضافته للمستودعات مع تثبيت تكلفة الشراء وطبقات التقييم.",
    tableId: "inv-receipts",
    searchPlaceholder: "بحث برقم الإذن أو كود الصنف أو المرجع…",
    initialParams: { sort: "date", order: "desc" },
    fetch: (params) => listMovements({ ...params, documentType: "goods_receipt" }),

    actions: (context) => [
      button({
        label: "إذن إضافة جديد",
        variant: "primary",
        icon: "plus",
        permission: "inv.receipt.create",
        onClick: () => openReceiptModal(context, { items, warehouses }),
      }),
      button({
        label: "حركات المخزون",
        variant: "secondary",
        icon: "reports",
        onClick: () => navigate("/inv/movements"),
      }),
    ],

    filters: [
      { key: "warehouseId", label: "المخزن", options: toOptions(warehouses) },
      { key: "itemId", label: "الصنف", options: toOptions(items) },
    ],

    columns: [
      codeColumn("reference", "رقم الإذن", { width: "10.5rem" }),
      dateColumn("date", "تاريخ الإضافة"),
      nameColumn("itemName", "itemCode", "الصنف المستلم", { width: "16rem" }),
      textColumn("warehouseName", "المستودع", { width: "11rem" }),
      quantityColumn("quantity", "الكمية المضافة"),
      moneyColumn("unitCost", "تكلفة الوحدة"),
      moneyColumn("totalCost", "إجمالي القيمة"),
      textColumn("performedBy", "المستلم", { width: "11rem", muted: true }),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 4 },
            { value: integer(rows.reduce((sum, r) => sum + (r.quantity ?? 0), 0)), numeric: true },
            { value: "", colspan: 1 },
            { value: totalCell(money.sumBy(rows, "totalCost")), numeric: true },
            { value: "", colspan: 1 },
          ]
        : null,

    onRowClick: (row) => navigate(`/inv/items/${row.itemId}`),

    rowActions: (row) =>
      buttonGroup(
        iconButton("eye", { label: "ملف الصنف", onClick: () => navigate(`/inv/items/${row.itemId}`) }),
      ),

    stats: async () => {
      const { data, meta } = await listMovements({ documentType: "goods_receipt", perPage: 200 });
      const totalVal = money.sumBy(data, "totalCost");
      const totalQty = data.reduce((sum, r) => sum + (r.quantity ?? 0), 0);

      return [
        statTile({
          label: "إجمالي أذون الإضافة",
          value: integer(meta.total),
          tone: "neutral",
          icon: "inventory",
        }),
        statTile({
          label: "إجمالي الوحدات المستلمة",
          value: integer(totalQty),
          tone: "brand",
          icon: "box",
        }),
        statTile({
          label: "إجمالي قيمة الإضافات",
          value: amount(totalVal),
          tone: "success",
          icon: "money",
        }),
      ];
    },
  });
}

/* ========================================================================== */

function openReceiptModal(context, { items, warehouses }) {
  const form = {
    itemId: items[0]?.id ?? 1,
    warehouseId: warehouses[0]?.id ?? 1,
    quantity: 10,
    unitCost: 5000,
    batchNumber: `BATCH-${Date.now().toString().slice(-4)}`,
    expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    date: new Date().toISOString().slice(0, 10),
    reason: "استلام توريد محلي",
    notes: "",
  };

  formModal({
    title: "إنشاء إذن إضافة مخزني",
    subtitle: "إضافة بضائع إلى المستودع وتثبيت تكلفة الوحدة لحسابات التقييم والترحيل",
    size: "lg",
    submitLabel: "ترحيل إذن الإضافة",
    success: "تم إنشاء إذن الإضافة وترحيل القيد المحاسبي بنجاح.",

    body: () =>
      el(
        "div",
        { class: "space-y-4" },
        el(
          "div",
          { class: "grid grid-cols-1 md:grid-cols-2 gap-3.5" },
          selectField({
            label: "الصنف",
            required: true,
            value: String(form.itemId),
            options: items.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` })),
            onChange: value((v) => (form.itemId = Number(v))),
          }),
          selectField({
            label: "المستودع المستلم",
            required: true,
            value: String(form.warehouseId),
            options: warehouses.map((w) => ({ value: w.id, label: w.name })),
            onChange: value((v) => (form.warehouseId = Number(v))),
          }),
        ),

        el(
          "div",
          { class: "grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2 border-t border-line" },
          textField({
            label: "الكمية المضافة",
            type: "number",
            required: true,
            value: String(form.quantity),
            onInput: numberValue((v) => (form.quantity = v)),
          }),
          moneyField({
            label: "تكلفة الوحدة (قروش)",
            required: true,
            value: form.unitCost,
            onChange: (cents) => (form.unitCost = cents),
          }),
          dateFieldWithLabel({
            label: "تاريخ الاستلام",
            required: true,
            value: form.date,
            onChange: value((v) => (form.date = v)),
          }),
        ),

        el(
          "div",
          { class: "grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2 border-t border-line" },
          textField({
            label: "رقم التشغيلة (Batch)",
            value: form.batchNumber,
            onInput: value((v) => (form.batchNumber = v)),
          }),
          dateFieldWithLabel({
            label: "تاريخ الصلاحية",
            value: form.expiryDate,
            onChange: value((v) => (form.expiryDate = v)),
          }),
        ),

        textField({
          label: "ملاحظات أو سبب الإضافة",
          value: form.reason,
          onInput: value((v) => (form.reason = v)),
        }),
      ),

    onSubmit: () =>
      createReceipt({
        itemId: form.itemId,
        warehouseId: form.warehouseId,
        quantity: Number(form.quantity),
        unitCost: Number(form.unitCost),
        batchNumber: form.batchNumber.trim() || undefined,
        expiryDate: form.expiryDate || undefined,
        date: form.date,
        reason: form.reason.trim(),
        notes: form.notes.trim() || undefined,
      }),

    onDone: async () => {
      invalidateLookups();
      await context.reload();
    },
  });
}

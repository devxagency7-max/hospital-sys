/**
 * أذون الصرف المخزني.
 *
 * صرف البضائع والمواد من المستودع مع احتساب التكلفة آليًا من طبقات التقييم.
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
import { formModal, selectField, dateFieldWithLabel, value, numberValue } from "../_shared/forms.js";
import { textField } from "../../components/forms/fields.js";
import { listMovements, createIssue } from "../../js/api/inventory.api.js";
import { getItems, getWarehouses, getCostCenters, toOptions, invalidateLookups } from "../../js/api/lookups.api.js";

export default async function issuesPage() {
  const [items, warehouses, costCenters] = await Promise.all([
    getItems(),
    getWarehouses(),
    getCostCenters(),
  ]);

  return listPage({
    title: "أذون الصرف المخزني",
    description: "صرف المواد ومخرجات المخزون؛ التكلفة تُحسب آليًا من طبقات التقييم وتُرحَّل لمصروف المركز المعني.",
    tableId: "inv-issues",
    searchPlaceholder: "بحث برقم إذن الصرف أو كود الصنف أو الغرض…",
    initialParams: { sort: "date", order: "desc" },
    fetch: (params) => listMovements({ ...params, documentType: "goods_issue" }),

    actions: (context) => [
      button({
        label: "إذن صرف جديد",
        variant: "primary",
        icon: "minus",
        permission: "inv.issue.create",
        onClick: () => openIssueModal(context, { items, warehouses, costCenters }),
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
      dateColumn("date", "تاريخ الصرف"),
      nameColumn("itemName", "itemCode", "الصنف المنصرف", { width: "16rem" }),
      textColumn("warehouseName", "المستودع", { width: "11rem" }),
      quantityColumn("quantity", "الكمية المنصرفة"),
      moneyColumn("unitCost", "تكلفة الوحدة"),
      moneyColumn("totalCost", "إجمالي التكلفة"),
      textColumn("reason", "الغرض / مركز التكلفة", { width: "13rem", muted: true }),
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
      const { data, meta } = await listMovements({ documentType: "goods_issue", perPage: 200 });
      const totalCost = money.sumBy(data, "totalCost");
      const totalQty = data.reduce((sum, r) => sum + (r.quantity ?? 0), 0);

      return [
        statTile({
          label: "إجمالي أذون الصرف",
          value: integer(meta.total),
          tone: "neutral",
          icon: "inventory",
        }),
        statTile({
          label: "إجمالي الوحدات المنصرفة",
          value: integer(totalQty),
          tone: "brand",
          icon: "box",
        }),
        statTile({
          label: "تكلفة المخزون المنصرف",
          value: amount(totalCost),
          hint: "محسوبة بمحرك التقييم المعتمد",
          tone: "info",
          icon: "money",
        }),
      ];
    },
  });
}

/* ========================================================================== */

function openIssueModal(context, { items, warehouses, costCenters }) {
  const form = {
    itemId: items[0]?.id ?? 1,
    warehouseId: warehouses[0]?.id ?? 1,
    quantity: 5,
    costCenterId: costCenters[0]?.id ?? 1,
    date: new Date().toISOString().slice(0, 10),
    reason: "صرف تشغيل وإنتاج",
    notes: "",
  };

  formModal({
    title: "إنشاء إذن صرف مخزني",
    subtitle: "صرف أصناف من المخزن؛ التكلفة تُشتق آليًا من طبقات التكلفة ولا تُدخَل يدويًا",
    size: "lg",
    submitLabel: "ترحيل إذن الصرف",
    success: "تم إنشاء إذن الصرف وترحيل تكلفته وقيده المحاسبي بنجاح.",

    body: () =>
      el(
        "div",
        { class: "space-y-4" },
        el(
          "div",
          { class: "grid grid-cols-1 md:grid-cols-2 gap-3.5" },
          selectField({
            label: "الصنف المراد صرفه",
            required: true,
            value: String(form.itemId),
            options: items.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` })),
            onChange: value((v) => (form.itemId = Number(v))),
          }),
          selectField({
            label: "مستودع الصرف",
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
            label: "الكمية المنصرفة",
            type: "number",
            required: true,
            value: String(form.quantity),
            onInput: numberValue((v) => (form.quantity = v)),
          }),
          selectField({
            label: "مركز التكلفة المستفيد",
            value: String(form.costCenterId),
            options: costCenters.map((cc) => ({ value: cc.id, label: `${cc.code} — ${cc.name}` })),
            onChange: value((v) => (form.costCenterId = Number(v))),
          }),
          dateFieldWithLabel({
            label: "تاريخ الصرف",
            required: true,
            value: form.date,
            onChange: value((v) => (form.date = v)),
          }),
        ),

        textField({
          label: "سبب أو غرض الصرف",
          value: form.reason,
          onInput: value((v) => (form.reason = v)),
        }),

        el(
          "p",
          { class: "text-xs text-muted leading-relaxed bg-subtle border border-line rounded-xl p-3" },
          "التكلفة المحسوبة تُثبَّت على الحركة للتدقيق عبر محرك التقييم (FIFO / المتوسط المرجّح) " +
            "ويُنشأ قيد اليومية آليًا: مصروف المركز مدين والمخزون دائن.",
        ),
      ),

    onSubmit: () =>
      createIssue({
        itemId: form.itemId,
        warehouseId: form.warehouseId,
        quantity: Number(form.quantity),
        costCenterId: Number(form.costCenterId),
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

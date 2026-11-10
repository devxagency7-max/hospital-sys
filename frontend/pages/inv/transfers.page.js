/**
 * التحويلات المخزنية.
 *
 * نقل البضائع بين المستودعات؛ التحويل الداخلي لا يُنتج إيرادًا ولا تكلفة مبيعات.
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
import { listMovements, createTransfer } from "../../js/api/inventory.api.js";
import { getItems, getWarehouses, toOptions, invalidateLookups } from "../../js/api/lookups.api.js";

export default async function transfersPage() {
  const [items, warehouses] = await Promise.all([
    getItems(),
    getWarehouses(),
  ]);

  return listPage({
    title: "التحويلات المخزنية",
    description: "نقل المواد بين المستودعات؛ حركتان متطابقتان بالتكلفة الدفترية دون توليد إيراد.",
    tableId: "inv-transfers",
    searchPlaceholder: "بحث برقم التحويل أو كود الصنف أو المرجع…",
    initialParams: { sort: "date", order: "desc" },
    fetch: (params) => listMovements({ ...params, type: "transfer_out" }),

    actions: (context) => [
      button({
        label: "تحويل مخزني جديد",
        variant: "primary",
        icon: "refresh",
        permission: "inv.transfer.create",
        onClick: () => openTransferModal(context, { items, warehouses }),
      }),
      button({
        label: "أرصدة المخزون",
        variant: "secondary",
        icon: "inventory",
        onClick: () => navigate("/inv/balances"),
      }),
    ],

    filters: [
      { key: "warehouseId", label: "المخزن المصدر", options: toOptions(warehouses) },
      { key: "itemId", label: "الصنف", options: toOptions(items) },
    ],

    columns: [
      codeColumn("reference", "رقم التحويل", { width: "10.5rem" }),
      dateColumn("date", "تاريخ التحويل"),
      nameColumn("itemName", "itemCode", "الصنف", { width: "16rem" }),
      textColumn("warehouseName", "من مستودع", { width: "11rem" }),
      quantityColumn("quantity", "الكمية المحولة"),
      moneyColumn("unitCost", "تكلفة الوحدة"),
      moneyColumn("totalCost", "إجمالي القيمة"),
      textColumn("reason", "البيان والملاحظات", { width: "14rem", muted: true }),
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
      const { data, meta } = await listMovements({ type: "transfer_out", perPage: 200 });
      const totalVal = money.sumBy(data, "totalCost");
      const totalUnits = data.reduce((sum, r) => sum + (r.quantity ?? 0), 0);

      return [
        statTile({
          label: "عمليات التحويل المنفذة",
          value: integer(meta.total),
          tone: "neutral",
          icon: "refresh",
        }),
        statTile({
          label: "الوحدات المنقولة بين المخازن",
          value: integer(totalUnits),
          tone: "brand",
          icon: "box",
        }),
        statTile({
          label: "القيمة الإجمالية المنقولة",
          value: amount(totalVal),
          hint: "بلا توليد إيراد أو تكلفة ربح",
          tone: "info",
          icon: "money",
        }),
      ];
    },
  });
}

/* ========================================================================== */

function openTransferModal(context, { items, warehouses }) {
  const form = {
    itemId: items[0]?.id ?? 1,
    fromWarehouseId: warehouses[0]?.id ?? 1,
    toWarehouseId: warehouses[1]?.id ?? 2,
    quantity: 5,
    date: new Date().toISOString().slice(0, 10),
    notes: "تحويل داخلي لتغذية رصيد المخزن",
  };

  formModal({
    title: "إنشاء تحويل مخزني",
    subtitle: "نقل كميات بين مستودعين بنفس التكلفة الدفترية دون أي أثر ربحي",
    size: "lg",
    submitLabel: "تنفيذ التحويل المخزني",
    success: "تم تنفيذ التحويل المخزني بنجاح.",

    body: () =>
      el(
        "div",
        { class: "space-y-4" },
        selectField({
          label: "الصنف المراد نقله",
          required: true,
          value: String(form.itemId),
          options: items.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` })),
          onChange: value((v) => (form.itemId = Number(v))),
        }),

        el(
          "div",
          { class: "grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2 border-t border-line" },
          selectField({
            label: "من مستودع (المصدر)",
            required: true,
            value: String(form.fromWarehouseId),
            options: warehouses.map((w) => ({ value: w.id, label: w.name })),
            onChange: value((v) => (form.fromWarehouseId = Number(v))),
          }),
          selectField({
            label: "إلى مستودع (الوجهة)",
            required: true,
            value: String(form.toWarehouseId),
            options: warehouses.map((w) => ({ value: w.id, label: w.name })),
            onChange: value((v) => (form.toWarehouseId = Number(v))),
          }),
        ),

        el(
          "div",
          { class: "grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2 border-t border-line" },
          textField({
            label: "الكمية المحولة",
            type: "number",
            required: true,
            value: String(form.quantity),
            onInput: numberValue((v) => (form.quantity = v)),
          }),
          dateFieldWithLabel({
            label: "تاريخ التحويل",
            required: true,
            value: form.date,
            onChange: value((v) => (form.date = v)),
          }),
        ),

        textField({
          label: "ملاحظات أو مبرر النقل",
          value: form.notes,
          onInput: value((v) => (form.notes = v)),
        }),

        el(
          "p",
          { class: "text-xs text-muted leading-relaxed bg-subtle border border-line rounded-xl p-3" },
          "القاعدة المعمارية 4: التحويل الداخلي لا يُنتج إيرادًا ولا مشتريات. " +
            "الوارد في المستودع الهدف يدخل بنفس تكلفة الصادر من المستودع المصدر تمامًا.",
        ),
      ),

    onSubmit: () =>
      createTransfer({
        itemId: form.itemId,
        fromWarehouseId: form.fromWarehouseId,
        toWarehouseId: form.toWarehouseId,
        quantity: Number(form.quantity),
        date: form.date,
        notes: form.notes.trim() || undefined,
      }),

    onDone: async () => {
      invalidateLookups();
      await context.reload();
    },
  });
}

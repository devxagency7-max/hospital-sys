/**
 * التسويات المخزنية.
 *
 * معالجة العجز والتلف أو الزيادة الجردية؛ التسوية المعلَّقة لا تؤثر على الرصيد إلا بعد اعتمادها.
 */

import { el } from "../../js/core/dom.js";
import { buttonGroup, iconButton, button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import { listPage, confirmThenRun } from "../_shared/list-page.js";
import {
  codeColumn,
  nameColumn,
  textColumn,
  quantityColumn,
  moneyColumn,
  dateColumn,
  statusColumn,
  totalCell,
} from "../_shared/cells.js";
import { formModal, selectField, dateFieldWithLabel, value, numberValue, moneyField } from "../_shared/forms.js";
import { textField } from "../../components/forms/fields.js";
import { listMovements, createAdjustment, approveAdjustment } from "../../js/api/inventory.api.js";
import { getItems, getWarehouses, toOptions, invalidateLookups } from "../../js/api/lookups.api.js";

export default async function adjustmentsPage() {
  const [items, warehouses] = await Promise.all([
    getItems(),
    getWarehouses(),
  ]);

  return listPage({
    title: "التسويات المخزنية",
    description: "معالجة فروق الجرد والعجز أو الزيادة مع ترحيل الفروق لحسابات الأرباح والخسائر المعنية.",
    tableId: "inv-adjustments",
    searchPlaceholder: "بحث برقم التسوية أو كود الصنف أو المرجع…",
    initialParams: { sort: "date", order: "desc" },
    fetch: async (params) => {
      const res = await listMovements(params);
      const rows = (res.data ?? []).filter((m) =>
        m.documentType === "stock_adjustment" || m.type === "adjustment_in" || m.type === "adjustment_out",
      );
      return { data: rows, meta: { ...res.meta, total: rows.length } };
    },

    actions: (context) => [
      button({
        label: "تسجيل تسوية جديدة",
        variant: "primary",
        icon: "plus",
        permission: "inv.adjust",
        onClick: () => openAdjustmentModal(context, { items, warehouses }),
      }),
      button({
        label: "الجرد الفعلي",
        variant: "secondary",
        icon: "reports",
        onClick: () => navigate("/inv/counts"),
      }),
    ],

    filters: [
      { key: "warehouseId", label: "المخزن", options: toOptions(warehouses) },
      { key: "itemId", label: "الصنف", options: toOptions(items) },
    ],

    columns: [
      codeColumn("reference", "رقم التسوية", { width: "10.5rem" }),
      dateColumn("date", "تاريخ التسوية"),
      {
        key: "type",
        label: "نوع التسوية",
        width: "9rem",
        align: "center",
        render: (row) =>
          row.type === "adjustment_in"
            ? badge("تسوية بالزيادة", { tone: "success", size: "sm" })
            : badge("تسوية بالعجز", { tone: "danger", size: "sm" }),
      },
      nameColumn("itemName", "itemCode", "الصنف", { width: "16rem" }),
      textColumn("warehouseName", "المستودع", { width: "11rem" }),
      {
        key: "quantity",
        label: "الكمية",
        numeric: true,
        width: "7.5rem",
        render: (row) => {
          const isInc = row.type === "adjustment_in";
          return el(
            "span",
            { class: isInc ? "text-success-400 tabular font-semibold" : "text-danger-400 tabular font-semibold" },
            `${isInc ? "+" : "−"}${integer(row.quantity ?? 0)}`,
          );
        },
      },
      moneyColumn("totalCost", "إجمالي القيمة"),
      textColumn("reason", "سبب التسوية", { width: "14rem" }),
      statusColumn(),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 5 },
            { value: integer(rows.reduce((sum, r) => sum + (r.quantity ?? 0), 0)), numeric: true },
            { value: totalCell(money.sumBy(rows, "totalCost")), numeric: true },
            { value: "", colspan: 2 },
          ]
        : null,

    onRowClick: (row) => navigate(`/inv/items/${row.itemId}`),

    rowActions: (row, context) =>
      buttonGroup(
        row.status === "pending_approval"
          ? iconButton("check", {
              label: "اعتماد التسوية وترحيلها",
              permission: "inv.adjust",
              onClick: () =>
                confirmThenRun(
                  {
                    title: `اعتماد التسوية ${row.reference}؟`,
                    message: "الاعتماد يحدّث رصيد المخزون فورًا ويُنشئ القيد المحاسبي في الدفتر.",
                    confirmLabel: "اعتماد التسوية",
                    tone: "primary",
                  },
                  () => approveAdjustment(row.id),
                  { success: "اعتُمدت التسوية ورُحِّل قيدها المحاسبي.", context },
                ),
            })
          : null,
        iconButton("eye", { label: "ملف الصنف", onClick: () => navigate(`/inv/items/${row.itemId}`) }),
      ),

    stats: async () => {
      const res = await listMovements({ perPage: 500 });
      const adjustments = (res.data ?? []).filter((m) =>
        m.documentType === "stock_adjustment" || m.type === "adjustment_in" || m.type === "adjustment_out",
      );
      const increases = adjustments.filter((a) => a.type === "adjustment_in");
      const decreases = adjustments.filter((a) => a.type === "adjustment_out");
      const pending = adjustments.filter((a) => a.status === "pending_approval");

      return [
        statTile({
          label: "إجمالي التسويات",
          value: integer(adjustments.length),
          tone: "neutral",
          icon: "inventory",
        }),
        statTile({
          label: "تسويات بالزيادة",
          value: integer(increases.length),
          hint: `${amount(money.sumBy(increases, "totalCost"))} قيمة مضافة`,
          tone: "success",
          icon: "checkCircle",
        }),
        statTile({
          label: "تسويات بالعجز والتلف",
          value: integer(decreases.length),
          hint: `${amount(money.sumBy(decreases, "totalCost"))} خسائر عجز`,
          tone: "danger",
          icon: "alertTriangle",
        }),
        statTile({
          label: "بانتظار الاعتماد",
          value: integer(pending.length),
          tone: pending.length ? "warning" : "neutral",
          icon: "clock",
        }),
      ];
    },
  });
}

/* ========================================================================== */

function openAdjustmentModal(context, { items, warehouses }) {
  const form = {
    itemId: items[0]?.id ?? 1,
    warehouseId: warehouses[0]?.id ?? 1,
    direction: "out",
    quantity: 1,
    unitCost: 1000,
    date: new Date().toISOString().slice(0, 10),
    reason: "عجز وتلف ناتج عن فحص المخزون",
    notes: "",
  };

  formModal({
    title: "تسجيل تسوية مخزنية",
    subtitle: "إثبات الفروق المخزنية؛ التسوية تتطلب سببًا وتخضع للاعتماد قبل الترحيل",
    size: "lg",
    submitLabel: "حفظ التسوية",
    success: "تم تسجيل التسوية بنجاح وبانتظار الاعتماد.",

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
            label: "المستودع",
            required: true,
            value: String(form.warehouseId),
            options: warehouses.map((w) => ({ value: w.id, label: w.name })),
            onChange: value((v) => (form.warehouseId = Number(v))),
          }),
        ),

        el(
          "div",
          { class: "grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2 border-t border-line" },
          selectField({
            label: "نوع التسوية",
            required: true,
            value: form.direction,
            options: [
              { value: "out", label: "تسوية بالعجز / التلف (خصم)" },
              { value: "in", label: "تسوية بالزيادة (إضافة)" },
            ],
            onChange: value((v) => (form.direction = v)),
          }),
          textField({
            label: "الكمية",
            type: "number",
            required: true,
            value: String(form.quantity),
            onInput: numberValue((v) => (form.quantity = v)),
          }),
          dateFieldWithLabel({
            label: "تاريخ التسوية",
            required: true,
            value: form.date,
            onChange: value((v) => (form.date = v)),
          }),
        ),

        textField({
          label: "سبب التسوية (إلزامي للتدقيق)",
          required: true,
          value: form.reason,
          onInput: value((v) => (form.reason = v)),
        }),

        el(
          "p",
          { class: "text-xs text-muted leading-relaxed bg-subtle border border-line rounded-xl p-3" },
          "التسوية المعلَّقة لا تؤثر على الرصيد المتاح ولا تُرحَّل محاسبيًا حتى يعتمدها " +
            "المدير المسؤول، وعند الاعتماد يُقيد القيد: إيراد زيادة مخزون أو مصروف عجز.",
        ),
      ),

    onSubmit: () =>
      createAdjustment({
        itemId: form.itemId,
        warehouseId: form.warehouseId,
        direction: form.direction,
        quantity: Number(form.quantity),
        unitCost: Number(form.unitCost),
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

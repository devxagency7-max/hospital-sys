/**
 * حركات المخزون.
 *
 * سجل تفصيلي لكل حركة مخزنية (وارد، صادر، تحويل، تسوية) مع الرصيد المتحرك والتكلفة.
 */

import { el } from "../../js/core/dom.js";
import { buttonGroup, iconButton, button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import { listPage, runAction } from "../_shared/list-page.js";
import {
  codeColumn,
  nameColumn,
  textColumn,
  quantityColumn,
  moneyColumn,
  dateColumn,
  totalCell,
} from "../_shared/cells.js";
import { formModal, selectField, notesField, value, numberValue } from "../_shared/forms.js";
import { textField } from "../../components/forms/fields.js";
import { toast } from "../../components/feedback/toast.js";
import { listMovements, createReceipt, createIssue } from "../../js/api/inventory.api.js";
import { getWarehouses, getItems, toOptions, invalidateLookups } from "../../js/api/lookups.api.js";

const MOVEMENT_TYPES = {
  goods_receipt: { label: "إذن إضافة", tone: "success" },
  goods_issue: { label: "إذن صرف", tone: "brand" },
  transfer_in: { label: "تحويل وارد", tone: "info" },
  transfer_out: { label: "تحويل صادر", tone: "warning" },
  adjustment_in: { label: "تسوية بالزيادة", tone: "success" },
  adjustment_out: { label: "تسوية بالعجز", tone: "danger" },
  initial_balance: { label: "رصيد افتتاحي", tone: "neutral" },
};

export default async function movementsPage() {
  const [warehouses, items] = await Promise.all([
    getWarehouses(),
    getItems(),
  ]);

  return listPage({
    title: "حركات المخزون",
    description: "كشف الحركات المخزنية الواردة والصادرة والتحويلات مع التكلفة والرصيد اللحظي.",
    tableId: "inv-movements",
    searchPlaceholder: "بحث برقم الحركة أو كود الصنف أو المرجع…",
    initialParams: { sort: "date", order: "desc" },
    fetch: listMovements,

    actions: (context) => [
      button({
        label: "إذن إضافة جديد",
        variant: "primary",
        icon: "plus",
        permission: "inv.receipt.create",
        onClick: () => openDirectReceiptModal(context, { items, warehouses }),
      }),
      button({
        label: "إذن صرف جديد",
        variant: "secondary",
        icon: "minus",
        permission: "inv.issue.create",
        onClick: () => openDirectIssueModal(context, { items, warehouses }),
      }),
      button({
        label: "تحويل مخزني",
        variant: "ghost",
        icon: "refresh",
        permission: "inv.transfer.create",
        onClick: () => navigate("/inv/transfers"),
      }),
    ],

    filters: [
      { key: "warehouseId", label: "المخزن", options: toOptions(warehouses) },
      { key: "itemId", label: "الصنف", options: toOptions(items) },
      {
        key: "type",
        label: "نوع الحركة",
        options: Object.entries(MOVEMENT_TYPES).map(([val, item]) => ({
          value: val,
          label: item.label,
        })),
      },
    ],

    columns: [
      codeColumn("movementNumber", "رقم الحركة", { width: "9.5rem" }),
      dateColumn("date", "التاريخ", { width: "7.5rem" }),
      {
        key: "type",
        label: "نوع الحركة",
        width: "9rem",
        align: "center",
        tooltip:
          "«رصيد افتتاحي» = كمية الجرد الفعلي لحظة بدء النظام، وهي أول حركة لكل صنف وكل ما بعدها يبني عليها.",
        render: (row) => {
          const t = MOVEMENT_TYPES[row.type] ?? { label: row.typeLabel ?? row.type, tone: "neutral" };
          return badge(t.label, { tone: t.tone, size: "sm" });
        },
      },
      nameColumn("itemName", "itemCode", "الصنف", { width: "15rem" }),
      textColumn("warehouseName", "المخزن", { width: "10rem" }),
      {
        key: "quantity",
        label: "الكمية",
        numeric: true,
        width: "7.5rem",
        render: (row) => {
          const isIn = row.direction === "in" || row.type === "goods_receipt" || row.type === "transfer_in" || row.type === "adjustment_in";
          return el(
            "span",
            { class: isIn ? "text-success-400 tabular font-semibold" : "text-ink tabular" },
            `${isIn ? "+" : "−"}${integer(row.quantity ?? 0)}`,
          );
        },
      },
      moneyColumn("costPerUnit", "تكلفة الوحدة", {
        tooltip: "تكلفة شراء الوحدة في هذه الحركة — وفي الصرف يحسبها محرك التقييم من طبقات الشراء، لا تُكتب يدويًا.",
      }),
      moneyColumn("totalCost", "إجمالي التكلفة", {
        tooltip: "الكمية × تكلفة الوحدة لهذه الحركة.",
      }),
      codeColumn("reference", "المرجع", { width: "8.5rem" }),
      quantityColumn("balanceAfter", "الرصيد بعدها", {
        tooltip: "رصيد الصنف في المخزن بعد تنفيذ هذه الحركة مباشرة.",
      }),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 5 },
            { value: integer(rows.reduce((sum, r) => sum + (r.quantity ?? 0), 0)), numeric: true },
            { value: "", colspan: 1 },
            { value: totalCell(money.sumBy(rows, "totalCost")), numeric: true },
            { value: "", colspan: 2 },
          ]
        : null,

    onRowClick: (row) => navigate(`/inv/items/${row.itemId}`),

    rowActions: (row) =>
      buttonGroup(
        iconButton("eye", { label: "ملف الصنف", onClick: () => navigate(`/inv/items/${row.itemId}`) }),
      ),

    stats: async () => {
      const { data, meta } = await listMovements({ perPage: 500 });
      const inbound = data.filter((m) => m.direction === "in" || m.type === "goods_receipt" || m.type === "transfer_in" || m.type === "adjustment_in");
      const outbound = data.filter((m) => m.direction === "out" || m.type === "goods_issue" || m.type === "transfer_out" || m.type === "adjustment_out");
      const totalCostSum = money.sumBy(data, "totalCost");

      return [
        statTile({
          label: "إجمالي الحركات المُسجَّلة",
          value: integer(meta.total),
          tone: "neutral",
          icon: "inventory",
        }),
        statTile({
          label: "حركات الإضافة / الوارد",
          value: integer(inbound.length),
          hint: `${amount(money.sumBy(inbound, "totalCost"))} تكلفة`,
          tone: "success",
          icon: "checkCircle",
        }),
        statTile({
          label: "حركات الصرف / الصادر",
          value: integer(outbound.length),
          hint: `${amount(money.sumBy(outbound, "totalCost"))} تكلفة منصرفة`,
          tone: "brand",
          icon: "money",
        }),
        statTile({
          label: "إجمالي قيمة الحركات",
          value: amount(totalCostSum),
          tone: "info",
          icon: "reports",
        }),
      ];
    },
  });
}

/**
 * نافذة سريعة ومبسطة لإنشاء إذن إضافة من المورد مباشرة في حركات المخزون.
 */
function openDirectReceiptModal(context, { items, warehouses }) {
  const itemOptions = items.map((i) => ({
    value: String(i.id),
    label: `${i.name} (آخر تكلفة: ${i.lastPurchasePrice || i.costPrice || 0} ج.م)`,
  }));

  const warehouseOptions = warehouses.map((w) => ({ value: String(w.id), label: w.name }));

  const form = {
    itemId: itemOptions[0]?.value ?? "1",
    warehouseId: warehouseOptions[0]?.value ?? "1",
    invoiceQty: 10,
    actualQty: 10,
    unitCost: 100,
    batchNumber: "",
    notes: "",
  };

  formModal({
    title: "تسجيل إذن إضافة بضاعة من المورد",
    subtitle: "إضافة المخزون المستلم وتوثيق أي عجز أو فروقات في الفاتورة",
    size: "md",
    submitLabel: "حفظ إذن الإضافة",
    success: "تم تسجيل إذن الإضافة بنجاح",

    body: () =>
      el(
        "div",
        { class: "space-y-4 text-sm" },
        selectField({
          label: "الصنف المستلم",
          required: true,
          value: form.itemId,
          options: itemOptions,
          onChange: value((v) => (form.itemId = v)),
        }),
        selectField({
          label: "المستودع المستقبل",
          required: true,
          value: form.warehouseId,
          options: warehouseOptions,
          onChange: value((v) => (form.warehouseId = v)),
        }),
        el("div", { class: "grid grid-cols-1 md:grid-cols-2 gap-3" }, [
          textField({
            label: "الكمية المذكورة في فاتورة المورد",
            type: "number",
            value: String(form.invoiceQty),
            required: true,
            onInput: numberValue((v) => (form.invoiceQty = v)),
          }),
          textField({
            label: "الكمية المستلمة فعلياً (بعد العد والفحص)",
            type: "number",
            value: String(form.actualQty),
            required: true,
            onInput: numberValue((v) => (form.actualQty = v)),
          }),
        ]),
        textField({
          label: "سعر شراء الوحدة في الفاتورة (ج.م)",
          type: "number",
          value: String(form.unitCost),
          required: true,
          onInput: numberValue((v) => (form.unitCost = v)),
        }),
        textField({
          label: "رقم التشغيلة (إن وُجد)",
          value: form.batchNumber,
          placeholder: "مثال: BATCH-884",
          onInput: value((v) => (form.batchNumber = v)),
        }),
        notesField({
          label: "ملاحظات الاستلام / إثبات أي عجز",
          value: form.notes,
          placeholder: "اكتب أي ملاحظات على الفحص أو النقص…",
          onInput: value((v) => (form.notes = v)),
        }),
      ),

    onSubmit: async () => {
      const iId = Number(form.itemId);
      const wId = Number(form.warehouseId);
      const invoiceQty = Number(form.invoiceQty);
      const actualQty = Number(form.actualQty);
      const unitCost = Number(form.unitCost);

      if (!iId || !wId || !(actualQty > 0) || !(unitCost > 0)) {
        throw new Error("يرجى ملء جميع الحقول الإلزامية بالقيم الصحيحة.");
      }

      const discrepancy = invoiceQty - actualQty;
      let finalNotes = form.notes || "";
      if (discrepancy > 0) {
        finalNotes = `عجز مثبت: في الفاتورة ${invoiceQty} والمستلم فعلياً ${actualQty} (نقص ${discrepancy}). ${finalNotes}`;
      }

      await createReceipt({
        itemId: iId,
        warehouseId: wId,
        quantity: actualQty,
        unitCost,
        batchNumber: form.batchNumber || null,
        notes: finalNotes || null,
      });
      invalidateLookups("items");
      context.refresh?.();
      toast.success(
        discrepancy > 0
          ? `تم تسجيل إذن الإضافة بالكمية الفعلية (${actualQty}) مع توثيق عجز (${discrepancy})`
          : "تم تسجيل إذن الإضافة وتحديث المخزون بنجاح",
      );
    },
  });
}

/**
 * نافذة سريعة ومبسطة لإنشاء إذن صرف مخزني.
 */
function openDirectIssueModal(context, { items, warehouses }) {
  const itemOptions = items.map((i) => ({ value: String(i.id), label: `${i.name} (${i.code || ""})` }));
  const warehouseOptions = warehouses.map((w) => ({ value: String(w.id), label: w.name }));

  const form = {
    itemId: itemOptions[0]?.value ?? "1",
    warehouseId: warehouseOptions[0]?.value ?? "1",
    quantity: 5,
    reason: "صرف تشغيل وأقسام",
    notes: "",
  };

  formModal({
    title: "تسجيل إذن صرف مخزني",
    subtitle: "صرف أصناف من المخزن للأقسام أو الفروع وخصم الرصيد",
    size: "md",
    submitLabel: "حفظ إذن الصرف",
    success: "تم تسجيل إذن الصرف وخصم الرصيد بنجاح",

    body: () =>
      el(
        "div",
        { class: "space-y-4 text-sm" },
        selectField({
          label: "الصنف المطلوب صرفه",
          required: true,
          value: form.itemId,
          options: itemOptions,
          onChange: value((v) => (form.itemId = v)),
        }),
        selectField({
          label: "المخزن المنصرف منه",
          required: true,
          value: form.warehouseId,
          options: warehouseOptions,
          onChange: value((v) => (form.warehouseId = v)),
        }),
        textField({
          label: "الكمية المصروفة",
          type: "number",
          value: String(form.quantity),
          required: true,
          onInput: numberValue((v) => (form.quantity = v)),
        }),
        selectField({
          label: "سبب الصرف",
          value: form.reason,
          options: [
            { value: "صرف تشغيل وأقسام", label: "صرف تشغيل وأقسام داخلية" },
            { value: "صرف لفرع خارجي", label: "صرف وتغذية فرع خارجي" },
            { value: "صرف علاجي للمرضى", label: "صرف علاجي ومستهلكات طبية" },
            { value: "صرف صيانة وتشغيل", label: "صرف صيانة وقطع غيار" },
          ],
          onChange: value((v) => (form.reason = v)),
        }),
        notesField({
          label: "ملاحظات إذن الصرف",
          value: form.notes,
          placeholder: "رقم إذن الصرف اليدوي أو الجهة المستلمة…",
          onInput: value((v) => (form.notes = v)),
        }),
      ),

    onSubmit: async () => {
      const iId = Number(form.itemId);
      const wId = Number(form.warehouseId);
      const qty = Number(form.quantity);

      if (!iId || !wId || !(qty > 0)) {
        throw new Error("يرجى تحديد الصنف والمخزن والكمية المصروفة.");
      }

      await createIssue({
        itemId: iId,
        warehouseId: wId,
        quantity: qty,
        reason: form.reason || "صرف مخزني",
        notes: form.notes || null,
      });
      invalidateLookups("items");
      context.refresh?.();
      toast.success("تم تسجيل إذن الصرف وخصم الرصيد بنجاح");
    },
  });
}

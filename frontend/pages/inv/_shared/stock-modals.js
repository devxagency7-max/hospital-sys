/**
 * نوافذ إنشاء إذن الإضافة وإذن الصرف — مشتركة بين "حركات المخزون" و"أرصدة
 * المخزون".
 *
 * كانت كل شاشة (receipts.page.js / issues.page.js / movements.page.js)
 * تبني نسختها الخاصة من نفس النافذة بحقول مختلفة قليلًا — فيُصرف من شاشة
 * ويُسجَّل بشكل، ومن أخرى بشكل آخر لنفس العملية. نافذة واحدة هنا، تُفتح من
 * أي شاشة تحتاجها مباشرة بلا تنقّل لشاشة وسيطة.
 */

import { el, render } from "../../../js/core/dom.js";
import { button, iconButton } from "../../../components/common/button.js";
import { amount } from "../../../js/core/format.js";
import { formModal, selectField, dateFieldWithLabel, value, numberValue, moneyField } from "../../_shared/forms.js";
import { textField } from "../../../components/forms/fields.js";
import { createReceipt, createIssue } from "../../../js/api/inventory.api.js";
import { invalidateLookups } from "../../../js/api/lookups.api.js";

/**
 * إذن إضافة — استلام صنف من المورد. صنف واحد لكل إذن: كل استلام له فاتورة
 * ومرجع مورد مستقل، فالتجميع هنا يُفقد أثر كل منهما.
 */
export function openReceiptModal(context, { items, warehouses }) {
  const initialItem = items[0];
  const form = {
    itemId: initialItem?.id ?? 1,
    warehouseId: warehouses[0]?.id ?? 1,
    quantity: 10,
    unitCost: initialItem?.costPrice ?? 50,
    batchNumber: `BATCH-${Date.now().toString().slice(-4)}`,
    expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    date: new Date().toISOString().slice(0, 10),
    reason: "استلام توريد محلي",
    notes: "",
  };

  const getSelectedItem = () => items.find((i) => Number(i.id) === Number(form.itemId)) || items[0];

  const infoHost = el("div");
  const alertHost = el("div");

  function updatePricingHints() {
    const itm = getSelectedItem();
    if (!itm) return;

    const prevCost = itm.costPrice ?? 0;
    const salePrice = itm.sellingPrice ?? 0;

    render(
      infoHost,
      el(
        "div",
        {
          class:
            "p-3 rounded-[var(--radius-card)] bg-surface-subtle border border-line text-xs grid grid-cols-1 sm:grid-cols-2 gap-3",
        },
        el(
          "div",
          { class: "flex items-center gap-1.5" },
          el("span", { class: "text-faint" }, "سعر الشراء المسجل سابقاً:"),
          el("span", { class: "font-semibold text-ink num text-sm" }, amount(prevCost)),
        ),
        el(
          "div",
          { class: "flex flex-col gap-0.5" },
          el(
            "div",
            { class: "flex items-center gap-1.5" },
            el("span", { class: "text-faint" }, "سعر البيع المعتمد للمرضى:"),
            el("span", { class: "font-semibold text-brand-400 num text-sm" }, amount(salePrice)),
          ),
          el(
            "span",
            { class: "text-[10px] text-faint" },
            "🔒 معتمد من مدير الحسابات — لا يملك أمين المخزن صلاحية تغييره",
          ),
        ),
      ),
    );

    const enteredCost = Number(form.unitCost || 0);
    if (enteredCost > 0 && prevCost > 0 && enteredCost !== prevCost) {
      const diff = Number((((enteredCost - prevCost) / prevCost) * 100).toFixed(1));
      const diffSign = diff > 0 ? `+${diff}%` : `${diff}%`;
      const isIncrease = diff > 0;

      render(
        alertHost,
        el(
          "div",
          {
            class:
              "p-3 rounded-[var(--radius-card)] border text-xs flex items-start gap-2.5 " +
              (isIncrease
                ? "bg-warning-50 text-warning-800 border-warning-200"
                : "bg-surface-subtle text-ink border-line"),
          },
          el("span", { class: "text-base shrink-0 leading-none" }, "⚠️"),
          el(
            "div",
            { class: "space-y-0.5 leading-relaxed" },
            el(
              "p",
              { class: "font-semibold" },
              `تنبيه تغير سعر الشراء: يختلف السعر المدخل (${amount(enteredCost)}) عن السابق (${amount(prevCost)}) بنسبة (${diffSign}).`,
            ),
            el(
              "p",
              { class: "text-[11px] opacity-90" },
              "سعر بيع الصنف للمريض سيبقى ثابتاً كما هو، وسيتم إرسال إشعار فوري لمدير الحسابات لمراجعة التكلفة وتحديد السعر أو تثبيته.",
            ),
          ),
        ),
      );
    } else {
      render(alertHost);
    }
  }

  formModal({
    title: "إنشاء إذن إضافة من المورد",
    subtitle: "إضافة بضائع إلى المستودع وتثبيت تكلفة الوحدة لحسابات التقييم والترحيل",
    size: "lg",
    submitLabel: "ترحيل إذن الإضافة",
    success: "تم إنشاء إذن الإضافة وترحيل القيد المحاسبي بنجاح.",

    body: () => {
      updatePricingHints();

      return el(
        "div",
        { class: "space-y-4" },
        el(
          "div",
          { class: "grid grid-cols-1 md:grid-cols-2 gap-3.5" },
          selectField({
            label: "الصنف المستلم",
            required: true,
            value: String(form.itemId),
            options: items.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` })),
            onChange: value((v) => {
              form.itemId = Number(v);
              const selected = getSelectedItem();
              if (selected?.costPrice) {
                form.unitCost = selected.costPrice;
              }
              updatePricingHints();
            }),
          }),
          selectField({
            label: "المستودع المستلم",
            required: true,
            value: String(form.warehouseId),
            options: warehouses.map((w) => ({ value: w.id, label: w.name })),
            onChange: value((v) => (form.warehouseId = Number(v))),
          }),
        ),

        infoHost,
        alertHost,

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
            label: "سعر الشراء للتوريد (ج.م)",
            required: true,
            value: form.unitCost,
            onChange: (val) => {
              form.unitCost = val;
              updatePricingHints();
            },
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
      );
    },

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
      await context.reload?.();
    },
  });
}

/**
 * إذن صرف — قد يحمل أكثر من صنف في نفس الإذن (نفس فكرة طلب النواقص
 * متعدد الأصناف): مخزن واحد ومركز تكلفة وتاريخ مشترك، وسطر لكل صنف. كل
 * سطر يتحول إلى `createIssue` مستقلة بمرجعها الخاص — التعدد هنا تجربة
 * إدخال فقط، كل صنف يُرحَّل بقيده وتكلفته الفعلية بنفسه كما كان.
 */
export function openIssueModal(context, { items, warehouses, costCenters }) {
  const form = {
    warehouseId: warehouses[0]?.id ?? 1,
    costCenterId: costCenters[0]?.id ?? 1,
    date: new Date().toISOString().slice(0, 10),
    reason: "صرف تشغيل وإنتاج",
    notes: "",
    lines: [{ itemId: items[0]?.id ?? 1, quantity: 5 }],
  };

  const linesHost = el("div", { class: "space-y-2.5" });

  function paintLines() {
    render(
      linesHost,
      ...form.lines.map((line, index) =>
        el(
          "div",
          { class: "flex items-end gap-2" },
          el(
            "div",
            { class: "flex-1" },
            selectField({
              label: index === 0 ? "الصنف المراد صرفه" : null,
              required: true,
              value: String(line.itemId),
              options: items.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` })),
              onChange: value((v) => (line.itemId = Number(v))),
            }),
          ),
          el(
            "div",
            { class: "w-28 shrink-0" },
            textField({
              label: index === 0 ? "الكمية" : null,
              type: "number",
              required: true,
              value: String(line.quantity),
              onInput: numberValue((v) => (line.quantity = v)),
            }),
          ),
          form.lines.length > 1
            ? iconButton("trash", {
                label: "حذف هذا الصنف",
                onClick: () => {
                  form.lines.splice(index, 1);
                  paintLines();
                },
              })
            : el("span", { class: "size-9 shrink-0" }),
        ),
      ),
    );
  }

  paintLines();

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
            label: "مستودع الصرف",
            required: true,
            value: String(form.warehouseId),
            options: warehouses.map((w) => ({ value: w.id, label: w.name })),
            onChange: value((v) => (form.warehouseId = Number(v))),
          }),
          selectField({
            label: "مركز التكلفة المستفيد",
            value: String(form.costCenterId),
            options: costCenters.map((cc) => ({ value: cc.id, label: `${cc.code} — ${cc.name}` })),
            onChange: value((v) => (form.costCenterId = Number(v))),
          }),
        ),

        linesHost,
        button({
          label: "+ إضافة صنف آخر",
          variant: "secondary",
          size: "sm",
          onClick: () => {
            form.lines.push({ itemId: items[0]?.id ?? 1, quantity: 5 });
            paintLines();
          },
        }),

        el(
          "div",
          { class: "grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2 border-t border-line" },
          dateFieldWithLabel({
            label: "تاريخ الصرف",
            required: true,
            value: form.date,
            onChange: value((v) => (form.date = v)),
          }),
          textField({
            label: "سبب أو غرض الصرف",
            value: form.reason,
            onInput: value((v) => (form.reason = v)),
          }),
        ),

        el(
          "p",
          { class: "text-xs text-muted leading-relaxed bg-subtle border border-line rounded-xl p-3" },
          "التكلفة المحسوبة تُثبَّت على كل حركة للتدقيق عبر محرك التقييم (FIFO / المتوسط المرجّح) " +
            "ويُنشأ قيد اليومية آليًا لكل صنف: مصروف المركز مدين والمخزون دائن.",
        ),
      ),

    onSubmit: async () => {
      if (form.lines.some((line) => !line.itemId || !(Number(line.quantity) > 0))) {
        throw new Error("يرجى تحديد صنف وكمية صحيحة لكل سطر.");
      }

      for (const line of form.lines) {
        await createIssue({
          itemId: line.itemId,
          warehouseId: form.warehouseId,
          quantity: Number(line.quantity),
          costCenterId: Number(form.costCenterId),
          date: form.date,
          reason: form.reason.trim(),
          notes: form.notes.trim() || undefined,
        });
      }
    },

    onDone: async () => {
      invalidateLookups();
      await context.reload?.();
    },
  });
}

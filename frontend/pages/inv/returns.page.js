/**
 * استرجاع صرف من مريض.
 *
 * المريض لم يأخذ الدواء، أو أخذ بعضه: الكمية ترجع للرف بتكلفتها الأصلية،
 * والمبلغ يُرفع عن حسابه. القائمة تعرض البنود القابلة للاسترجاع وحدها —
 * غير المفوترة، في نطاق مخزن المستخدم — فلا يفتح أحد نافذةً ليُرفض بعدها.
 */

import { el } from "../../js/core/dom.js";
import { button, buttonGroup } from "../../components/common/button.js";
import { statTile } from "../../components/common/card.js";
import { currency, integer } from "../../js/core/format.js";
import * as money from "../../js/core/money.js";
import { listPage } from "../_shared/list-page.js";
import { codeColumn, nameColumn, textColumn, quantityColumn, moneyColumn, dateColumn } from "../_shared/cells.js";
import { formModal, numberValue, value } from "../_shared/forms.js";
import { textField } from "../../components/forms/fields.js";
import { listReturnableDispenses, returnDispensedToPatient } from "../../js/api/dispensing.api.js";

export default async function returnsPage() {
  return listPage({
    title: "استرجاع صرف من مريض",
    description:
      "البنود المصروفة التي لم تُفوتر بعد. الاسترجاع يُرجع الكمية للمخزن بتكلفتها الأصلية ويرفع قيمتها عن حساب المريض.",
    tableId: "inv-returns",
    searchPlaceholder: "بحث باسم المريض أو الصنف أو مرجع الصرف…",
    fetch: listReturnableDispenses,

    emptyMessage:
      "لا توجد بنود قابلة للاسترجاع — كل ما صُرف إما استُرجع أو أُدرج في فاتورة صادرة. " +
      "والبند المفوتر يُعالَج بإشعار دائن لا بالاسترجاع.",

    columns: [
      dateColumn("date", "تاريخ الصرف"),
      codeColumn("sourceRef", "مرجع الصرف", { width: "10rem" }),
      textColumn("patientName", "المريض", { width: "13rem" }),
      nameColumn("serviceName", "itemCode", "الصنف المصروف", { width: "18rem" }),
      quantityColumn("quantity", "الكمية المصروفة"),
      moneyColumn("unitPrice", "سعر الوحدة"),
      moneyColumn("amount", "المحمَّل على المريض"),
      textColumn("warehouseName", "المخزن", { width: "11rem", muted: true }),
    ],

    rowActions: (row, context) =>
      buttonGroup(
        button({
          label: "استرجاع",
          variant: "secondary",
          size: "sm",
          icon: "refresh",
          permission: "inv.dispense.return",
          onClick: () => openReturnModal(context, row),
        }),
      ),

    stats: async () => {
      const { data, meta } = await listReturnableDispenses({ perPage: 500 });
      const totalValue = money.sumBy(data, "amount");
      const patients = new Set(data.map((r) => String(r.patientId))).size;

      return [
        statTile({
          label: "بنود قابلة للاسترجاع",
          value: integer(meta.total),
          hint: "غير مفوترة بعد",
          tone: "neutral",
          icon: "refresh",
        }),
        statTile({
          label: "قيمتها على حسابات المرضى",
          value: currency(totalValue),
          tone: "brand",
          icon: "money",
        }),
        statTile({
          label: "عدد المرضى",
          value: integer(patients),
          tone: "info",
          icon: "users",
        }),
      ];
    },
  });
}

/* ========================================================================== */

function openReturnModal(context, row) {
  const form = { quantity: row.quantity, reason: "" };

  const summaryHost = el("div");

  function paintSummary() {
    const qty = Math.max(0, Math.min(Number(form.quantity) || 0, row.quantity));
    const refunded = money.multiply(row.unitPrice ?? 0, qty);
    const remaining = row.quantity - qty;

    summaryHost.replaceChildren(
      el(
        "div",
        { class: "p-3 rounded-xl bg-subtle border border-line text-xs space-y-1.5" },
        el(
          "div",
          { class: "flex items-center justify-between" },
          el("span", { class: "text-muted" }, "يُرفع عن حساب المريض"),
          el("span", { class: "font-black num text-brand-700 dark:text-brand-300" }, currency(refunded)),
        ),
        el(
          "div",
          { class: "flex items-center justify-between" },
          el("span", { class: "text-muted" }, "يتبقّى على حسابه"),
          el(
            "span",
            { class: "font-bold num text-ink" },
            `${integer(remaining)} ${remaining ? "وحدة" : "— البند يُحذف بالكامل"}`,
          ),
        ),
      ),
    );
  }

  paintSummary();

  formModal({
    title: "استرجاع صنف مصروف",
    subtitle: `${row.serviceName} — ${row.patientName}`,
    size: "md",
    submitLabel: "تنفيذ الاسترجاع",
    success: "تم الاسترجاع: رجعت الكمية للمخزن ورُفعت قيمتها عن حساب المريض.",

    body: () =>
      el(
        "div",
        { class: "space-y-4" },
        el(
          "div",
          { class: "grid grid-cols-2 gap-3 text-xs" },
          infoCell("المصروف", `${integer(row.quantity)} وحدة`),
          infoCell("سعر الوحدة", currency(row.unitPrice ?? 0)),
          infoCell("مرجع الصرف", row.sourceRef ?? "—"),
          infoCell("المخزن", row.warehouseName ?? "—"),
        ),

        textField({
          label: "الكمية المرتجعة",
          type: "number",
          min: "1",
          max: String(row.quantity),
          required: true,
          value: String(form.quantity),
          onInput: numberValue((v) => {
            form.quantity = v;
            paintSummary();
          }),
        }),

        summaryHost,

        textField({
          label: "سبب الاسترجاع",
          placeholder: "المريض لم يأخذ الدواء، أو أُلغيت الوصفة…",
          value: form.reason,
          onInput: value((v) => (form.reason = v)),
        }),

        el(
          "p",
          { class: "text-xs text-muted leading-relaxed bg-subtle border border-line rounded-xl p-3" },
          "الكمية ترجع للمخزن بتكلفتها الأصلية المثبَّتة على حركة صرفها لا بتكلفة اليوم — " +
            "فالاسترجاع لا يُنتج ربحًا ولا خسارة.",
        ),
      ),

    onSubmit: () => {
      const qty = Number(form.quantity);
      if (!(qty > 0) || qty > row.quantity) {
        throw new Error(`الكمية المرتجعة يجب أن تكون بين 1 و ${row.quantity}.`);
      }

      return returnDispensedToPatient({
        chargeId: row.id,
        quantity: qty,
        reason: form.reason.trim() || undefined,
      });
    },

    onDone: async () => {
      await context.reload?.();
    },
  });
}

function infoCell(label, text) {
  return el(
    "div",
    { class: "space-y-0.5" },
    el("span", { class: "block text-faint" }, label),
    el("span", { class: "block font-bold text-ink num" }, text),
  );
}

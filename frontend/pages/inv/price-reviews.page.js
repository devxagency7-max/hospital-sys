/**
 * مراجعة وتحديث أسعار البيع — شاشة مدير الحسابات والمدير المالي.
 *
 * عندما يستلم أمين المخزن بضائع بسعر شراء جديد (مختلف عن السعر السابق)،
 * لا تتغير أسعار بيع الأصناف للمرضى تلقائيًا، ولا يملك أمين المخزن صلاحية
 * تحديد سعر البيع. هنا يراجع مدير الحسابات التكلفة الجديدة، ويحدد نسبة
 * الزيادة وهامش الربح، ويعتمد سعر البيع الجديد أو يقرر تثبيته.
 */

import { el, cx } from "../../js/core/dom.js";
import { button, buttonGroup } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import * as money from "../../js/core/money.js";
import { listPage } from "../_shared/list-page.js";
import {
  codeColumn,
  nameColumn,
  textColumn,
  moneyColumn,
  dateColumn,
} from "../_shared/cells.js";
import { formModal, value, numberValue, moneyField } from "../_shared/forms.js";
import { textField, textarea } from "../../components/forms/fields.js";
import {
  listPriceReviews,
  approvePriceReview,
} from "../../js/api/inventory.api.js";
import { invalidateLookups } from "../../js/api/lookups.api.js";

export default async function priceReviewsPage() {
  return listPage({
    title: "مراجعة وتحديث أسعار البيع",
    description:
      "اعتماد أسعار البيع وهوامش الربح للأصناف بعد تغير أسعار الشراء في أذون التوريد المخزنية (خاص بمدير الحسابات).",
    tableId: "inv-price-reviews",
    searchPlaceholder: "بحث بكود الصنف أو الاسم أو رقم إذن الإضافة…",
    initialParams: { status: "pending", sort: "date", order: "desc" },
    fetch: listPriceReviews,

    filters: [
      {
        key: "status",
        label: "حالة الاعتماد",
        options: [
          { value: "all", label: "جميع الحالات" },
          { value: "pending", label: "قيد المراجعة (معلقة)" },
          { value: "approved", label: "تم اعتمادها وتحديثها" },
          { value: "kept_unchanged", label: "مثبّتة دون تغيير" },
        ],
      },
    ],

    columns: [
      dateColumn("date", "تاريخ التوريد", { width: "8.5rem" }),
      codeColumn("receiptReference", "رقم إذن الإضافة", { width: "9.5rem" }),
      nameColumn("itemName", "itemCode", "الصنف المستلم", { width: "16rem" }),
      textColumn("category", "التصنيف", { width: "10rem", muted: true }),
      moneyColumn("oldPurchasePrice", "سعر الشراء السابق", { width: "8.5rem" }),
      moneyColumn("newPurchasePrice", "سعر الشراء الجديد", { width: "8.5rem" }),
      {
        key: "changePercent",
        label: "نسبة التغير",
        align: "center",
        width: "7.5rem",
        render: (row) => {
          const val = Number(row.changePercent || 0);
          const isUp = val > 0;
          return el(
            "span",
            {
              class: cx(
                "px-2 py-0.5 rounded-full text-xs font-semibold num inline-block",
                isUp
                  ? "bg-warning-50 text-warning-800 border border-warning-200"
                  : "bg-success-50 text-success-800 border border-success-200",
              ),
            },
            isUp ? `+${val}%` : `${val}%`,
          );
        },
      },
      moneyColumn("currentSellingPrice", "سعر البيع الحالي", { width: "8.5rem" }),
      {
        key: "currentMarginPct",
        label: "هامش الربح",
        align: "center",
        width: "6.5rem",
        render: (row) =>
          el("span", { class: "text-xs num text-faint" }, `${row.currentMarginPct ?? 0}%`),
      },
      moneyColumn("suggestedSellingPrice", "المقترح بنفس الهامش", {
        width: "9.5rem",
        tooltip: "سعر البيع المقترح الذي يحافظ بدقة على نفس نسبة هامش الربح السابقة للصنف",
      }),
      {
        key: "status",
        label: "الحالة",
        align: "center",
        width: "8.5rem",
        render: (row) => {
          if (row.status === "pending") return badge("قيد المراجعة", { tone: "warning" });
          if (row.status === "approved") return badge("معتمد ومحدّث", { tone: "success" });
          return badge("مثبّت دون تغيير", { tone: "neutral" });
        },
      },
      textColumn("decidedBy", "معتمد بواسطة", { width: "11rem", muted: true }),
    ],

    rowActions: (row, context) =>
      buttonGroup(
        button({
          label: row.status === "pending" ? "مراجعة واعتماد السعر" : "تعديل السعر",
          variant: row.status === "pending" ? "primary" : "secondary",
          size: "sm",
          icon: row.status === "pending" ? "check" : "edit",
          onClick: () => openDecisionModal(context, row),
        }),
      ),

    stats: async () => {
      const { meta } = await listPriceReviews({ perPage: 1 });

      return [
        statTile({
          label: "طلبات تسعير معلقة",
          value: integer(meta.pendingCount ?? 0),
          hint: "تنتظر مراجعة وقرار مدير الحسابات",
          tone: (meta.pendingCount ?? 0) > 0 ? "warning" : "success",
          icon: "clock",
        }),
        statTile({
          label: "أسعار بيع تم اعتمادها",
          value: integer(meta.approvedCount ?? 0),
          hint: "مطبقة حاليًا في حسابات وخدمات المرضى",
          tone: "success",
          icon: "check",
        }),
        statTile({
          label: "أسعار تم تثبيتها",
          value: integer(meta.keptCount ?? 0),
          hint: "تم الإبقاء على سعر المريض السابق",
          tone: "neutral",
          icon: "inventory",
        }),
        statTile({
          label: "متوسط هامش الربح المعتمد",
          value: `${meta.averageMargin ?? 35}%`,
          hint: "النسبة الربحية المستهدفة",
          tone: "brand",
          icon: "money",
        }),
      ];
    },
  });
}

/* ==========================================================================
   نافذة مراجعة وقرار التسعير
   ========================================================================== */

function openDecisionModal(context, row) {
  const oldCost = Number(row.oldPurchasePrice || 0);
  const newCost = Number(row.newPurchasePrice || 0);
  const curSale = Number(row.currentSellingPrice || 0);
  const suggestedSale = Number(row.suggestedSellingPrice || (newCost * 1.35));

  // الهامش المبدئي المقترح
  const initialMargin =
    newCost > 0
      ? Number((((suggestedSale - newCost) / newCost) * 100).toFixed(1))
      : 35.0;

  const form = {
    action: "update_price", // "update_price" | "keep_price"
    targetMarginPct: initialMargin,
    newSellingPrice: suggestedSale,
    decisionNotes: "",
  };

  const previewHost = el("div");
  const marginInputHost = el("div");
  const priceInputHost = el("div");

  function recalculateFromMargin(marginPct) {
    form.targetMarginPct = Number(marginPct);
    form.newSellingPrice = money.round(newCost * (1 + form.targetMarginPct / 100));
    renderInputs();
  }

  function recalculateFromPrice(priceVal) {
    form.newSellingPrice = Number(priceVal);
    if (newCost > 0) {
      form.targetMarginPct = Number((((form.newSellingPrice - newCost) / newCost) * 100).toFixed(1));
    }
    renderInputs();
  }

  function renderInputs() {
    if (form.action === "update_price") {
      marginInputHost.style.display = "block";
      priceInputHost.style.display = "block";

      const marginInput = marginInputHost.querySelector("input");
      if (marginInput && Number(marginInput.value) !== form.targetMarginPct) {
        marginInput.value = String(form.targetMarginPct);
      }

      const priceInput = priceInputHost.querySelector("input");
      if (priceInput && Number(priceInput.value) !== form.newSellingPrice) {
        priceInput.value = String(form.newSellingPrice);
      }
    } else {
      marginInputHost.style.display = "none";
      priceInputHost.style.display = "none";
    }

    renderPreview();
  }

  function renderPreview() {
    const isUpdating = form.action === "update_price";
    const finalPrice = isUpdating ? form.newSellingPrice : curSale;
    const finalMargin =
      newCost > 0
        ? Number((((finalPrice - newCost) / newCost) * 100).toFixed(1))
        : 0;

    previewHost.replaceChildren(
      el(
        "div",
        {
          class:
            "p-3.5 rounded-[var(--radius-card)] bg-surface-subtle border border-line flex flex-col sm:flex-row items-center justify-between gap-3",
        },
        el(
          "div",
          { class: "space-y-0.5 text-xs text-center sm:text-start" },
          el(
            "p",
            { class: "font-semibold text-ink" },
            isUpdating ? "سعر البيع المعتمد الجديد للمريض:" : "الإبقاء على سعر البيع الحالي:",
          ),
          el(
            "p",
            { class: "text-muted text-[11px]" },
            `التكلفة الجديدة: ${amount(newCost)} — هامش الربح الناتج: ${finalMargin}%`,
          ),
        ),
        el(
          "span",
          {
            class: cx(
              "text-lg font-bold num px-3 py-1 rounded-[var(--radius-input)]",
              isUpdating ? "bg-brand-50 text-brand-400 border border-brand-200" : "bg-neutral-100 text-ink",
            ),
          },
          amount(finalPrice),
        ),
      ),
    );
  }

  formModal({
    title: `مراجعة واعتماد سعر البيع — ${row.itemName}`,
    subtitle: `إذن التوريد: ${row.receiptReference} — تاريخ: ${row.date}`,
    size: "lg",
    submitLabel: "اعتماد وحفظ السعر",
    success: "تم اعتماد سعر البيع بنجاح وتطبيقه على النظام وفواتير المرضى.",

    body: () => {
      // 1. بطاقات المقارنة الثلاثية
      const comparisonCards = el(
        "div",
        { class: "grid grid-cols-1 md:grid-cols-3 gap-3" },
        // البطاقة 1: تكلفة الشراء
        el(
          "div",
          { class: "p-3 rounded-[var(--radius-card)] bg-surface-subtle border border-line space-y-1.5" },
          el("span", { class: "text-[11px] font-medium text-faint block" }, "تكلفة الشراء والتوريد"),
          el(
            "div",
            { class: "flex items-baseline justify-between" },
            el("span", { class: "text-xs text-muted" }, "السابق:"),
            el("span", { class: "text-xs num text-ink font-semibold" }, amount(oldCost)),
          ),
          el(
            "div",
            { class: "flex items-baseline justify-between" },
            el("span", { class: "text-xs text-muted" }, "الجديد:"),
            el("span", { class: "text-xs num text-ink font-bold" }, amount(newCost)),
          ),
          el(
            "div",
            { class: "pt-1 border-t border-line flex items-center justify-between text-xs" },
            el("span", { class: "text-faint" }, "نسبة الزيادة:"),
            el(
              "span",
              {
                class: cx(
                  "font-bold num",
                  row.changePercent > 0 ? "text-warning-600" : "text-success-600",
                ),
              },
              `${row.changePercent > 0 ? "+" : ""}${row.changePercent}%`,
            ),
          ),
        ),

        // البطاقة 2: سعر البيع الحالي
        el(
          "div",
          { class: "p-3 rounded-[var(--radius-card)] bg-surface-subtle border border-line space-y-1.5" },
          el("span", { class: "text-[11px] font-medium text-faint block" }, "سعر البيع الحالي للمريض"),
          el(
            "div",
            { class: "flex items-baseline justify-between" },
            el("span", { class: "text-xs text-muted" }, "سعر البيع:"),
            el("span", { class: "text-xs num text-ink font-semibold" }, amount(curSale)),
          ),
          el(
            "div",
            { class: "flex items-baseline justify-between" },
            el("span", { class: "text-xs text-muted" }, "الهامش السابق:"),
            el("span", { class: "text-xs num text-muted" }, `${row.currentMarginPct ?? 0}%`),
          ),
          el(
            "div",
            { class: "pt-1 border-t border-line flex items-center justify-between text-xs" },
            el("span", { class: "text-faint" }, "الهامش بالتكلفة الجديدة:"),
            el(
              "span",
              {
                class: cx(
                  "font-bold num",
                  newCost > 0 && (curSale - newCost) / newCost < 0.15
                    ? "text-danger-600"
                    : "text-ink",
                ),
              },
              `${newCost > 0 ? (((curSale - newCost) / newCost) * 100).toFixed(1) : 0}%`,
            ),
          ),
        ),

        // البطاقة 3: المقترح بنفس الهامش
        el(
          "div",
          {
            class:
              "p-3 rounded-[var(--radius-card)] bg-brand-50/50 border border-brand-200/60 space-y-1.5",
          },
          el(
            "span",
            { class: "text-[11px] font-semibold text-brand-400 block" },
            "السعر المقترح بنفس الهامش",
          ),
          el(
            "div",
            { class: "flex items-baseline justify-between" },
            el("span", { class: "text-xs text-muted" }, "سعر البيع المقترح:"),
            el("span", { class: "text-sm num text-brand-400 font-bold" }, amount(suggestedSale)),
          ),
          el(
            "div",
            { class: "flex items-baseline justify-between" },
            el("span", { class: "text-xs text-muted" }, "هامش الربح المحفوظ:"),
            el("span", { class: "text-xs num text-brand-400 font-semibold" }, `${row.currentMarginPct ?? 0}%`),
          ),
          el(
            "div",
            { class: "pt-1 border-t border-brand-200/40 text-[10px] text-faint" },
            "يحافظ تلقائياً على هامش الربحية السابق للمستشفى",
          ),
        ),
      );

      // 2. خيارات القرار
      const actionRadioUpdate = el("input", {
        type: "radio",
        name: "decisionAction",
        value: "update_price",
        id: "radio-update",
        checked: true,
        class: "mt-0.5",
      });
      const actionRadioKeep = el("input", {
        type: "radio",
        name: "decisionAction",
        value: "keep_price",
        id: "radio-keep",
        class: "mt-0.5",
      });

      actionRadioUpdate.addEventListener("change", () => {
        form.action = "update_price";
        renderInputs();
      });

      actionRadioKeep.addEventListener("change", () => {
        form.action = "keep_price";
        renderInputs();
      });

      const optionsSection = el(
        "div",
        { class: "p-3 rounded-[var(--radius-card)] border border-line bg-surface space-y-2.5 text-xs" },
        el("p", { class: "font-semibold text-ink" }, "قرار مدير الحسابات:"),
        el(
          "div",
          { class: "space-y-2" },
          el(
            "label",
            { class: "flex items-start gap-2.5 cursor-pointer" },
            actionRadioUpdate,
            el(
              "div",
              {},
              el("span", { class: "font-medium text-ink" }, "تعديل سعر البيع وتطبيق نسبة هامش ربح جديدة"),
              el(
                "span",
                { class: "text-[11px] text-muted block" },
                "زيادة سعر بيع الصنف للمريض ليعكس التكلفة الجديدة ويحافظ على ربحية المنشأة.",
              ),
            ),
          ),
          el(
            "label",
            { class: "flex items-start gap-2.5 cursor-pointer" },
            actionRadioKeep,
            el(
              "div",
              {},
              el("span", { class: "font-medium text-ink" }, "تثبيت سعر البيع الحالي للمريض دون زيادة"),
              el(
                "span",
                { class: "text-[11px] text-muted block" },
                "تحمّل المستشفى لفارق التكلفة مؤقتًا والإبقاء على السعر الحالي للمرضى.",
              ),
            ),
          ),
        ),
      );

      // 3. حقول الإدخال التفاعلية
      marginInputHost.appendChild(
        textField({
          label: "نسبة هامش الربح المستهدفة (%)",
          type: "number",
          value: String(form.targetMarginPct),
          onInput: numberValue(recalculateFromMargin),
        }),
      );

      priceInputHost.appendChild(
        moneyField({
          label: "سعر البيع المعتمد الجديد (ج.م)",
          value: form.newSellingPrice,
          onChange: recalculateFromPrice,
        }),
      );

      renderPreview();

      return el(
        "div",
        { class: "space-y-4" },
        comparisonCards,
        optionsSection,
        el(
          "div",
          { class: "grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-line" },
          marginInputHost,
          priceInputHost,
        ),
        previewHost,
        textarea({
          label: "مبررات القرار أو ملاحظات الاعتماد",
          placeholder: "مثال: تم اعتماد تعديل السعر طبقاً لزيادة التكلفة من شركة الأدوية الموزعة…",
          value: form.decisionNotes,
          onInput: value((v) => (form.decisionNotes = v)),
        }),
      );
    },

    onSubmit: () =>
      approvePriceReview(row.id, {
        action: form.action,
        newSellingPrice: form.newSellingPrice,
        decisionNotes: form.decisionNotes.trim(),
      }),

    onDone: async () => {
      invalidateLookups("items");
      await context.reload();
    },
  });
}

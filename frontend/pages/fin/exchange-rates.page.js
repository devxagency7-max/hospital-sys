/**
 * أسعار الصرف.
 *
 * إعلان سعر صرف جديد لعملة أجنبية — يسري على الحركات القادمة فقط ولا
 * يُعدِّل مستندًا صادرًا (القاعدة المعمارية: الفاتورة تحتفظ بسعر يوم
 * إصدارها إلى الأبد). كل الفواتير والحركات تستخدم السعر الساري بتاريخها
 * هي عبر js/domain/pricing.js#rateFor — لا تعديل رجعي من هنا أبدًا.
 */

import { el, render } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { statTile } from "../../components/common/card.js";
import { listPage } from "../_shared/list-page.js";
import { codeColumn, textColumn, dateColumn } from "../_shared/cells.js";
import { formModal, selectField, dateFieldWithLabel, value, numberValue } from "../_shared/forms.js";
import { textField } from "../../components/forms/fields.js";
import { listExchangeRates, declareExchangeRate } from "../../js/api/pricing.api.js";

export default async function exchangeRatesPage() {
  const { data: knownRates } = await listExchangeRates({ perPage: 200 });

  /* أحدث سعر لكل عملة — الصفوف مرتبة الأحدث أولًا، فأول ظهور للعملة يكفي. */
  const seenCurrencies = new Set();
  const knownCurrencies = knownRates.filter((r) => {
    if (seenCurrencies.has(r.currency)) return false;
    seenCurrencies.add(r.currency);
    return true;
  });

  return listPage({
    title: "أسعار الصرف",
    description:
      "السعر الساري لكل عملة أجنبية مقابل الجنيه — يسري على الحركات والفواتير القادمة فقط، ولا يغيّر فاتورة صدرت بسعر يوم إصدارها.",
    tableId: "fin-exchange-rates",
    searchPlaceholder: "بحث بالعملة…",
    initialParams: { sort: "date", order: "desc" },
    fetch: listExchangeRates,

    actions: (context) => [
      button({
        label: "إعلان سعر صرف جديد",
        variant: "primary",
        icon: "plus",
        permission: "pricing.fx.manage",
        onClick: () => openDeclareRateModal(context, { knownCurrencies }),
      }),
    ],

    columns: [
      dateColumn("date", "تاريخ السريان"),
      codeColumn("currency", "العملة", { width: "7rem" }),
      textColumn("name", "الاسم", { width: "11rem" }),
      {
        key: "rate",
        label: "سعر الصرف",
        width: "11rem",
        align: "end",
        render: (row) => el("span", { class: "tabular" }, `1 ${row.currency} = ${row.rate} ج.م`),
      },
      textColumn("source", "المصدر", { width: "12rem", muted: true }),
    ],

    /*
     * السعر الساري لكل عملة — مُشتق من `knownCurrencies` نفسها لا من
     * `meta` القادمة عبر `fetchList`: الأخيرة تُطبَّع لحقول الترقيم
     * القياسية فقط (page/perPage/total) وتُسقط أي حقل إضافي ترجعه خدمة
     * المحاكاة (مثل `current`)، فالاعتماد عليها هنا كان يرمي خطأً دائمًا.
     */
    stats: () => [
      statTile({
        label: "عملات مُعلَنة",
        value: String(knownCurrencies.length),
        tone: "neutral",
        icon: "money",
      }),
      ...[...knownCurrencies]
        .sort((a, b) => (a.currency === "USD" ? -1 : b.currency === "USD" ? 1 : 0))
        .slice(0, 3)
        .map((c) =>
        statTile({
          label: `سعر ${c.name} الساري`,
          value: `1 ${c.currency} = ${c.rate} ج.م`,
          hint: `منذ ${c.date}`,
          tone: "brand",
          icon: "money",
        }),
      ),
    ],
  });
}

/* ========================================================================== */

function openDeclareRateModal(context, { knownCurrencies }) {
  let isNewCurrency = knownCurrencies.length === 0;

  const form = {
    currency: knownCurrencies[0]?.currency ?? "",
    name: knownCurrencies[0]?.name ?? "",
    symbol: knownCurrencies[0]?.symbol ?? "",
    rate: knownCurrencies[0]?.rate ?? 1,
    date: new Date().toISOString().slice(0, 10),
    source: "إعلان يدوي",
  };

  const newCurrencyHost = el("div");

  function paintNewCurrencyFields() {
    render(
      newCurrencyHost,
      isNewCurrency
        ? el(
            "div",
            { class: "grid grid-cols-1 md:grid-cols-3 gap-3.5" },
            textField({
              label: "كود العملة (مثال: USD)",
              required: true,
              value: form.currency,
              onInput: value((v) => (form.currency = v.toUpperCase())),
            }),
            textField({
              label: "اسم العملة",
              required: true,
              value: form.name,
              onInput: value((v) => (form.name = v)),
            }),
            textField({
              label: "رمز العملة ($)",
              required: true,
              value: form.symbol,
              onInput: value((v) => (form.symbol = v)),
            }),
          )
        : null,
    );
  }

  paintNewCurrencyFields();

  formModal({
    title: "إعلان سعر صرف جديد",
    subtitle: "يسري على الحركات والفواتير القادمة فقط — لا يُعدِّل مستندًا صدر بسعر سابق",
    size: "md",
    submitLabel: "إعلان السعر",
    success: "تم إعلان سعر الصرف بنجاح",

    body: () =>
      el(
        "div",
        { class: "space-y-4" },
        selectField({
          label: "العملة",
          required: true,
          value: isNewCurrency ? "__new__" : form.currency,
          options: [
            ...knownCurrencies.map((c) => ({ value: c.currency, label: `${c.name} (${c.currency})` })),
            { value: "__new__", label: "+ عملة جديدة غير مُعلَنة من قبل" },
          ],
          onChange: value((v) => {
            isNewCurrency = v === "__new__";
            if (isNewCurrency) {
              form.currency = "";
              form.name = "";
              form.symbol = "";
            } else {
              const known = knownCurrencies.find((c) => c.currency === v);
              form.currency = v;
              form.name = known?.name ?? v;
              form.symbol = known?.symbol ?? v;
              form.rate = known?.rate ?? form.rate;
            }
            paintNewCurrencyFields();
          }),
        }),

        newCurrencyHost,

        el(
          "div",
          { class: "grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2 border-t border-line" },
          textField({
            label: "سعر الصرف (مقابل الجنيه)",
            type: "number",
            step: "0.01",
            required: true,
            value: String(form.rate),
            onInput: numberValue((v) => (form.rate = v)),
          }),
          dateFieldWithLabel({
            label: "تاريخ السريان",
            required: true,
            value: form.date,
            onChange: value((v) => (form.date = v)),
          }),
        ),

        textField({
          label: "المصدر",
          value: form.source,
          onInput: value((v) => (form.source = v)),
        }),

        el(
          "p",
          { class: "text-xs text-muted leading-relaxed bg-subtle border border-line rounded-xl p-3" },
          "السعر يسري على الحركات والفواتير التي تُصدر بعد هذا التاريخ فقط. أي فاتورة صدرت سابقًا تحتفظ بسعرها يوم إصدارها إلى الأبد.",
        ),
      ),

    onSubmit: () =>
      declareExchangeRate({
        currency: form.currency.trim().toUpperCase(),
        name: form.name.trim(),
        symbol: form.symbol.trim(),
        rate: Number(form.rate),
        date: form.date,
        source: form.source.trim() || undefined,
      }),

    onDone: async () => {
      await context.reload();
    },
  });
}

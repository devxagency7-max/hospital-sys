/**
 * حقول النماذج.
 *
 * كل حقل يُغلَّف بـ `field()` التي تتولى التسمية وعلامة الإلزام ورسالة الخطأ
 * وربط `aria-describedby`. الربط اليدوي في كل نموذج يُنسى، فتظهر رسالة الخطأ
 * بصريًا دون أن يسمعها قارئ الشاشة.
 */

import { el, cx, uid } from "../../js/core/dom.js";
import { icon } from "../common/icon.js";

const CONTROL_BASE =
  "w-full bg-surface border rounded-[var(--radius-control)] text-sm text-ink " +
  "placeholder:text-faint transition-colors outline-none " +
  "disabled:bg-subtle disabled:text-faint disabled:cursor-not-allowed " +
  "read-only:bg-subtle";

const CONTROL_SIZES = { sm: "h-8 px-2.5 text-xs", md: "h-9 px-3", lg: "h-11 px-3.5" };

function controlClasses({ size = "md", invalid = false, class: className } = {}) {
  return cx(
    CONTROL_BASE,
    CONTROL_SIZES[size] ?? CONTROL_SIZES.md,
    invalid
      ? "border-danger-600 focus:border-danger-600"
      : "border-line-strong hover:border-faint focus:border-brand-500",
    className,
  );
}

/**
 * غلاف الحقل.
 *
 * @param {object} options
 * @param {string} [options.label]
 * @param {Node} options.control
 * @param {boolean} [options.required]
 * @param {string} [options.error]
 * @param {string} [options.hint]        نص مساعد — يُخفى عند وجود خطأ
 * @param {string} [options.id]
 * @param {"full"|"half"} [options.span="full"]
 */
export function field({ label, control, required = false, error, hint, id, span = "full" } = {}) {
  // بعض الحقول تُعيد غلافًا (قائمة منسدلة، حقل بسابقة، مربع بحث). السمات
  // يجب أن تُضبط على عنصر الإدخال نفسه وإلا لم يربطه المتصفح بالتسمية.
  const inner = control?.matches?.("input, select, textarea")
    ? control
    : (control?.querySelector?.("input, select, textarea") ?? control);

  const controlId = id ?? inner?.id ?? uid("field");
  const messageId = `${controlId}-message`;

  if (inner) {
    if (!inner.id) inner.id = controlId;

    if (error) {
      inner.setAttribute("aria-invalid", "true");
      inner.setAttribute("aria-describedby", messageId);
    } else if (hint) {
      inner.setAttribute("aria-describedby", messageId);
    }
    if (required) inner.setAttribute("aria-required", "true");
  }

  return el(
    "div",
    { class: cx("min-w-0", span === "half" && "sm:col-span-1") },
    label
      ? el(
          "label",
          { for: controlId, class: "block text-xs font-medium text-ink mb-1.5" },
          label,
          required
            ? el("span", { class: "text-danger-600 ms-0.5", "aria-hidden": "true" }, "*")
            : null,
        )
      : null,
    control,
    error
      ? el(
          "p",
          { id: messageId, class: "flex items-start gap-1 text-xs text-danger-700 mt-1.5" },
          icon("error", { size: 13, class: "mt-0.5" }),
          el("span", {}, error),
        )
      : hint
        ? el("p", { id: messageId, class: "text-xs text-faint mt-1.5" }, hint)
        : null,
  );
}

/* ==========================================================================
   عناصر الإدخال
   ========================================================================== */

/**
 * حقل نص.
 * @param {object} options { name, value, placeholder, type, size, invalid, onInput, onChange, ... }
 */
export function input({
  name,
  value = "",
  type = "text",
  placeholder,
  size = "md",
  invalid = false,
  disabled = false,
  readOnly = false,
  required = false,
  onInput,
  onChange,
  onBlur,
  prefix,
  suffix,
  class: className,
  ...rest
} = {}) {
  const control = el("input", {
    type,
    name,
    value,
    placeholder,
    disabled,
    readOnly,
    required,
    // `inputMode` يفتح لوحة الأرقام على الموبايل، وهو فرق محسوس في إدخال المبالغ.
    inputmode: type === "number" ? "decimal" : type === "tel" ? "tel" : undefined,
    class: controlClasses({
      size,
      invalid,
      class: cx(prefix && "ps-9", suffix && "pe-12", className),
    }),
    onInput,
    onChange,
    onBlur,
    ...rest,
  });

  if (!prefix && !suffix) return control;

  // اللاحقة/السابقة تُطبَّق كطبقة فوق الحقل حتى تبقى الحدود وحلقة التركيز سليمة.
  return el(
    "div",
    { class: "relative" },
    prefix
      ? el(
          "span",
          { class: "absolute inset-y-0 start-0 w-9 grid place-items-center text-faint pointer-events-none" },
          typeof prefix === "string" ? icon(prefix, { size: 15 }) : prefix,
        )
      : null,
    control,
    suffix
      ? el(
          "span",
          { class: "absolute inset-y-0 end-0 px-3 grid place-items-center text-xs text-faint pointer-events-none" },
          suffix,
        )
      : null,
  );
}

/** حقل مبلغ مالي — يضيف رمز العملة ويضبط الخطوة. */
export function moneyInput({ currencyLabel = "ج.م", ...options } = {}) {
  return input({
    ...options,
    type: "number",
    step: "0.01",
    min: options.min ?? "0",
    suffix: currencyLabel,
    class: cx("tabular", options.class),
  });
}

/** حقل كمية — أعداد صحيحة. */
export function quantityInput(options = {}) {
  return input({ ...options, type: "number", step: "1", min: options.min ?? "0", class: cx("tabular", options.class) });
}

/** منطقة نص. */
export function textarea({
  name,
  value = "",
  placeholder,
  rows = 3,
  invalid = false,
  disabled = false,
  onInput,
  onChange,
  class: className,
  ...rest
} = {}) {
  return el("textarea", {
    name,
    rows,
    placeholder,
    disabled,
    class: cx(
      CONTROL_BASE,
      "py-2 px-3 leading-relaxed resize-y min-h-[4.5rem]",
      invalid
        ? "border-danger-600 focus:border-danger-600"
        : "border-line-strong hover:border-faint focus:border-brand-500",
      className,
    ),
    onInput,
    onChange,
    ...rest,
    textContent: value,
  });
}

/**
 * قائمة منسدلة.
 * @param {Array<{value:*,label:string}|string>} options.options
 * @param {string} [options.placeholder] يُنشئ خيارًا فارغًا في الأعلى
 */
export function select({
  name,
  value = "",
  options: choices = [],
  placeholder,
  size = "md",
  invalid = false,
  disabled = false,
  onChange,
  class: className,
  ...rest
} = {}) {
  const normalized = choices.map((choice) =>
    typeof choice === "object" ? choice : { value: choice, label: String(choice) },
  );

  return el(
    "div",
    { class: "relative" },
    el(
      "select",
      {
        name,
        disabled,
        class: controlClasses({
          size,
          invalid,
          class: cx("appearance-none pe-8 bg-none cursor-pointer", className),
        }),
        onChange,
        ...rest,
      },
      placeholder ? el("option", { value: "" }, placeholder) : null,
      ...normalized.map((choice) =>
        el(
          "option",
          { value: String(choice.value), selected: String(choice.value) === String(value) },
          choice.label,
        ),
      ),
    ),
    el(
      "span",
      { class: "absolute inset-y-0 end-0 w-8 grid place-items-center text-faint pointer-events-none" },
      icon("chevronDown", { size: 15 }),
    ),
  );
}

/** مربع اختيار. */
export function checkbox({ name, label, checked = false, disabled = false, onChange, hint } = {}) {
  const id = uid("check");

  return el(
    "div",
    { class: "flex items-start gap-2.5" },
    el("input", {
      type: "checkbox",
      id,
      name,
      checked,
      disabled,
      class:
        "mt-0.5 size-4 shrink-0 rounded border-line-strong text-brand-600 " +
        "accent-brand-600 cursor-pointer disabled:cursor-not-allowed",
      onChange,
    }),
    el(
      "div",
      { class: "min-w-0" },
      el("label", { for: id, class: "text-sm text-ink cursor-pointer select-none" }, label),
      hint ? el("p", { class: "text-xs text-faint mt-0.5" }, hint) : null,
    ),
  );
}

/** مجموعة أزرار راديو. */
export function radioGroup({ name, value, options: choices = [], onChange, inline = false } = {}) {
  return el(
    "div",
    {
      class: cx("flex gap-x-5 gap-y-2", inline ? "flex-row flex-wrap items-center" : "flex-col"),
      role: "radiogroup",
    },
    ...choices.map((choice) => {
      const id = uid("radio");

      return el(
        "div",
        { class: "flex items-center gap-2" },
        el("input", {
          type: "radio",
          id,
          name,
          value: String(choice.value),
          checked: String(choice.value) === String(value),
          class: "size-4 border-line-strong accent-brand-600 cursor-pointer",
          onChange,
        }),
        el("label", { for: id, class: "text-sm text-ink cursor-pointer select-none" }, choice.label),
      );
    }),
  );
}

/**
 * حقل تاريخ.
 *
 * نستخدم `input[type=date]` الأصلي عن قصد: يجلب منتقي التاريخ المحلي للنظام،
 * ويعمل بلوحة المفاتيح، ولا يحتاج مكتبة. القيمة دائمًا `YYYY-MM-DD` — وهي
 * صيغة التبادل مع الـ API مهما كان العرض المحلي.
 */
export function dateField({
  name,
  value = "",
  min,
  max,
  size = "md",
  invalid = false,
  disabled = false,
  onChange,
  ...rest
} = {}) {
  return el("input", {
    type: "date",
    name,
    value,
    min,
    max,
    disabled,
    // منتقي التاريخ الأصلي يعرض أجزاءه بترتيب يعتمد الاتجاه؛ العزل يُثبّته.
    class: controlClasses({ size, invalid, class: "num ltr-start" }),
    onChange,
    ...rest,
  });
}

/** نطاق تاريخين — «من» و«إلى» مرتبطان. */
export function dateRangeField({ fromName = "dateFrom", toName = "dateTo", from = "", to = "", onChange } = {}) {
  let fromValue = from;

  const toInput = dateField({
    name: toName,
    value: to,
    // لا يمكن اختيار «إلى» أسبق من «من» — قيد في الواجهة أوضح من رسالة خطأ.
    min: from || undefined,
    onChange,
  });

  const fromInput = dateField({
    name: fromName,
    value: from,
    max: to || undefined,
    onChange: (evt) => {
      fromValue = evt.target.value;
      toInput.min = fromValue || "";
      if (toInput.value && fromValue && toInput.value < fromValue) toInput.value = fromValue;
      onChange?.(evt);
    },
  });

  return el(
    "div",
    { class: "flex items-center gap-2" },
    el("div", { class: "flex-1 min-w-0" }, fromInput),
    el("span", { class: "text-xs text-faint shrink-0" }, "إلى"),
    el("div", { class: "flex-1 min-w-0" }, toInput),
  );
}

/** مربع بحث مع زر مسح. */
export function searchInput({
  value = "",
  placeholder = "بحث…",
  size = "md",
  onInput,
  onClear,
  class: className,
} = {}) {
  let control;

  const clearButton = el(
    "button",
    {
      type: "button",
      class: cx(
        "absolute inset-y-0 end-0 w-8 grid place-items-center text-faint hover:text-ink transition-colors",
        !value && "hidden",
      ),
      "aria-label": "مسح البحث",
      onClick: () => {
        control.value = "";
        clearButton.classList.add("hidden");
        control.focus();
        onClear?.();
        onInput?.({ target: control });
      },
    },
    icon("close", { size: 14 }),
  );

  control = el("input", {
    type: "search",
    value,
    placeholder,
    // نُخفي زر المسح الأصلي في WebKit لأننا نوفّر زرًا متسقًا.
    class: controlClasses({
      size,
      class: cx("ps-9 pe-8 [&::-webkit-search-cancel-button]:hidden", className),
    }),
    onInput: (evt) => {
      clearButton.classList.toggle("hidden", !evt.target.value);
      onInput?.(evt);
    },
  });

  return el(
    "div",
    { class: "relative", role: "search" },
    el(
      "span",
      { class: "absolute inset-y-0 start-0 w-9 grid place-items-center text-faint pointer-events-none" },
      icon("search", { size: 15 }),
    ),
    control,
    clearButton,
  );
}

/** شبكة نموذج متجاوبة. */
export function formGrid(...children) {
  return el("div", { class: "grid gap-4 sm:grid-cols-2" }, ...children.flat().filter(Boolean));
}

/** قسم داخل نموذج طويل. */
export function formSection({ title, description, children }) {
  return el(
    "div",
    { class: "pt-5 first:pt-0 border-t border-line first:border-0" },
    title
      ? el(
          "div",
          { class: "mb-3.5" },
          el("h3", { class: "text-sm font-semibold text-ink" }, title),
          description ? el("p", { class: "text-xs text-muted mt-0.5" }, description) : null,
        )
      : null,
    ...[children].flat().filter(Boolean),
  );
}

/** تذييل أزرار النموذج. */
export function formActions(...buttons) {
  return el(
    "div",
    { class: "flex items-center gap-2 pt-5 mt-5 border-t border-line" },
    ...buttons.flat().filter(Boolean),
  );
}

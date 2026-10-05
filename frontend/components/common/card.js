/**
 * الكروت وبطاقات المؤشرات.
 */

import { el, cx } from "../../js/core/dom.js";
import { icon } from "./icon.js";
import { badge } from "./badge.js";

/**
 * كرت عام.
 *
 * @param {object} options
 * @param {string} [options.title]
 * @param {string} [options.subtitle]
 * @param {Node} [options.actions]   أزرار في رأس الكرت
 * @param {Node|Node[]} options.body
 * @param {Node} [options.footer]
 * @param {boolean} [options.flush]  يلغي الحشو الداخلي — للجداول داخل الكروت
 */
export function card({ title, subtitle, actions, body, footer, flush = false, class: className } = {}) {
  const hasHeader = title || subtitle || actions;

  return el(
    "section",
    {
      class: cx(
        "bg-surface border border-line rounded-[var(--radius-card)] shadow-card",
        className,
      ),
    },
    hasHeader
      ? el(
          "header",
          {
            class: cx(
              "flex items-start justify-between gap-4 px-4 py-3",
              (body || footer) && "border-b border-line",
            ),
          },
          el(
            "div",
            { class: "min-w-0" },
            title ? el("h2", { class: "text-sm font-semibold text-ink truncate-1" }, title) : null,
            subtitle ? el("p", { class: "text-xs text-muted mt-0.5" }, subtitle) : null,
          ),
          actions ? el("div", { class: "shrink-0 flex items-center gap-2" }, actions) : null,
        )
      : null,
    body ? el("div", { class: flush ? "" : "p-4" }, body) : null,
    footer
      ? el("footer", { class: "px-4 py-3 border-t border-line bg-subtle rounded-b-[var(--radius-card)]" }, footer)
      : null,
  );
}

const TREND_TONES = {
  up: { tone: "success", icon: "arrowUp" },
  down: { tone: "danger", icon: "arrowDown" },
  flat: { tone: "neutral", icon: null },
};

/**
 * بطاقة مؤشر — الوحدة الأساسية في لوحة التحكم.
 *
 * @param {object} options
 * @param {string} options.label
 * @param {string|number} options.value    مُنسَّق مسبقًا عبر js/core/format.js
 * @param {string} [options.hint]          سطر توضيحي أسفل الرقم
 * @param {string} [options.icon]
 * @param {"brand"|"success"|"warning"|"danger"|"info"|"neutral"} [options.tone="brand"]
 * @param {{ direction:"up"|"down"|"flat", label:string }} [options.trend]
 * @param {string} [options.href]          يجعل البطاقة قابلة للنقر
 */
export function statCard({
  label,
  value,
  hint,
  icon: iconName,
  tone = "brand",
  trend,
  href,
  loading = false,
} = {}) {
  const ICON_TONES = {
    brand: "bg-brand-50 text-brand-600",
    success: "bg-success-50 text-success-600",
    warning: "bg-warning-50 text-warning-600",
    danger: "bg-danger-50 text-danger-600",
    info: "bg-info-50 text-info-600",
    neutral: "bg-subtle text-muted",
  };

  const inner = [
    el(
      "div",
      { class: "flex items-start justify-between gap-3" },
      el(
        "div",
        { class: "min-w-0" },
        el("p", { class: "text-xs font-medium text-muted truncate-1" }, label),
        loading
          ? el("div", { class: "hx-skeleton h-7 w-24 mt-2" })
          : el("p", { class: "text-2xl font-semibold text-ink mt-1 tabular" }, String(value ?? "—")),
      ),
      iconName
        ? el(
            "span",
            { class: cx("shrink-0 grid place-items-center size-9 rounded-[var(--radius-control)]", ICON_TONES[tone]) },
            icon(iconName, { size: 18 }),
          )
        : null,
    ),
    hint || trend
      ? el(
          "div",
          { class: "flex items-center gap-2 mt-2.5" },
          trend && TREND_TONES[trend.direction]
            ? badge(trend.label, { tone: TREND_TONES[trend.direction].tone, size: "sm" })
            : null,
          hint ? el("span", { class: "text-xs text-faint truncate-1" }, hint) : null,
        )
      : null,
  ];

  const classes = cx(
    "block bg-surface border border-line rounded-[var(--radius-card)] shadow-card p-4",
    href && "transition-colors hover:border-brand-300 hover:shadow-raised",
  );

  return href
    ? el("a", { href, class: classes }, ...inner)
    : el("div", { class: classes }, ...inner);
}

/** شبكة مؤشرات متجاوبة. */
export function statGrid(...cards) {
  return el(
    "div",
    { class: "grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" },
    ...cards.flat().filter(Boolean),
  );
}

/** صف بيانات «تسمية: قيمة» — يُستخدم كثيرًا في شاشات التفاصيل. */
export function dataRow(label, value, { tone } = {}) {
  return el(
    "div",
    { class: "flex items-start justify-between gap-4 py-2 border-b border-line last:border-0" },
    el("dt", { class: "text-xs text-muted shrink-0" }, label),
    el(
      "dd",
      {
        class: cx(
          "text-sm text-ink text-end min-w-0 break-words",
          tone === "danger" && "text-danger-700 font-medium",
          tone === "success" && "text-success-700 font-medium",
        ),
      },
      value instanceof Node ? value : String(value ?? "—"),
    ),
  );
}

/** قائمة وصفية من `dataRow`. */
export function dataList(...rows) {
  return el("dl", { class: "divide-y-0" }, ...rows.flat().filter(Boolean));
}

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
        "glass-card rounded-2xl overflow-hidden shadow-card transition-all duration-200",
        className,
      ),
    },
    hasHeader
      ? el(
          "header",
          {
            class: cx(
              "flex items-start justify-between gap-4 px-5 py-3.5",
              (body || footer) && "border-b border-black/[0.05] dark:border-white/[0.08]",
            ),
          },
          el(
            "div",
            { class: "min-w-0" },
            title ? el("h2", { class: "text-[15px] font-bold text-slate-900 dark:text-white truncate-1" }, title) : null,
            subtitle ? el("p", { class: "text-xs text-muted mt-0.5" }, subtitle) : null,
          ),
          actions ? el("div", { class: "shrink-0 flex items-center gap-2" }, actions) : null,
        )
      : null,
    body ? el("div", { class: flush ? "" : "p-5" }, body) : null,
    footer
      ? el("footer", { class: "px-5 py-3 border-t border-black/[0.05] dark:border-white/[0.08] bg-white/20 dark:bg-white/[0.02]" }, footer)
      : null,
  );
}

const TREND_TONES = {
  up: { tone: "success", icon: "arrowUp" },
  down: { tone: "danger", icon: "arrowDown" },
  flat: { tone: "neutral", icon: null },
};

const TONE_ACCENTS = {
  brand: "border-e-[4px] border-e-blue-600",
  success: "border-e-[4px] border-e-emerald-500",
  warning: "border-e-[4px] border-e-amber-500",
  danger: "border-e-[4px] border-e-rose-500",
  info: "border-e-[4px] border-e-sky-500",
  purple: "border-e-[4px] border-e-indigo-500",
  neutral: "border-e-[4px] border-e-slate-400",
};

/**
 * بطاقة مؤشر — الوحدة الأساسية في لوحة التحكم (Glass Capsule).
 *
 * @param {object} options
 * @param {string} options.label
 * @param {string|number} options.value    مُنسَّق مسبقًا عبر js/core/format.js
 * @param {string} [options.hint]          سطر توضيحي أسفل الرقم
 * @param {string} [options.icon]
 * @param {"brand"|"success"|"warning"|"danger"|"info"|"purple"|"neutral"} [options.tone="brand"]
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
    brand: "bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/25",
    success: "bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md shadow-emerald-500/25",
    warning: "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/25",
    danger: "bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-md shadow-rose-500/25",
    info: "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25",
    purple: "bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/25",
    neutral: "bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-md shadow-slate-600/20",
  };

  const inner = [
    el(
      "div",
      { class: "flex items-center justify-between gap-2" },
      el("p", { class: "text-xs font-bold text-slate-500 dark:text-slate-400 truncate-1 tracking-wide" }, label),
      iconName
        ? el(
            "span",
            { class: cx("shrink-0 grid place-items-center size-9 rounded-xl transition-transform duration-300", ICON_TONES[tone] ?? ICON_TONES.brand) },
            icon(iconName, { size: 17 }),
          )
        : null,
    ),
    loading
      ? el("div", { class: "hx-skeleton h-8 w-24 mt-2" })
      : el("p", { class: "text-2xl sm:text-[26px] font-black text-slate-900 dark:text-white tabular tracking-tight leading-none mt-2" }, String(value ?? "—")),
    hint || trend
      ? el(
          "div",
          { class: "flex items-center gap-2 mt-2.5 pt-2 border-t border-black/[0.04] dark:border-white/[0.06]" },
          trend && TREND_TONES[trend.direction]
            ? badge(trend.label, { tone: TREND_TONES[trend.direction].tone, size: "sm" })
            : null,
          hint ? el("span", { class: "text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate-1" }, hint) : null,
        )
      : null,
  ];

  const classes = cx(
    "hx-press block glass-card rounded-2xl shadow-card p-4",
    "transition-all duration-300 hover:-translate-y-1 hover:shadow-raised border border-white/80 dark:border-white/10",
    href && "cursor-pointer",
  );

  return href
    ? el("a", { href, class: classes }, ...inner)
    : el("div", { class: classes }, ...inner);
}

/** اسم بديل لـ statCard */
export const statTile = statCard;

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
          tone === "danger" && "text-danger-300 font-medium",
          tone === "success" && "text-success-300 font-medium",
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

/**
 * بطاقة مؤشر لوحة التحكم — النمط الطبي التنفيذي الفاخر (Medical Executive Glass).
 *
 * كروت زجاجية نقية بيضاء عالية التباين، أرقام عريضة فخمة، أيقونات متدرجة فاخرة
 * وإلغاء ألوان الباستيل الباهتة بالكامل.
 */

import { el, cx } from "../../js/core/dom.js";
import { icon } from "../common/icon.js";
import { badge } from "../common/badge.js";
import { tweenNumber } from "../../js/core/animate.js";
import { registerCleanup } from "../../js/core/lifecycle.js";

/*
 * تدرجات لونية فاخرة لحاويات الأيقونات — هوية طبية عصرية عالية التباين
 */
const ICON_GRADIENTS = {
  brand: "bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/25",
  success: "bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md shadow-emerald-500/25",
  warning: "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/25",
  danger: "bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-md shadow-rose-500/25",
  info: "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25",
  neutral: "bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-md shadow-slate-600/20",
};

const TREND_TONES = {
  up: "success",
  down: "danger",
  flat: "neutral",
};

/**
 * @param {object} options
 * @param {string} options.label
 * @param {number} options.value          الرقم الخام (قبل التنسيق) — يُحرَّك إليه
 * @param {(n:number) => string} [options.format]  ينسّق الرقم عند كل إطار
 * @param {string} [options.hint]
 * @param {string} [options.icon]
 * @param {"brand"|"success"|"warning"|"danger"|"info"|"neutral"} [options.tone="brand"]
 * @param {{ direction:"up"|"down"|"flat", label:string }} [options.trend]
 * @param {string} [options.href]
 * @param {boolean} [options.loading]
 * @param {number} [options.animateDelayMs=0]
 */
export function kpiTile({
  label,
  value,
  format = (n) => String(Math.round(n)),
  hint,
  icon: iconName,
  tone = "brand",
  trend,
  href,
  loading = false,
  animateDelayMs = 0,
} = {}) {
  const iconStyle = ICON_GRADIENTS[tone] ?? ICON_GRADIENTS.brand;

  // رقم كبير، عريض، عالي التباين
  const valueNode = el(
    "p",
    { class: "text-2xl sm:text-[26px] font-black text-slate-900 dark:text-white num tracking-tight leading-none mt-1" },
    "—",
  );

  const classes = cx(
    "hx-press group relative block glass-card rounded-2xl",
    "p-4 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-raised",
    href && "cursor-pointer",
  );

  const inner = [
    el(
      "div",
      { class: "flex items-center justify-between gap-2" },
      el("p", { class: "text-xs font-bold text-slate-500 dark:text-slate-400 truncate-1 tracking-wide" }, label),
      iconName
        ? el(
            "span",
            {
              class: cx(
                "shrink-0 grid place-items-center size-9 rounded-xl transition-transform duration-300 group-hover:scale-110",
                iconStyle,
              ),
            },
            icon(iconName, { size: 17 }),
          )
        : null,
    ),
    loading
      ? el("div", { class: "hx-skeleton h-8 w-24 mt-2" })
      : el("div", { class: "mt-2" }, valueNode),
    hint || trend
      ? el(
          "div",
          { class: "flex items-center gap-2 mt-2.5 pt-2 border-t border-black/[0.04] dark:border-white/[0.06]" },
          trend ? badge(trend.label, { tone: TREND_TONES[trend.direction] ?? "neutral", size: "sm" }) : null,
          hint ? el("span", { class: "text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate-1" }, hint) : null,
        )
      : null,
  ];

  const node = href ? el("a", { href, class: classes }, ...inner) : el("div", { class: classes }, ...inner);

  if (!loading) {
    const timer = setTimeout(() => {
      const cancelTween = tweenNumber({
        from: 0,
        to: value,
        duration: 900,
        onUpdate: (current) => {
          valueNode.textContent = format(current);
        },
      });
      registerCleanup(cancelTween);
    }, animateDelayMs);

    registerCleanup(() => clearTimeout(timer));
  }

  return node;
}

/** شبكة بطاقات مؤشرات — تتكيف ديناميكيًا حسب عدد البطاقات. */
export function kpiGrid(...tiles) {
  const flat = tiles.flat().filter(Boolean);
  const colsClass =
    flat.length >= 6
      ? "grid gap-3.5 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
      : "grid gap-3.5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4";
  return el(
    "div",
    { class: colsClass },
    ...flat,
  );
}

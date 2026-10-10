/**
 * بطاقة مؤشر لوحة التحكم — مطابقة تامة لنمط كروت مؤسسة النهضة
 *
 * كروت زجاجية نقية مريحة للعين، إطار زجاجي ناعم، أرقام واضحة ملونة بحسب الحالة،
 * وحاويات أيقونات شفافة هادئة (Translucent Tinted Glass).
 */

import { el, cx } from "../../js/core/dom.js";
import { icon } from "../common/icon.js";
import { tweenNumber } from "../../js/core/animate.js";
import { registerCleanup } from "../../js/core/lifecycle.js";

/*
 * التدرجات والألوان المعتمدة للبطاقات — مطابقة حرفية لمرجع التصميم (TONES)
 */
const TONES = {
  amber: {
    bgIcon: "bg-amber-500/15 text-[#b45309] dark:text-amber-400 dark:bg-amber-500/20",
    textVal: "text-[#b45309] dark:text-amber-400",
    border: "border-amber-500/35 dark:border-amber-500/40",
  },
  blue: {
    bgIcon: "bg-blue-600/15 text-[#2563eb] dark:text-blue-400 dark:bg-blue-600/20",
    textVal: "text-[#2563eb] dark:text-blue-400",
    border: "border-blue-600/35 dark:border-blue-600/40",
  },
  green: {
    bgIcon: "bg-emerald-500/15 text-[#047857] dark:text-emerald-400 dark:bg-emerald-500/20",
    textVal: "text-[#047857] dark:text-emerald-400",
    border: "border-emerald-600/35 dark:border-emerald-600/40",
  },
  red: {
    bgIcon: "bg-rose-500/15 text-[#be123c] dark:text-rose-400 dark:bg-rose-500/20",
    textVal: "text-[#be123c] dark:text-rose-400",
    border: "border-rose-600/35 dark:border-rose-600/40",
  },
  neutral: {
    bgIcon: "bg-slate-500/15 text-[#475569] dark:text-slate-300 dark:bg-slate-500/20",
    textVal: "text-[#0f172a] dark:text-white",
    border: "border-slate-300/50 dark:border-white/10",
  },
};

// توافق مع المسميات الأخرى
TONES.warning = TONES.amber;
TONES.brand = TONES.blue;
TONES.info = TONES.blue;
TONES.success = TONES.green;
TONES.danger = TONES.red;

/**
 * @param {object} options
 * @param {string} options.label
 * @param {number} options.value
 * @param {(n:number) => string} [options.format]
 * @param {string} [options.hint]
 * @param {string} [options.icon]
 * @param {string} [options.tone="neutral"]
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
  tone = "neutral",
  href,
  loading = false,
  animateDelayMs = 0,
} = {}) {
  const toneCfg = TONES[tone] ?? TONES.neutral;

  // رقم كبير، عريض، ملون بلون التون مع الحفاظ على p.num للفحوصات
  const valueNode = el(
    "p",
    {
      class: cx(
        "num text-xl sm:text-[24px] font-black tabular leading-none tracking-tight",
        toneCfg.textVal,
      ),
    },
    "—",
  );

  const classes = cx(
    "hx-press group relative flex items-center justify-between gap-3.5 glass-card dash-stat-card",
    "p-3.5 sm:px-4.5 sm:py-3.5 rounded-[22px] border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-raised",
    toneCfg.border,
    href && "cursor-pointer",
  );

  const inner = [
    // الجانب الأيمن (العنوان والرقم)
    el(
      "div",
      { class: "flex flex-col text-right min-w-0 flex-1" },
      el(
        "p",
        {
          class: "tracking-wide text-xs sm:text-[13px] font-bold text-slate-500 dark:text-slate-400 truncate-1 mb-1.5",
        },
        label,
      ),
      loading
        ? el("div", { class: "hx-skeleton h-6 w-20" })
        : el("div", { class: "flex items-center gap-1.5" }, valueNode),
    ),

    // الجانب الأيسر (الأيقونة ذات الخلفية الزجاجية الخفيفة)
    iconName
      ? el(
          "span",
          {
            class: cx(
              "shrink-0 grid place-items-center size-10 sm:size-10.5 rounded-[13px] transition-transform duration-300 group-hover:scale-105",
              toneCfg.bgIcon,
            ),
          },
          icon(iconName, { size: 19 }),
        )
      : null,
  ];

  const node = href
    ? el("a", { href, class: classes, title: hint || "" }, ...inner)
    : el("div", { class: classes, title: hint || "" }, ...inner);

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

/** شبكة بطاقات مؤشرات — 4 أعمدة مطابقة لـ .dash-stats-grid */
export function kpiGrid(...tiles) {
  const flat = tiles.flat().filter(Boolean);
  return el(
    "div",
    { class: "grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-3.5 dash-stats-grid" },
    ...flat,
  );
}

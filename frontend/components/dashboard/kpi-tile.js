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
 * التدرجات والألوان المعتمدة للبطاقات — منسوخة حرفيًا (نفس قيم rgba/hex)
 * من TONES في dashboard.component.js لمؤسسة النهضة:
 *   amber:   icon rgba(217,119,6,.15)=amber-600/15   text #b45309=amber-700   border rgba(217,119,6,.3)=amber-600/30
 *   blue:    icon rgba(37,99,235,.15)=blue-600/15     text #2563eb=blue-600    border rgba(37,99,235,.3)=blue-600/30
 *   green:   icon rgba(16,185,129,.15)=emerald-500/15 text #047857=emerald-700 border rgba(16,185,129,.3)=emerald-500/30
 *   red:     icon rgba(225,29,72,.15)=rose-600/15     text #be123c=rose-700   border rgba(225,29,72,.3)=rose-600/30
 *   neutral: icon rgba(100,116,139,.15)=slate-500/15  text #475569=slate-600  border: '' — بلا حدّ، الكارت يبقى
 *            على حدّ .glass-card الزجاجي الافتراضي (rgba(255,255,255,.5)) كما في المرجع بالضبط.
 */
const TONES = {
  amber: {
    bgIcon: "bg-amber-600/15 text-[#b45309] dark:text-amber-400 dark:bg-amber-500/20",
    textVal: "text-[#b45309] dark:text-amber-400",
    border: "border-amber-600/30 dark:border-amber-500/40",
  },
  blue: {
    bgIcon: "bg-blue-600/15 text-[#2563eb] dark:text-blue-400 dark:bg-blue-600/20",
    textVal: "text-[#2563eb] dark:text-blue-400",
    border: "border-blue-600/30 dark:border-blue-600/40",
  },
  green: {
    bgIcon: "bg-emerald-500/15 text-[#047857] dark:text-emerald-400 dark:bg-emerald-500/20",
    textVal: "text-[#047857] dark:text-emerald-400",
    border: "border-emerald-500/30 dark:border-emerald-600/40",
  },
  red: {
    bgIcon: "bg-rose-600/15 text-[#be123c] dark:text-rose-400 dark:bg-rose-500/20",
    textVal: "text-[#be123c] dark:text-rose-400",
    border: "border-rose-600/30 dark:border-rose-500/40",
  },
  neutral: {
    bgIcon: "bg-slate-500/15 text-[#475569] dark:text-slate-300 dark:bg-slate-500/20",
    textVal: "text-[#0f172a] dark:text-white",
    border: "",
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

  // رقم 19px/800 بالضبط مطابق لـ .dash-stat-card__val في المرجع — لا حجمًا
  // متجاوبًا أكبر عند الشاشات الواسعة، المرجع ثابت القياس دائمًا.
  const valueNode = el(
    "p",
    {
      class: cx("num text-[19px] font-extrabold tabular leading-[1.1]", toneCfg.textVal),
    },
    "—",
  );

  // بلا border فئة ثابتة: neutral بلا حدّ أصلًا (راجع تعليق TONES)، فإضافة
  // "border" هنا كانت ستفرض حدًّا شفافًا بلون افتراضي حتى لو toneCfg.border
  // فارغة. نضيف "border" فقط مع toneCfg.border نفسها.
  const classes = cx(
    "hx-press group relative glass-card dash-stat-card transition-shadow duration-300",
    toneCfg.border && cx("border", toneCfg.border),
    href && "cursor-pointer",
  );

  // ترتيب الأبناء كالمرجع بالضبط: الأيقونة أولًا ثم المحتوى — في RTL هذا
  // يضع الأيقونة على يمين الكارت والنص على يساره (dash-kpis.html الأصلي).
  const inner = [
    iconName
      ? el(
          "span",
          {
            class: cx(
              "shrink-0 grid place-items-center size-11 rounded-[14px] shadow-[0_4px_12px_rgba(29,78,216,0.18)] backdrop-blur-[8px] transition-transform duration-300 group-hover:scale-105",
              toneCfg.bgIcon,
            ),
          },
          icon(iconName, { size: 20, strokeWidth: 2.2 }),
        )
      : null,

    el(
      "div",
      { class: "flex flex-col w-full min-w-0" },
      el(
        "span",
        {
          class:
            "dash-stat-card__title text-xs font-bold text-slate-500 dark:text-slate-400 truncate-1 mb-1",
        },
        label,
      ),
      loading ? el("div", { class: "hx-skeleton h-5 w-16" }) : valueNode,
    ),
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

/**
 * شبكة بطاقات مؤشرات — .dash-stats-grid وحدها تضبط العرض/الفجوة/نقاط الكسر
 * (4 أعمدة ← 2 عند 1024px ← 1 عند 640px، مطابقة لـ dashboard.css في المرجع)؛
 * لا كلاسات Tailwind شبكية مكرّرة فوقها قد تتعارك معها في الـ cascade.
 */
export function kpiGrid(...tiles) {
  const flat = tiles.flat().filter(Boolean);
  return el("div", { class: "dash-stats-grid" }, ...flat);
}

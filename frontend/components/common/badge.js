/**
 * الشرائح (badges) وشرائح الحالة.
 */

import { el, cx } from "../../js/core/dom.js";
import { describeStatus } from "../../js/core/statuses.js";

const TONES = {
  neutral: "bg-subtle text-muted border-line-strong",
  info: "bg-info-50 text-info-700 border-info-200",
  success: "bg-success-50 text-success-700 border-success-200",
  warning: "bg-warning-50 text-warning-700 border-warning-200",
  danger: "bg-danger-50 text-danger-700 border-danger-200",
  muted: "bg-line/50 text-faint border-line",
  brand: "bg-brand-50 text-brand-700 border-brand-200",
};

const DOT_TONES = {
  neutral: "bg-faint",
  info: "bg-info-600",
  success: "bg-success-600",
  warning: "bg-warning-600",
  danger: "bg-danger-600",
  muted: "bg-line-strong",
  brand: "bg-brand-600",
};

/**
 * شريحة عامة.
 * @param {string} label
 * @param {object} [options]
 * @param {keyof TONES} [options.tone="neutral"]
 * @param {boolean} [options.dot]   نقطة لون قبل النص
 * @param {"sm"|"md"} [options.size="md"]
 */
export function badge(label, { tone = "neutral", dot = false, size = "md", class: className } = {}) {
  return el(
    "span",
    {
      class: cx(
        "inline-flex items-center gap-1.5 border rounded-full font-medium whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0 text-[11px]" : "px-2 py-0.5 text-xs",
        TONES[tone] ?? TONES.neutral,
        className,
      ),
    },
    dot ? el("span", { class: cx("size-1.5 rounded-full shrink-0", DOT_TONES[tone]) }) : null,
    el("span", {}, label),
  );
}

/**
 * شريحة حالة.
 *
 * تقرأ النص واللون من js/core/statuses.js، فلا يمكن أن تظهر «معتمد» باللون
 * الأحمر في شاشة وبالأخضر في أخرى.
 *
 * @param {string} statusKey مفتاح مسجَّل في STATUSES
 */
export function statusBadge(statusKey, { size = "md", dot = true } = {}) {
  const { label, tone } = describeStatus(statusKey);
  return badge(label, { tone, dot, size });
}

/** شريحة عدّاد — للتبويبات والتنبيهات. */
export function countBadge(value, { tone = "neutral" } = {}) {
  if (!value) return null;

  return el(
    "span",
    {
      class: cx(
        "inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-semibold tabular",
        TONES[tone] ?? TONES.neutral,
      ),
    },
    String(value),
  );
}

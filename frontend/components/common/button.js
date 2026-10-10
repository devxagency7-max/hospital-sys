/**
 * الأزرار.
 *
 * كل زر في النظام يُنشأ من هنا. الفائدة ليست التوفير في الكتابة بل أن حالة
 * «جاري التنفيذ» والتعطيل والأيقونة تتصرف بنفس الطريقة في 105 شاشة.
 */

import { el, cx } from "../../js/core/dom.js";
import { icon } from "./icon.js";
import { can } from "../../js/core/permissions.js";

/*
 * تعبئات صلبة (primary/danger/success) تأخذ رفعة خفيفة عند التحويم (hover lift)
 * — لمسة الفخامة المطلوبة في المرجع البصري لأزرار الإجراء الأساسي تحديدًا؛
 * ثانوي/شبح/رابط تبقى بلا رفعة فلا يتنافس كل زر في الشاشة على الانتباه.
 */
const LIFT = "hover:-translate-y-px";

const VARIANTS = {
  primary: cx(
    "bg-brand-600 text-white border-brand-600 shadow-[0_1px_2px_rgb(0_0_0/0.05)]",
    "hover:bg-brand-700 hover:border-brand-700 hover:shadow-glow-brand active:bg-brand-800",
    LIFT,
  ),
  secondary:
    "bg-surface text-ink border-line-strong hover:bg-subtle hover:border-faint active:bg-line",
  ghost: "bg-transparent text-muted border-transparent hover:bg-line/60 hover:text-ink",
  danger: cx(
    "bg-danger-600 text-white border-danger-600 hover:bg-danger-700 hover:border-danger-700",
    LIFT,
  ),
  "danger-ghost":
    "bg-transparent text-danger-600 border-transparent hover:bg-danger-50 hover:text-danger-300",
  success: cx(
    "bg-success-600 text-white border-success-600 hover:bg-success-700 hover:border-success-700",
    LIFT,
  ),
  link: "bg-transparent text-brand-300 border-transparent hover:text-brand-400 hover:underline px-0",
};

const SIZES = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-sm gap-2",
  /** زر أيقونة مربع — للإجراءات داخل صفوف الجداول. */
  icon: "h-9 w-9 p-0 justify-center",
  "icon-sm": "h-7 w-7 p-0 justify-center",
};

const BASE =
  "hx-press inline-flex items-center justify-center font-medium border rounded-[var(--radius-control)] " +
  "transition-[background-color,border-color,box-shadow,transform,color] duration-200 ease-(--ease-premium) " +
  "select-none whitespace-nowrap " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:translate-y-0 disabled:shadow-none";

/**
 * @param {object} options
 * @param {string} [options.label]
 * @param {keyof VARIANTS} [options.variant="secondary"]
 * @param {keyof SIZES} [options.size="md"]
 * @param {string} [options.icon]        اسم أيقونة تظهر قبل النص
 * @param {string} [options.iconAfter]
 * @param {Function} [options.onClick]
 * @param {boolean} [options.loading]    يعرض دوّارة ويمنع النقر
 * @param {boolean} [options.disabled]
 * @param {string} [options.permission]  يُعيد null إذا لم يملكها المستخدم
 * @param {string} [options.href]        يُنتج <a> بدل <button>
 * @param {string} [options.title]
 * @param {"button"|"submit"|"reset"} [options.type="button"]
 * @returns {HTMLElement|null}
 */
export function button({
  label,
  variant = "secondary",
  size = "md",
  icon: iconName,
  iconAfter,
  onClick,
  loading = false,
  disabled = false,
  permission,
  href,
  title,
  type = "button",
  class: className,
  ...rest
} = {}) {
  // الزر الممنوع لا يُعرض معطّلاً: المستخدم لا يحتاج أن يرى إجراءً لا يملكه.
  if (permission && !can(permission)) return null;

  const isIconOnly = size === "icon" || size === "icon-sm";
  const classes = cx(BASE, VARIANTS[variant] ?? VARIANTS.secondary, SIZES[size] ?? SIZES.md, className);

  const children = [
    loading
      ? el("span", {
          class: cx("hx-spinner", size === "sm" || isIconOnly ? "size-3.5" : "size-4"),
          "aria-hidden": "true",
        })
      : iconName
        ? icon(iconName, { size: size === "lg" ? 18 : 16 })
        : null,
    label && !isIconOnly ? el("span", {}, label) : null,
    iconAfter && !loading ? icon(iconAfter, { size: 16 }) : null,
  ];

  const shared = {
    class: classes,
    title: title ?? (isIconOnly ? label : undefined),
    // زر الأيقونة بلا نص مرئي — يحتاج اسمًا لقارئ الشاشة.
    "aria-label": isIconOnly ? label : undefined,
    "aria-busy": loading ? "true" : undefined,
    ...rest,
  };

  if (href) {
    return el(
      "a",
      {
        ...shared,
        href,
        ...(disabled || loading ? { "aria-disabled": "true", tabindex: "-1" } : {}),
        onClick: disabled || loading ? (evt) => evt.preventDefault() : onClick,
      },
      ...children,
    );
  }

  return el(
    "button",
    { ...shared, type, disabled: disabled || loading, onClick },
    ...children,
  );
}

/** مجموعة أزرار متجاورة — تتجاهل القيم null القادمة من فحص الصلاحيات. */
export function buttonGroup(...buttons) {
  const visible = buttons.flat().filter(Boolean);
  if (!visible.length) return null;
  return el("div", { class: "flex items-center gap-2" }, ...visible);
}

/** زر أيقونة لصفوف الجداول. */
export function iconButton(iconName, { label, ...options } = {}) {
  return button({ ...options, label, icon: iconName, size: options.size ?? "icon", variant: options.variant ?? "ghost" });
}

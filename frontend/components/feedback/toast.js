/**
 * إشعارات منبثقة (toasts).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  قاعدة ملزِمة: `toast.success` تُستدعى فقط بعد نجاح العملية فعلًا — أي بعد
 *  أن يُعيد الـ API استجابة ناجحة، لا قبلها ولا بالتوازي معها.
 *
 *    ✗  savePatient(); toast.success("تم الحفظ");
 *    ✓  await savePatient(); toast.success("تم حفظ بيانات المريض");
 *
 *  «ممنوع استخدام رسائل نجاح وهمية لعمليات لا تحدث فعلًا»
 *  — docs/07-FRONTEND-RULES.md
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { el, cx } from "../../js/core/dom.js";
import { icon } from "../common/icon.js";
import { UI } from "../../js/core/config.js";
import { describeError } from "../../js/core/errors.js";

const TONES = {
  success: { bar: "bg-success-600", iconClass: "text-success-600", icon: "success" },
  error: { bar: "bg-danger-600", iconClass: "text-danger-600", icon: "error" },
  warning: { bar: "bg-warning-600", iconClass: "text-warning-600", icon: "warning" },
  info: { bar: "bg-info-600", iconClass: "text-info-600", icon: "info" },
};

let container = null;

function ensureContainer() {
  if (container?.isConnected) return container;

  container = el("div", {
    class: "fixed top-4 inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none no-print",
    // aria-live يجعل قارئ الشاشة يعلن الإشعار دون سرقة التركيز.
    role: "region",
    "aria-live": "polite",
    "aria-label": "الإشعارات",
  });

  document.body.appendChild(container);
  return container;
}

/**
 * يعرض إشعارًا.
 *
 * @param {object} options
 * @param {"success"|"error"|"warning"|"info"} [options.tone="info"]
 * @param {string} options.message
 * @param {string} [options.title]
 * @param {number} [options.duration]  ms؛ 0 = لا يختفي تلقائيًا
 * @param {{ label:string, onClick:Function }} [options.action]
 */
export function showToast({ tone = "info", message, title, duration, action } = {}) {
  const preset = TONES[tone] ?? TONES.info;

  // الأخطاء لا تختفي تلقائيًا: رسالة الخطأ التي تهرب قبل قراءتها عديمة الفائدة.
  const lifetime = duration ?? (tone === "error" ? 0 : UI.toastDurationMs);

  let timer;
  const node = el(
    "div",
    {
      class:
        "hx-toast pointer-events-auto w-full max-w-md flex items-stretch gap-0 " +
        "bg-surface border border-line rounded-[var(--radius-card)] shadow-overlay overflow-hidden",
      role: tone === "error" ? "alert" : "status",
    },
    el("span", { class: cx("w-1 shrink-0", preset.bar), "aria-hidden": "true" }),
    el(
      "div",
      { class: "flex items-start gap-2.5 p-3 flex-1 min-w-0" },
      el("span", { class: cx("shrink-0 mt-0.5", preset.iconClass) }, icon(preset.icon, { size: 17 })),
      el(
        "div",
        { class: "min-w-0 flex-1" },
        title ? el("p", { class: "text-sm font-semibold text-ink" }, title) : null,
        el("p", { class: cx("text-sm text-muted break-words", title && "mt-0.5") }, message),
        action
          ? el(
              "button",
              {
                type: "button",
                class: "text-xs font-medium text-brand-300 hover:text-brand-400 hover:underline mt-1.5",
                onClick: () => {
                  action.onClick();
                  dismiss();
                },
              },
              action.label,
            )
          : null,
      ),
      el(
        "button",
        {
          type: "button",
          class: "shrink-0 text-faint hover:text-ink transition-colors p-0.5 rounded",
          "aria-label": "إغلاق الإشعار",
          onClick: () => dismiss(),
        },
        icon("close", { size: 15 }),
      ),
    ),
  );

  function dismiss() {
    clearTimeout(timer);
    node.style.transition = "opacity .15s, transform .15s";
    node.style.opacity = "0";
    node.style.transform = "translateY(-6px)";
    setTimeout(() => node.remove(), 150);
  }

  if (lifetime > 0) {
    timer = setTimeout(dismiss, lifetime);
    // الوقوف بالمؤشر فوق الإشعار يوقف العدّاد — وإلا اختفى أثناء القراءة.
    node.addEventListener("mouseenter", () => clearTimeout(timer));
    node.addEventListener("mouseleave", () => {
      timer = setTimeout(dismiss, 1500);
    });
  }

  ensureContainer().appendChild(node);
  return dismiss;
}

export const toast = {
  /** استدعِها بعد نجاح العملية فعلًا — لا قبله. */
  success: (message, options = {}) => showToast({ ...options, tone: "success", message }),

  /** يقبل كائن Error ويستخرج منه رسالة صالحة للعرض. */
  error: (messageOrError, options = {}) =>
    showToast({
      ...options,
      tone: "error",
      message: messageOrError instanceof Error ? describeError(messageOrError) : messageOrError,
    }),

  warning: (message, options = {}) => showToast({ ...options, tone: "warning", message }),
  info: (message, options = {}) => showToast({ ...options, tone: "info", message }),
};

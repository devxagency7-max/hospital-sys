/**
 * النوافذ المنبثقة والأدراج ونوافذ التأكيد.
 *
 * الثلاثة تتقاسم قاعدة واحدة (`openOverlay`) لأن سلوك الوصولية مطلوب في كلٍ
 * منها بالتساوي: حصر التركيز، الإغلاق بـ Escape، إعادة التركيز إلى العنصر
 * الذي فتح النافذة، ومنع تمرير الخلفية. تنفيذها ثلاث مرات يعني نسيانها مرتين.
 */

import { el, cx, trapFocus, uid } from "../../js/core/dom.js";
import { icon } from "../common/icon.js";
import { button } from "../common/button.js";

/** مكدّس النوافذ المفتوحة — يسمح بنافذة تأكيد فوق نموذج. */
const stack = [];

function lockScroll() {
  if (stack.length === 1) document.body.style.overflow = "hidden";
}

function unlockScroll() {
  if (!stack.length) document.body.style.overflow = "";
}

/**
 * القاعدة المشتركة. مُصدَّرة عمدًا: أي سطح منبثق جديد لا يطابق شكل نافذة أو
 * درج أو تأكيد (مثل لوحة أوامر بحث) يبنيها فوق هذه، لا بتكرار منطق حصر
 * التركيز والإغلاق من الصفر.
 * @returns {{ close: Function, element: HTMLElement }}
 */
export function openOverlay({ panel, onClose, dismissible = true, align = "center" }) {
  /*
   * "center": نافذة/تأكيد — وسط الشاشة تمامًا.
   * "end": درج — نهاية المحور المنطقي، أي يسار الشاشة في RTL، بكامل الارتفاع.
   * "top": لوحة أوامر — أعلى الشاشة، وسطًا أفقيًا، بلا تمدد رأسي كامل.
   */
  const ALIGN = {
    center: "items-center justify-center p-4",
    end: "items-stretch justify-end",
    top: "items-start justify-center pt-[12vh] p-4",
  };

  const backdrop = el("div", {
    class: cx(
      "hx-backdrop fixed inset-0 z-50 bg-ink/40 backdrop-blur-[1px] flex no-print",
      ALIGN[align] ?? ALIGN.center,
    ),
  });

  let releaseFocus = () => {};
  let closed = false;

  function close(result) {
    if (closed) return;
    closed = true;

    const index = stack.indexOf(entry);
    if (index !== -1) stack.splice(index, 1);

    document.removeEventListener("keydown", onKeydown, true);
    releaseFocus();
    backdrop.remove();
    unlockScroll();
    onClose?.(result);
  }

  function onKeydown(evt) {
    // النافذة العلوية فقط تستجيب لـ Escape.
    if (evt.key === "Escape" && dismissible && stack[stack.length - 1] === entry) {
      evt.stopPropagation();
      close(undefined);
    }
  }

  const entry = { close };

  if (dismissible) {
    backdrop.addEventListener("mousedown", (evt) => {
      // النقر على الخلفية فقط — لا على النافذة نفسها.
      if (evt.target === backdrop) close(undefined);
    });
  }

  const panelNode = panel(close);
  backdrop.appendChild(panelNode);

  stack.push(entry);
  document.body.appendChild(backdrop);
  lockScroll();
  document.addEventListener("keydown", onKeydown, true);
  releaseFocus = trapFocus(panelNode);

  return { close, element: panelNode };
}

const SIZES = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  full: "max-w-[min(96rem,95vw)]",
};

/**
 * نافذة منبثقة.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.subtitle]
 * @param {Node|((close:Function)=>Node)} options.body
 * @param {Node[]|((close:Function)=>Node[])} [options.footer]
 * @param {"sm"|"md"|"lg"|"xl"|"full"} [options.size="md"]
 * @param {boolean} [options.dismissible=true] false يمنع الإغلاق بـ Escape/الخلفية
 * @param {Function} [options.onClose]
 * @returns {{ close: Function, element: HTMLElement }}
 */
export function openModal({
  title,
  subtitle,
  body,
  footer,
  size = "md",
  dismissible = true,
  onClose,
} = {}) {
  const titleId = uid("modal-title");

  return openOverlay({
    dismissible,
    onClose,
    panel: (close) =>
      el(
        "div",
        {
          class: cx(
            "hx-rise bg-surface w-full rounded-[var(--radius-card)] shadow-overlay flex flex-col",
            "max-h-[min(90vh,52rem)]",
            SIZES[size] ?? SIZES.md,
          ),
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": titleId,
          tabindex: "-1",
        },
        el(
          "header",
          { class: "flex items-start justify-between gap-4 px-5 py-3.5 border-b border-line shrink-0" },
          el(
            "div",
            { class: "min-w-0" },
            el("h2", { id: titleId, class: "text-sm font-semibold text-ink" }, title),
            subtitle ? el("p", { class: "text-xs text-muted mt-0.5" }, subtitle) : null,
          ),
          dismissible
            ? el(
                "button",
                {
                  type: "button",
                  class: "shrink-0 text-faint hover:text-ink transition-colors p-1 -m-1 rounded",
                  "aria-label": "إغلاق",
                  onClick: () => close(undefined),
                },
                icon("close", { size: 17 }),
              )
            : null,
        ),
        // المحتوى هو ما يتمدد ويُمرَّر — الرأس والتذييل يبقيان ثابتين.
        el(
          "div",
          { class: "px-5 py-4 overflow-y-auto grow" },
          typeof body === "function" ? body(close) : body,
        ),
        footer
          ? el(
              "footer",
              { class: "flex items-center justify-start gap-2 px-5 py-3.5 border-t border-line bg-subtle shrink-0 rounded-b-[var(--radius-card)]" },
              ...[typeof footer === "function" ? footer(close) : footer].flat().filter(Boolean),
            )
          : null,
      ),
  });
}

/**
 * درج جانبي.
 *
 * يستقر عند نهاية المحور المنطقي — أي يسار الشاشة في RTL، مقابل الشريط
 * الجانبي على اليمين. يُفضَّل على النافذة للنماذج الطويلة لأنه يُبقي سياق
 * الجدول خلفه مرئيًا.
 */
export function openDrawer({
  title,
  subtitle,
  body,
  footer,
  size = "md",
  dismissible = true,
  onClose,
} = {}) {
  const titleId = uid("drawer-title");

  const WIDTHS = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" };

  return openOverlay({
    dismissible,
    onClose,
    align: "end",
    panel: (close) =>
      el(
        "div",
        {
          class: cx(
            "hx-drawer bg-surface w-full h-full flex flex-col shadow-overlay",
            WIDTHS[size] ?? WIDTHS.md,
          ),
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": titleId,
          tabindex: "-1",
        },
        el(
          "header",
          { class: "flex items-start justify-between gap-4 px-5 py-3.5 border-b border-line shrink-0" },
          el(
            "div",
            { class: "min-w-0" },
            el("h2", { id: titleId, class: "text-sm font-semibold text-ink" }, title),
            subtitle ? el("p", { class: "text-xs text-muted mt-0.5" }, subtitle) : null,
          ),
          dismissible
            ? el(
                "button",
                {
                  type: "button",
                  class: "shrink-0 text-faint hover:text-ink transition-colors p-1 -m-1 rounded",
                  "aria-label": "إغلاق",
                  onClick: () => close(undefined),
                },
                icon("close", { size: 17 }),
              )
            : null,
        ),
        el(
          "div",
          { class: "px-5 py-4 overflow-y-auto grow" },
          typeof body === "function" ? body(close) : body,
        ),
        footer
          ? el(
              "footer",
              { class: "flex items-center gap-2 px-5 py-3.5 border-t border-line bg-subtle shrink-0" },
              ...[typeof footer === "function" ? footer(close) : footer].flat().filter(Boolean),
            )
          : null,
      ),
  });
}

/**
 * نافذة تأكيد.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  كل إجراء مُدمِّر يمر من هنا (docs/07-FRONTEND-RULES.md + 09-DEFINITION-OF-DONE.md).
 *
 *    if (!(await confirmAction({ ... }))) return;
 *    await archivePatient(id);
 *    toast.success("تم أرشفة المريض");
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} [options.confirmLabel="تأكيد"]
 * @param {string} [options.cancelLabel="إلغاء"]
 * @param {"danger"|"primary"} [options.tone="danger"]
 * @param {string} [options.detail]        سطر توضيحي لما سيحدث بالضبط
 * @param {string} [options.confirmText]   نص يجب كتابته حرفيًا لتمكين التأكيد
 * @returns {Promise<boolean>}
 */
export function confirmAction({
  title,
  message,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  tone = "danger",
  detail,
  confirmText,
} = {}) {
  return new Promise((resolve) => {
    let confirmButton;

    const typedGuard = confirmText
      ? el(
          "div",
          { class: "mt-3" },
          el(
            "label",
            { class: "block text-xs text-muted mb-1.5" },
            `اكتب «${confirmText}» للتأكيد`,
          ),
          el("input", {
            type: "text",
            class:
              "w-full h-9 px-3 text-sm bg-surface border border-line-strong rounded-[var(--radius-control)] " +
              "focus:border-brand-500 outline-none",
            autocomplete: "off",
            onInput: (evt) => {
              if (confirmButton) confirmButton.disabled = evt.target.value.trim() !== confirmText;
            },
          }),
        )
      : null;

    openOverlay({
      // الإغلاق بالخلفية متاح: الإلغاء هو الخيار الآمن دائمًا في نافذة تأكيد.
      dismissible: true,
      onClose: (result) => resolve(result === true),
      panel: (closeOverlay) =>
        el(
          "div",
          {
            class: "hx-rise bg-surface w-full max-w-md rounded-[var(--radius-card)] shadow-overlay p-5",
            role: "alertdialog",
            "aria-modal": "true",
            tabindex: "-1",
          },
          el(
            "div",
            { class: "flex items-start gap-3" },
            el(
              "span",
              {
                class: cx(
                  "shrink-0 grid place-items-center size-10 rounded-full",
                  tone === "danger" ? "bg-danger-50 text-danger-600" : "bg-brand-50 text-brand-600",
                ),
              },
              icon(tone === "danger" ? "warning" : "info", { size: 20 }),
            ),
            el(
              "div",
              { class: "min-w-0 flex-1" },
              el("h2", { class: "text-sm font-semibold text-ink" }, title),
              el("p", { class: "text-sm text-muted mt-1 leading-relaxed" }, message),
              detail
                ? el(
                    "p",
                    { class: "text-xs text-faint mt-2 bg-subtle border border-line rounded px-2.5 py-1.5" },
                    detail,
                  )
                : null,
              typedGuard,
            ),
          ),
          el(
            "div",
            { class: "flex items-center gap-2 mt-5" },
            (confirmButton = button({
              label: confirmLabel,
              variant: tone === "danger" ? "danger" : "primary",
              size: "md",
              disabled: Boolean(confirmText),
              onClick: () => closeOverlay(true),
            })),
            button({
              label: cancelLabel,
              variant: "secondary",
              size: "md",
              onClick: () => closeOverlay(false),
            }),
          ),
        ),
    });
  });
}

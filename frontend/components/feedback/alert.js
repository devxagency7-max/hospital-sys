/**
 * تنبيهات داخل الصفحة (inline alerts).
 *
 * تختلف عن الـ toast: التنبيه يبقى في مكانه ويرتبط بسياق محدد — ملخص أخطاء
 * النموذج، تحذير أن الفترة المحاسبية مغلقة، أو بيان أن تقريرًا غير مكتمل.
 * الـ toast للإشعار العابر، والتنبيه للحالة المستمرة.
 */

import { el, cx } from "../../js/core/dom.js";
import { icon } from "../common/icon.js";
import { button } from "../common/button.js";

const TONES = {
  info: { wrap: "bg-info-50 border-info-200 text-info-300", icon: "info" },
  success: { wrap: "bg-success-50 border-success-200 text-success-300", icon: "success" },
  warning: { wrap: "bg-warning-50 border-warning-200 text-warning-300", icon: "warning" },
  danger: { wrap: "bg-danger-50 border-danger-200 text-danger-300", icon: "error" },
  neutral: { wrap: "bg-subtle border-line text-muted", icon: "info" },
};

/**
 * @param {object} options
 * @param {"info"|"success"|"warning"|"danger"|"neutral"} [options.tone="info"]
 * @param {string} [options.title]
 * @param {string|Node} [options.message]
 * @param {string[]} [options.items]       قائمة نقطية — لملخص الأخطاء
 * @param {Node|Node[]} [options.actions]
 * @param {Function} [options.onDismiss]   يُظهر زر الإغلاق
 */
export function alert({
  tone = "info",
  title,
  message,
  items,
  actions,
  onDismiss,
  class: className,
} = {}) {
  const preset = TONES[tone] ?? TONES.info;
  const resolvedActions = [actions].flat().filter(Boolean);

  const node = el(
    "div",
    {
      class: cx("flex items-start gap-3 border rounded-[var(--radius-control)] p-3", preset.wrap, className),
      role: tone === "danger" ? "alert" : "status",
    },
    el("span", { class: "shrink-0 mt-0.5" }, icon(preset.icon, { size: 17 })),
    el(
      "div",
      { class: "min-w-0 flex-1" },
      title ? el("p", { class: "text-sm font-semibold" }, title) : null,
      message
        ? el(
            "div",
            { class: cx("text-sm leading-relaxed", title && "mt-1") },
            message instanceof Node ? message : el("p", {}, message),
          )
        : null,
      items?.length
        ? el(
            "ul",
            { class: cx("text-sm space-y-0.5 list-disc ps-5", (title || message) && "mt-1.5") },
            ...items.map((item) => el("li", {}, item)),
          )
        : null,
      resolvedActions.length
        ? el("div", { class: "flex items-center gap-2 mt-2.5" }, ...resolvedActions)
        : null,
    ),
    onDismiss
      ? el(
          "button",
          {
            type: "button",
            class: "shrink-0 opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded",
            "aria-label": "إغلاق التنبيه",
            onClick: () => {
              node.remove();
              onDismiss();
            },
          },
          icon("close", { size: 15 }),
        )
      : null,
  );

  return node;
}

/**
 * ملخص أخطاء النموذج.
 *
 * يُعرض أعلى النموذج الطويل، لأن المستخدم قد لا يرى الحقل الخاطئ أسفل الشاشة.
 * @param {Record<string,string>} errors
 * @param {Record<string,string>} [labels] خريطة اسم الحقل ← تسميته العربية
 */
export function formErrorSummary(errors, labels = {}) {
  const entries = Object.entries(errors ?? {});
  if (!entries.length) return null;

  return alert({
    tone: "danger",
    title: `تعذّر الحفظ — ${entries.length === 1 ? "حقل واحد يحتاج" : `${entries.length} حقول تحتاج`} تصحيحًا`,
    items: entries.map(([field, message]) => `${labels[field] ?? field}: ${message}`),
  });
}

/**
 * تنبيه تقرير غير مكتمل.
 *
 * الواجهة البصرية للقاعدة الحرجة في docs/05-REPORTING-SPECIFICATION.md: يسمّي
 * الأقسام التي فشلت بالاسم بدل رسالة «حدث خطأ» مبهمة.
 *
 * @param {{ failures: Array<{label:string, error:string}> }} report
 * @param {Function} [onRetry]
 */
export function reportIncompleteAlert(report, onRetry) {
  if (!report?.failures?.length) return null;

  return alert({
    tone: "danger",
    title: "التصدير متوقف — التقرير غير مكتمل",
    message: "فشل تحميل الأقسام التالية، ولن يُصدَّر التقرير قبل نجاحها:",
    items: report.failures.map((failure) => `${failure.label} — ${failure.error}`),
    actions: onRetry
      ? button({
          label: "إعادة تحميل الأقسام الفاشلة",
          icon: "refresh",
          variant: "secondary",
          size: "sm",
          onClick: onRetry,
        })
      : null,
  });
}

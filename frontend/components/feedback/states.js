/**
 * حالات التحميل والفراغ والخطأ.
 *
 * docs/09-DEFINITION-OF-DONE.md يشترط وجود الثلاثة في كل شاشة. وجودها جاهزة
 * هنا يجعل تنفيذها أرخص من إهمالها — وهذا هو الغرض.
 *
 * التمييز المهم: «لا توجد نتائج للفلتر الحالي» ليست «لا توجد بيانات بعد».
 * الأولى تحتاج زر مسح فلاتر، والثانية تحتاج زر إضافة. `emptyState` تدعم الحالتين.
 */

import { el, cx } from "../../js/core/dom.js";
import { icon } from "../common/icon.js";
import { button } from "../common/button.js";
import { code } from "../common/value.js";
import { describeError, toApiError, ErrorCode } from "../../js/core/errors.js";

/* ==========================================================================
   التحميل
   ========================================================================== */

/** دوّارة بسيطة مع نص. */
export function loadingState({ message = "جاري التحميل…", compact = false } = {}) {
  return el(
    "div",
    {
      class: cx(
        "flex flex-col items-center justify-center gap-3 text-muted",
        compact ? "py-8" : "py-16",
      ),
      role: "status",
      "aria-live": "polite",
    },
    el("span", { class: "hx-spinner size-6 text-brand-500", "aria-hidden": "true" }),
    el("p", { class: "text-sm" }, message),
  );
}

/**
 * هيكل جدول.
 *
 * نُفضّله على الدوّارة في الجداول: الهيكل يحتفظ بارتفاع المحتوى فلا تقفز
 * الصفحة عند وصول البيانات، وهي قفزة مزعجة في جدول من 25 صفًا.
 */
export function tableSkeleton({ rows = 8, columns = 5 } = {}) {
  return el(
    "div",
    { class: "p-4 space-y-2.5", role: "status", "aria-label": "جاري تحميل البيانات" },
    el(
      "div",
      { class: "flex gap-3" },
      ...Array.from({ length: columns }, () => el("div", { class: "hx-skeleton h-3.5 flex-1" })),
    ),
    ...Array.from({ length: rows }, () =>
      el(
        "div",
        { class: "flex gap-3 pt-2" },
        ...Array.from({ length: columns }, (_unused, index) =>
          el("div", {
            class: cx("hx-skeleton h-4", index === 0 ? "flex-[1.6]" : "flex-1"),
          }),
        ),
      ),
    ),
  );
}

/** هيكل بطاقات — للوحة التحكم. */
export function cardsSkeleton({ count = 4 } = {}) {
  return el(
    "div",
    { class: "grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" },
    ...Array.from({ length: count }, () =>
      el(
        "div",
        { class: "bg-surface border border-line rounded-[var(--radius-card)] p-4" },
        el("div", { class: "hx-skeleton h-3 w-20" }),
        el("div", { class: "hx-skeleton h-7 w-28 mt-3" }),
        el("div", { class: "hx-skeleton h-3 w-32 mt-3" }),
      ),
    ),
  );
}

/** هيكل نموذج. */
export function formSkeleton({ fields = 6 } = {}) {
  return el(
    "div",
    { class: "grid gap-4 sm:grid-cols-2" },
    ...Array.from({ length: fields }, () =>
      el(
        "div",
        {},
        el("div", { class: "hx-skeleton h-3 w-24" }),
        el("div", { class: "hx-skeleton h-9 w-full mt-2" }),
      ),
    ),
  );
}

/* ==========================================================================
   الفراغ
   ========================================================================== */

/**
 * حالة فراغ.
 *
 * @param {object} options
 * @param {string} [options.title]
 * @param {string} [options.message]
 * @param {string} [options.icon="empty"]
 * @param {Node|Node[]} [options.actions]
 * @param {boolean} [options.filtered]  true = «لا نتائج للفلتر»، false = «لا بيانات»
 * @param {Function} [options.onClearFilters]
 */
export function emptyState({
  title,
  message,
  icon: iconName = "empty",
  actions,
  filtered = false,
  onClearFilters,
  compact = false,
} = {}) {
  const resolvedTitle = title ?? (filtered ? "لا نتائج مطابقة" : "لا توجد بيانات بعد");
  const resolvedMessage =
    message ??
    (filtered
      ? "جرّب تعديل كلمة البحث أو توسيع نطاق الفلاتر."
      : "لم تُضف أي بيانات حتى الآن.");

  const resolvedActions = [
    actions,
    filtered && onClearFilters
      ? button({ label: "مسح الفلاتر", icon: "close", variant: "secondary", size: "sm", onClick: onClearFilters })
      : null,
  ]
    .flat()
    .filter(Boolean);

  return el(
    "div",
    {
      class: cx(
        "flex flex-col items-center justify-center text-center px-6",
        compact ? "py-10" : "py-16",
      ),
    },
    el(
      "span",
      { class: "grid place-items-center size-12 rounded-full bg-subtle text-faint mb-3" },
      icon(filtered ? "search" : iconName, { size: 22 }),
    ),
    el("h3", { class: "text-sm font-semibold text-ink" }, resolvedTitle),
    el("p", { class: "text-xs text-muted mt-1 max-w-sm" }, resolvedMessage),
    resolvedActions.length
      ? el("div", { class: "flex items-center gap-2 mt-4" }, ...resolvedActions)
      : null,
  );
}

/* ==========================================================================
   الخطأ
   ========================================================================== */

/**
 * حالة خطأ.
 *
 * تُفرِّق بين أنواع الفشل: المؤقت يحصل على زر «إعادة المحاولة»، ونقص الصلاحية
 * لا يحصل عليه (لأن إعادة المحاولة لن تغيّر شيئًا)، وغير المنفَّذ يُعرَّف بصراحة
 * كنقص في التنفيذ لا كخطأ في بيانات المستخدم.
 *
 * @param {object} options
 * @param {Error} options.error
 * @param {Function} [options.onRetry]
 * @param {string} [options.title]
 */
export function errorState({ error, onRetry, title, compact = false } = {}) {
  const apiError = toApiError(error);

  const presets = {
    [ErrorCode.NOT_IMPLEMENTED]: {
      icon: "code",
      title: "غير منفَّذ بعد",
      tone: "text-muted",
    },
    [ErrorCode.FORBIDDEN]: { icon: "lock", title: "لا تملك الصلاحية", tone: "text-warning-700" },
    [ErrorCode.UNAUTHENTICATED]: { icon: "lock", title: "انتهت الجلسة", tone: "text-warning-700" },
    [ErrorCode.NOT_FOUND]: { icon: "search", title: "غير موجود", tone: "text-muted" },
    [ErrorCode.NETWORK]: { icon: "refresh", title: "تعذّر الاتصال", tone: "text-danger-700" },
    [ErrorCode.TIMEOUT]: { icon: "refresh", title: "انتهت مهلة الطلب", tone: "text-danger-700" },
  };

  const preset = presets[apiError.code] ?? {
    icon: "error",
    title: "حدث خطأ",
    tone: "text-danger-700",
  };

  return el(
    "div",
    {
      class: cx(
        "flex flex-col items-center justify-center text-center px-6",
        compact ? "py-10" : "py-16",
      ),
      role: "alert",
    },
    el(
      "span",
      {
        class: cx(
          "grid place-items-center size-12 rounded-full mb-3",
          apiError.code === ErrorCode.NOT_IMPLEMENTED ? "bg-subtle text-faint" : "bg-danger-50 text-danger-600",
        ),
      },
      icon(preset.icon, { size: 22 }),
    ),
    el("h3", { class: cx("text-sm font-semibold", preset.tone) }, title ?? preset.title),
    el("p", { class: "text-xs text-muted mt-1 max-w-md leading-relaxed" }, describeError(apiError)),
    // الرمز يُسرّع على الدعم الفني تشخيص ما حدث.
    apiError.code !== ErrorCode.UNKNOWN
      ? el("div", { class: "mt-2" }, code(apiError.code))
      : null,
    onRetry && apiError.isRetryable
      ? el(
          "div",
          { class: "mt-4" },
          button({ label: "إعادة المحاولة", icon: "refresh", variant: "secondary", size: "sm", onClick: onRetry }),
        )
      : null,
  );
}

/** حالة منع الوصول — يستخدمها الراوتر عند فشل فحص الصلاحية. */
export function forbiddenState({ route } = {}) {
  return el(
    "div",
    { class: "flex flex-col items-center justify-center text-center py-20 px-6" },
    el(
      "span",
      { class: "grid place-items-center size-14 rounded-full bg-warning-50 text-warning-600 mb-4" },
      icon("lock", { size: 26 }),
    ),
    el("h1", { class: "text-base font-semibold text-ink" }, "لا تملك صلاحية الوصول"),
    el(
      "p",
      { class: "text-sm text-muted mt-1.5 max-w-md" },
      route?.title
        ? `شاشة «${route.title}» تتطلب صلاحية غير متاحة لدورك الحالي.`
        : "هذه الشاشة تتطلب صلاحية غير متاحة لدورك الحالي.",
    ),
    route?.permission
      ? el("div", { class: "mt-2" }, code(route.permission))
      : null,
    el(
      "div",
      { class: "mt-5" },
      button({ label: "العودة إلى لوحة التحكم", variant: "secondary", size: "sm", href: "#/" }),
    ),
  );
}

/** شاشة 404. */
export function notFoundState({ path } = {}) {
  return el(
    "div",
    { class: "flex flex-col items-center justify-center text-center py-20 px-6" },
    el("p", { class: "text-5xl font-bold text-line-strong tabular" }, "404"),
    el("h1", { class: "text-base font-semibold text-ink mt-3" }, "الصفحة غير موجودة"),
    el(
      "p",
      { class: "text-sm text-muted mt-1.5" },
      "الرابط الذي فتحته غير مسجَّل في النظام.",
    ),
    path ? el("div", { class: "mt-2" }, code(path)) : null,
    el(
      "div",
      { class: "mt-5" },
      button({ label: "العودة إلى لوحة التحكم", variant: "primary", size: "sm", href: "#/" }),
    ),
  );
}

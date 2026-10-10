/**
 * مسار التنقل (breadcrumbs) وترويسة الصفحة.
 *
 * يُبنى آليًا من js/config/navigation.js: المسار يُطابَق فيُعرف الموديول
 * والشاشة. البناء اليدوي في كل صفحة يعني مسارًا خاطئًا في شاشة أو اثنتين،
 * والمستخدم يفقد إحساسه بموقعه في نظام من 105 شاشة.
 */

import { el, cx } from "../../js/core/dom.js";
import { icon } from "../common/icon.js";
import { findScreen, navigation } from "../../js/config/navigation.js";

/**
 * @param {object} context سياق الراوتر { path, route, params }
 */
export function breadcrumbs({ path, route } = {}) {
  const trail = buildTrail(path, route);
  if (trail.length <= 1) return null;

  return el(
    "nav",
    { class: "flex items-center gap-1.5 text-xs no-print", "aria-label": "مسار التنقل" },
    ...trail.flatMap((entry, index) => {
      const isLast = index === trail.length - 1;

      const node = isLast
        ? el("span", { class: "text-ink font-medium truncate-1", "aria-current": "page" }, entry.label)
        : entry.path
          ? el(
              "a",
              { href: `#${entry.path}`, class: "text-muted hover:text-brand-300 transition-colors truncate-1" },
              entry.label,
            )
          : el("span", { class: "text-muted truncate-1" }, entry.label);

      return index === 0
        ? [node]
        : [
            icon("chevronStart", { size: 12, class: "text-line-strong shrink-0" }),
            node,
          ];
    }),
  );
}

function buildTrail(path, route) {
  const trail = [{ label: "لوحة التحكم", path: "/" }];
  if (path === "/") return trail;

  const screen = findScreen(path);

  if (screen) {
    // الموديول يُعرض كخطوة وسيطة بلا رابط — لا توجد صفحة «موديول».
    const module = navigation.find((entry) => entry.key === screen.module);
    if (module?.children) trail.push({ label: module.label });
    trail.push({ label: screen.label, path: screen.path });
    return trail;
  }

  /* --- مسار ديناميكي (/patients/1001) --- */
  // نصعد إلى أقرب مسار أب مسجَّل حتى يبقى المسار صحيحًا للتفاصيل.
  const segments = path.split("/").filter(Boolean);

  for (let depth = segments.length - 1; depth > 0; depth -= 1) {
    const parentPath = `/${segments.slice(0, depth).join("/")}`;
    const parent = findScreen(parentPath);

    if (parent) {
      const module = navigation.find((entry) => entry.key === parent.module);
      if (module?.children) trail.push({ label: module.label });
      trail.push({ label: parent.label, path: parent.path });
      break;
    }
  }

  if (route?.title) trail.push({ label: route.title });
  return trail;
}

/**
 * ترويسة الصفحة — العنوان والوصف والإجراءات.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.description]
 * @param {Node|Node[]} [options.actions]
 * @param {Node} [options.meta]        محتوى إضافي تحت العنوان (شرائح حالة…)
 */
export function pageHeader({ title, description, actions, meta } = {}) {
  const resolvedActions = [actions].flat().filter(Boolean);

  return el(
    "div",
    { class: "flex flex-wrap items-start justify-between gap-3 mb-4" },
    el(
      "div",
      { class: "min-w-0" },
      el("h1", { class: "text-lg font-semibold text-ink outline-none", "data-page-title": "" }, title),
      description ? el("p", { class: "text-sm text-muted mt-0.5" }, description) : null,
      meta ? el("div", { class: "flex flex-wrap items-center gap-2 mt-2" }, meta) : null,
    ),
    resolvedActions.length
      ? el("div", { class: cx("flex items-center gap-2 shrink-0 no-print") }, ...resolvedActions)
      : null,
  );
}

/**
 * ترويسة طباعة — تظهر في المطبوعات فقط.
 * docs/05-REPORTING-SPECIFICATION.md يشترط اسم المستشفى ومن أصدر التقرير
 * وتاريخه في ترويسة كل تقرير.
 */
export function printHeader({ organization, title, subtitle, generatedBy, generatedAt }) {
  return el(
    "div",
    { class: "print-only mb-4 pb-3 border-b-2 border-ink" },
    el("p", { class: "text-base font-bold" }, organization),
    el("p", { class: "text-sm font-semibold mt-1" }, title),
    subtitle ? el("p", { class: "text-xs mt-0.5" }, subtitle) : null,
    el(
      "div",
      { class: "flex justify-between text-[10px] mt-2" },
      el("span", {}, generatedBy ? `أصدره: ${generatedBy}` : ""),
      el("span", {}, generatedAt ? `تاريخ الإصدار: ${generatedAt}` : ""),
    ),
  );
}

/**
 * الشريط الجانبي.
 *
 * يُبنى من js/config/navigation.js ويُرشَّح بالصلاحيات: المجموعة التي لا يملك
 * المستخدم أي عنصر فيها لا تظهر أصلاً. موظف الاستقبال لا يرى «المحاسبة» حتى
 * مطويّة — القائمة المليئة بعناصر ممنوعة تُربك ولا تفيد.
 */

import { el, cx, render } from "../../js/core/dom.js";
import { icon } from "../common/icon.js";
import { navigation } from "../../js/config/navigation.js";
import { can, canAny } from "../../js/core/permissions.js";
import { appState, writePreference } from "../../js/core/store.js";
import { on } from "../../js/core/events.js";
import { APP } from "../../js/core/config.js";

/** المجموعات المفتوحة — نُبقيها في الذاكرة فلا تُطوى عند كل انتقال. */
const expanded = new Set();

export function sidebar() {
  const navHost = el("nav", {
    class: "flex-1 overflow-y-auto px-2 py-3 space-y-0.5",
    "aria-label": "القائمة الرئيسية",
  });

  const element = el(
    "aside",
    {
      // `group/rail` يسمح لعناصر داخلية بالاستجابة لحالة الطي عبر data-collapsed.
      class: cx(
        "group/rail bg-rail text-rail-text flex flex-col shrink-0 h-full no-print",
        "w-(--spacing-sidebar) transition-[width] duration-200",
      ),
      dataset: { collapsed: "false" },
    },
    brand(),
    navHost,
    footer(),
  );

  /** المسار الحالي — يُحدِّد العنصر النشط. */
  function currentPath() {
    return (window.location.hash.replace(/^#/, "").split("?")[0] || "/").replace(/\/$/, "") || "/";
  }

  function paint() {
    const active = currentPath();
    const collapsed = appState.get().sidebarCollapsed;

    element.dataset.collapsed = String(collapsed);
    element.classList.toggle("w-(--spacing-sidebar)", !collapsed);
    element.classList.toggle("w-(--spacing-sidebar-collapsed)", collapsed);

    const groups = navigation
      .filter((entry) =>
        // مجموعة بلا أي عنصر مسموح لا تُعرض.
        entry.children ? canAny(entry.children.map((child) => child.permission)) : can(entry.permission),
      )
      .map((entry) => (entry.children ? renderGroup(entry, active, collapsed) : renderLink(entry, active, collapsed)));

    render(navHost, ...groups);
  }

  function renderLink(entry, active, collapsed) {
    const isActive = active === entry.path;

    return el(
      "a",
      {
        href: `#${entry.path}`,
        class: cx(
          "flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-control)] text-sm transition-colors",
          isActive
            ? "bg-rail-active text-white font-medium"
            : "text-rail-text hover:bg-rail-hover hover:text-white",
          collapsed && "justify-center px-0",
        ),
        title: collapsed ? entry.label : undefined,
        "aria-current": isActive ? "page" : undefined,
      },
      icon(entry.icon, { size: 18 }),
      collapsed ? null : el("span", { class: "truncate-1" }, entry.label),
    );
  }

  function renderGroup(entry, active, collapsed) {
    const children = entry.children.filter((child) => can(child.permission));
    const hasActiveChild = children.some((child) => child.path === active);

    // المجموعة التي تحتوي الشاشة الحالية تُفتح تلقائيًا.
    if (hasActiveChild) expanded.add(entry.key);
    const isOpen = expanded.has(entry.key) && !collapsed;

    const toggle = el(
      "button",
      {
        type: "button",
        class: cx(
          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-control)] text-sm transition-colors",
          hasActiveChild && !isOpen
            ? "bg-rail-hover text-white"
            : "text-rail-text hover:bg-rail-hover hover:text-white",
          collapsed && "justify-center px-0",
        ),
        title: collapsed ? entry.label : undefined,
        "aria-expanded": String(isOpen),
        onClick: () => {
          if (collapsed) {
            // في الحالة المطويّة لا مكان للقائمة الفرعية: نفتح الشريط أولاً.
            setCollapsed(false);
            expanded.add(entry.key);
          } else if (expanded.has(entry.key)) {
            expanded.delete(entry.key);
          } else {
            expanded.add(entry.key);
          }
          paint();
        },
      },
      icon(entry.icon, { size: 18 }),
      collapsed
        ? null
        : el(
            "span",
            { class: "flex-1 text-start truncate-1" },
            entry.label,
          ),
      collapsed
        ? null
        : icon(isOpen ? "chevronUp" : "chevronDown", { size: 14, class: "opacity-60 shrink-0" }),
    );

    return el(
      "div",
      {},
      toggle,
      isOpen
        ? el(
            "div",
            { class: "mt-0.5 mb-1 ms-4 ps-3 border-s border-rail-hover space-y-0.5" },
            ...children.map((child) => {
              const isActive = child.path === active;

              return el(
                "a",
                {
                  href: `#${child.path}`,
                  class: cx(
                    "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[var(--radius-control)] text-[13px] transition-colors",
                    isActive
                      ? "bg-rail-active text-white font-medium"
                      : "text-rail-text/85 hover:bg-rail-hover hover:text-white",
                  ),
                  "aria-current": isActive ? "page" : undefined,
                },
                el("span", { class: "truncate-1" }, child.label),
                // وسم المرحلة يوضّح أن الشاشة مخطَّطة لا معطّلة.
                child.phase > APP.phase
                  ? el(
                      "span",
                      {
                        class: "shrink-0 text-[10px] px-1 rounded bg-rail-hover text-rail-heading tabular",
                        title: `مخطَّطة في المرحلة ${child.phase}`,
                      },
                      `P${child.phase}`,
                    )
                  : null,
              );
            }),
          )
        : null,
    );
  }

  /* --- المراقبون --- */
  const unsubscribers = [
    on("router:navigated", paint),
    on("session:changed", paint),
    appState.subscribe((next, previous) => {
      if (next.sidebarCollapsed !== previous.sidebarCollapsed) paint();
    }),
  ];

  paint();

  element.destroy = () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  return element;
}

export function setCollapsed(collapsed) {
  appState.set({ sidebarCollapsed: collapsed });
  writePreference("sidebarCollapsed", collapsed);
}

export function toggleCollapsed() {
  setCollapsed(!appState.get().sidebarCollapsed);
}

/* -------------------------------------------------------------------------- */

function brand() {
  return el(
    "div",
    { class: "flex items-center gap-2.5 h-(--spacing-header) px-3.5 shrink-0 border-b border-rail-hover" },
    el(
      "span",
      { class: "grid place-items-center size-8 rounded-[var(--radius-control)] bg-brand-600 text-white shrink-0" },
      icon("pharmacy", { size: 18 }),
    ),
    el(
      "div",
      { class: "min-w-0 group-data-[collapsed=true]/rail:hidden" },
      el("p", { class: "text-sm font-semibold text-white truncate-1" }, APP.organization),
      el("p", { class: "text-[10px] text-rail-heading" }, "نظام إدارة المستشفى"),
    ),
  );
}

function footer() {
  return el(
    "div",
    { class: "shrink-0 px-3.5 py-2.5 border-t border-rail-hover" },
    el(
      "p",
      { class: "text-[10px] text-rail-heading tabular" },
      `الإصدار ${APP.version} — المرحلة ${APP.phase}`,
    ),
  );
}

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
import { can, canAny, currentUser, currentRole } from "../../js/core/permissions.js";
import { appState, writePreference } from "../../js/core/store.js";
import { on } from "../../js/core/events.js";
import { APP } from "../../js/core/config.js";
import { initials } from "../../js/core/format.js";
import { toast } from "../feedback/toast.js";

/** المجموعات المفتوحة — نُبقيها في الذاكرة فلا تُطوى عند كل انتقال. */
const expanded = new Set();

export function sidebar() {
  const navHost = el("nav", {
    class: "flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5",
    "aria-label": "القائمة الرئيسية",
  });

  const collapseIconHost = el("span", { class: "grid place-items-center size-[18px] shrink-0" });

  const collapseToggle = el(
    "button",
    {
      type: "button",
      class:
        "hx-press flex items-center gap-2.5 w-full px-3 py-2 rounded-2xl " +
        "text-xs font-bold text-rail-heading hover:bg-white/60 dark:hover:bg-white/10 hover:text-rail-text transition-colors cursor-pointer",
      onClick: toggleCollapsed,
    },
    collapseIconHost,
    el("span", { class: "group-data-[collapsed=true]/rail:hidden" }, "طيّ القائمة الجانبية"),
  );

  const footerHost = el("div", { class: "shrink-0" });

  const element = el(
    "aside",
    {
      // `group/rail` يسمح لعناصر داخلية بالاستجابة لحالة الطي عبر data-collapsed.
      class: cx(
        "group/rail glass-rail text-rail-text flex flex-col shrink-0 no-print",
        "my-2.5 ms-2.5 me-2 h-[calc(100vh-1.25rem)] rounded-[28px] overflow-hidden",
        "w-(--spacing-sidebar) transition-[width] duration-300 ease-(--ease-premium)",
      ),
      dataset: { collapsed: "false" },
    },
    brand(),
    navHost,
    el("div", { class: "shrink-0 px-2 pb-1" }, collapseToggle),
    footerHost,
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

    // مقلوب لا مُدار يدويًا: أيقونة واحدة لكل حالة، كنمط تبديل أيقونة المجموعات أدناه.
    render(collapseIconHost, icon(collapsed ? "chevronEnd" : "chevronStart", { size: 14 }));
    // اسمان مختلفان تمامًا عن زر فتح الدرج في الهيدر على الموبايل (header.js) —
    // نفس التسمية لعنصرين مختلفين تربك قارئ الشاشة وتكسر محدِّدات الاختبار.
    collapseToggle.title = collapsed ? "توسيع القائمة الجانبية" : "طيّ القائمة الجانبية";

    const groups = navigation
      .filter((entry) =>
        // مجموعة بلا أي عنصر مسموح لا تُعرض.
        entry.children ? canAny(entry.children.map((child) => child.permission)) : can(entry.permission),
      )
      .map((entry) => (entry.children ? renderGroup(entry, active, collapsed) : renderLink(entry, active, collapsed)));

    render(navHost, ...groups);
    render(footerHost, footer(collapsed));
  }

  function renderLink(entry, active, collapsed) {
    const isActive = active === entry.path;

    return el(
      "a",
      {
        href: `#${entry.path}`,
        class: cx(
          "hx-press relative flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[13.5px]",
          "transition-all duration-200 mx-2",
          isActive
            ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-extrabold shadow-md shadow-blue-500/25 border border-blue-400/30"
            : "text-slate-700 dark:text-slate-200 font-bold hover:bg-white/70 dark:hover:bg-white/10 hover:text-blue-600 dark:hover:text-blue-400 border border-transparent",
          collapsed && "justify-center px-0 mx-1",
        ),
        title: collapsed ? entry.label : undefined,
        "aria-current": isActive ? "page" : undefined,
      },
      icon(entry.icon, { size: 19, class: isActive ? "text-white" : "text-slate-600 dark:text-slate-300" }),
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
          "hx-press w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl text-[13.5px] font-bold transition-all cursor-pointer mx-2",
          hasActiveChild && !isOpen
            ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 shadow-xs font-black"
            : "text-slate-700 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-transparent",
          collapsed && "justify-center px-0 mx-1",
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
      icon(entry.icon, { size: 19, class: hasActiveChild ? "text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-300" }),
      collapsed
        ? null
        : el(
            "span",
            { class: "flex-1 text-start truncate-1" },
            entry.label,
          ),
      collapsed
        ? null
        : el(
            "span",
            { class: cx("shrink-0 transition-transform duration-200", isOpen && "rotate-180") },
            icon("chevronDown", { size: 14, class: "opacity-60" }),
          ),
    );

    return el(
      "div",
      { class: "space-y-0.5" },
      toggle,
      isOpen
        ? el(
            "div",
            {
              class:
                "hx-page-in mt-1 mb-1.5 ms-4 ps-3 border-s-2 border-slate-200/80 dark:border-white/15 space-y-1 overflow-hidden",
            },
            ...children.map((child) => {
              const isActive = child.path === active;

              return el(
                "a",
                {
                  href: `#${child.path}`,
                  class: cx(
                    "hx-press flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-[13px] transition-all",
                    isActive
                      ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-extrabold shadow-sm shadow-blue-500/20 border border-blue-400/30"
                      : "text-slate-600 dark:text-slate-300 font-semibold hover:bg-white/70 dark:hover:bg-white/10 hover:text-blue-600 dark:hover:text-blue-400 border border-transparent",
                  ),
                  "aria-current": isActive ? "page" : undefined,
                },
                el("span", { class: "truncate-1" }, child.label),
                // وسم المرحلة يوضّح أن الشاشة مخطَّطة لا معطّلة.
                !isActive && child.phase > APP.phase
                  ? el(
                      "span",
                      {
                        class: "shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold tabular",
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
    {
      class:
        "flex items-center justify-between min-h-[76px] px-3.5 py-3 shrink-0 border-b border-black/[0.04] dark:border-white/[0.08]",
    },
    el(
      "div",
      { class: "flex items-center gap-2.5 min-w-0" },
      el(
        "span",
        {
          class:
            "relative grid place-items-center size-12 rounded-2xl shrink-0 " +
            "bg-white dark:bg-slate-800 shadow-xs border border-white/80 dark:border-white/20 p-1.5 overflow-hidden",
        },
        el("img", {
          src: "assets/logo.png",
          alt: "Logo",
          class: "size-full object-contain",
          onError: (evt) => {
            evt.target.style.display = "none";
          },
        }),
      ),
      el(
        "div",
        { class: "min-w-0 group-data-[collapsed=true]/rail:hidden" },
        el("p", { class: "text-[14px] font-black text-slate-900 dark:text-white truncate-1 tracking-tight" }, APP.organization),
        el("p", { class: "text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate-1" }, "منظومة الإدارة الطبية المتكاملة"),
      ),
    ),
    el(
      "button",
      {
        type: "button",
        class:
          "hx-press grid place-items-center size-7.5 rounded-full shrink-0 border border-slate-200/80 dark:border-white/15 " +
          "bg-white/90 dark:bg-slate-800 hover:bg-white text-slate-600 dark:text-slate-300 shadow-sm transition-all group-data-[collapsed=true]/rail:hidden cursor-pointer",
        title: "طيّ القائمة الجانبية",
        onClick: toggleCollapsed,
      },
      icon("chevronStart", { size: 14 }),
    ),
  );
}

/*
 * بطاقة المستخدم وتسجيل الخروج في أسفل القضيب — حسب المرجع البصري.
 */
function footer(collapsed) {
  const user = currentUser();
  const role = currentRole();

  return el(
    "div",
    { class: "shrink-0 border-t border-black/[0.04] dark:border-white/[0.08] px-3 py-2.5 space-y-2.5" },
    collapsed
      ? null
      : el(
          "div",
          { class: "flex items-center justify-center py-1 px-2 mb-0.5" },
          el("img", { src: "assets/devx_logo.jpg", alt: "DevX", class: "h-5 rounded-md object-contain shadow-xs border border-white/60" }),
        ),
    el(
      "button",
      {
        type: "button",
        class: cx(
          "hx-press w-full flex items-center justify-center gap-2 py-1 text-xs font-bold cursor-pointer transition-colors",
          "text-red-500 hover:text-red-600 dark:text-red-400",
          collapsed && "justify-center px-0",
        ),
        title: collapsed ? "تسجيل الخروج" : undefined,
        "aria-label": "تسجيل الخروج من الشريط الجانبي",
        onClick: () =>
          toast.info("تسجيل الخروج يتطلب نظام مصادقة — غير منفَّذ بعد."),
      },
      icon("logout", { size: 15, class: "text-red-500" }),
      collapsed ? null : el("span", {}, "تسجيل الخروج"),
    ),
    el(
      "div",
      {
        class: cx(
          "flex items-center gap-2.5 p-2 rounded-2xl bg-white/80 dark:bg-white/5 border border-white/90 dark:border-white/10 shadow-xs",
          collapsed && "justify-center p-1 bg-transparent border-transparent",
        ),
        title: collapsed ? user.name : undefined,
      },
      el(
        "span",
        {
          class:
            "grid place-items-center size-9 rounded-full shrink-0 text-xs font-bold " +
            "bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-xs",
        },
        initials(user.name),
      ),
      collapsed
        ? null
        : el(
            "div",
            { class: "min-w-0" },
            el("p", { class: "text-xs font-black text-slate-900 dark:text-white truncate-1" }, user.name),
            el("p", { class: "text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate-1" }, role.label),
          ),
    ),
    collapsed
      ? null
      : el(
          "p",
          { class: "text-[9px] text-center text-slate-400 tabular" },
          `الإصدار ${APP.version} — مستشفى النيل التخصصي`,
        ),
  );
}

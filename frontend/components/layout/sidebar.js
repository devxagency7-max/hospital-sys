/**
 * الشريط الجانبي.
 * تصميم زجاجي عصري فاخر لمستشفى أمان الحياة في حالتيه:
 * 1. الحالة المفتوحة (Expanded) مع الشعار، العناوين، الأيقونات بالطرف الأيمن،
 *    العناصر النشطة ببطاقات بيضاء بنقطة زرقاء، شعار DevX، وزر الخروج الأحمر وبطاقة المستخدم.
 * 2. الحالة المطوية (Collapsed) مع زر التوسيع العلوي، عمود الأيقونات المتمركزة،
 *    أيقونة الخروج الحمراء، وصورة المستخدم بالأسفل، مع الحواف المنحنية الفاخرة rounded-tl/bl-[36px].
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
    class: "flex-1 overflow-y-auto px-2.5 py-3 space-y-1",
    "aria-label": "القائمة الرئيسية",
  });

  const footerHost = el("div", { class: "shrink-0" });

  const element = el(
    "aside",
    {
      // `group/rail` يسمح لعناصر داخلية بالاستجابة لحالة الطي عبر data-collapsed.
      class: cx(
        "group/rail glass-rail text-rail-text flex flex-col shrink-0 no-print",
        "h-screen rounded-tl-[36px] rounded-bl-[36px] rounded-r-none overflow-hidden",
        "border-l border-white/80 dark:border-white/10 shadow-2xl",
        "sidebar-expanded transition-[width] duration-300 ease-(--ease-premium)",
      ),
      dataset: { collapsed: "false" },
    },
    brand(),
    navHost,
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
    element.classList.toggle("sidebar-expanded", !collapsed);
    element.classList.toggle("sidebar-collapsed", collapsed);

    const groups = navigation
      .filter((entry) =>
        entry.children ? canAny(entry.children.map((child) => child.permission)) : can(entry.permission),
      )
      .map((entry) => (entry.children ? renderGroup(entry, active, collapsed) : renderLink(entry, active, collapsed)));

    render(navHost, ...groups);
    render(footerHost, footer(collapsed));
  }

  function renderLink(entry, active, collapsed) {
    const isActive = active === entry.path;

    if (collapsed) {
      return el(
        "a",
        {
          href: `#${entry.path}`,
          class: cx(
            "hx-press grid place-items-center size-11 rounded-2xl mx-auto my-1 transition-all cursor-pointer",
            isActive
              ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/60 dark:border-white/15 font-black"
              : "text-slate-800 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-white/10 hover:text-blue-600 font-bold",
          ),
          title: entry.label,
          "aria-current": isActive ? "page" : undefined,
        },
        icon(entry.icon, { size: 22 }),
      );
    }

    return el(
      "a",
      {
        href: `#${entry.path}`,
        class: cx(
          "hx-press flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl text-[14px] transition-all cursor-pointer mx-1",
          isActive
            ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-extrabold shadow-sm border border-slate-200/60 dark:border-white/10"
            : "text-slate-800 dark:text-slate-200 font-bold hover:bg-white/60 dark:hover:bg-white/10 hover:text-blue-600 border border-transparent",
        ),
        "aria-current": isActive ? "page" : undefined,
      },
      el(
        "div",
        { class: "flex items-center gap-3 min-w-0 flex-1" },
        icon(entry.icon, {
          size: 21,
          class: isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-800 dark:text-slate-200",
        }),
        el("span", { class: "truncate-1 text-start" }, entry.label),
      ),
      isActive
        ? el("span", { class: "size-2.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0 ms-1" })
        : null,
    );
  }

  function renderGroup(entry, active, collapsed) {
    const children = entry.children.filter((child) => can(child.permission));
    const hasActiveChild = children.some((child) => child.path === active);

    // المجموعة التي تحتوي الشاشة الحالية تُفتح تلقائيًا.
    if (hasActiveChild) expanded.add(entry.key);
    const isOpen = expanded.has(entry.key) && !collapsed;

    if (collapsed) {
      const toggle = el(
        "button",
        {
          type: "button",
          class: cx(
            "hx-press grid place-items-center size-11 rounded-2xl mx-auto my-1 transition-all cursor-pointer",
            hasActiveChild
              ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/60 dark:border-white/15"
              : "text-slate-800 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-white/10 hover:text-blue-600",
          ),
          title: entry.label,
          "aria-expanded": "false",
          onClick: () => {
            setCollapsed(false);
            expanded.add(entry.key);
            paint();
          },
        },
        icon(entry.icon, { size: 22 }),
      );

      return el("div", { class: "space-y-0.5" }, toggle);
    }

    const toggle = el(
      "button",
      {
        type: "button",
        class: cx(
          "hx-press w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl text-[14px] transition-all cursor-pointer mx-1",
          hasActiveChild && !isOpen
            ? "bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 font-black shadow-xs"
            : "text-slate-800 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-white/10 hover:text-slate-900 font-bold border border-transparent",
        ),
        "aria-expanded": String(isOpen),
        onClick: () => {
          if (expanded.has(entry.key)) {
            expanded.delete(entry.key);
          } else {
            expanded.add(entry.key);
          }
          paint();
        },
      },
      el(
        "div",
        { class: "flex items-center gap-3 min-w-0 flex-1" },
        icon(entry.icon, {
          size: 21,
          class: hasActiveChild ? "text-blue-600 dark:text-blue-400" : "text-slate-800 dark:text-slate-200",
        }),
        el("span", { class: "text-start truncate-1" }, entry.label),
      ),
      el(
        "span",
        { class: cx("shrink-0 transition-transform duration-200 text-slate-500", isOpen && "rotate-180") },
        icon("chevronDown", { size: 15 }),
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
              class: "hx-page-in my-0.5 space-y-0.5 overflow-hidden ps-2 pe-1",
            },
            ...children.map((child) => {
              const isActive = child.path === active;

              return el(
                "a",
                {
                  href: `#${child.path}`,
                  class: cx(
                    "hx-press flex items-center justify-between gap-2 px-3 py-2 rounded-2xl text-[12.5px] transition-all",
                    isActive
                      ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-extrabold shadow-sm border border-slate-100 dark:border-white/10"
                      : "text-slate-700 dark:text-slate-300 font-bold hover:bg-white/50 dark:hover:bg-white/10 hover:text-blue-600 border border-transparent",
                  ),
                  "aria-current": isActive ? "page" : undefined,
                },
                el(
                  "span",
                  {
                    class: cx("truncate-1", isActive ? "font-extrabold text-blue-600 dark:text-blue-400" : "font-bold"),
                  },
                  child.label,
                ),
                isActive
                  ? el("span", { class: "size-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0 ms-1" })
                  : child.phase > APP.phase
                    ? el(
                        "span",
                        {
                          class:
                            "shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold tabular",
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
  // زر الطيّ (يظهر عندما يكون الشريط مفتوحًا)
  const collapseBtn = el(
    "button",
    {
      type: "button",
      class:
        "hx-press grid place-items-center size-8.5 rounded-2xl shrink-0 " +
        "border border-slate-200/80 dark:border-white/15 bg-white/90 dark:bg-slate-800 hover:bg-white " +
        "text-slate-700 dark:text-slate-200 shadow-xs transition-all cursor-pointer",
      title: "طيّ القائمة الجانبية",
      onClick: toggleCollapsed,
    },
    icon("chevronEnd", { size: 14 }),
  );

  // رأس الشريط عندما يكون مفتوحًا (Expanded)
  const expandedBrand = el(
    "div",
    {
      class:
        "flex items-center justify-between min-h-[78px] px-3.5 py-3 shrink-0 " +
        "border-b border-black/[0.05] dark:border-white/[0.08] rail-expanded-only",
    },
    el(
      "div",
      { class: "flex items-center gap-2.5 min-w-0 flex-1" },
      el(
        "span",
        {
          class:
            "relative grid place-items-center size-12 rounded-2xl shrink-0 " +
            "bg-white dark:bg-slate-800 shadow-xs border border-white/90 dark:border-white/20 p-1.5 overflow-hidden",
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
        { class: "min-w-0 flex-1 space-y-0.5" },
        el("p", { class: "text-[13px] font-black text-slate-900 dark:text-white truncate-1 tracking-tight" }, APP.organization),
        el("p", { class: "text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate-1" }, "منظومة الإدارة الطبية"),
        el("p", { class: "text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate-1" }, "ترخيص طبي رقم 1079"),
      ),
    ),
    collapseBtn,
  );

  // زر التوسيع (يظهر عندما يكون الشريط مطويًا)
  const expandBtn = el(
    "button",
    {
      type: "button",
      class:
        "hx-press grid place-items-center size-9 rounded-2xl shrink-0 " +
        "border border-slate-200/80 dark:border-white/15 bg-white/90 dark:bg-slate-800 hover:bg-white " +
        "text-slate-700 dark:text-slate-200 shadow-xs transition-all cursor-pointer mx-auto",
      title: "توسيع القائمة الجانبية",
      onClick: toggleCollapsed,
    },
    icon("chevronStart", { size: 14 }),
  );

  // رأس الشريط عندما يكون مطويًا (Collapsed)
  const collapsedBrand = el(
    "div",
    {
      class:
        "flex items-center justify-center min-h-[78px] py-3 shrink-0 " +
        "border-b border-black/[0.05] dark:border-white/[0.08] rail-collapsed-only",
    },
    expandBtn,
  );

  return el("div", { class: "shrink-0" }, expandedBrand, collapsedBrand);
}

/*
 * بطاقة المستخدم وتسجيل الخروج في أسفل الشريط الجانبي — مطابق 1:1 للمرجع البصري.
 */
function footer(collapsed) {
  const user = currentUser();
  const role = currentRole();

  if (collapsed) {
    return el(
      "div",
      { class: "shrink-0 border-t border-black/[0.05] dark:border-white/[0.08] px-2 py-3 space-y-2.5" },
      el(
        "button",
        {
          type: "button",
          class:
            "hx-press grid place-items-center size-10 rounded-2xl mx-auto text-red-500 hover:bg-red-50/60 dark:hover:bg-red-950/30 transition-colors cursor-pointer",
          title: "تسجيل الخروج",
          "aria-label": "تسجيل الخروج من الشريط الجانبي",
          onClick: () => toast.info("تسجيل الخروج يتطلب نظام مصادقة — غير منفَّذ بعد."),
        },
        icon("logout", { size: 18, class: "text-red-500" }),
      ),
      el(
        "div",
        {
          class: "flex items-center justify-center pt-1 border-t border-black/[0.04] dark:border-white/[0.08]",
          title: `${user.name} — ${role.label}`,
        },
        el(
          "span",
          {
            class:
              "grid place-items-center size-10 rounded-full font-bold text-xs " +
              "bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-2 border-white dark:border-slate-700 shadow-xs",
          },
          initials(user.name),
        ),
      ),
    );
  }

  return el(
    "div",
    { class: "shrink-0 border-t border-black/[0.05] dark:border-white/[0.08] px-3.5 py-3 space-y-2.5" },
    el(
      "div",
      { class: "flex items-center justify-center py-1 mb-0.5" },
      el("img", {
        src: "assets/devx_logo.jpg",
        alt: "DevX",
        class: "h-5 rounded-md object-contain shadow-xs border border-white/60",
      }),
    ),
    el(
      "button",
      {
        type: "button",
        class:
          "hx-press w-full flex items-center justify-center gap-2 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors " +
          "text-red-500 hover:text-red-600 hover:bg-red-50/50 dark:hover:bg-red-950/20",
        "aria-label": "تسجيل الخروج من الشريط الجانبي",
        onClick: () => toast.info("تسجيل الخروج يتطلب نظام مصادقة — غير منفَّذ بعد."),
      },
      icon("logout", { size: 15, class: "text-red-500" }),
      el("span", {}, "تسجيل الخروج"),
    ),
    el(
      "div",
      {
        class:
          "flex items-center gap-3 p-2.5 rounded-[22px] bg-white/90 dark:bg-slate-800/90 " +
          "border border-white/90 dark:border-white/15 shadow-xs",
        title: `${user.name} — ${role.label}`,
      },
      el(
        "span",
        {
          class:
            "grid place-items-center size-9.5 rounded-full shrink-0 text-xs font-bold " +
            "bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xs border border-white dark:border-slate-700",
        },
        initials(user.name),
      ),
      el(
        "div",
        { class: "min-w-0 flex-1 space-y-0.5" },
        el("p", { class: "text-[13px] font-black text-slate-900 dark:text-white truncate-1" }, user.name),
        el("p", { class: "text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate-1" }, role.label),
      ),
    ),
  );
}

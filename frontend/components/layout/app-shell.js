/**
 * الإطار العام للتطبيق.
 *
 * يُبنى مرة واحدة عند بدء التطبيق ولا يُعاد رسمه عند التنقل — الشاشات تُرسم
 * في `outlet` فقط. هذه هي الفائدة العملية لاختيار SPA: الشريط الجانبي والهيدر
 * لا يرتعشان بين الشاشات، وحالة القائمة المفتوحة تبقى كما هي.
 */

import { el, render } from "../../js/core/dom.js";
import { sidebar } from "./sidebar.js";
import { header } from "./header.js";
import { breadcrumbs } from "./breadcrumbs.js";
import { UI } from "../../js/core/config.js";

/**
 * @returns {{ element: HTMLElement, outlet: HTMLElement, setContext: Function }}
 */
export function appShell() {
  const outlet = el("div", { id: "page", class: "px-4 pb-8 pt-3 sm:px-5" });
  const breadcrumbHost = el("div", { class: "px-4 pt-3 sm:px-5 min-h-0" });

  const navPanel = sidebar();

  /* --- الشريط الجانبي على الموبايل: درج فوق المحتوى لا عمود يسحقه --- */
  const mobileBackdrop = el("div", {
    class: "fixed inset-0 z-40 bg-ink/40 hidden lg:hidden",
    onClick: () => closeMobileNav(),
  });

  const mobileHost = el(
    "div",
    { class: "fixed inset-y-0 start-0 z-50 hidden lg:hidden" },
  );

  function openMobileNav() {
    mobileBackdrop.classList.remove("hidden");
    mobileHost.classList.remove("hidden");
    mobileHost.appendChild(navPanel);
  }

  function closeMobileNav() {
    mobileBackdrop.classList.add("hidden");
    mobileHost.classList.add("hidden");
    desktopHost.appendChild(navPanel);
  }

  const desktopHost = el("div", { class: "hidden lg:block h-full" }, navPanel);

  const topBar = header({ onOpenMobileNav: openMobileNav });

  const element = el(
    "div",
    { class: "flex h-screen overflow-hidden bg-canvas" },
    desktopHost,
    mobileBackdrop,
    mobileHost,
    el(
      "div",
      { class: "flex-1 flex flex-col min-w-0" },
      topBar,
      // التمرير يحدث هنا لا على body — فيبقى الهيدر والشريط ثابتين.
      el("main", { class: "flex-1 overflow-y-auto", id: "main" }, breadcrumbHost, outlet),
    ),
  );

  /** يُستدعى من خطّافات الراوتر عند كل انتقال. */
  function setContext(context) {
    const trail = breadcrumbs(context);
    if (trail) render(breadcrumbHost, trail);
    else render(breadcrumbHost);

    // إغلاق درج الموبايل بعد الانتقال — تركه مفتوحًا يحجب الشاشة الجديدة.
    if (window.innerWidth < UI.mobileBreakpoint) closeMobileNav();
  }

  // العودة من عرض موبايل إلى سطح المكتب تُعيد الشريط إلى مكانه.
  window.addEventListener("resize", () => {
    if (window.innerWidth >= UI.mobileBreakpoint && mobileHost.contains(navPanel)) closeMobileNav();
  });

  return { element, outlet, setContext };
}

/** رابط «تجاوز إلى المحتوى» — أول عنصر قابل للتركيز في الصفحة. */
export function skipLink() {
  return el(
    "a",
    {
      href: "#main",
      class:
        "sr-only-focusable absolute z-[70] top-2 start-2 px-3 py-2 bg-brand-600 text-white " +
        "text-sm rounded-[var(--radius-control)] shadow-raised",
    },
    "تجاوز إلى المحتوى",
  );
}

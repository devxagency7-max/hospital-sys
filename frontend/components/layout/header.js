/**
 * الهيدر.
 *
 * يضم: زر طي الشريط، شريط تقدّم الطلبات، الإشعارات، وبطاقة المستخدم.
 *
 * مبدّل الأدوار أداة تطوير لا ميزة للمستخدم: وجوده يجعل اختبار الواجهة
 * المدركة للصلاحيات فعليًا بدل افتراضه. يُزال عند ربط المصادقة في Phase 7.
 */

import { el, cx, render, qs } from "../../js/core/dom.js";
import { icon } from "../common/icon.js";
import { iconButton } from "../common/button.js";
import { initials } from "../../js/core/format.js";
import { currentUser, currentRole, ROLES, setRole } from "../../js/core/permissions.js";
import { appState } from "../../js/core/store.js";
import { on } from "../../js/core/events.js";
import { toggleCollapsed } from "./sidebar.js";
import { describeDataLayer } from "../../js/api/meta.api.js";
import { APP } from "../../js/core/config.js";

export function header({ onOpenMobileNav } = {}) {
  /* --- شريط التقدّم: الدليل الوحيد على وجود طلب جارٍ خارج محتوى الصفحة --- */
  const progress = el("div", {
    class:
      "absolute top-0 inset-x-0 h-0.5 bg-brand-500 origin-[100%_0] scale-x-0 " +
      "transition-transform duration-300 opacity-0",
  });

  const userMenuHost = el("div", { class: "relative" });

  const element = el(
    "header",
    {
      class:
        "relative shrink-0 h-(--spacing-header) bg-surface border-b border-line " +
        "flex items-center gap-2 px-3 no-print",
    },
    progress,

    /* --- يمين (البداية في RTL) --- */
    iconButton("menu", {
      label: "طي القائمة",
      size: "icon",
      class: "hidden lg:inline-flex",
      onClick: toggleCollapsed,
    }),
    iconButton("menu", {
      label: "فتح القائمة",
      size: "icon",
      class: "lg:hidden",
      onClick: () => onOpenMobileNav?.(),
    }),

    el("div", { class: "flex-1" }),

    /* --- يسار (النهاية في RTL) --- */
    dataLayerBadge(),
    roleSwitcher(),
    iconButton("bell", { label: "الإشعارات", size: "icon", onClick: () => {} }),
    userMenuHost,
  );

  /* --- بطاقة المستخدم --- */
  function paintUser() {
    const user = currentUser();
    const role = currentRole();

    render(
      userMenuHost,
      el(
        "div",
        { class: "flex items-center gap-2.5 ps-2 border-s border-line" },
        el(
          "div",
          { class: "text-end hidden sm:block" },
          el("p", { class: "text-xs font-medium text-ink leading-tight" }, user.name),
          el("p", { class: "text-[11px] text-faint leading-tight" }, role.label),
        ),
        el(
          "span",
          {
            class:
              "grid place-items-center size-8 rounded-full bg-brand-100 text-brand-700 " +
              "text-xs font-semibold shrink-0",
            title: user.name,
          },
          initials(user.name),
        ),
      ),
    );
  }

  /* --- شريط التقدّم --- */
  function paintProgress(pending) {
    if (pending > 0) {
      progress.style.opacity = "1";
      progress.style.transform = "scaleX(0.7)";
    } else {
      progress.style.transform = "scaleX(1)";
      // نُكمل الشريط ثم نُخفيه — الاختفاء الفوري يبدو كأن الطلب أُلغي.
      setTimeout(() => {
        progress.style.opacity = "0";
        setTimeout(() => {
          progress.style.transform = "scaleX(0)";
        }, 300);
      }, 180);
    }
  }

  const unsubscribers = [
    on("session:changed", paintUser),
    appState.subscribe((next, previous) => {
      if (next.pendingRequests !== previous.pendingRequests) paintProgress(next.pendingRequests);
    }),
  ];

  paintUser();

  element.destroy = () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  return element;
}

/**
 * وسم يُذكّر بأن البيانات تجريبية — يمنع الخلط بين عرض ونظام حقيقي.
 *
 * الحالة تُقرأ من طبقة الـ API لا من ثابت الإعداد مباشرة: المكوّن لا يحتاج
 * أن يعرف أن هناك شيئًا اسمه «mock»، يكفيه أن يسأل «هل البيانات حقيقية؟».
 * يختفي الوسم تلقائيًا عند الربط بباك-إند حقيقي.
 */
function dataLayerBadge() {
  const { isMock } = describeDataLayer();
  if (!isMock) return null;

  return el(
    "span",
    {
      class:
        "hidden md:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full " +
        "bg-warning-50 border border-warning-200 text-warning-700 text-[11px] font-medium",
      title: "الواجهة تعمل على بيانات تجريبية. راجع js/core/config.js للربط بباك-إند حقيقي.",
    },
    icon("info", { size: 13 }),
    el("span", {}, "بيانات تجريبية"),
  );
}

/** مبدّل الأدوار — أداة تطوير، تُزال في Phase 7. */
function roleSwitcher() {
  const host = el("div", { class: "relative hidden md:block" });

  let panel = null;

  const toggle = el(
    "button",
    {
      type: "button",
      class:
        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-line-strong " +
        "text-[11px] text-muted hover:text-ink hover:border-faint transition-colors",
      title: "تبديل الدور لاختبار الصلاحيات (أداة تطوير)",
      onClick: () => {
        if (panel) {
          panel.remove();
          panel = null;
          return;
        }

        panel = el(
          "div",
          {
            class:
              "absolute top-full end-0 mt-1.5 z-30 w-56 bg-surface border border-line " +
              "rounded-[var(--radius-control)] shadow-raised p-1.5",
          },
          el(
            "p",
            { class: "px-2 py-1 text-[10px] text-faint leading-snug" },
            "أداة تطوير: بدّل الدور لتتحقق من أن الواجهة تحترم الصلاحيات.",
          ),
          ...Object.entries(ROLES).map(([key, role]) =>
            el(
              "button",
              {
                type: "button",
                class: cx(
                  "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-start text-xs transition-colors",
                  currentRole().key === key
                    ? "bg-brand-50 text-brand-800 font-medium"
                    : "text-ink hover:bg-subtle",
                ),
                onClick: () => {
                  setRole(key);
                  panel?.remove();
                  panel = null;
                  paintLabel();
                  // الشاشة الحالية قد تكون ممنوعة على الدور الجديد — نعيد توجيهها.
                  window.dispatchEvent(new HashChangeEvent("hashchange"));
                },
              },
              el("span", {}, role.label),
              currentRole().key === key ? icon("check", { size: 13 }) : null,
            ),
          ),
        );

        host.appendChild(panel);

        setTimeout(() => {
          const onOutside = (evt) => {
            if (!host.contains(evt.target)) {
              panel?.remove();
              panel = null;
              document.removeEventListener("mousedown", onOutside);
            }
          };
          document.addEventListener("mousedown", onOutside);
        }, 0);
      },
    },
    icon("user", { size: 13 }),
    el("span", { dataset: { roleLabel: "" } }, currentRole().label),
    icon("chevronDown", { size: 12 }),
  );

  function paintLabel() {
    const label = qs("[data-role-label]", toggle);
    if (label) label.textContent = currentRole().label;
  }

  host.appendChild(toggle);
  return APP.phase < 7 ? host : el("span", { hidden: true });
}

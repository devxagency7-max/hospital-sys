/**
 * الهيدر.
 *
 * يضم: زر طي الشريط، شريط تقدّم الطلبات، بحث سريع (لوحة أوامر)، إشعارات
 * المخزون، وقائمة المستخدم.
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
import { notificationsPanel } from "./notifications-panel.js";
import { openCommandPalette } from "../common/command-palette.js";
import { toast } from "../feedback/toast.js";
import { describeDataLayer } from "../../js/api/meta.api.js";
import { APP } from "../../js/core/config.js";
import { setTheme, currentThemePreference } from "../../js/core/theme.js";
import { navigate } from "../../js/core/router.js";

export function header({ onOpenMobileNav } = {}) {
  /* --- شريط التقدّم: الدليل الوحيد على وجود طلب جارٍ خارج محتوى الصفحة --- */
  const progress = el("div", {
    class:
      "absolute top-0 inset-x-0 h-0.5 bg-gradient-to-l from-brand-400 via-brand-500 to-brand-400 " +
      "origin-[100%_0] scale-x-0 transition-transform duration-300 opacity-0",
  });

  const userMenuHost = el("div", { class: "relative" });

  const element = el(
    "header",
    {
      // z-20 ضروري هنا لا تزيينية: glass يُفعِّل backdrop-filter، والذي يُنشئ
      // سياق تكديس جديد (stacking context) للهيدر. قائمة المستخدم المنسدلة
      // عنصر أبناء داخل هذا السياق بـz-30 نسبي له — لكن الهيدر نفسه بلا
      // z-index صريح يبقى "auto" في تكديس الجذر، فيُرسَم <main> (الشقيق
      // التالي في DOM) فوق صندوق الهيدر كاملاً بما فيه القائمة المنسدلة
      // المفتوحة. باگ فعلي ظهر فقط بعد إصلاح backdrop-filter (راجع تعليق
      // glass في tailwind.src.css) — قبل الإصلاح لم يكن الهيدر يُنشئ سياق
      // تكديس أصلاً فلم يظهر التعارض.
      class:
        "glass relative z-20 shrink-0 h-(--spacing-header) border-b border-line " +
        "flex items-center gap-2 px-3 no-print",
    },
    progress,

    /* --- يمين (البداية في RTL) --- */
    iconButton("menu", {
      label: "طي القائمة",
      size: "icon",
      // max-lg:hidden لا hidden+lg:inline-flex: كلا الزرّين يحمل inline-flex
      // أصلاً من BASE في button.js، فقاعدة .hidden غير المشروطة وقاعدة
      // .inline-flex غير المشروطة تتصارعان بنفس الخصوصية خارج أي media query
      // — ترتيبهما في مخرجات Tailwind يحسم الفائز بصرف النظر عن ترتيب الأصناف
      // في HTML، وقد ظهر فعليًا: الزرّان معًا ظاهران على الموبايل. التأهيل
      // بـmax-lg يبقي display:none داخل media query فلا يتصادم مع القاعدة
      // غير المشروطة لـinline-flex.
      class: "max-lg:hidden",
      onClick: toggleCollapsed,
    }),
    iconButton("menu", {
      label: "فتح القائمة",
      size: "icon",
      class: "lg:hidden",
      onClick: () => onOpenMobileNav?.(),
    }),

    searchTrigger(),

    el("div", { class: "flex-1" }),

    /* --- يسار (النهاية في RTL) --- */
    dataLayerBadge(),
    roleSwitcher(),
    iconButton("image", {
      label: "استوديو تخصيص الخلفية والمظهر",
      size: "icon",
      title: "استوديو تخصيص الخلفية والمظهر",
      onClick: () => navigate("/settings/appearance"),
    }),
    notificationsPanel(),
    userMenuHost,
  );

  /* --- بطاقة المستخدم وقائمتها --- */
  let userPanel = null;
  let detachOutsideClick = () => {};

  function paintUser() {
    const user = currentUser();
    const role = currentRole();

    const avatarButton = el(
      "button",
      {
        type: "button",
        class:
          "hx-press flex items-center gap-2.5 ps-2.5 pe-1 py-1 border-s border-line rounded-[var(--radius-control)] " +
          "hover:bg-subtle transition-colors",
        "aria-haspopup": "true",
        "aria-expanded": "false",
        onClick: toggleUserPanel,
      },
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
            "grid place-items-center size-8 rounded-full shrink-0 text-xs font-semibold " +
            "bg-gradient-to-br from-brand-400 to-brand-700 text-white",
          title: user.name,
        },
        initials(user.name),
      ),
      icon("chevronDown", { size: 13, class: "hidden sm:block text-faint" }),
    );

    render(userMenuHost, avatarButton);
  }

  function toggleUserPanel() {
    if (userPanel) {
      closeUserPanel();
      return;
    }

    const user = currentUser();
    const role = currentRole();

    userPanel = el(
      "div",
      {
        class:
          "absolute top-full end-0 mt-2 z-30 w-60 bg-surface border border-line " +
          "rounded-[var(--radius-card)] shadow-overlay overflow-hidden hx-rise",
        role: "menu",
      },
      el(
        "div",
        { class: "px-3.5 py-3 border-b border-line" },
        el("p", { class: "text-sm font-semibold text-ink truncate-1" }, user.name),
        el("p", { class: "text-xs text-muted mt-0.5" }, `${role.label} — ${user.jobTitle ?? ""}`),
      ),
      el("div", { class: "p-1.5 border-b border-line" }, themeToggle()),
      el(
        "div",
        { class: "p-1.5" },
        menuItem({ icon: "settings", label: "الإعدادات", href: "#/settings/hospital" }),
        menuItem({
          icon: "logout",
          label: "تسجيل الخروج",
          tone: "danger",
          onClick: () => {
            closeUserPanel();
            // صريح لا مُقلَّد: لا نظام مصادقة بعد (Phase 7)، فلا تسجيل خروج فعلي.
            toast.info("تسجيل الخروج يتطلب نظام مصادقة — غير منفَّذ بعد (Phase 7).");
          },
        }),
      ),
    );

    userMenuHost.appendChild(userPanel);
    qs('[aria-haspopup="true"]', userMenuHost)?.setAttribute("aria-expanded", "true");

    setTimeout(() => {
      const onOutside = (evt) => {
        if (!userMenuHost.contains(evt.target)) closeUserPanel();
      };
      document.addEventListener("mousedown", onOutside);
      detachOutsideClick = () => document.removeEventListener("mousedown", onOutside);
    }, 0);
  }

  function closeUserPanel() {
    userPanel?.remove();
    userPanel = null;
    detachOutsideClick();
    detachOutsideClick = () => {};
    qs('[aria-haspopup="true"]', userMenuHost)?.setAttribute("aria-expanded", "false");
  }

  /**
   * مفتاح ثلاثي (داكن / فاتح / النظام) — لا قائمة منسدلة منفصلة: ثلاثة خيارات
   * فقط تستحق ضغطة واحدة، لا فتح-ثم-اختيار. إعادة الرسم تعتمد على بثّ appState
   * (setTheme يكتب فيه) فتتزامن حالة الزر الفعّال حتى لو تغيّر التفضيل من مكان
   * آخر (تبويب آخر، أو تغيّر تفضيل النظام أثناء فتح اللوحة).
   */
  const THEME_OPTIONS = [
    { value: "light", label: "فاتح", icon: "sun" },
    { value: "dark", label: "داكن", icon: "moon" },
    { value: "system", label: "النظام", icon: "monitor" },
  ];

  function themeToggle() {
    const host = el("div", {
      class: "grid grid-cols-3 gap-1 p-1 bg-subtle rounded-[var(--radius-control)]",
      role: "radiogroup",
      "aria-label": "سمة الواجهة",
    });

    function paint() {
      const active = currentThemePreference();
      render(
        host,
        ...THEME_OPTIONS.map(({ value, label, icon: iconName }) =>
          el(
            "button",
            {
              type: "button",
              class: cx(
                "hx-press flex flex-col items-center gap-1 py-1.5 rounded-[calc(var(--radius-control)-2px)] text-[11px] transition-colors",
                active === value
                  ? "bg-surface text-ink shadow-card font-medium"
                  : "text-faint hover:text-muted",
              ),
              role: "radio",
              "aria-checked": String(active === value),
              onClick: () => {
                setTheme(value);
                paint();
              },
            },
            icon(iconName, { size: 15 }),
            label,
          ),
        ),
      );
    }

    paint();
    return host;
  }

  function menuItem({ icon: iconName, label, href, tone, onClick }) {
    const classes = cx(
      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-control)] text-sm text-start transition-colors",
      tone === "danger" ? "text-danger-300 hover:bg-danger-50" : "text-ink hover:bg-subtle",
    );

    const content = [icon(iconName, { size: 16 }), el("span", {}, label)];

    return href
      ? el("a", { href, class: classes, role: "menuitem", onClick: closeUserPanel }, ...content)
      : el("button", { type: "button", class: classes, role: "menuitem", onClick }, ...content);
  }

  /* --- اختصار لوحة الأوامر: Ctrl/Cmd+K من أي مكان في الصفحة --- */
  function onGlobalKeydown(evt) {
    if ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === "k") {
      evt.preventDefault();
      openCommandPalette();
    }
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

  document.addEventListener("keydown", onGlobalKeydown);

  const unsubscribers = [
    on("session:changed", paintUser),
    on("router:navigated", closeUserPanel),
    appState.subscribe((next, previous) => {
      if (next.pendingRequests !== previous.pendingRequests) paintProgress(next.pendingRequests);
    }),
  ];

  paintUser();

  element.destroy = () => {
    document.removeEventListener("keydown", onGlobalKeydown);
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };

  return element;
}

/** زر البحث السريع — يبدو كحقل بحث، لا كأيقونة مجردة، فيُفهم دوره فورًا. */
function searchTrigger() {
  return el(
    "button",
    {
      type: "button",
      class:
        "hx-press hidden md:flex items-center gap-2.5 h-9 px-3 w-64 lg:w-80 rounded-[var(--radius-control)] " +
        "bg-subtle border border-line text-start text-sm text-faint hover:border-line-strong hover:text-muted " +
        "transition-colors",
      onClick: () => openCommandPalette(),
    },
    icon("search", { size: 15 }),
    el("span", { class: "flex-1 truncate-1" }, "بحث عن مريض، فاتورة، أو شاشة…"),
    el(
      "kbd",
      { class: "hidden lg:inline-block text-[10px] border border-line-strong rounded px-1.5 py-0.5 num" },
      "Ctrl K",
    ),
  );
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
        "bg-warning-50 border border-warning-200 text-warning-300 text-[11px] font-medium",
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
                    ? "bg-brand-50 text-brand-300 font-medium"
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

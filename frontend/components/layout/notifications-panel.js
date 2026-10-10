/**
 * لوحة الإشعارات.
 *
 * ليست إشعارات مُختلَقة — عرض آخر لتنبيهات المخزون الحقيقية نفسها التي
 * تغذّي لوحة التحكم (`GET /inventory/alerts`، المُنفَّذة فعلًا). لا خاصية
 * «تمييز كمقروء» هنا: ذلك يحتاج تخزينًا من جهة الخادم غير موجود في هذه
 * المرحلة، وتقليد التخزين محليًا يوهم بحالة لا تُحفَظ فعلًا بين الجلسات —
 * بالضبط ما تمنعه docs/07-FRONTEND-RULES.md من «نجاح وهمي».
 */

import { el, cx, render } from "../../js/core/dom.js";
import { icon } from "../common/icon.js";
import { iconButton } from "../common/button.js";
import { getAlerts } from "../../js/api/inventory.api.js";
import { range } from "../common/value.js";
import { toApiError, describeError } from "../../js/core/errors.js";
import { on } from "../../js/core/events.js";
import * as fmt from "../../js/core/format.js";

const MAX_ROWS_PER_GROUP = 3;

export function notificationsPanel() {
  const host = el("div", { class: "relative" });

  let state = { status: "loading" };
  let panelEl = null;
  let detachOutsideClick = () => {};

  const badge = el("span", {
    class:
      "absolute -top-0.5 -end-0.5 min-w-[1.05rem] h-[1.05rem] px-1 rounded-full " +
      "bg-danger-600 text-white text-[10px] font-bold grid place-items-center num " +
      "ring-2 ring-rail hidden",
  });

  const trigger = el(
    "div",
    { class: "relative" },
    iconButton("bell", {
      label: "الإشعارات",
      size: "icon",
      onClick: toggle,
    }),
    badge,
  );

  host.appendChild(trigger);

  function toggle() {
    if (panelEl) {
      closePanel();
      return;
    }
    openPanel();
  }

  function openPanel() {
    panelEl = el(
      "div",
      {
        class:
          "absolute top-full end-0 mt-2 z-30 w-80 bg-surface border border-line " +
          "rounded-[var(--radius-card)] shadow-overlay overflow-hidden hx-rise",
        role: "region",
        "aria-label": "الإشعارات",
      },
      el(
        "div",
        { class: "flex items-center justify-between px-3.5 py-2.5 border-b border-line" },
        el("p", { class: "text-sm font-semibold text-ink" }, "تنبيهات المخزون"),
        iconButton("refresh", { label: "تحديث", size: "icon-sm", onClick: load }),
      ),
      el("div", { class: "max-h-96 overflow-y-auto" }, paintBody()),
    );

    host.appendChild(panelEl);

    setTimeout(() => {
      const onOutside = (evt) => {
        if (!host.contains(evt.target)) closePanel();
      };
      document.addEventListener("mousedown", onOutside);
      detachOutsideClick = () => document.removeEventListener("mousedown", onOutside);
    }, 0);
  }

  function closePanel() {
    panelEl?.remove();
    panelEl = null;
    detachOutsideClick();
    detachOutsideClick = () => {};
  }

  function paintBody() {
    if (state.status === "loading") {
      return el(
        "div",
        { class: "p-3 space-y-2" },
        ...Array.from({ length: 3 }, () => el("div", { class: "hx-skeleton h-10 w-full" })),
      );
    }

    if (state.status === "error") {
      return el(
        "div",
        { class: "p-6 text-center" },
        el("p", { class: "text-xs text-danger-300" }, describeError(state.error)),
      );
    }

    const groups = [
      { key: "outOfStock", title: "أصناف نافدة", tone: "danger", kind: "stock", path: "/inventory/items?status=out_of_stock" },
      { key: "lowStock", title: "رصيد منخفض", tone: "warning", kind: "stock", path: "/inventory/items?status=low_stock" },
      { key: "expired", title: "تشغيلات منتهية", tone: "danger", kind: "expiry", path: "/inventory/expiry?status=expired" },
      { key: "nearExpiry", title: "قاربت الانتهاء", tone: "warning", kind: "expiry", path: "/inventory/expiry?status=near_expiry" },
    ]
      .map((group) => ({ ...group, rows: state.data[group.key] ?? [] }))
      .filter((group) => group.rows.length > 0);

    if (!groups.length) {
      return el(
        "div",
        { class: "flex flex-col items-center justify-center text-center py-10 px-4" },
        el(
          "span",
          { class: "grid place-items-center size-10 rounded-full bg-success-50 text-success-300 mb-2" },
          icon("success", { size: 18 }),
        ),
        el("p", { class: "text-sm text-ink font-medium" }, "لا تنبيهات حاليًا"),
        el("p", { class: "text-xs text-muted mt-0.5" }, "كل أرصدة المخزون وصلاحياته ضمن الحدود الطبيعية."),
      );
    }

    return el("div", { class: "py-1" }, ...groups.map(renderGroup));
  }

  function renderGroup({ title, tone, kind, path, rows }) {
    const DOT = { danger: "bg-danger-600", warning: "bg-warning-600" };
    const visible = rows.slice(0, MAX_ROWS_PER_GROUP);
    const overflow = rows.length - visible.length;

    return el(
      "div",
      { class: "px-2 py-1.5" },
      el(
        "div",
        { class: "flex items-center gap-1.5 px-1.5 py-1" },
        el("span", { class: cx("size-1.5 rounded-full shrink-0", DOT[tone]) }),
        el("p", { class: "text-[11px] font-semibold text-faint" }, `${title} (${rows.length})`),
      ),
      ...visible.map((row) =>
        el(
          "a",
          {
            href: `#${path}`,
            class: "flex items-center justify-between gap-2 px-1.5 py-1.5 rounded hover:bg-subtle transition-colors",
            onClick: closePanel,
          },
          el("span", { class: "text-xs text-ink truncate-1" }, row.name ?? row.itemName),
          el(
            "span",
            { class: "text-[11px] text-faint shrink-0" },
            // التمييز بنوع المجموعة لا بوجود الحقل: التشغيلات (kind="expiry")
            // تحمل quantity أيضًا، فالاعتماد على وجوده وحده كان يُحوِّل صفوف
            // الانتهاء خطأً لعرض نسبة رصيد بلا حدٍّ أدنى (مثل "40 / —").
            // range() تعزل الرقمين اتجاهيًا — بلا ذلك يُعاد ترتيبهما بصريًا في
            // فقرة RTL فيُقرأ صنف نافد (0 من 10) كأن رصيده 10 من حدٍّ أدنى صفر.
            kind === "stock"
              ? range(fmt.integer(row.quantity), fmt.integer(row.minimumQuantity), "/")
              : fmt.date(row.expiryDate),
          ),
        ),
      ),
      overflow > 0
        ? el(
            "a",
            { href: `#${path}`, class: "block px-1.5 py-1 text-[11px] text-brand-300 hover:underline", onClick: closePanel },
            `+${overflow} أخرى`,
          )
        : null,
    );
  }

  function updateBadge() {
    const count =
      state.status === "ready"
        ? Object.values(state.data).reduce((total, rows) => total + rows.length, 0)
        : 0;

    badge.textContent = count > 9 ? "9+" : String(count);
    badge.classList.toggle("hidden", count === 0);
  }

  async function load() {
    state = { status: "loading" };
    if (panelEl) render(panelEl.lastElementChild, paintBody());

    try {
      const data = await getAlerts();
      state = { status: "ready", data };
    } catch (error) {
      state = { status: "error", error: toApiError(error) };
    }

    updateBadge();
    if (panelEl) render(panelEl.lastElementChild, paintBody());
  }

  load();

  /*
   * `on("router:navigated")` لا `registerCleanup`: الأخير سجل يُستهلك مرة
   * واحدة عند أول تنقّل ثم يُفرَّغ (مُصمَّم لتنظيف أنشأته الشاشة الحالية حصرًا) —
   * هذا المكوّن يعيش طوال الجلسة مثل الهيدر نفسه، ويحتاج الإغلاق عند *كل*
   * تنقّل لا عند الأول فقط. إغلاق اللوحة عند مغادرة الصفحة سلوك مقصود: لوحة
   * إشعارات مفتوحة فوق شاشة لم تعد هي ما يراه المستخدم أمر مربك.
   */
  const unsubscribe = on("router:navigated", closePanel);
  host.destroy = unsubscribe;

  return host;
}

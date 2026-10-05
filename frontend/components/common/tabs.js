/**
 * التبويبات.
 *
 * التبويب النشط يُكتب في معامل الاستعلام `tab`، فيكون رابط «ملف المريض ←
 * تبويب الحساب المالي» قابلاً للمشاركة، ولا يُعيدك زر الرجوع إلى أول تبويب.
 */

import { el, cx, render, clear } from "../../js/core/dom.js";
import { icon } from "../common/icon.js";
import { countBadge } from "./badge.js";
import { setQuery } from "../../js/core/router.js";
import { can } from "../../js/core/permissions.js";

/**
 * @param {object} options
 * @param {Array<{
 *   key: string,
 *   label: string,
 *   icon?: string,
 *   count?: number,
 *   permission?: string,
 *   render: () => Node|Promise<Node>
 * }>} options.tabs
 * @param {string} [options.active]        المفتاح النشط ابتداءً
 * @param {boolean} [options.syncUrl=true]
 * @returns {{ element: HTMLElement, select: Function, activeKey: Function }}
 */
export function tabs({ tabs: definitions, active, syncUrl = true } = {}) {
  const visible = definitions.filter((tab) => can(tab.permission));

  if (!visible.length) {
    return { element: el("div"), select: () => {}, activeKey: () => null };
  }

  let activeKey = visible.some((tab) => tab.key === active) ? active : visible[0].key;

  const tabList = el("div", {
    class: "flex items-center gap-1 overflow-x-auto border-b border-line -mb-px",
    role: "tablist",
  });

  const panel = el("div", { class: "pt-4", role: "tabpanel" });

  async function select(key, { updateUrl = true } = {}) {
    const tab = visible.find((candidate) => candidate.key === key);
    if (!tab) return;

    activeKey = key;
    paintList();

    if (syncUrl && updateUrl) setQuery({ tab: key });

    // التبويب قد يجلب بياناته — نُظهر مؤشرًا بدل فراغ.
    clear(panel);
    panel.appendChild(el("div", { class: "hx-skeleton h-24 w-full" }));

    const content = await tab.render();

    // تبويب آخر قد يكون اختير أثناء الانتظار.
    if (activeKey !== key) return;
    render(panel, content);
  }

  function paintList() {
    render(
      tabList,
      ...visible.map((tab) => {
        const isActive = tab.key === activeKey;

        return el(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": String(isActive),
            class: cx(
              "inline-flex items-center gap-2 px-3.5 py-2.5 text-sm whitespace-nowrap",
              "border-b-2 transition-colors",
              isActive
                ? "border-brand-600 text-brand-700 font-medium"
                : "border-transparent text-muted hover:text-ink hover:border-line-strong",
            ),
            onClick: () => select(tab.key),
          },
          tab.icon ? icon(tab.icon, { size: 15 }) : null,
          el("span", {}, tab.label),
          tab.count !== undefined ? countBadge(tab.count, { tone: isActive ? "brand" : "neutral" }) : null,
        );
      }),
    );
  }

  const element = el("div", {}, tabList, panel);

  paintList();
  select(activeKey, { updateUrl: false });

  return { element, select, activeKey: () => activeKey };
}

/** تبويبات فرعية بنمط شرائح — للتصفية السريعة داخل شاشة. */
export function segmentedControl({ options: choices, value, onChange } = {}) {
  let current = value ?? choices[0]?.value;

  const host = el("div", {
    class: "inline-flex items-center gap-0.5 p-0.5 bg-subtle border border-line rounded-[var(--radius-control)]",
    role: "tablist",
  });

  function paint() {
    render(
      host,
      ...choices.map((choice) =>
        el(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": String(choice.value === current),
            class: cx(
              "inline-flex items-center gap-1.5 px-2.5 h-7 rounded-[calc(var(--radius-control)-2px)]",
              "text-xs whitespace-nowrap transition-colors",
              choice.value === current
                ? "bg-surface text-ink font-medium shadow-card"
                : "text-muted hover:text-ink",
            ),
            onClick: () => {
              current = choice.value;
              paint();
              onChange?.(choice.value);
            },
          },
          choice.label,
          choice.count !== undefined
            ? el("span", { class: "text-[10px] text-faint tabular" }, `(${choice.count})`)
            : null,
        ),
      ),
    );
  }

  paint();
  return host;
}

/**
 * شريط البحث الرئيسي في لوحة التحكم.
 *
 * يبحث في أطراف التعامل والأصناف والقيود، ويُحوّل إلى الشاشة المناسبة لنوع
 * البحث المختار. لا نتيجة مُختلقة: الإرسال ينتقل فعليًا إلى شاشة مسجَّلة
 * بمعامل بحث تقرأه تلك الشاشة.
 */

import { el, cx } from "../../js/core/dom.js";
import { icon } from "../common/icon.js";
import { button } from "../common/button.js";
import { navigate } from "../../js/core/router.js";

/** أنواع البحث — كل نوع وشاشته التي يُرسَل إليها. */
const MODES = [
  { key: "customers", label: "العملاء", icon: "users", path: "/fin/customers", placeholder: "اسم العميل أو كوده أو رقم هاتفه…" },
  { key: "suppliers", label: "الموردون", icon: "truck", path: "/fin/suppliers", placeholder: "اسم المورد أو كوده…" },
  { key: "items", label: "الأصناف", icon: "inventory", path: "/inv/items", placeholder: "اسم الصنف أو كوده أو الباركود…" },
  { key: "journal", label: "قيود اليومية", icon: "accounting", path: "/gl/journal", placeholder: "رقم القيد أو وصفه أو مرجعه…" },
];

export function heroSearch() {
  let mode = MODES[0];

  const input = el("input", {
    type: "search",
    class: "w-full h-11 bg-transparent text-sm text-ink placeholder:text-faint outline-none px-1",
    placeholder: mode.placeholder,
    "aria-label": "بحث",
    autocomplete: "off",
  });

  function submit() {
    const query = input.value.trim();
    /* بحث بحرف واحد يُعيد كل شيء — لا قيمة في إرساله. */
    if (query.length < 2) {
      input.focus();
      return;
    }
    navigate(`${mode.path}?search=${encodeURIComponent(query)}`);
  }

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submit();
  });

  const tabs = el(
    "div",
    { class: "flex items-center gap-1.5 flex-wrap" },
    ...MODES.map((item) =>
      el(
        "button",
        {
          type: "button",
          "data-mode": item.key,
          class: cx(
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-all",
            item.key === mode.key
              ? "bg-brand-600 text-white shadow-sm"
              : "text-muted hover:text-ink hover:bg-subtle",
          ),
          onClick: (event) => {
            mode = item;
            input.placeholder = item.placeholder;
            for (const node of event.currentTarget.parentElement.children) {
              const active = node.dataset.mode === mode.key;
              node.classList.toggle("bg-brand-600", active);
              node.classList.toggle("text-white", active);
              node.classList.toggle("shadow-sm", active);
              node.classList.toggle("text-muted", !active);
            }
            input.focus();
          },
        },
        icon(item.icon, { size: 14 }),
        item.label,
      ),
    ),
  );

  return el(
    "section",
    { class: "rounded-[var(--radius-card)] border border-line bg-surface/80 p-5 space-y-3.5" },
    el(
      "div",
      {},
      el("h2", { class: "text-lg font-bold text-ink" }, "بحث واستعلام سريع"),
      el(
        "p",
        { class: "text-xs text-muted mt-1" },
        "ابحث في العملاء والموردين والأصناف وقيود اليومية — ينتقل إلى السجل الفعلي.",
      ),
    ),
    tabs,
    el(
      "div",
      { class: "flex items-center gap-2" },
      el(
        "div",
        { class: "relative flex-1 flex items-center border border-line-strong rounded-[var(--radius-control)] px-3 bg-surface" },
        el("span", { class: "text-faint shrink-0" }, icon("search", { size: 16 })),
        input,
      ),
      button({ label: "بحث", variant: "primary", icon: "search", onClick: submit }),
    ),
  );
}

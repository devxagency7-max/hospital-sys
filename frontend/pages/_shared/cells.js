/**
 * خلايا الجداول المتكررة.
 *
 * عمود المبلغ وعمود التاريخ وعمود الحالة تتكرر في كل شاشة. تعريفها هنا يضمن
 * أن «مبلغ» يُنسَّق بنفس الطريقة في سبعين شاشة، وأن الرقم السالب يظهر أحمر
 * في كل مكان لا في بعضه.
 */

import { el, cx } from "../../js/core/dom.js";
import { currency, amount, date as formatDate, dateTime, integer, decimal, percent, EMPTY } from "../../js/core/format.js";
import { statusBadge, badge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { twoLineCell } from "../../components/tables/data-table.js";
import * as money from "../../js/core/money.js";

/* ==========================================================================
   أعمدة جاهزة
   ========================================================================== */

/**
 * عمود مبلغ مالي.
 *
 * `signed: true` يُلوّن السالب أحمر والموجب أخضر — للأعمدة التي يحمل فيها
 * الاتجاه معنى (الربح، الفرق، الرصيد). الأعمدة التي لا تكون سالبة أبدًا
 * (الإجمالي، المدين) تبقى محايدة اللون، فلا يصير اللون ضجيجًا.
 */
export function moneyColumn(key, label, { signed = false, width, hidden, align = "end", symbol = false } = {}) {
  return {
    key,
    label,
    numeric: true,
    sortable: true,
    align,
    width,
    hidden,
    render: (row) => {
      const value = Number(row[key]);
      if (!Number.isFinite(value)) return el("span", { class: "text-faint" }, EMPTY);

      return el(
        "span",
        {
          class: cx(
            "tabular",
            signed && money.isNegative(value) && "text-danger-400",
            signed && money.isPositive(value) && "text-success-400",
          ),
        },
        symbol ? currency(value) : amount(value),
      );
    },
  };
}

/** عمود كمية — يحترم عدد المنازل العشرية للوحدة. */
export function quantityColumn(key, label, { width, hidden, decimals } = {}) {
  return {
    key,
    label,
    numeric: true,
    sortable: true,
    width,
    hidden,
    render: (row) => {
      const value = Number(row[key]);
      if (!Number.isFinite(value)) return el("span", { class: "text-faint" }, EMPTY);

      const places = decimals ?? row.decimals ?? 0;
      return el("span", { class: "tabular" }, places > 0 ? decimal(value) : integer(value));
    },
  };
}

/** عمود نسبة مئوية — المدخل كسر (0.14 = 14%). */
export function percentColumn(key, label, { width, hidden } = {}) {
  return {
    key,
    label,
    numeric: true,
    sortable: true,
    width,
    hidden,
    render: (row) => {
      const value = Number(row[key]);
      if (!Number.isFinite(value)) return el("span", { class: "text-faint" }, EMPTY);
      return el("span", { class: "tabular" }, percent(value * 100));
    },
  };
}

export function dateColumn(key, label, { width = "7rem", hidden, withTime = false } = {}) {
  return {
    key,
    label,
    sortable: true,
    width,
    hidden,
    render: (row) =>
      row[key]
        ? ref(withTime ? dateTime(row[key]) : formatDate(row[key]))
        : el("span", { class: "text-faint" }, EMPTY),
  };
}

/** عمود حالة — يقرأ من كتالوج الحالات في js/core/statuses.js. */
export function statusColumn(key = "status", label = "الحالة", { width = "8rem", hidden } = {}) {
  return {
    key,
    label,
    width,
    hidden,
    align: "center",
    render: (row) => (row[key] ? statusBadge(row[key], { size: "sm" }) : el("span", { class: "text-faint" }, EMPTY)),
  };
}

/** عمود مرجع أو كود — يُعزل اتجاهيًا دائمًا. */
export function codeColumn(key, label, { width = "9rem", hidden, mono = true } = {}) {
  return {
    key,
    label,
    sortable: true,
    width,
    hidden,
    render: (row) =>
      row[key]
        ? ref(row[key], { class: mono ? "font-mono text-xs" : "text-xs" })
        : el("span", { class: "text-faint" }, EMPTY),
  };
}

/** عمود «الاسم فوق والكود تحت». */
export function nameColumn(nameKey, codeKey, label, { width, alwaysVisible = true } = {}) {
  return {
    key: nameKey,
    label,
    sortable: true,
    width,
    alwaysVisible,
    render: (row) => twoLineCell(row[nameKey], codeKey ? row[codeKey] : null),
  };
}

/** عمود نص عادي مع تقصير. */
export function textColumn(key, label, { width, hidden, sortable = false, muted = false } = {}) {
  return {
    key,
    label,
    sortable,
    width,
    hidden,
    render: (row) =>
      row[key]
        ? el("span", { class: cx("truncate-1", muted && "text-muted") }, String(row[key]))
        : el("span", { class: "text-faint" }, EMPTY),
  };
}

/** عمود وسم من قائمة قيم ← ألوان. */
export function tagColumn(key, label, map, { width = "8rem", hidden } = {}) {
  return {
    key,
    label,
    width,
    hidden,
    align: "center",
    render: (row) => {
      const found = map[row[key]];
      if (!found) return row[key] ? badge(String(row[key]), { size: "sm" }) : el("span", { class: "text-faint" }, EMPTY);
      return badge(found.label, { tone: found.tone, size: "sm" });
    },
  };
}

/** عمود عدد. */
export function countColumn(key, label, { width = "6rem", hidden } = {}) {
  return {
    key,
    label,
    numeric: true,
    sortable: true,
    width,
    hidden,
    render: (row) => el("span", { class: "tabular" }, integer(row[key] ?? 0)),
  };
}

/* ==========================================================================
   خلايا مساعدة
   ========================================================================== */

/** خلية مبلغ للمجاميع في التذييل. */
export function totalCell(value, { signed = false } = {}) {
  return el(
    "span",
    {
      class: cx(
        "tabular",
        signed && money.isNegative(value) && "text-danger-400",
        signed && money.isPositive(value) && "text-success-400",
      ),
    },
    amount(value ?? 0),
  );
}

/**
 * شريط تقدّم صغير — لنسبة الاستهلاك أو الإنجاز.
 * يُستخدم في أعمدة مثل «نسبة الإهلاك» و«نسبة استهلاك الرصيد».
 */
export function progressCell(ratio, { tone = "brand" } = {}) {
  const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));

  const TONES = {
    brand: "bg-brand-500",
    success: "bg-success-500",
    warning: "bg-warning-500",
    danger: "bg-danger-500",
  };

  return el(
    "div",
    { class: "flex items-center gap-2 min-w-[5rem]" },
    el(
      "div",
      { class: "flex-1 h-1.5 rounded-full bg-line overflow-hidden" },
      el("div", {
        class: cx("h-full rounded-full", TONES[tone] ?? TONES.brand),
        style: `width: ${(clamped * 100).toFixed(1)}%`,
      }),
    ),
    el("span", { class: "text-[11px] tabular text-muted w-9 text-end" }, `${Math.round(clamped * 100)}%`),
  );
}

/**
 * نبرة المؤشر من قيمة موقَّعة.
 * موجب = جيد، سالب = سيئ — ينطبق على الربح والفرق لا على كل رقم.
 */
export function toneForValue(value) {
  if (money.isPositive(value)) return "success";
  if (money.isNegative(value)) return "danger";
  return "neutral";
}

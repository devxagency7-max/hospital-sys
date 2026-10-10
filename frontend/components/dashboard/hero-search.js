/**
 * شريط البحث الرئيسي في لوحة التحكم.
 *
 * مكوّن زجاجي فاخر مخصَّص — حسب المرجع البصري الجديد — لا نسخة مصغّرة من
 * لوحة الأوامر (command-palette.js). يبحث حصرًا في المرضى عبر الحقل الموحَّد
 * الحقيقي الوحيد الذي يدعمه patients.api.js (الاسم/الكود/الهاتف/الرقم القومي/
 * المحافظة معًا)؛ الإرسال ينتقل فعليًا إلى `/patients?search=...` — لا نتيجة
 * مُختلقة تُعرض هنا.
 *
 * شرائح النطاق (الاسم، الهاتف، …) لا تُفعِّل فلترة منفصلة فعليًا — الـ API لا
 * يدعم ذلك — بل تُغيِّر نص العنصر النائب فقط لتوضيح الصيغة المتوقَّعة لما
 * يكتبه المستخدم؛ البحث الفعلي خلفها واحد دائمًا. قرار واعٍ لا خداع: محاولة
 * تمثيل 6 حقول بحث منفصلة غير موجودة كانت ستَعِد بقدرة لا يملكها النظام.
 */

import { el, cx } from "../../js/core/dom.js";
import { icon } from "../common/icon.js";
import { navigate } from "../../js/core/router.js";

const SCOPES = [
  { key: "nationalId", label: "الرقم القومي (14 رقم)", icon: "code", placeholder: "أدخل الرقم القومي (14 رقمًا)…" },
  { key: "name", label: "الاسم", icon: "patients", placeholder: "أدخل اسم المريض (حرفين على الأقل)…" },
  { key: "phone", label: "رقم الهاتف", icon: "bell", placeholder: "أدخل رقم الهاتف…" },
  { key: "code", label: "رقم الملف الطبي", icon: "billing", placeholder: "أدخل رقم الملف الطبي…" },
  { key: "governorate", label: "المركز أو المحافظة", icon: "building", placeholder: "أدخل اسم المركز أو المحافظة…" },
  { key: "date", label: "تاريخ التسجيل", icon: "calendar", placeholder: "أدخل تاريخ الزيارة أو التسجيل…" },
];

export function heroSearch() {
  let activeScope = SCOPES[0];

  const input = el("input", {
    type: "text",
    class: "flex-1 min-w-0 bg-transparent text-base text-ink placeholder:text-faint outline-none h-full px-1",
    placeholder: activeScope.placeholder,
    autocomplete: "off",
    "aria-label": "ابحث عن مريض",
  });

  const chipsHost = el("div", { class: "flex flex-wrap items-center justify-center gap-2 mt-4" });

  function submit() {
    const query = input.value.trim();
    if (!query) {
      input.focus();
      return;
    }
    navigate(`/patients?search=${encodeURIComponent(query)}`);
  }

  function paintChips() {
    const chips = SCOPES.map((scope) =>
      el(
        "button",
        {
          type: "button",
          class: cx(
            "hx-press flex items-center gap-1.5 h-9 px-4 rounded-[var(--radius-pill)] text-sm transition-colors",
            scope.key === activeScope.key
              ? "bg-brand-50 text-brand-300 border border-brand-200 font-medium"
              : "bg-subtle text-muted border border-transparent hover:text-ink hover:border-line-strong",
          ),
          "aria-pressed": String(scope.key === activeScope.key),
          onClick: () => {
            activeScope = scope;
            input.placeholder = scope.placeholder;
            input.focus();
            paintChips();
          },
        },
        icon(scope.icon, { size: 14 }),
        el("span", {}, scope.label),
      ),
    );
    chipsHost.replaceChildren(...chips);
  }

  paintChips();

  const form = el(
    "form",
    {
      class: "w-full",
      onSubmit: (evt) => {
        evt.preventDefault();
        submit();
      },
    },
    el(
      "div",
      {
        class:
          "glass flex items-center h-14 rounded-[var(--radius-pill)] border border-line shadow-card " +
          "ps-5 pe-1.5 gap-3 transition-shadow duration-200 focus-within:shadow-raised focus-within:border-brand-300",
      },
      icon("search", { size: 20, class: "text-faint shrink-0" }),
      input,
      el(
        "button",
        {
          type: "submit",
          class:
            "hx-press shrink-0 flex items-center gap-2 h-11 px-6 rounded-[var(--radius-pill)] " +
            "bg-brand-600 text-white text-sm font-medium transition-[background-color,box-shadow,transform] duration-200 " +
            "hover:bg-brand-700 hover:shadow-glow-brand hover:-translate-y-px",
        },
        icon("search", { size: 16 }),
        el("span", {}, "بحث"),
      ),
    ),
    chipsHost,
  );

  return el(
    "section",
    { class: "glass rounded-[var(--radius-card)] border border-line shadow-card p-6 sm:p-8 text-center" },
    el("h2", { class: "text-xl sm:text-2xl font-bold text-ink" }, "البحث والاستعلام عن المرضى"),
    el(
      "p",
      { class: "text-sm text-muted mt-1.5 max-w-xl mx-auto" },
      "استعلام فوري بالاسم، الهاتف، الرقم القومي، أو المحافظة — ينتقل إلى سجل المرضى الفعلي.",
    ),
    el("div", { class: "mt-6 max-w-2xl mx-auto" }, form),
  );
}

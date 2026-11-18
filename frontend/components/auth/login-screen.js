/**
 * شاشة اللوج إن — بوابة الدخول الوحيدة للنظام.
 *
 * حقلا البريد وكلمة المرور شكليان: لا نظام مصادقة حقيقي بعد (Phase 7)،
 * فزر «تسجيل الدخول» يُخبر بذلك صراحة بدل أن يتظاهر بتحقق لا يحدث. الدخول
 * الفعلي من أزرار الأدوار أسفله — كل زر دور حقيقي بصلاحياته الكاملة، بوصف
 * سطر واحد يكفي لمعرفة شغله بلا شرح إضافي.
 *
 * مدير النظام وحده منفصل أعلى القائمة: يرى كل شيء، وليس مجرد دور إضافي بين
 * ثمانية غيره.
 */

import { el, cx } from "../../js/core/dom.js";
import { icon } from "../common/icon.js";
import { button } from "../common/button.js";
import { textField } from "../forms/fields.js";
import { toast } from "../feedback/toast.js";
import { ROLES } from "../../js/core/permissions.js";
import { APP } from "../../js/core/config.js";

/** كل الأدوار غير مدير النظام، بأيقونة ووصف سطر واحد — بترتيب العمل اليومي. */
const ROLE_ENTRIES = [
  { key: "reception", icon: "hospital", hint: "الاستقبال، إشغال الغرف، وسداد حسابات المرضى" },
  { key: "gl", icon: "accounting", hint: "القيود والحسابات العامة، ويعتمد أسعار بيع الأصناف" },
  { key: "fin", icon: "money", hint: "العملاء والموردون والخزائن والبنوك" },
  { key: "hr", icon: "users", hint: "الحضور والإجازات ومسيّرات الرواتب" },
  { key: "inv", icon: "building", hint: "يستلم من الموردين ويشحن للفروع، ويضيف الأصناف والكميات" },
  { key: "pharmacy", icon: "inventory", hint: "يصرف للمرضى بورقة الطلب، ويطلب نواقصه ويستلم شحناته" },
  { key: "billing", icon: "billing", hint: "فواتير المرضى وسنداتهم وتحصيلاتهم" },
];

/**
 * @param {object} options
 * @param {(roleKey: string) => void} options.onEnter
 */
export function loginScreen({ onEnter }) {
  function roleButton(key, { icon: iconName, hint, emphasize = false }) {
    const role = ROLES[key];
    if (!role) return null;

    return el(
      "button",
      {
        type: "button",
        class:
          "hx-press w-full flex items-center gap-3 p-3.5 rounded-2xl border text-start transition-colors " +
          (emphasize
            ? "bg-brand-600 border-brand-600 text-white hover:bg-brand-700"
            : "bg-surface border-line hover:border-brand-300 hover:bg-subtle"),
        onClick: () => onEnter(key),
      },
      el(
        "span",
        {
          class:
            "grid place-items-center size-10 rounded-xl shrink-0 " +
            (emphasize ? "bg-white/15 text-white" : "bg-brand-50 text-brand-400"),
        },
        icon(iconName, { size: 20 }),
      ),
      el(
        "span",
        { class: "min-w-0 flex-1 space-y-0.5" },
        el("span", { class: "block text-sm font-bold truncate-1" }, role.label),
        el(
          "span",
          { class: cx("block text-[11px] truncate-1", emphasize ? "text-white/80" : "text-muted") },
          hint,
        ),
      ),
      icon("chevronStart", { size: 14, class: emphasize ? "text-white/70 shrink-0" : "text-faint shrink-0" }),
    );
  }

  return el(
    "div",
    {
      class:
        "min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-canvas",
    },
    el(
      "div",
      { class: "w-full max-w-md space-y-5" },
      /* --- الشعار واسم المنشأة --- */
      el(
        "div",
        { class: "flex flex-col items-center gap-2 text-center" },
        el(
          "span",
          {
            class:
              "grid place-items-center size-14 rounded-2xl bg-surface border border-line shadow-card p-2 overflow-hidden",
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
        el("p", { class: "text-sm font-black text-ink" }, APP.organization),
        el("p", { class: "text-xs text-muted" }, APP.nameAr),
      ),

      /* --- حقلا الدخول الشكليان --- */
      el(
        "div",
        { class: "glass-card rounded-2xl shadow-card border border-line p-5 space-y-3.5" },
        textField({ label: "البريد الإلكتروني", type: "email", placeholder: "name@hospital.local" }),
        textField({ label: "كلمة المرور", type: "password", placeholder: "••••••••" }),
        button({
          label: "تسجيل الدخول",
          variant: "primary",
          class: "w-full",
          onClick: () =>
            toast.info("تسجيل الدخول يتطلب نظام مصادقة حقيقي — اختر دورك من الأزرار بالأسفل للدخول الآن."),
        }),
      ),

      /* --- الدخول المباشر بالدور --- */
      el(
        "div",
        { class: "space-y-2" },
        el(
          "div",
          { class: "flex items-center gap-2" },
          el("span", { class: "h-px flex-1 bg-line" }),
          el("span", { class: "text-[11px] text-faint" }, "أو ادخل مباشرة بدورك"),
          el("span", { class: "h-px flex-1 bg-line" }),
        ),

        roleButton("admin", {
          icon: "shield",
          hint: "يرى النظام كله ويدير كل الشاشات",
          emphasize: true,
        }),

        el(
          "div",
          { class: "space-y-1.5 pt-1" },
          ...ROLE_ENTRIES.map((entry) => roleButton(entry.key, entry)),
        ),
      ),
    ),
  );
}

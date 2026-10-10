/**
 * تفضيلات وتهيئة النظام (System Preferences)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { select } from "../../components/forms/fields.js";
import { toast } from "../../components/feedback/toast.js";

export default function systemPreferencesPage() {
  const container = el("div", { class: "space-y-4 max-w-3xl" });

  const header = pageHeader({
    title: "تفضيلات وإعدادات النظام الإقليمية",
    description: "اللغة، العملة الافتراضية، المنطقة الزمنية، وتنسيق الأرقام والتواريخ.",
  });
  container.appendChild(header);

  const prefCard = card({
    title: "الإعدادات العامة واللغة",
    body: el(
      "div",
      { class: "space-y-4" },
      select({
        label: "لغة الواجهة الافتراضية",
        value: "ar-EG",
        options: [
          { value: "ar-EG", label: "العربية (مصر)" },
          { value: "en-US", label: "English (US)" },
        ],
      }),
      select({
        label: "العملة الأساسية للنظام",
        value: "EGP",
        options: [
          { value: "EGP", label: "الجنيه المصري (ج.م - EGP)" },
          { value: "USD", label: "الدولار الأمريكي ($ - USD)" },
          { value: "SAR", label: "الريال السعودي (ر.س - SAR)" },
        ],
      }),
      select({
        label: "المنطقة الزمنية",
        value: "Africa/Cairo",
        options: [
          { value: "Africa/Cairo", label: "توقيت القاهرة (UTC+03:00 / UTC+02:00)" },
          { value: "Asia/Riyadh", label: "توقيت الرياض (UTC+03:00)" },
        ],
      }),
    ),
    footer: el(
      "div",
      { class: "flex justify-end gap-2" },
      button({
        label: "حفظ التفضيلات",
        variant: "primary",
        icon: "check",
        onClick: () => toast.success("تم حفظ تفضيلات النظام بنجاح"),
      }),
    ),
  });

  container.appendChild(prefCard);
  return container;
}

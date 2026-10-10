/**
 * تفضيلات وقنوات الإشعارات (Notification Preferences)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { toast } from "../../components/feedback/toast.js";

export default function notificationPreferencesPage() {
  const container = el("div", { class: "space-y-4 max-w-3xl" });

  const header = pageHeader({
    title: "تفضيلات وقنوات الإشعارات والتنبيهات",
    description: "إدارة إشعارات نفاد المخزون، تنبيهات الفواتير المتأخرة، وتأكيد مواعيد المرضى.",
  });
  container.appendChild(header);

  const channels = [
    { title: "تنبيهات انخفاض رصيد المخزون", desc: "إشعار فوري عند وصول صنف لحد إعادة الطلب", enabled: true },
    { title: "تنبيهات قرب انتهاء صلاحية الأدوية", desc: "تنبيه أسبوعي بالأدوية التي تقل صلاحيتها عن 90 يومًا", enabled: true },
    { title: "تأكيد مواعيد المرضى عبر SMS", desc: "إرسال رسالة نصية تذكيرية للمريض قبل الموعد بـ 24 ساعة", enabled: true },
    { title: "تنبيهات الفواتير المتأخرة", desc: "إشعار للمدير المالي بالفواتير التي تجاوزت موعد استحقاقها", enabled: true },
    { title: "إشعارات نتائج التحاليل والأشعة العاجلة (STAT)", desc: "تنبيه الطبيب المعالج فور صدور فحص عاجل", enabled: true },
  ];

  const notifCard = card({
    title: "قواعد التنبيه الآلي",
    body: el(
      "div",
      { class: "space-y-3" },
      ...channels.map((ch) =>
        el(
          "div",
          { class: "flex items-center justify-between p-3 rounded-xl bg-subtle border border-line text-xs" },
          el(
            "div",
            { class: "space-y-0.5" },
            el("div", { class: "font-semibold text-ink" }, ch.title),
            el("div", { class: "text-muted" }, ch.desc),
          ),
          el(
            "label",
            { class: "relative inline-flex items-center cursor-pointer" },
            el("input", { type: "checkbox", checked: ch.enabled, class: "sr-only peer" }),
            el("div", {
              class:
                "w-9 h-5 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full " +
                "peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] " +
                "after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 " +
                "after:transition-all peer-checked:bg-brand-600",
            }),
          ),
        ),
      ),
    ),
    footer: el(
      "div",
      { class: "flex justify-end gap-2" },
      button({
        label: "حفظ إعدادات التنبيهات",
        variant: "primary",
        icon: "check",
        onClick: () => toast.success("تم تحديث تفضيلات الإشعارات بنجاح"),
      }),
    ),
  });

  container.appendChild(notifCard);
  return container;
}

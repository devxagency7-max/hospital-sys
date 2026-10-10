/**
 * جدولة مواعيد غرف وأجهزة الأشعة (Radiology Scheduling)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { toast } from "../../components/feedback/toast.js";

export default function radiologySchedulingPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "جدولة أجهزة وغرف الأشعة التخصصية",
    description: "متابعة أجهزة الرنين المغناطيسي، الأشعة المقطعية، والموجات الصوتية لتفادي التكدس.",
  });
  container.appendChild(header);

  const devices = [
    { name: "جهاز الرنين المغناطيسي (MRI 3.0 Tesla)", room: "غرفة الأشعة 1 - الدور الأرضي", status: "يعمل / متاح", todayScans: 8, nextAvailable: "12:30 م" },
    { name: "جهاز الأشعة المقطعية متعدد المقاطع (CT 128 Slice)", room: "غرفة الأشعة 2 - الدور الأرضي", status: "قيد التشغيل", todayScans: 14, nextAvailable: "11:45 ص" },
    { name: "جهاز الأشعة السينية الرقمية (Digital X-Ray)", room: "غرفة الأشعة 3 - الدور الأرضي", status: "يعمل / متاح", todayScans: 25, nextAvailable: "فوري" },
    { name: "جهاز الموجات الصوتية والإيكو (Ultrasound 4D)", room: "عيادة السونار - الدور الأول", status: "يعمل / متاح", todayScans: 12, nextAvailable: "01:00 م" },
  ];

  const grid = el(
    "div",
    { class: "grid grid-cols-1 md:grid-cols-2 gap-4" },
    ...devices.map((d) =>
      card({
        title: d.name,
        subtitle: d.room,
        body: el(
          "div",
          { class: "space-y-2 text-xs" },
          el(
            "div",
            { class: "flex justify-between items-center" },
            badge(d.status, { tone: "success", size: "sm" }),
            el("span", { class: "text-muted" }, `فحوصات اليوم: ${d.todayScans}`),
          ),
          el(
            "div",
            { class: "p-2 bg-subtle rounded-xl flex justify-between border border-line" },
            el("span", { class: "text-muted" }, "أقرب موعد متاح:"),
            el("span", { class: "font-mono font-bold text-brand-700" }, d.nextAvailable),
          ),
        ),
        footer: el(
          "div",
          { class: "flex justify-end" },
          button({
            label: "حجز موعد على الجهاز",
            variant: "subtle",
            size: "sm",
            onClick: () => toast.info(`فتح حجز على ${d.name}`),
          }),
        ),
      }),
    ),
  );

  container.appendChild(grid);
  return container;
}

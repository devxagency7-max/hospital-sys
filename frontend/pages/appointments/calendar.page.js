/**
 * تقويم المواعيد (Appointments Calendar)
 */

import { el, cx, clear } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { listAppointments } from "../../js/api/appointments.api.js";
import { navigate } from "../../js/core/router.js";

export default async function appointmentsCalendarPage() {
  const container = el("div", { class: "space-y-4" });

  let appointments = [];
  try {
    const res = await listAppointments({ perPage: 100 });
    appointments = res.data || [];
  } catch (e) {}

  const header = pageHeader({
    title: "تقويم المواعيد الأسبوعي",
    description: "توزيع مواعيد المرضى على أيام الأسبوع وساعات العمل بالعيادات الخارجية.",
    actions: [
      button({
        label: "عرض القائمة",
        variant: "subtle",
        onClick: () => navigate("/appointments"),
      }),
      button({
        label: "حجز موعد جديد",
        variant: "primary",
        icon: "plus",
        onClick: () => navigate("/appointments/new"),
      }),
    ],
  });
  container.appendChild(header);

  // توليد أيام الأسبوع الحالي
  const days = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
  const baseDate = new Date();
  const todayStr = baseDate.toISOString().slice(0, 10);

  const weekGrid = el("div", { class: "grid grid-cols-1 md:grid-cols-7 gap-3 min-h-[500px]" });

  days.forEach((dayName, idx) => {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - 3 + idx);
    const dateStr = d.toISOString().slice(0, 10);
    const dayApps = appointments.filter((a) => a.date === dateStr);
    const isToday = dateStr === todayStr;

    const dayCol = el(
      "div",
      {
        class: cx(
          "bg-surface/90 border rounded-2xl p-3 flex flex-col gap-2 transition-all shadow-sm",
          isToday ? "border-brand-500 ring-2 ring-brand-400/20 bg-brand-50/20" : "border-line",
        ),
      },
      el(
        "div",
        { class: "flex items-center justify-between pb-2 border-b border-line" },
        el("span", { class: cx("font-bold text-xs", isToday ? "text-brand-700" : "text-ink") }, dayName),
        el("span", { class: "text-[11px] text-muted font-mono" }, dateStr.slice(5)),
      ),
      el(
        "div",
        { class: "flex-1 space-y-2 overflow-y-auto max-h-[480px]" },
        dayApps.length
          ? dayApps.map((a) =>
              el(
                "div",
                {
                  class:
                    "p-2 rounded-xl bg-white/90 border border-line shadow-xs hover:border-brand-300 transition-colors text-xs space-y-1 cursor-pointer",
                  onClick: () => navigate(`/appointments`),
                },
                el(
                  "div",
                  { class: "flex items-center justify-between" },
                  el("span", { class: "font-mono font-bold text-brand-700 text-[11px]" }, a.time),
                  badge(a.status === "completed" ? "مكتمل" : a.status === "confirmed" ? "مؤكد" : "انتظار", {
                    tone: a.status === "completed" ? "success" : a.status === "confirmed" ? "info" : "warning",
                    size: "sm",
                  }),
                ),
                el("div", { class: "font-semibold text-ink truncate-1" }, a.patientName),
                el("div", { class: "text-muted text-[11px] truncate-1" }, a.doctorName),
              ),
            )
          : el("div", { class: "py-8 text-center text-muted/60 text-[11px]" }, "لا مواعيد"),
      ),
    );

    weekGrid.appendChild(dayCol);
  });

  const calCard = card({
    title: "مواعيد الأسبوع الحالي",
    subtitle: "انقر على أي موعد لعرض التفاصيل وتحديث حالته",
    body: weekGrid,
  });
  container.appendChild(calCard);

  return container;
}

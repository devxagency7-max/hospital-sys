/**
 * جدول أطباء العيادات (Doctors Schedule)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { getDoctors, getDepartments } from "../../js/api/lookups.api.js";
import { navigate } from "../../js/core/router.js";

export default async function doctorsSchedulePage() {
  const container = el("div", { class: "space-y-4" });

  const [doctors, departments] = await Promise.all([
    getDoctors().catch(() => []),
    getDepartments().catch(() => []),
  ]);

  const header = pageHeader({
    title: "جدول مواعيد الأطباء والاستشاريين",
    description: "مواعيد تواجد الأطباء في العيادات الخارجية وساعات الاستقبال والحجوزات المتاحة.",
  });
  container.appendChild(header);

  const daysSchedule = ["السبت - الإثنين - الأربعاء (09:00 ص - 02:00 م)", "الأحد - الثلاثاء - الخميس (04:00 م - 09:00 م)", "يوميًا عدا الجمعة (10:00 ص - 03:00 م)"];

  const grid = el(
    "div",
    { class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
    ...doctors.map((doc, idx) => {
      const dept = departments.find((d) => d.id === doc.departmentId);
      const schedule = daysSchedule[idx % daysSchedule.length];

      return card({
        title: doc.name,
        subtitle: doc.title,
        body: el(
          "div",
          { class: "space-y-3 text-xs" },
          el(
            "div",
            { class: "flex justify-between items-center" },
            badge(dept?.name || "العيادات", { tone: "brand", size: "sm" }),
            badge("متاح للحجز", { tone: "success", size: "sm" }),
          ),
          el("div", { class: "p-2 rounded-xl bg-subtle text-muted text-xs border border-line" }, `⏰ ${schedule}`),
          el(
            "div",
            { class: "flex justify-between text-muted text-[11px]" },
            el("span", {}, "الحد الأقصى للكشوفات:"),
            el("span", { class: "font-mono font-bold text-ink" }, "20 مريض / يوم"),
          ),
        ),
        footer: el(
          "div",
          { class: "flex justify-end" },
          button({
            label: "حجز موعد مع الطبيب",
            variant: "subtle",
            size: "sm",
            onClick: () => navigate(`/appointments/new?doctorId=${doc.id}`),
          }),
        ),
      });
    }),
  );

  container.appendChild(grid);
  return container;
}

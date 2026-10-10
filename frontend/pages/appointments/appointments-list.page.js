/**
 * قائمة المواعيد (Appointments List)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date } from "../../js/core/format.js";
import { listAppointments, updateAppointment } from "../../js/api/appointments.api.js";
import { navigate } from "../../js/core/router.js";
import { toast } from "../../components/feedback/toast.js";

export default function appointmentsListPage() {
  const container = el("div", { class: "space-y-4" });

  let tableInstance = null;

  const header = pageHeader({
    title: "جدول المواعيد والزيارات",
    description: "كافة مواعيد الكشف والاستشارات والمتابعات في العيادات الخارجية.",
    actions: [
      button({
        label: "عرض التقويم",
        variant: "subtle",
        icon: "calendar",
        onClick: () => navigate("/appointments/calendar"),
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

  tableInstance = dataTable({
    id: "appointments-list",
    fetch: listAppointments,
    searchPlaceholder: "بحث برقم الحجز، اسم المريض، الطبيب، أو العيادة…",
    filters: [
      {
        key: "status",
        label: "حالة الموعد",
        options: [
          { value: "", label: "الكل" },
          { value: "confirmed", label: "مؤكد" },
          { value: "waiting", label: "في الانتظار" },
          { value: "completed", label: "مكتمل" },
          { value: "cancelled", label: "ملغي" },
        ],
      },
    ],
    columns: [
      {
        key: "appointmentNumber",
        label: "رقم الحجز",
        render: (row) => ref(row.appointmentNumber, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "patientName",
        label: "المريض",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.patientName),
      },
      {
        key: "doctorName",
        label: "الطبيب المعالج",
        render: (row) => el("span", { class: "text-ink" }, row.doctorName),
      },
      {
        key: "clinicName",
        label: "العيادة",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.clinicName),
      },
      {
        key: "date",
        label: "تاريخ الموعد",
        render: (row) => date(row.date),
      },
      {
        key: "time",
        label: "التوقيت",
        render: (row) => ref(row.time, { class: "font-mono font-semibold text-brand-700" }),
      },
      {
        key: "type",
        label: "نوع الزيارة",
        render: (row) =>
          row.type === "consultation"
            ? "كشف أولي"
            : row.type === "follow_up"
              ? "إعادة كشف"
              : "طوارئ / عاجل",
      },
      {
        key: "status",
        label: "الحالة",
        render: (row) => statusBadge(row.status === "completed" ? "paid" : row.status === "confirmed" ? "active" : row.status === "waiting" ? "pending" : "cancelled"),
      },
    ],
    rowActions: (row) =>
      row.status !== "completed"
        ? button({
            label: "إتمام الكشف",
            variant: "subtle",
            size: "sm",
            onClick: async () => {
              await updateAppointment(row.id, { status: "completed" });
              toast.success(`تم تحديث الموعد ${row.appointmentNumber} إلى مكتمل`);
              tableInstance?.reload();
            },
          })
        : null,
  });

  container.appendChild(tableInstance.element);
  return container;
}

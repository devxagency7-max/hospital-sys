/**
 * قائمة الانتظار الحية (Live Waiting Queue)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { badge, statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { listAppointmentQueue, updateAppointment } from "../../js/api/appointments.api.js";
import { toast } from "../../components/feedback/toast.js";

export default function appointmentQueuePage() {
  const container = el("div", { class: "space-y-4" });

  let tableInstance = null;

  const header = pageHeader({
    title: "شاشة استدعاء وقائمة الانتظار",
    description: "المرضى المتواجدون حاليًا في صالات الانتظار بانتظار الدخول إلى العيادات.",
    actions: [
      button({
        label: "تحديث القائمة",
        variant: "subtle",
        icon: "refresh",
        onClick: () => tableInstance?.reload(),
      }),
    ],
  });
  container.appendChild(header);

  tableInstance = dataTable({
    id: "appointment-queue",
    fetch: listAppointmentQueue,
    searchPlaceholder: "بحث برقم الحجز أو اسم المريض…",
    columns: [
      {
        key: "appointmentNumber",
        label: "رقم التذكرة",
        render: (row) => ref(row.appointmentNumber, { class: "font-mono font-bold text-brand-600 text-sm" }),
      },
      {
        key: "patientName",
        label: "اسم المريض",
        render: (row) => el("span", { class: "font-bold text-ink" }, row.patientName),
      },
      {
        key: "clinicName",
        label: "العيادة",
        render: (row) => el("span", { class: "text-muted" }, row.clinicName),
      },
      {
        key: "doctorName",
        label: "الطبيب",
        render: (row) => el("span", { class: "text-ink" }, row.doctorName),
      },
      {
        key: "time",
        label: "الوقت المحدد",
        render: (row) => ref(row.time, { class: "font-mono font-semibold" }),
      },
      {
        key: "status",
        label: "الحالة",
        render: (row) => badge(row.status === "waiting" ? "في الانتظار" : "مؤكد للحضور", {
          tone: row.status === "waiting" ? "warning" : "info",
        }),
      },
    ],
    rowActions: (row) => [
      button({
        label: "نداء المريض 📢",
        variant: "primary",
        size: "sm",
        onClick: () => toast.success(`تم إرسال نداء للمريض: ${row.patientName} لشاشات الانتظار`),
      }),
      button({
        label: "دخول العيادة",
        variant: "subtle",
        size: "sm",
        onClick: async () => {
          await updateAppointment(row.id, { status: "completed" });
          toast.info(`دخل المريض ${row.patientName} إلى غرفة الكشف`);
          tableInstance?.reload();
        },
      }),
    ],
  });

  container.appendChild(tableInstance.element);
  return container;
}

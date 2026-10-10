/**
 * حجز موعد جديد (New Appointment)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { textField, select } from "../../components/forms/fields.js";
import { createAppointment } from "../../js/api/appointments.api.js";
import { listPatients } from "../../js/api/patients.api.js";
import { navigate } from "../../js/core/router.js";
import { toast } from "../../components/feedback/toast.js";
import { getDoctors, getDepartments } from "../../js/api/lookups.api.js";

export default async function newAppointmentPage({ query = {} } = {}) {
  const container = el("div", { class: "space-y-4 max-w-3xl" });

  let [patients, doctors, departments] = await Promise.all([
    listPatients({ perPage: 50 }).then((r) => r.data || []).catch(() => []),
    getDoctors().catch(() => []),
    getDepartments().catch(() => []),
  ]);

  const header = pageHeader({
    title: "حجز موعد عيادة جديد",
    description: "تحديد المريض والطبيب والعيادة والموعد المناسب وتأكيد الحجز.",
    actions: [
      button({
        label: "العودة للمواعيد",
        variant: "subtle",
        onClick: () => navigate("/appointments"),
      }),
    ],
  });
  container.appendChild(header);

  let selectedPatientId = query.patientId || (patients[0]?.id ? String(patients[0].id) : "");
  let selectedDoctorId = String(doctors[0]?.id || 1);
  let selectedDate = new Date().toISOString().slice(0, 10);
  let selectedTime = "10:00";
  let selectedType = "consultation";
  let notes = "";

  const formCard = card({
    title: "بيانات الحجز والزيارة",
    subtitle: "اختر المريض ثم الطبيب والوقت المطلوب",
    body: el(
      "div",
      { class: "space-y-4" },
      select({
        label: "المريض",
        value: selectedPatientId,
        options: patients.map((p) => ({ value: String(p.id), label: `${p.name} (${p.patientCode})` })),
        onChange: (v) => (selectedPatientId = v),
      }),
      select({
        label: "الطبيب والعيادة",
        value: selectedDoctorId,
        options: doctors.map((d) => {
          const dept = departments.find((dp) => dp.id === d.departmentId);
          return { value: String(d.id), label: `${d.name} — ${d.title} (قسم ${dept?.name || ""})` };
        }),
        onChange: (v) => (selectedDoctorId = v),
      }),
      el(
        "div",
        { class: "grid grid-cols-1 md:grid-cols-2 gap-4" },
        textField({
          label: "تاريخ الموعد",
          type: "date",
          value: selectedDate,
          onInput: (v) => (selectedDate = v),
        }),
        select({
          label: "التوقيت المتاح",
          value: selectedTime,
          options: [
            { value: "09:00", label: "09:00 صباحًا" },
            { value: "09:30", label: "09:30 صباحًا" },
            { value: "10:00", label: "10:00 صباحًا" },
            { value: "10:30", label: "10:30 صباحًا" },
            { value: "11:00", label: "11:00 صباحًا" },
            { value: "11:30", label: "11:30 صباحًا" },
            { value: "12:00", label: "12:00 ظهرًا" },
            { value: "13:00", label: "01:00 ظهرًا" },
            { value: "14:00", label: "02:00 عصرًا" },
            { value: "17:00", label: "05:00 مساءً" },
          ],
          onChange: (v) => (selectedTime = v),
        }),
      ),
      select({
        label: "نوع الكشف",
        value: selectedType,
        options: [
          { value: "consultation", label: "كشف استشاري أولي" },
          { value: "follow_up", label: "استشارة ومتابعة" },
          { value: "urgent", label: "كشف عاجل" },
        ],
        onChange: (v) => (selectedType = v),
      }),
      textField({
        label: "ملاحظات أو شكوى المريض المبدئية",
        placeholder: "مثال: صداع نصفي متكرر مع ارتفاع في ضغط الدم",
        onInput: (v) => (notes = v),
      }),
    ),
    footer: el(
      "div",
      { class: "flex justify-end gap-2" },
      button({
        label: "إلغاء",
        variant: "subtle",
        onClick: () => navigate("/appointments"),
      }),
      button({
        label: "تأكيد وحفظ الحجز",
        variant: "primary",
        icon: "check",
        onClick: async () => {
          const patient = patients.find((p) => String(p.id) === String(selectedPatientId));
          const doctor = doctors.find((d) => String(d.id) === String(selectedDoctorId));
          const dept = departments.find((dp) => dp.id === doctor?.departmentId);

          if (!patient || !doctor) {
            toast.warning("يرجى اختيار المريض والطبيب");
            return;
          }

          try {
            await createAppointment({
              patientId: patient.id,
              patientName: patient.name,
              patientCode: patient.patientCode,
              doctorId: doctor.id,
              doctorName: doctor.name,
              clinicName: `عيادة ${dept?.name || "التخصصية"}`,
              date: selectedDate,
              time: selectedTime,
              type: selectedType,
              status: "confirmed",
              notes,
            });
            toast.success("تم تأكيد الحجز بنجاح");
            navigate("/appointments");
          } catch (e) {
            toast.error("فشل تأكيد الحجز");
          }
        },
      }),
    ),
  });
  container.appendChild(formCard);

  return container;
}

/**
 * قائمة المرضى (Patients List)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date, currency } from "../../js/core/format.js";
import { listPatients } from "../../js/api/patients.api.js";
import { navigate } from "../../js/core/router.js";

export default function patientsListPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "سجل المرضى والمراجعين",
    description: "قاعدة بيانات المرضى المسجلين، الملفات الطبية، وبيانات الاتصال والتأمين.",
    actions: [
      button({
        label: "إضافة مريض جديد",
        variant: "primary",
        icon: "plus",
        onClick: () => navigate("/patients/new"),
      }),
    ],
  });
  container.appendChild(header);

  const table = dataTable({
    id: "patients-list",
    fetch: listPatients,
    searchPlaceholder: "بحث بالاسم، كود المريض، الهاتف، أو الرقم القومي…",
    filters: [
      {
        key: "status",
        label: "الحالة",
        options: [
          { value: "", label: "الكل" },
          { value: "active", label: "نشط" },
          { value: "inactive", label: "غير نشط" },
        ],
      },
      {
        key: "gender",
        label: "النوع",
        options: [
          { value: "", label: "الكل" },
          { value: "male", label: "ذكر" },
          { value: "female", label: "أنثى" },
        ],
      },
    ],
    columns: [
      {
        key: "patientCode",
        label: "كود المريض",
        render: (row) => ref(row.patientCode, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "name",
        label: "اسم المريض",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.name),
      },
      {
        key: "phone",
        label: "رقم الهاتف",
        render: (row) => ref(row.phone, { class: "text-muted font-mono" }),
      },
      {
        key: "governorate",
        label: "المحافظة",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.governorate || "—"),
      },
      {
        key: "visitsCount",
        label: "عدد الزيارات",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-medium text-ink tabular" }, String(row.visitsCount ?? 0)),
      },
      {
        key: "outstandingBalance",
        label: "الرصيد المستحق",
        numeric: true,
        render: (row) =>
          row.outstandingBalance > 0
            ? el("span", { class: "font-mono font-bold text-rose-600 tabular" }, currency(row.outstandingBalance))
            : el("span", { class: "font-mono text-emerald-600 tabular" }, "0.00 ج.م"),
      },
      {
        key: "registeredAt",
        label: "تاريخ التسجيل",
        render: (row) => date(row.registeredAt),
      },
      {
        key: "status",
        label: "الحالة",
        render: (row) => statusBadge(row.status),
      },
    ],
    rowActions: (row) => [
      button({
        label: "تقرير الحالة",
        variant: "subtle",
        size: "sm",
        onClick: () => navigate(`/patients/case-report?code=${row.patientCode}`),
      }),
      button({
        label: "حجز موعد",
        variant: "ghost",
        size: "sm",
        onClick: () => navigate(`/appointments/new?patientId=${row.id}`),
      }),
      button({
        label: "كشف حساب",
        variant: "ghost",
        size: "sm",
        onClick: () => navigate(`/billing/statements?patientId=${row.id}`),
      }),
    ],
  });

  container.appendChild(table.element);
  return container;
}

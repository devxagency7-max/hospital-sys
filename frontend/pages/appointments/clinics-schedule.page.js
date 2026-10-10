/**
 * جدول وتجهيزات العيادات (Clinics Schedule)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { listClinics } from "../../js/api/settings.api.js";

export default function clinicsSchedulePage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "جدول العيادات الخارجية والتسكين",
    description: "توزيع العيادات التخصصية على الغرف والأدوار والأطباء المناوبين.",
  });
  container.appendChild(header);

  const table = dataTable({
    id: "clinics-schedule",
    fetch: listClinics,
    searchPlaceholder: "بحث برمز العيادة أو الاسم أو الطبيب أو الغرفة…",
    columns: [
      {
        key: "code",
        label: "رمز العيادة",
        render: (row) => ref(row.code, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "name",
        label: "اسم العيادة التخصصية",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.name),
      },
      {
        key: "departmentName",
        label: "القسم الطبي",
        render: (row) => el("span", { class: "text-muted" }, row.departmentName),
      },
      {
        key: "doctor",
        label: "الطبيب المناوب اليوم",
        render: (row) => el("span", { class: "text-ink font-medium" }, row.doctor),
      },
      {
        key: "room",
        label: "رقم الغرفة والموقع",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.room),
      },
      {
        key: "status",
        label: "الحالة التشغيلية",
        render: (row) => statusBadge("active"),
      },
    ],
  });

  container.appendChild(table.element);
  return container;
}

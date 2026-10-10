/**
 * إعدادات العيادات الخارجية (Clinics Settings)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { listClinics } from "../../js/api/settings.api.js";
import { toast } from "../../components/feedback/toast.js";

export default function clinicsSettingsPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "إعدادات وتجهيزات العيادات الخارجية",
    description: "توصيف أرقام الغرف والتجهيزات والأطباء المكلفين بإدارة العيادات.",
    actions: [
      button({
        label: "إضافة عيادة",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("طلب إضافة عيادة جديدة"),
      }),
    ],
  });
  container.appendChild(header);

  const table = dataTable({
    id: "settings-clinics-table",
    fetch: listClinics,
    searchPlaceholder: "بحث بالعيادة أو القسم أو الغرفة…",
    columns: [
      {
        key: "code",
        label: "كود العيادة",
        render: (row) => ref(row.code, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "name",
        label: "اسم العيادة",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.name),
      },
      {
        key: "departmentName",
        label: "القسم التابع له",
        render: (row) => el("span", { class: "text-muted" }, row.departmentName),
      },
      {
        key: "room",
        label: "رقم الغرفة والموقع",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.room),
      },
      {
        key: "doctor",
        label: "الطبيب المسؤول",
        render: (row) => el("span", { class: "text-ink font-medium" }, row.doctor),
      },
      {
        key: "status",
        label: "الحالة",
        render: (row) => statusBadge("active"),
      },
    ],
  });

  container.appendChild(table.element);
  return container;
}

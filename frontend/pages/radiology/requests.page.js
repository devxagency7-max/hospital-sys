/**
 * طلبات الأشعة والتصوير الطبي (Radiology Requests)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { badge, statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date } from "../../js/core/format.js";
import { listRadiologyRequests, updateRadiologyRequest } from "../../js/api/clinical.api.js";
import { toast } from "../../components/feedback/toast.js";

const MODALITY_COLORS = {
  MRI: "brand",
  CT: "danger",
  "X-Ray": "info",
  US: "success",
  ECHO: "warning",
};

export default function radiologyRequestsPage() {
  const container = el("div", { class: "space-y-4" });

  let tableInstance = null;

  const header = pageHeader({
    title: "طلبات الأشعة والتصوير الطبي",
    description: "الأشعة العادية، الأشعة المقطعية (CT)، الرنين المغناطيسي (MRI)، والموجات فوق الصوتية.",
  });
  container.appendChild(header);

  tableInstance = dataTable({
    id: "radiology-requests-table",
    fetch: listRadiologyRequests,
    searchPlaceholder: "بحث برقم الطلب، اسم المريض، نوع الأشعة، أو الطبيب…",
    columns: [
      {
        key: "requestNumber",
        label: "رقم الفحص",
        render: (row) => ref(row.requestNumber, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "patientName",
        label: "المريض",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.patientName),
      },
      {
        key: "modality",
        label: "نوع الجهاز",
        render: (row) => badge(row.modality, { tone: MODALITY_COLORS[row.modality] || "neutral", size: "sm" }),
      },
      {
        key: "scanName",
        label: "الفحص المطلوب",
        render: (row) => el("span", { class: "font-medium text-ink" }, row.scanName),
      },
      {
        key: "bodyPart",
        label: "العضو / المنطقة",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.bodyPart),
      },
      {
        key: "priority",
        label: "الأولوية",
        render: (row) => badge(row.priority === "urgent" ? "عاجل" : "عادي", {
          tone: row.priority === "urgent" ? "danger" : "neutral",
        }),
      },
      {
        key: "date",
        label: "التاريخ",
        render: (row) => date(row.date),
      },
      {
        key: "status",
        label: "الحالة",
        render: (row) =>
          badge(
            row.status === "completed"
              ? "تم الفحص والتقرير"
              : row.status === "in_progress"
                ? "قيد التصوير"
                : "مجدول",
            { tone: row.status === "completed" ? "success" : row.status === "in_progress" ? "info" : "warning" },
          ),
      },
    ],
    rowActions: (row) =>
      row.status !== "completed"
        ? button({
            label: "بدء الفحص 🩻",
            variant: "primary",
            size: "sm",
            onClick: async () => {
              await updateRadiologyRequest(row.id, { status: "completed" });
              toast.success(`تم إتمام فحص الأشعة ${row.requestNumber}`);
              tableInstance?.reload();
            },
          })
        : null,
  });

  container.appendChild(tableInstance.element);
  return container;
}

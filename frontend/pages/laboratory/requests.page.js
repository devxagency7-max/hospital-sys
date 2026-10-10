/**
 * طلبات التحاليل الطبية (Lab Requests)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { badge, statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date } from "../../js/core/format.js";
import { listLabRequests, updateLabRequest } from "../../js/api/clinical.api.js";
import { toast } from "../../components/feedback/toast.js";

const STATUS_LABELS = {
  pending: { label: "بانتظار العينة", tone: "warning" },
  sample_collected: { label: "تم سحب العينة", tone: "info" },
  completed: { label: "النتيجة جاهزة", tone: "success" },
};

export default function labRequestsPage() {
  const container = el("div", { class: "space-y-4" });

  let tableInstance = null;

  const header = pageHeader({
    title: "طلبات التحاليل والفحوصات المخبرية",
    description: "قائمة طلبات التحاليل الصادرة من العيادات وأقسام المستشفى ومتابعة مراحل التحليل.",
  });
  container.appendChild(header);

  tableInstance = dataTable({
    id: "laboratory-requests-table",
    fetch: listLabRequests,
    searchPlaceholder: "بحث برقم الطلب، اسم المريض، الطبيب، أو اسم الفحص…",
    filters: [
      {
        key: "status",
        label: "حالة الفحص",
        options: [
          { value: "", label: "الكل" },
          { value: "pending", label: "بانتظار العينة" },
          { value: "sample_collected", label: "تم سحب العينة" },
          { value: "completed", label: "النتيجة جاهزة" },
        ],
      },
    ],
    columns: [
      {
        key: "requestNumber",
        label: "رقم الطلب",
        render: (row) => ref(row.requestNumber, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "patientName",
        label: "المريض",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.patientName),
      },
      {
        key: "testName",
        label: "اسم التحليل",
        render: (row) => el("span", { class: "font-medium text-ink" }, row.testName),
      },
      {
        key: "category",
        label: "التصنيف",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.category),
      },
      {
        key: "priority",
        label: "الأولوية",
        render: (row) => badge(row.priority === "urgent" ? "عاجل (STAT)" : "عادي", {
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
        render: (row) => {
          const cfg = STATUS_LABELS[row.status] || { label: row.status, tone: "neutral" };
          return badge(cfg.label, { tone: cfg.tone });
        },
      },
    ],
    rowActions: (row) =>
      row.status === "pending"
        ? button({
            label: "سحب العينة 🩸",
            variant: "primary",
            size: "sm",
            onClick: async () => {
              await updateLabRequest(row.id, {
                status: "sample_collected",
                collectedAt: new Date().toISOString(),
                collectedBy: "فني مختبر / هدى إبراهيم",
              });
              toast.success(`تم تسجيل سحب عينة التحليل ${row.requestNumber}`);
              tableInstance?.reload();
            },
          })
        : null,
  });

  container.appendChild(tableInstance.element);
  return container;
}

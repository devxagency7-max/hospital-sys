/**
 * سحب العينات وباركود الأنابيب (Phlebotomy & Sample Collection)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { listLabRequests, updateLabRequest } from "../../js/api/clinical.api.js";
import { toast } from "../../components/feedback/toast.js";

export default function labSamplesPage() {
  const container = el("div", { class: "space-y-4" });

  let tableInstance = null;

  const header = pageHeader({
    title: "محطة سحب العينات المخبرية والباركود",
    description: "استقبال المرضى لسحب عينات الدم والبول والمسحات وطباعة ملصقات الباركود التعريفي.",
  });
  container.appendChild(header);

  tableInstance = dataTable({
    id: "laboratory-samples-table",
    fetch: listLabRequests,
    searchPlaceholder: "بحث بالمريض أو رقم الطلب أو نوع العينة…",
    columns: [
      {
        key: "requestNumber",
        label: "رقم الفحص",
        render: (row) => ref(row.requestNumber, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "patientName",
        label: "اسم المريض",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.patientName),
      },
      {
        key: "testName",
        label: "التحليل المطلوب",
        render: (row) => el("span", { class: "font-medium text-ink" }, row.testName),
      },
      {
        key: "sampleType",
        label: "نوع العينة المطلوبة",
        render: (row) => badge(row.sampleType, { tone: "info" }),
      },
      {
        key: "status",
        label: "حالة العينة",
        render: (row) => badge(row.status === "pending" ? "بانتظار السحب" : "تم السحب بنجاح", {
          tone: row.status === "pending" ? "warning" : "success",
        }),
      },
    ],
    rowActions: (row) => [
      button({
        label: "طباعة باركود الأنبوب 🏷️",
        variant: "subtle",
        size: "sm",
        onClick: () => toast.success(`تم إرسال باركود العينة ${row.requestNumber} لطابعة الملصقات`),
      }),
      row.status === "pending"
        ? button({
            label: "تأكيد السحب",
            variant: "primary",
            size: "sm",
            onClick: async () => {
              await updateLabRequest(row.id, { status: "sample_collected" });
              toast.success("تم تأكيد سحب العينة بنجاح");
              tableInstance?.reload();
            },
          })
        : null,
    ],
  });

  container.appendChild(tableInstance.element);
  return container;
}

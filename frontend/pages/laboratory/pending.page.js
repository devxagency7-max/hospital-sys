/**
 * قائمة التحاليل الجارية والمعلقة (Pending Lab Results)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { listLabRequests, updateLabRequest } from "../../js/api/clinical.api.js";
import { openModal } from "../../components/modals/overlay.js";
import { textField } from "../../components/forms/fields.js";
import { toast } from "../../components/feedback/toast.js";

export default function labPendingPage() {
  const container = el("div", { class: "space-y-4" });

  let tableInstance = null;

  const header = pageHeader({
    title: "التحاليل قيد الفحص وإدخال النتائج",
    description: "العينات التي تم سحبها والموجودة داخل أجهزة التحليل في انتظار مراجعة واعتماد النتائج.",
  });
  container.appendChild(header);

  tableInstance = dataTable({
    id: "laboratory-pending-table",
    fetch: (p) => listLabRequests({ ...p, status: "sample_collected" }),
    searchPlaceholder: "بحث بالمريض أو الفحص…",
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
        key: "testName",
        label: "التحليل المطلوب",
        render: (row) => el("span", { class: "font-medium text-ink" }, row.testName),
      },
      {
        key: "priority",
        label: "الأولوية",
        render: (row) => badge(row.priority === "urgent" ? "عاجل" : "عادي", {
          tone: row.priority === "urgent" ? "danger" : "neutral",
        }),
      },
      {
        key: "collectedBy",
        label: "فني السحب",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.collectedBy || "—"),
      },
    ],
    rowActions: (row) =>
      button({
        label: "إدخال النتيجة واعتمادها 📝",
        variant: "primary",
        size: "sm",
        onClick: () => showEnterResultModal(row, () => tableInstance?.reload()),
      }),
  });

  container.appendChild(tableInstance.element);
  return container;
}

function showEnterResultModal(req, onSaved) {
  let resultSummary = "طبيعي - في حدود المعدل الطبيعي";
  let notes = "تم الفحص بواسطة المحلل الآلي التلقائي.";

  openModal({
    title: `إدخال نتيجة تحليل: ${req.testName}`,
    subtitle: `المريض: ${req.patientName} (${req.requestNumber})`,
    size: "md",
    body: (close) =>
      el(
        "div",
        { class: "space-y-3 p-1" },
        textField({
          label: "النتيجة / القيمة الرقمية",
          value: resultSummary,
          required: true,
          onInput: (v) => (resultSummary = v),
        }),
        textField({
          label: "ملاحظات إكلينيكية وتوصيات التقرير",
          value: notes,
          onInput: (v) => (notes = v),
        }),
      ),
    footer: (close) => [
      button({ label: "إلغاء", variant: "subtle", onClick: () => close() }),
      button({
        label: "اعتماد وتوقيع النتيجة",
        variant: "primary",
        icon: "check",
        onClick: async () => {
          await updateLabRequest(req.id, {
            status: "completed",
            resultSummary,
            resultDetails: notes,
            verifiedBy: "د. نهاد عزمي (استشاري التحاليل الطبية)",
          });
          toast.success("تم اعتماد التقرير المخبري بنجاح");
          close();
          onSaved();
        },
      }),
    ],
  });
}

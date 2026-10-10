/**
 * تقارير الأشعة والتشخيص الطبي (Radiology Reports)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date } from "../../js/core/format.js";
import { listRadiologyRequests } from "../../js/api/clinical.api.js";
import { openModal } from "../../components/modals/overlay.js";
import { toast } from "../../components/feedback/toast.js";

export default function radiologyReportsPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "سجل تقارير الأشعة المعتمدة",
    description: "التقارير التشخيصية المكتوبة والموقعة من استشاريي الأشعة مع الاستنتاج الطبي النهائي.",
  });
  container.appendChild(header);

  const table = dataTable({
    id: "radiology-reports-table",
    fetch: (p) => listRadiologyRequests({ ...p, status: "completed" }),
    searchPlaceholder: "بحث بالمريض، رقم الفحص، أو نوع الأشعة…",
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
        key: "scanName",
        label: "الفحص الطبي",
        render: (row) => el("span", { class: "font-medium text-ink" }, row.scanName),
      },
      {
        key: "radiologist",
        label: "استشاري الأشعة",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.radiologist || "د. حازم زاهر"),
      },
      {
        key: "conclusion",
        label: "النتيجة والاستنتاج",
        render: (row) => el("span", { class: "font-bold text-emerald-700 text-xs" }, row.conclusion || "فحص طبيعي"),
      },
      {
        key: "date",
        label: "التاريخ",
        render: (row) => date(row.date),
      },
    ],
    rowActions: (row) => [
      button({
        label: "عرض التقرير",
        variant: "ghost",
        size: "sm",
        onClick: () => showReportModal(row),
      }),
      button({
        label: "طباعة 🖨️",
        variant: "subtle",
        size: "sm",
        onClick: () => {
          toast.success(`طباعة تقرير الأشعة ${row.requestNumber}`);
          window.print();
        },
      }),
    ],
  });

  container.appendChild(table.element);
  return container;
}

function showReportModal(row) {
  openModal({
    title: `تقرير تشخيص الأشعة: ${row.scanName}`,
    subtitle: `المريض: ${row.patientName} (${row.requestNumber})`,
    size: "lg",
    body: () =>
      el(
        "div",
        { class: "space-y-4 text-xs p-2 leading-relaxed" },
        el("div", { class: "font-bold text-ink text-sm border-b pb-1" }, "المشاهدات والفحص التشريحي (Findings)"),
        el("p", { class: "text-muted text-justify" }, row.findings || "فحص سليم دون وجود ارتشاح أو ظلال غير طبيعية."),
        el("div", { class: "font-bold text-ink text-sm border-b pb-1 pt-2" }, "الخلاصة والتشخيص النهائي (Conclusion)"),
        el("p", { class: "font-bold text-emerald-700" }, row.conclusion || "فحص طبيعي وسليم (Normal Study)."),
        el(
          "div",
          { class: "pt-4 border-t flex justify-between text-muted text-[11px]" },
          el("span", {}, `تاريخ الفحص: ${row.date}`),
          el("span", {}, `توقيع الاستشاري: ${row.radiologist || "د. حازم زاهر"}`),
        ),
      ),
  });
}

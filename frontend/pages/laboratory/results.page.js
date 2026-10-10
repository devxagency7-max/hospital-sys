/**
 * تقارير ونتائج التحاليل المعتمدة (Lab Results)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date } from "../../js/core/format.js";
import { listLabRequests } from "../../js/api/clinical.api.js";
import { openModal } from "../../components/modals/overlay.js";
import { toast } from "../../components/feedback/toast.js";

export default function labResultsPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "سجل نتائج وتقارير التحاليل المعتمدة",
    description: "أرشيف نتائج التحاليل الجاهزة للطباعة والربط مع ملف المريض الإلكتروني.",
  });
  container.appendChild(header);

  const table = dataTable({
    id: "laboratory-results-table",
    fetch: (p) => listLabRequests({ ...p, status: "completed" }),
    searchPlaceholder: "بحث بالمريض، رقم الفحص، أو اسم التحليل…",
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
        label: "التحليل",
        render: (row) => el("span", { class: "font-medium text-ink" }, row.testName),
      },
      {
        key: "resultSummary",
        label: "النتيجة المعتمدة",
        render: (row) => el("span", { class: "font-bold text-emerald-700 text-xs" }, row.resultSummary || "طبيعي"),
      },
      {
        key: "verifiedBy",
        label: "استشاري المختبر المعتمد",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.verifiedBy || "—"),
      },
      {
        key: "date",
        label: "تاريخ الإصدار",
        render: (row) => date(row.date),
      },
      {
        key: "status",
        label: "الحالة",
        render: (row) => statusBadge("paid"),
      },
    ],
    rowActions: (row) =>
      button({
        label: "طباعة التقرير المخبري 🖨️",
        variant: "subtle",
        size: "sm",
        onClick: () => {
          toast.success(`طباعة تقرير التحليل ${row.requestNumber}`);
          window.print();
        },
      }),
  });

  container.appendChild(table.element);
  return container;
}

/**
 * الروشتات والوصفات الطبية (Prescriptions)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { badge, statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date, currency } from "../../js/core/format.js";
import { listPrescriptions, dispensePrescription } from "../../js/api/pharmacy.api.js";
import { openModal } from "../../components/modals/overlay.js";
import { toast } from "../../components/feedback/toast.js";

export default function prescriptionsPage() {
  const container = el("div", { class: "space-y-4" });

  let tableInstance = null;

  const header = pageHeader({
    title: "الروشتات والوصفات الطبية الإلكترونية",
    description: "الوصفات الطبية الصادرة من العيادات وأقسام الطوارئ والإقامة في انتظار الصرف أو المصروفة.",
  });
  container.appendChild(header);

  tableInstance = dataTable({
    id: "pharmacy-prescriptions",
    fetch: listPrescriptions,
    searchPlaceholder: "بحث برقم الروشتة، اسم المريض، أو الطبيب…",
    filters: [
      {
        key: "status",
        label: "حالة الصرف",
        options: [
          { value: "", label: "الكل" },
          { value: "pending", label: "قيد الانتظار" },
          { value: "dispensed", label: "تم الصرف" },
        ],
      },
    ],
    columns: [
      {
        key: "prescriptionNumber",
        label: "رقم الروشتة",
        render: (row) => ref(row.prescriptionNumber, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "patientName",
        label: "المريض",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.patientName),
      },
      {
        key: "doctorName",
        label: "الطبيب الواصف",
        render: (row) => el("span", { class: "text-ink" }, row.doctorName),
      },
      {
        key: "date",
        label: "التاريخ",
        render: (row) => date(row.date),
      },
      {
        key: "totalAmount",
        label: "القيمة الإجمالية",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-ink tabular" }, currency(row.totalAmount)),
      },
      {
        key: "status",
        label: "الحالة",
        render: (row) =>
          badge(row.status === "dispensed" ? "تم الصرف" : "في الانتظار", {
            tone: row.status === "dispensed" ? "success" : "warning",
          }),
      },
    ],
    rowActions: (row) => [
      button({
        label: "عرض الأدوية",
        variant: "ghost",
        size: "sm",
        onClick: () => showRxDetailsModal(row),
      }),
      row.status !== "dispensed"
        ? button({
            label: "صرف الروشتة 💊",
            variant: "primary",
            size: "sm",
            onClick: async () => {
              await dispensePrescription(row.id);
              toast.success(`تم صرف الروشتة ${row.prescriptionNumber} وتحديث مخزون الصيدلية`);
              tableInstance?.reload();
            },
          })
        : null,
    ],
  });

  container.appendChild(tableInstance.element);
  return container;
}

function showRxDetailsModal(rx) {
  openModal({
    title: `تفاصيل الروشتة: ${rx.prescriptionNumber}`,
    subtitle: `المريض: ${rx.patientName} — الطبيب: ${rx.doctorName}`,
    size: "md",
    body: () => {
      const rows = (rx.items || []).map((item) =>
        el(
          "tr",
          { class: "border-b border-line hover:bg-subtle text-xs" },
          el("td", { class: "p-2.5 font-semibold text-ink" }, item.name),
          el("td", { class: "p-2.5 text-muted" }, item.dosage),
          el("td", { class: "p-2.5 font-mono text-center font-bold" }, String(item.quantity)),
          el("td", { class: "p-2.5 font-mono text-end font-semibold tabular" }, currency(item.price * item.quantity)),
        ),
      );

      return el(
        "table",
        { class: "w-full text-right text-xs border-collapse" },
        el(
          "thead",
          { class: "bg-subtle text-muted border-b border-line font-semibold" },
          el(
            "tr",
            {},
            el("th", { class: "p-2.5" }, "الدواء"),
            el("th", { class: "p-2.5" }, "الجرعة وطريقة الاستخدام"),
            el("th", { class: "p-2.5 text-center" }, "الكمية"),
            el("th", { class: "p-2.5 text-end" }, "السعر"),
          ),
        ),
        el("tbody", {}, ...rows),
      );
    },
  });
}

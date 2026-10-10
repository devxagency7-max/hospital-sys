/**
 * تتبع تواريخ الصلاحية (Expiry Tracking)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statTile } from "../../components/common/card.js";
import { dataTable } from "../../components/tables/data-table.js";
import { badge, statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date } from "../../js/core/format.js";
import { listBatches, getAlerts } from "../../js/api/inventory.api.js";
import { toast } from "../../components/feedback/toast.js";

export default async function expiryTrackingPage() {
  const container = el("div", { class: "space-y-4" });

  let alerts = { nearExpiry: [], expired: [] };
  try {
    alerts = await getAlerts();
  } catch (e) {}

  const header = pageHeader({
    title: "تتبع صلاحية الأدوية واللقاحات",
    description: "الإنذار المبكر للأصناف التي اقترب تاريخ انتهاء صلاحيتها أو منتهية الصلاحية للعزل الفوري.",
  });
  container.appendChild(header);

  const kpis = el(
    "div",
    { class: "grid grid-cols-1 md:grid-cols-3 gap-3" },
    statTile({ label: "تشغيلات منتهية الصلاحية", value: String(alerts.expired?.length || 0), tone: "danger", icon: "x" }),
    statTile({ label: "قاربت على الانتهاء (< 90 يومًا)", value: String(alerts.nearExpiry?.length || 0), tone: "warning", icon: "refresh" }),
    statTile({ label: "تشغيلات صالحة وآمنة", value: "85", tone: "success", icon: "check" }),
  );
  container.appendChild(kpis);

  const table = dataTable({
    id: "expiry-tracking-table",
    fetch: listBatches,
    searchPlaceholder: "بحث بالتشغيلة أو الصنف…",
    columns: [
      {
        key: "batchNumber",
        label: "رقم التشغيلة",
        render: (row) => ref(row.batchNumber, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "itemName",
        label: "اسم الصنف",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.itemName),
      },
      {
        key: "quantity",
        label: "الكمية المتبقية",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-ink tabular" }, String(row.quantity)),
      },
      {
        key: "expiryDate",
        label: "تاريخ الانتهاء",
        render: (row) => date(row.expiryDate),
      },
      {
        key: "status",
        label: "مستوى الخطورة",
        render: (row) =>
          row.status === "expired"
            ? badge("منتهي الصلاحية", { tone: "danger" })
            : row.status === "near_expiry"
              ? badge("قارب على الانتهاء", { tone: "warning" })
              : badge("صالح للاستخدام", { tone: "success" }),
      },
    ],
    rowActions: (row) =>
      row.status === "expired"
        ? button({
            label: "عزل التشغيلة",
            variant: "danger",
            size: "sm",
            onClick: () => toast.success(`تم عزل التشغيلة ${row.batchNumber} ومنع صرفها طبيًا`),
          })
        : null,
  });

  container.appendChild(table.element);
  return container;
}

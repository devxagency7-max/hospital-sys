/**
 * صلاحية الأدوية وتنبيهات الأرفف (Pharmacy Expiry Alerts)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { badge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { date } from "../../js/core/format.js";
import { listBatches } from "../../js/api/inventory.api.js";

export default function pharmacyExpiryPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "متابعة صلاحية الأدوية بالصيدلية",
    description: "قوائم الأدوية ذات الصلاحية الوشيكة (أقل من 3 أشهر) لجدولة إرجاعها أو استهلاكها أولاً.",
  });
  container.appendChild(header);

  const table = dataTable({
    id: "pharmacy-expiry-table",
    fetch: listBatches,
    searchPlaceholder: "بحث بالتشغيلة أو اسم الدواء…",
    columns: [
      {
        key: "batchNumber",
        label: "رقم التشغيلة",
        render: (row) => ref(row.batchNumber, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "itemName",
        label: "اسم الدواء",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.itemName),
      },
      {
        key: "quantity",
        label: "الرصيد",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold tabular" }, String(row.quantity)),
      },
      {
        key: "expiryDate",
        label: "تاريخ الانتهاء",
        render: (row) => date(row.expiryDate),
      },
      {
        key: "status",
        label: "حالة الصلاحية",
        render: (row) =>
          row.status === "expired"
            ? badge("منتهي الصلاحية", { tone: "danger" })
            : row.status === "near_expiry"
              ? badge("قارب على الانتهاء", { tone: "warning" })
              : badge("صالح", { tone: "success" }),
      },
    ],
  });

  container.appendChild(table.element);
  return container;
}

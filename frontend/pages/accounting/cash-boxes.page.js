/**
 * الصناديق النقدية (Cash Boxes)
 */

import { el, cx } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statTile } from "../../components/common/card.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { badge, statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { currency } from "../../js/core/format.js";
import { listCashBoxes } from "../../js/api/accounting.api.js";
import { toast } from "../../components/feedback/toast.js";

export default function cashBoxesPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "الصناديق والخزائن النقدية",
    description: "متابعة أرصدة الخزينة الرئيسية، نقاط التحصيل، والعهد النقدية التشغيلية.",
    actions: [
      button({
        label: "توريد / جرد نقدي",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("ميزة جرد وتوريد النقدية مفعلة وتلقائية مع اليومية"),
      }),
    ],
  });
  container.appendChild(header);

  const table = dataTable({
    id: "cash-boxes",
    fetch: listCashBoxes,
    searchPlaceholder: "بحث باسم الخزينة أو الأمين أو الموقع…",
    columns: [
      {
        key: "code",
        label: "رمز الخزينة",
        render: (row) => ref(row.code, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "name",
        label: "اسم الصندوق / الخزينة",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.name),
      },
      {
        key: "balance",
        label: "الرصيد الدفتري الحالي",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-emerald-600 text-sm tabular" }, currency(row.balance)),
      },
      {
        key: "custodian",
        label: "أمين العهدة / المسؤول",
        render: (row) => el("span", { class: "text-muted" }, row.custodian),
      },
      {
        key: "location",
        label: "الموقع في المستشفى",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.location),
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

/**
 * دليل الخدمات والأسعار وقائمة التسعير (Services & Price List)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { currency } from "../../js/core/format.js";
import { getServices } from "../../js/api/lookups.api.js";
import { toast } from "../../components/feedback/toast.js";

export default function servicesSettingsPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "لائحة الخدمات الطبية والأسعار",
    description: "قائمة أسعار الكشوفات، العمليات الجراحية، الفحوصات المخبرية، والإقامة السريرية.",
    actions: [
      button({
        label: "إضافة خدمة جديدة",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("إضافة خدمة طبية جديدة للقائمة"),
      }),
    ],
  });
  container.appendChild(header);

  const table = dataTable({
    id: "settings-services-table",
    fetch: async () => {
      const items = await getServices().catch(() => []);
      return { data: items, meta: { total: items.length, page: 1, perPage: 50 } };
    },
    searchPlaceholder: "بحث بكود الخدمة أو الاسم أو التصنيف…",
    columns: [
      {
        key: "code",
        label: "كود الخدمة",
        render: (row) => ref(row.code, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "name",
        label: "اسم الخدمة / الإجراء الطبي",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.name),
      },
      {
        key: "category",
        label: "الفئة",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.category),
      },
      {
        key: "price",
        label: "السعر النقدي المعتمد",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-emerald-600 text-sm tabular" }, currency(row.price)),
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

/**
 * دليل الموردين (Suppliers Directory)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { listSuppliers } from "../../js/api/purchasing.api.js";
import { navigate } from "../../js/core/router.js";
import { toast } from "../../components/feedback/toast.js";

export default function suppliersPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "دليل الموردين والشركات الطبية",
    description: "قائمة موردي الأدوية والمستلزمات الطبية والأجهزة وبيانات الاتصال والتقييم.",
    actions: [
      button({
        label: "إضافة مورد جديد",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("إضافة مورد جديد"),
      }),
    ],
  });
  container.appendChild(header);

  const table = dataTable({
    id: "suppliers-list",
    fetch: listSuppliers,
    searchPlaceholder: "بحث بكود المورد أو الاسم أو الهاتف…",
    columns: [
      {
        key: "code",
        label: "كود المورد",
        render: (row) => ref(row.code, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "name",
        label: "اسم الشركة / المورد",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.name),
      },
      {
        key: "phone",
        label: "رقم الهاتف",
        render: (row) => ref(row.phone, { class: "text-muted font-mono" }),
      },
      {
        key: "status",
        label: "الحالة",
        render: (row) => statusBadge("active"),
      },
    ],
    rowActions: (row) =>
      button({
        label: "كشف حساب المورد",
        variant: "subtle",
        size: "sm",
        onClick: () => navigate(`/purchasing/supplier-accounts?supplierId=${row.id}`),
      }),
  });

  container.appendChild(table.element);
  return container;
}

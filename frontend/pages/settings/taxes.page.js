/**
 * إعدادات الضرائب والرسوم (Tax Settings)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { listTaxes } from "../../js/api/settings.api.js";
import { toast } from "../../components/feedback/toast.js";

export default function taxesSettingsPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "إعدادات الضرائب والخصم الضريبي",
    description: "نسب ضريبة القيمة المضافة (VAT 14%)، الخصم والإضافة، وقواعد الإعفاء الطبي.",
    actions: [
      button({
        label: "إضافة بند ضريبي",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("إضافة بند ضريبي جديد"),
      }),
    ],
  });
  container.appendChild(header);

  const table = dataTable({
    id: "settings-taxes-table",
    fetch: listTaxes,
    searchPlaceholder: "بحث بكود الضريبة أو الاسم…",
    columns: [
      {
        key: "code",
        label: "كود الضريبة",
        render: (row) => ref(row.code, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "name",
        label: "اسم الضريبة",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.name),
      },
      {
        key: "rate",
        label: "النسبة المئوية",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-ink tabular" }, `${row.rate}%`),
      },
      {
        key: "applicableTo",
        label: "مجال التطبيق",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.applicableTo),
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

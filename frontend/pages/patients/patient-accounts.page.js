/**
 * حسابات المرضى (Patient Accounts)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { ref } from "../../components/common/value.js";
import { currency } from "../../js/core/format.js";
import { listPatients } from "../../js/api/patients.api.js";
import { navigate } from "../../js/core/router.js";

export default function patientAccountsPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "حسابات ومديونيات المرضى",
    description: "الأرصدة المالية الإجمالية لكل مريض والمبالغ المحصلة والمتبقية.",
  });
  container.appendChild(header);

  const table = dataTable({
    id: "patient-accounts",
    fetch: listPatients,
    searchPlaceholder: "بحث بكود المريض أو الاسم أو الهاتف…",
    columns: [
      {
        key: "patientCode",
        label: "كود المريض",
        render: (row) => ref(row.patientCode, { class: "font-mono font-bold text-brand-600" }),
      },
      {
        key: "name",
        label: "اسم المريض",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.name),
      },
      {
        key: "phone",
        label: "رقم الهاتف",
        render: (row) => ref(row.phone, { class: "text-muted font-mono" }),
      },
      {
        key: "visitsCount",
        label: "إجمالي الزيارات",
        numeric: true,
        render: (row) => el("span", { class: "font-mono text-ink tabular" }, String(row.visitsCount ?? 0)),
      },
      {
        key: "outstandingBalance",
        label: "الرصيد المستحق (مدين)",
        numeric: true,
        render: (row) =>
          row.outstandingBalance > 0
            ? el("span", { class: "font-mono font-bold text-rose-600 text-sm tabular" }, currency(row.outstandingBalance))
            : el("span", { class: "font-mono text-emerald-600 tabular" }, "0.00 ج.م (خالص)"),
      },
    ],
    rowActions: (row) =>
      button({
        label: "عرض كشف الحساب",
        variant: "primary",
        size: "sm",
        onClick: () => navigate(`/billing/statements?patientId=${row.id}`),
      }),
  });

  container.appendChild(table.element);
  return container;
}

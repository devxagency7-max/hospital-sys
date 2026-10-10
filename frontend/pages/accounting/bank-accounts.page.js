/**
 * الحسابات البنكية (Bank Accounts)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { currency } from "../../js/core/format.js";
import { listBankAccounts } from "../../js/api/accounting.api.js";
import { toast } from "../../components/feedback/toast.js";

export default function bankAccountsPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "الحسابات البنكية للمستشفى",
    description: "إدارة الحسابات الجارية، الودائع، وحركات التحويل المصرفي.",
    actions: [
      button({
        label: "إضافة حساب بنكي",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("طلب إضافة حساب بنكي جديد قيد التنفيذ"),
      }),
    ],
  });
  container.appendChild(header);

  const table = dataTable({
    id: "bank-accounts",
    fetch: listBankAccounts,
    searchPlaceholder: "بحث باسم البنك أو رقم الحساب أو الآيبان…",
    columns: [
      {
        key: "bankName",
        label: "اسم البنك",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.bankName),
      },
      {
        key: "accountName",
        label: "مسمى الحساب",
        render: (row) => el("span", { class: "text-muted" }, row.accountName),
      },
      {
        key: "accountNumber",
        label: "رقم الحساب",
        render: (row) => ref(row.accountNumber, { class: "font-mono font-medium" }),
      },
      {
        key: "iban",
        label: "رقم الآيبان الدولي (IBAN)",
        render: (row) => ref(row.iban, { class: "font-mono text-xs text-muted" }),
      },
      {
        key: "balance",
        label: "الرصيد الحالي",
        numeric: true,
        render: (row) => el("span", { class: "font-mono font-bold text-emerald-600 text-sm tabular" }, currency(row.balance)),
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

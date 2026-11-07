/**
 * الموظفون.
 *
 * «على رأس العمل» و«تحت التجربة» يدخلان مسيّر الرواتب؛ المنتهية خدمتهم يبقون
 * في السجل للتاريخ ولا يدخلون المسيّر — وهو ما يفعله `runPayroll` بالترشيح
 * على تاريخ التعيين وتاريخ انتهاء الخدمة.
 */

import { el } from "../../js/core/dom.js";
import { buttonGroup, iconButton, button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer, phone as formatPhone } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { statusOptions } from "../../js/core/statuses.js";
import * as money from "../../js/core/money.js";
import { listPage } from "../_shared/list-page.js";
import { moneyColumn, nameColumn, textColumn, dateColumn, statusColumn, countColumn, totalCell } from "../_shared/cells.js";
import { listEmployees } from "../../js/api/hr.api.js";
import { getDepartments, getPositions, toOptions } from "../../js/api/lookups.api.js";

const CONTRACT_LABELS = { permanent: "دائم", fixed_term: "محدَّد المدة", part_time: "جزئي" };

export default async function employeesPage() {
  const [departments, positions] = await Promise.all([getDepartments(), getPositions()]);

  return listPage({
    title: "الموظفون",
    description: "سجل العاملين ورواتبهم الأساسية وبدلاتهم ومستنداتهم.",
    tableId: "hr-employees",
    searchPlaceholder: "بحث بالاسم أو الكود أو الوظيفة أو الهاتف…",
    initialParams: { sort: "code", order: "asc" },
    fetch: listEmployees,

    actions: () => [
      button({
        label: "إضافة موظف",
        variant: "primary",
        icon: "plus",
        permission: "hr.employee.manage",
        onClick: () => navigate("/hr/employees/new"),
      }),
      button({ label: "الهيكل التنظيمي", variant: "secondary", icon: "shield", onClick: () => navigate("/hr/org-chart") }),
    ],

    filters: [
      { key: "departmentId", label: "الإدارة", options: toOptions(departments) },
      { key: "positionId", label: "الوظيفة", options: toOptions(positions, { label: "title" }) },
      { key: "status", label: "الحالة", options: statusOptions(["employed", "probation", "suspended", "terminated", "resigned"]) },
      {
        key: "contractType",
        label: "نوع العقد",
        options: Object.entries(CONTRACT_LABELS).map(([v, l]) => ({ value: v, label: l })),
      },
    ],

    columns: [
      nameColumn("name", "code", "الموظف", { width: "15rem" }),
      textColumn("jobTitle", "الوظيفة", { width: "13rem", sortable: true }),
      textColumn("departmentName", "الإدارة", { width: "12rem", muted: true }),
      {
        key: "contractType",
        label: "العقد",
        width: "7rem",
        align: "center",
        render: (row) => badge(CONTRACT_LABELS[row.contractType] ?? row.contractType, { size: "sm" }),
      },
      dateColumn("hireDate", "التعيين"),
      {
        key: "yearsOfService",
        label: "سنوات الخدمة",
        numeric: true,
        width: "7rem",
        hidden: true,
        render: (row) => el("span", { class: "tabular" }, integer(row.yearsOfService ?? 0)),
      },
      moneyColumn("basicSalary", "الأساسي"),
      moneyColumn("allowancesTotal", "البدلات"),
      {
        key: "phone",
        label: "الهاتف",
        width: "8rem",
        hidden: true,
        render: (row) => el("span", { class: "num" }, formatPhone(row.phone)),
      },
      {
        key: "expiredDocuments",
        label: "مستندات",
        width: "7rem",
        align: "center",
        render: (row) =>
          row.expiredDocuments
            ? badge(`${integer(row.expiredDocuments)} منتهي`, { tone: "warning", size: "sm" })
            : badge("سليمة", { tone: "success", size: "sm" }),
      },
      statusColumn(),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 5 },
            { value: "", numeric: true },
            { value: totalCell(money.sumBy(rows, "basicSalary")), numeric: true },
            { value: totalCell(money.sumBy(rows, "allowancesTotal")), numeric: true },
            { value: "", colspan: 3 },
          ]
        : null,

    onRowClick: (row) => navigate(`/hr/employees/${row.id}`),

    rowActions: (row) =>
      buttonGroup(
        iconButton("eye", { label: "ملف الموظف", onClick: () => navigate(`/hr/employees/${row.id}`) }),
        iconButton("clock", {
          label: "سجل الحضور",
          permission: "hr.attendance.view",
          onClick: () => navigate(`/hr/attendance?employeeId=${row.id}`),
        }),
      ),

    stats: async () => {
      const all = await listEmployees({ perPage: 200 });
      const rows = all.data;
      const active = rows.filter((row) => ["employed", "probation"].includes(row.status));
      const payrollBase = money.sum(active.map((row) => money.add(row.basicSalary, row.allowancesTotal)));

      return [
        statTile({ label: "على رأس العمل", value: integer(active.length), hint: `من ${integer(all.meta.total)} في السجل`, tone: "success", icon: "users" }),
        statTile({ label: "تحت التجربة", value: integer(rows.filter((r) => r.status === "probation").length), tone: "warning", icon: "clock" }),
        statTile({ label: "الأساسي + البدلات", value: amount(payrollBase), hint: "قبل الإضافي والاستقطاعات", tone: "brand", icon: "money" }),
        statTile({
          label: "متوسط الأساسي",
          value: active.length ? amount(money.round(money.sumBy(active, "basicSalary") / active.length)) : "—",
          tone: "info",
          icon: "reports",
        }),
        statTile({
          label: "مستندات منتهية",
          value: integer(rows.reduce((total, row) => total + (row.expiredDocuments ?? 0), 0)),
          tone: rows.some((row) => row.expiredDocuments) ? "warning" : "success",
          icon: "fileText",
        }),
      ];
    },
  });
}

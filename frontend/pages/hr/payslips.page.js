/**
 * قسائم الرواتب (مفردات مرتب الموظفين).
 *
 * استعراض مفردات المرتب لكل موظف وتفاصيل الإجمالي والاستقطاعات والتأمينات والضرائب وصافي الراتب.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import { listPage } from "../_shared/list-page.js";
import {
  codeColumn,
  textColumn,
  moneyColumn,
  statusColumn,
  totalCell,
} from "../_shared/cells.js";
import { listPayslips } from "../../js/api/hr.api.js";

export default async function payslipsPage() {
  return listPage({
    title: "قسائم الرواتب",
    description: "مفردات المرتب التفصيلية لكل موظف شاملة البدلات والاستقطاعات وصافي التحويل البنكي.",
    tableId: "hr-payslips",
    searchPlaceholder: "بحث برقم القسيمة، كود الموظف، أو اسمه…",
    initialParams: { sort: "period", order: "desc" },
    fetch: async (params) => listPayslips(params),

    actions: () => [
      button({
        label: "مسيّرات الرواتب",
        variant: "secondary",
        icon: "billing",
        onClick: () => navigate("/hr/payroll"),
      }),
      button({
        label: "إعدادات الرواتب",
        variant: "ghost",
        icon: "settings",
        onClick: () => navigate("/hr/payroll-settings"),
      }),
    ],

    columns: [
      codeColumn("payslipNumber", "رقم القسيمة", { width: "11rem" }),
      {
        key: "period",
        header: "الفترة",
        width: "8rem",
        render: (row) => el("span", { style: "font-weight: 600;" }, row.period),
      },
      codeColumn("employeeCode", "كود الموظف", { width: "10rem" }),
      textColumn("employeeName", "الموظف", { width: "16rem" }),
      textColumn("departmentName", "الإدارة", { width: "12rem" }),
      moneyColumn("grossSalary", "إجمالي الراتب"),
      moneyColumn("deductions", "الاستقطاعات"),
      moneyColumn("netSalary", "صافي الراتب المستحق"),
      statusColumn(),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 5 },
            { value: totalCell(money.sumBy(rows, "grossSalary")), numeric: true },
            { value: totalCell(money.sumBy(rows, "deductions")), numeric: true },
            { value: totalCell(money.sumBy(rows, "netSalary")), numeric: true },
            { value: "", colspan: 1 },
          ]
        : null,

    stats: async () => {
      const res = await listPayslips({ perPage: 200 });
      const rows = res.data ?? [];
      const totalGross = money.sumBy(rows, "grossSalary");
      const totalDeductions = money.sumBy(rows, "deductions");
      const totalNet = money.sumBy(rows, "netSalary");

      return [
        statTile({
          label: "إجمالي الأجور المحتسبة",
          value: amount(totalGross),
          hint: `${integer(rows.length)} قسيمة راتب`,
        }),
        statTile({
          label: "إجمالي الاستقطاعات (تأمينات + ضرائب)",
          value: amount(totalDeductions),
          hint: "استقطاعات قانونية وسلف",
          trend: "neutral",
        }),
        statTile({
          label: "صافي الرواتب واجبة السداد",
          value: amount(totalNet),
          hint: "محولة لحسابات الموظفين البنكية",
          trend: "positive",
        }),
      ];
    },
  });
}

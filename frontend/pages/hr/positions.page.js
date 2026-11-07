/**
 * الوظائف والدرجات الوظيفية.
 *
 * جدول التوصيف الوظيفي، الدرجات، ونطاقات الرواتب (الحد الأدنى والأقصى).
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { listPage } from "../_shared/list-page.js";
import {
  codeColumn,
  textColumn,
  moneyColumn,
  statusColumn,
} from "../_shared/cells.js";
import { listPositions } from "../../js/api/hr.api.js";

export default async function positionsPage() {
  return listPage({
    title: "الوظائف والدرجات",
    description: "دليل التوصيف الوظيفي وسلم الدرجات ونطاقات الرواتب المعتمدة.",
    tableId: "hr-positions",
    searchPlaceholder: "بحث بكود الوظيفة، المسمى، أو الإدارة…",
    initialParams: { sort: "code", order: "asc" },
    fetch: async (params) => listPositions(params),

    actions: () => [
      button({
        label: "الهيكل التنظيمي",
        variant: "secondary",
        icon: "users",
        onClick: () => navigate("/hr/org-chart"),
      }),
      button({
        label: "الموظفون",
        variant: "ghost",
        icon: "inventory",
        onClick: () => navigate("/hr/employees"),
      }),
    ],

    columns: [
      codeColumn("code", "كود الوظيفة", { width: "10rem" }),
      {
        key: "title",
        header: "المسمى الوظيفي",
        width: "18rem",
        render: (row) => el("span", { style: "font-weight: 600;" }, row.title ?? row.name),
      },
      textColumn("departmentName", "الإدارة التابعة", { width: "14rem" }),
      {
        key: "grade",
        header: "الدرجة الوظيفية",
        width: "10rem",
        render: (row) => badge(row.grade ?? "عامة", { variant: "info" }),
      },
      moneyColumn("minSalary", "الحد الأدنى للراتب"),
      moneyColumn("maxSalary", "الحد الأقصى للراتب"),
      statusColumn(),
    ],

    stats: async () => {
      const res = await listPositions({ perPage: 100 });
      const rows = res.data ?? [];

      return [
        statTile({
          label: "إجمالي الوظائف المعرفة",
          value: integer(rows.length),
          hint: "توصيف وظيفي نشط",
        }),
        statTile({
          label: "متوسط الحد الأدنى للرواتب",
          value: amount(rows.length ? rows.reduce((acc, r) => acc + (r.minSalary ?? 0), 0) / rows.length : 0),
          hint: "بداية المربوط",
        }),
        statTile({
          label: "متوسط الحد الأقصى للرواتب",
          value: amount(rows.length ? rows.reduce((acc, r) => acc + (r.maxSalary ?? 0), 0) / rows.length : 0),
          hint: "نهاية المربوط",
        }),
      ];
    },
  });
}

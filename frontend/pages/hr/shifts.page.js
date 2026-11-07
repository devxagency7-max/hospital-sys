/**
 * ورديات العمل ومواعيد الدوام.
 *
 * إدارة جداول الورديات وساعات الحضور والانصراف وفترات السماح.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { listPage } from "../_shared/list-page.js";
import {
  codeColumn,
  nameColumn,
  textColumn,
  statusColumn,
} from "../_shared/cells.js";
import { listShifts } from "../../js/api/hr.api.js";

export default async function shiftsPage() {
  return listPage({
    title: "ورديات العمل",
    description: "إعداد جداول الورديات وتحديد ساعات العمل وفترات السماح لحساب التأخير والإضافي.",
    tableId: "hr-shifts",
    searchPlaceholder: "بحث باسم الوردية أو الكود…",
    initialParams: { sort: "code", order: "asc" },
    fetch: async (params) => listShifts(params),

    actions: () => [
      button({
        label: "سجل الحضور والانصراف",
        variant: "secondary",
        icon: "calendar",
        onClick: () => navigate("/hr/attendance"),
      }),
      button({
        label: "الموظفون",
        variant: "ghost",
        icon: "users",
        onClick: () => navigate("/hr/employees"),
      }),
    ],

    columns: [
      codeColumn("code", "كود الوردية", { width: "10rem" }),
      nameColumn("name", "nameEn", "اسم الوردية", { width: "18rem" }),
      {
        key: "startTime",
        header: "بداية الوردية",
        width: "10rem",
        render: (row) => el("span", { class: "ltr-isolate", style: "font-weight: 600;" }, row.startTime),
      },
      {
        key: "endTime",
        header: "نهاية الوردية",
        width: "10rem",
        render: (row) => el("span", { class: "ltr-isolate", style: "font-weight: 600;" }, row.endTime),
      },
      {
        key: "workHours",
        header: "ساعات العمل الرسمية",
        width: "12rem",
        render: (row) => el("span", { class: "ltr-isolate" }, `${row.workHours ?? 8} ساعات`),
      },
      {
        key: "gracePeriodMinutes",
        header: "فترة السماح (دقائق)",
        width: "11rem",
        render: (row) => badge(`${row.gracePeriodMinutes ?? 15} دقيقة`, { variant: "info" }),
      },
      statusColumn(),
    ],

    stats: async () => {
      const res = await listShifts();
      const rows = res.data ?? [];

      return [
        statTile({
          label: "إجمالي الورديات المعتمدة",
          value: integer(rows.length),
          hint: "أنماط دوام معتمدة",
        }),
        statTile({
          label: "الورديات الصباحية والمسائية",
          value: integer(rows.filter((r) => r.status === "active").length),
          hint: "نشطة قيد التشغيل",
          trend: "positive",
        }),
        statTile({
          label: "متوسط فترة السماح",
          value: "15 دقيقة",
          hint: "قبل احتساب التأخير",
        }),
      ];
    },
  });
}

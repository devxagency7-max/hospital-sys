/**
 * فروع المنشأة والمنافذ.
 *
 * إدارة فروع الشركة الإقليمية ومراكز التوزيع والمستودعات الإقليمية.
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
import { listBranches } from "../../js/api/admin.api.js";

export default async function branchesPage() {
  return listPage({
    title: "فروع المنشأة",
    description: "إدارة الفروع الإقليمية ومنافذ البيع وتوزيع المستودعات والخزائن عليها.",
    tableId: "settings-branches",
    searchPlaceholder: "بحث بكود الفرع أو اسمه أو المحافظة…",
    initialParams: { sort: "code", order: "asc" },
    fetch: async (params) => listBranches(params),

    actions: () => [
      button({
        label: "بيانات المنشأة",
        variant: "secondary",
        icon: "settings",
        onClick: () => navigate("/settings/company"),
      }),
      button({
        label: "المخازن",
        variant: "ghost",
        icon: "inventory",
        onClick: () => navigate("/inv/warehouses"),
      }),
    ],

    columns: [
      codeColumn("code", "كود الفرع", { width: "10rem" }),
      nameColumn("name", "nameEn", "اسم الفرع", { width: "18rem" }),
      textColumn("governorate", "المحافظة / المدينة", { width: "12rem" }),
      textColumn("address", "العنوان التفصيلي", { width: "20rem", muted: true }),
      textColumn("phone", "رقم الهاتف", { width: "12rem" }),
      {
        key: "isMain",
        header: "الفرع الرئيسي",
        width: "9rem",
        render: (row) => (row.isMain ? badge("الرئيسي", { variant: "info" }) : el("span", { style: "color: var(--text-muted);" }, "فرعي")),
      },
      statusColumn(),
    ],

    stats: async () => {
      const res = await listBranches();
      const rows = res.data ?? [];

      return [
        statTile({
          label: "إجمالي الفروع والمنافذ",
          value: integer(rows.length),
          hint: "تغطية جغرافية",
        }),
        statTile({
          label: "الفروع النشطة",
          value: integer(rows.filter((r) => r.status === "active").length),
          hint: "قيد التشغيل",
          trend: "positive",
        }),
        statTile({
          label: "الفرع الرئيسي والمقر العام",
          value: rows.find((r) => r.isMain)?.name ?? "القاهرة",
          hint: "مركز الإدارة",
        }),
      ];
    },
  });
}

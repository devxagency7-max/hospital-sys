/**
 * وحدات القياس.
 *
 * دليل وحدات القياس ومعاملات التحويل بين الوحدات الأساسية والفرعية.
 */

import { el } from "../../js/core/dom.js";
import { buttonGroup, iconButton, button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { listPage } from "../_shared/list-page.js";
import {
  codeColumn,
  nameColumn,
  countColumn,
} from "../_shared/cells.js";
import { listUnits } from "../../js/api/inventory.api.js";

export default async function unitsPage() {
  return listPage({
    title: "وحدات القياس",
    description: "وحدات قياس الكميات المخزنية ومعاملات التحويل وعدد المنازل العشرية.",
    tableId: "inv-units",
    searchPlaceholder: "بحث باسم الوحدة أو الرمز…",
    initialParams: { sort: "code", order: "asc" },
    fetch: listUnits,

    actions: () => [
      button({
        label: "الأصناف المخزنية",
        variant: "primary",
        icon: "inventory",
        onClick: () => navigate("/inv/items"),
      }),
      button({
        label: "التصنيفات",
        variant: "secondary",
        icon: "reports",
        onClick: () => navigate("/inv/categories"),
      }),
    ],

    columns: [
      codeColumn("code", "رمز الوحدة", { width: "9rem" }),
      nameColumn("name", "nameEn", "اسم الوحدة", { width: "16rem" }),
      {
        key: "baseUnitId",
        label: "طبيعة الوحدة",
        width: "12rem",
        align: "center",
        render: (row) =>
          row.baseUnitId
            ? badge(`وحدة فرعية #${row.baseUnitId}`, { tone: "info", size: "sm" })
            : badge("وحدة أساسية", { tone: "brand", size: "sm" }),
      },
      countColumn("factor", "معامل التحويل"),
      countColumn("decimals", "المنازل العشرية"),
    ],

    stats: async () => {
      const { data, meta } = await listUnits({ perPage: 100 });
      const baseUnits = data.filter((u) => !u.baseUnitId);
      const subUnits = data.filter((u) => u.baseUnitId);

      return [
        statTile({
          label: "إجمالي وحدات القياس",
          value: integer(meta.total),
          tone: "neutral",
          icon: "inventory",
        }),
        statTile({
          label: "وحدات أساسية",
          value: integer(baseUnits.length),
          tone: "brand",
          icon: "checkCircle",
        }),
        statTile({
          label: "وحدات تحويلية وفرعية",
          value: integer(subUnits.length),
          tone: "info",
          icon: "refresh",
        }),
      ];
    },
  });
}

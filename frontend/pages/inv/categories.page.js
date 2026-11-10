/**
 * تصنيفات الأصناف.
 *
 * شجرة تصنيفات المخزون وحساباتها الرقابية المرتبطة بدليل الحسابات.
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
  textColumn,
  statusColumn,
  countColumn,
} from "../_shared/cells.js";
import { listCategories } from "../../js/api/inventory.api.js";

export default async function categoriesPage() {
  return listPage({
    title: "تصنيفات الأصناف",
    description: "هيكل تصنيف المواد والمخزون وحساب الأستاذ الرقابي لكل فئة.",
    tableId: "inv-categories",
    searchPlaceholder: "بحث باسم التصنيف أو الكود…",
    initialParams: { sort: "code", order: "asc" },
    fetch: listCategories,

    actions: () => [
      button({
        label: "الأصناف المخزنية",
        variant: "primary",
        icon: "inventory",
        onClick: () => navigate("/inv/items"),
      }),
    ],

    filters: [
      {
        key: "status",
        label: "الحالة",
        options: [
          { value: "active", label: "نشط" },
          { value: "inactive", label: "غير نشط" },
        ],
      },
    ],

    columns: [
      codeColumn("code", "كود التصنيف", { width: "11rem" }),
      nameColumn("name", "nameEn", "اسم التصنيف", { width: "18rem" }),
      {
        key: "parentId",
        label: "التصنيف الأب",
        width: "12rem",
        render: (row) =>
          row.parentId
            ? badge(`رئيسي #${row.parentId}`, { tone: "info", size: "sm" })
            : badge("فئة رئيسية", { tone: "brand", size: "sm" }),
      },
      codeColumn("inventoryAccountId", "حساب المخزون الرقابي", { width: "12rem" }),
      statusColumn(),
    ],

    onRowClick: (row) => navigate(`/inv/items?category=${encodeURIComponent(row.name)}`),

    rowActions: (row) =>
      buttonGroup(
        iconButton("eye", {
          label: "عرض أصناف التصنيف",
          onClick: () => navigate(`/inv/items?category=${encodeURIComponent(row.name)}`),
        }),
      ),

    stats: async () => {
      const { data, meta } = await listCategories({ perPage: 100 });
      const mainCats = data.filter((c) => !c.parentId);
      const subCats = data.filter((c) => c.parentId);

      return [
        statTile({
          label: "إجمالي التصنيفات",
          value: integer(meta.total),
          tone: "neutral",
          icon: "inventory",
        }),
        statTile({
          label: "فئات رئيسية",
          value: integer(mainCats.length),
          tone: "brand",
          icon: "box",
        }),
        statTile({
          label: "فئات فرعية",
          value: integer(subCats.length),
          tone: "info",
          icon: "reports",
        }),
      ];
    },
  });
}

/**
 * المخازن والمستودعات.
 *
 * دليل المستودعات ومواقعها وطريقة تقييم مخزونها وحساباتها الرقابية.
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
  tagColumn,
  statusColumn,
} from "../_shared/cells.js";
import { listWarehouses } from "../../js/api/inventory.api.js";

const COSTING_METHODS = {
  fifo: { label: "FIFO", tone: "brand" },
  weighted_average: { label: "متوسط مرجح", tone: "info" },
};

export default async function warehousesPage() {
  return listPage({
    title: "المخازن والمستودعات",
    description: "إدارة المستودعات المعتمدة ومواقعها الجغرافية وطرق التقييم وحساباتها الرقابية.",
    tableId: "inv-warehouses",
    searchPlaceholder: "بحث بكود المخزن أو الاسم أو الموقع…",
    initialParams: { sort: "code", order: "asc" },
    fetch: listWarehouses,

    actions: () => [
      button({
        label: "أرصدة المخزون",
        variant: "primary",
        icon: "inventory",
        onClick: () => navigate("/inv/balances"),
      }),
      button({
        label: "حركات المخزون",
        variant: "secondary",
        icon: "reports",
        onClick: () => navigate("/inv/movements"),
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
      {
        key: "costingMethod",
        label: "طريقة التقييم",
        options: [
          { value: "fifo", label: "FIFO" },
          { value: "weighted_average", label: "متوسط مرجح" },
        ],
      },
    ],

    columns: [
      codeColumn("code", "كود المستودع", { width: "10rem" }),
      nameColumn("name", "nameEn", "اسم المستودع", { width: "16rem" }),
      textColumn("location", "الموقع الجغرافي", { width: "18rem" }),
      tagColumn("costingMethod", "طريقة التقييم", COSTING_METHODS, { width: "8.5rem" }),
      codeColumn("inventoryAccountId", "حساب المخزون الرقابي", { width: "11rem" }),
      statusColumn(),
    ],

    onRowClick: (row) => navigate(`/inv/balances?warehouseId=${row.id}`),

    rowActions: (row) =>
      buttonGroup(
        iconButton("eye", {
          label: "أرصدة المستودع",
          onClick: () => navigate(`/inv/balances?warehouseId=${row.id}`),
        }),
        iconButton("clock", {
          label: "سجل حركات المستودع",
          onClick: () => navigate(`/inv/movements?warehouseId=${row.id}`),
        }),
      ),

    stats: async () => {
      const { data, meta } = await listWarehouses({ perPage: 100 });
      const fifoWh = data.filter((w) => w.costingMethod === "fifo");
      const avgWh = data.filter((w) => w.costingMethod === "weighted_average");

      return [
        statTile({
          label: "إجمالي المستودعات",
          value: integer(meta.total),
          tone: "neutral",
          icon: "inventory",
        }),
        statTile({
          label: "مستودعات نشطة",
          value: integer(data.filter((w) => w.status === "active").length),
          tone: "success",
          icon: "checkCircle",
        }),
        statTile({
          label: "تقييم بنظام FIFO",
          value: integer(fifoWh.length),
          hint: "الوارد أولاً صادر أولاً",
          tone: "brand",
          icon: "box",
        }),
        statTile({
          label: "تقييم بالمتوسط المرجح",
          value: integer(avgWh.length),
          hint: "متوسط تكلفة متحرك",
          tone: "info",
          icon: "reports",
        }),
      ];
    },
  });
}

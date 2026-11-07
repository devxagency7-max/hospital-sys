/**
 * تشغيلات المخزون (Batches).
 *
 * تتبّع أرقام التشغيلات وكمياتها المتبقية وتواريخ الإنتاج وانتهاء الصلاحية.
 */

import { el } from "../../js/core/dom.js";
import { buttonGroup, iconButton, button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import { listPage } from "../_shared/list-page.js";
import {
  codeColumn,
  nameColumn,
  textColumn,
  quantityColumn,
  moneyColumn,
  dateColumn,
  statusColumn,
  totalCell,
} from "../_shared/cells.js";
import { listBatches } from "../../js/api/inventory.api.js";
import { getItems, getWarehouses, toOptions } from "../../js/api/lookups.api.js";

export default async function batchesPage() {
  const [items, warehouses] = await Promise.all([
    getItems(),
    getWarehouses(),
  ]);

  return listPage({
    title: "تشغيلات الأصناف (Batches)",
    description: "تتبّع التشغيلات وأرقام اللوت وأرصدتها الحالية وتواريخ صلاحيتها لتطبيق سياسة الأسبق انتهاءً أولاً بالصرف.",
    tableId: "inv-batches",
    searchPlaceholder: "بحث برقم التشغيلة أو كود الصنف أو المرجع…",
    initialParams: { sort: "expiryDate", order: "asc" },
    fetch: listBatches,

    actions: () => [
      button({
        label: "تقرير تتبّع الصلاحية",
        variant: "primary",
        icon: "clock",
        onClick: () => navigate("/inv/expiry"),
      }),
      button({
        label: "أرصدة المخزون",
        variant: "secondary",
        icon: "inventory",
        onClick: () => navigate("/inv/balances"),
      }),
    ],

    filters: [
      { key: "warehouseId", label: "المخزن", options: toOptions(warehouses) },
      { key: "itemId", label: "الصنف", options: toOptions(items) },
      {
        key: "status",
        label: "حالة التشغيلة",
        options: [
          { value: "available", label: "صالحة ومتاحة" },
          { value: "near_expiry", label: "قاربت على الانتهاء" },
          { value: "expired", label: "منتهية الصلاحية" },
        ],
      },
    ],

    columns: [
      codeColumn("batchNumber", "رقم التشغيلة", { width: "11rem" }),
      nameColumn("itemName", "itemCode", "الصنف", { width: "16rem" }),
      textColumn("warehouseName", "المستودع", { width: "11rem" }),
      quantityColumn("quantity", "الرصيد المتبقي"),
      dateColumn("productionDate", "تاريخ الإنتاج", { hidden: true }),
      dateColumn("expiryDate", "انتهاء الصلاحية"),
      moneyColumn("unitCost", "تكلفة الوحدة"),
      moneyColumn("value", "إجمالي القيمة"),
      statusColumn(),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 3 },
            { value: integer(rows.reduce((sum, r) => sum + (r.quantity ?? 0), 0)), numeric: true },
            { value: "", colspan: 2 },
            { value: totalCell(money.sumBy(rows, "value")), numeric: true },
            { value: "", colspan: 1 },
          ]
        : null,

    onRowClick: (row) => navigate(`/inv/items/${row.itemId}`),

    rowActions: (row) =>
      buttonGroup(
        iconButton("eye", { label: "ملف الصنف", onClick: () => navigate(`/inv/items/${row.itemId}`) }),
      ),

    stats: async () => {
      const { data, meta } = await listBatches({ perPage: 500 });
      const totalUnits = data.reduce((sum, r) => sum + (r.quantity ?? 0), 0);
      const totalVal = money.sumBy(data, "value");
      const nearExpiry = data.filter((b) => b.status === "near_expiry");
      const expired = data.filter((b) => b.status === "expired");

      return [
        statTile({
          label: "إجمالي التشغيلات النشطة",
          value: integer(meta.total),
          tone: "neutral",
          icon: "box",
        }),
        statTile({
          label: "قيمة تشغيلات المخزون",
          value: amount(totalVal),
          hint: `${integer(totalUnits)} وحدة مسجلة بتشغيلة`,
          tone: "brand",
          icon: "money",
        }),
        statTile({
          label: "قاربت على الانتهاء",
          value: integer(nearExpiry.length),
          hint: "تستوجب سرعة الصرف أو البيع",
          tone: nearExpiry.length ? "warning" : "success",
          icon: "clock",
        }),
        statTile({
          label: "تشغيلات منتهية",
          value: integer(expired.length),
          hint: "محظورة الصرف ويجب عزلها",
          tone: expired.length ? "danger" : "neutral",
          icon: "xCircle",
        }),
      ];
    },
  });
}

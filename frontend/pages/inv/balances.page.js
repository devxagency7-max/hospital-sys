/**
 * أرصدة المخزون.
 *
 * رصيد كل صنف في كل مخزن محسوبًا من الحركات الفعلية: المتاح والمحجوز ومتوسط التكلفة.
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
  nameColumn,
  textColumn,
  quantityColumn,
  moneyColumn,
  statusColumn,
  totalCell,
  dateColumn,
} from "../_shared/cells.js";
import { listBalances } from "../../js/api/inventory.api.js";
import { getWarehouses, getItemCategories, toOptions } from "../../js/api/lookups.api.js";

export default async function balancesPage() {
  const [warehouses, categories] = await Promise.all([
    getWarehouses(),
    getItemCategories(),
  ]);

  return listPage({
    title: "أرصدة المخزون",
    description: "الأرصدة الفعلية والمحجوزة والمتاحة لكل صنف عبر كل مستودع، وقيمتها التقديرية.",
    tableId: "inv-balances",
    searchPlaceholder: "بحث باسم الصنف أو الكود أو المخزن…",
    initialParams: { sort: "warehouseName", order: "asc" },
    fetch: listBalances,

    actions: () => [
      button({
        label: "إذن إضافة",
        variant: "primary",
        icon: "plus",
        permission: "inv.receipt.create",
        onClick: () => navigate("/inv/receipts"),
      }),
      button({
        label: "إذن صرف",
        variant: "secondary",
        icon: "minus",
        permission: "inv.issue.create",
        onClick: () => navigate("/inv/issues"),
      }),
      button({
        label: "تحويل مخزني",
        variant: "ghost",
        icon: "refresh",
        permission: "inv.transfer.create",
        onClick: () => navigate("/inv/transfers"),
      }),
    ],

    filters: [
      { key: "warehouseId", label: "المخزن", options: toOptions(warehouses) },
      { key: "category", label: "التصنيف", options: toOptions(categories, { value: "name" }) },
      {
        key: "status",
        label: "حالة الرصيد",
        options: [
          { value: "available", label: "متاح" },
          { value: "low_stock", label: "رصيد منخفض" },
          { value: "out_of_stock", label: "نافد" },
          { value: "over_stock", label: "فوق الحد الأقصى" },
        ],
      },
    ],

    columns: [
      nameColumn("itemName", "itemCode", "الصنف", { width: "16rem" }),
      textColumn("warehouseName", "المخزن", { width: "11rem", sortable: true }),
      textColumn("category", "التصنيف", { width: "9rem", muted: true }),
      quantityColumn("onHand", "الرصيد الفعلي", {
        tooltip: "الكمية الموجودة فعليًا في هذا المخزن الآن: الرصيد الافتتاحي + الإضافات − الصرف.",
      }),
      quantityColumn("reserved", "المحجوز", {
        tooltip: "كميات عليها أذون صرف معتمدة لم تُسلَّم بعد — لا يمكن صرفها لجهة أخرى.",
      }),
      quantityColumn("available", "المتاح", {
        tooltip: "ما يمكن صرفه الآن = الرصيد الفعلي − المحجوز. النظام يرفض الصرف فوق هذا الرقم.",
      }),
      moneyColumn("averageCost", "متوسط التكلفة", {
        tooltip: "متوسط تكلفة شراء الوحدة الواحدة للرصيد الحالي في هذا المخزن.",
      }),
      moneyColumn("totalValue", "القيمة الإجمالية", {
        tooltip: "الكمية × تكلفتها = قيمة المخزون في هذا الصف، ومجموعها يطابق حساب المخزون في الميزانية.",
      }),
      dateColumn("lastMovementDate", "آخر حركة", { hidden: true }),
      statusColumn(),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 3 },
            { value: integer(rows.reduce((sum, r) => sum + (r.onHand ?? 0), 0)), numeric: true },
            { value: integer(rows.reduce((sum, r) => sum + (r.reserved ?? 0), 0)), numeric: true },
            { value: integer(rows.reduce((sum, r) => sum + (r.available ?? 0), 0)), numeric: true },
            { value: "", colspan: 1 },
            { value: totalCell(money.sumBy(rows, "totalValue")), numeric: true },
            { value: "", colspan: 1 },
          ]
        : null,

    onRowClick: (row) => navigate(`/inv/items/${row.itemId}`),

    rowActions: (row) =>
      buttonGroup(
        iconButton("eye", { label: "ملف الصنف", onClick: () => navigate(`/inv/items/${row.itemId}`) }),
        iconButton("clock", {
          label: "كشف حركات الصنف",
          onClick: () => navigate(`/inv/movements?itemId=${row.itemId}&warehouseId=${row.warehouseId}`),
        }),
      ),

    stats: async () => {
      const { data, meta } = await listBalances({ perPage: 500 });
      const totalVal = money.sumBy(data, "totalValue");
      const totalUnits = data.reduce((sum, r) => sum + (r.onHand ?? 0), 0);
      const reservedUnits = data.reduce((sum, r) => sum + (r.reserved ?? 0), 0);
      const lowStockCount = data.filter((r) => r.status === "low_stock").length;

      return [
        statTile({
          label: "إجمالي السجلات المخزنية",
          value: integer(meta.total),
          hint: `${integer(warehouses.length)} مخازن معتمدة`,
          tone: "neutral",
          icon: "inventory",
        }),
        statTile({
          label: "إجمالي الوحدات بالمخازن",
          value: integer(totalUnits),
          hint: `${integer(reservedUnits)} وحدة محجوزة للطلبات`,
          tone: "brand",
          icon: "box",
        }),
        statTile({
          label: "إجمالي قيمة الأرصدة",
          value: amount(totalVal),
          hint: "بالتكلفة المرجحة",
          tone: "success",
          icon: "money",
        }),
        statTile({
          label: "أرصدة تستوجب إعادة الطلب",
          value: integer(lowStockCount),
          tone: lowStockCount ? "warning" : "success",
          icon: "clock",
        }),
      ];
    },
  });
}

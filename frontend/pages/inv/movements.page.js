/**
 * حركات المخزون.
 *
 * سجل تفصيلي لكل حركة مخزنية (وارد، صادر، تحويل، تسوية) مع الرصيد المتحرك والتكلفة.
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
  totalCell,
} from "../_shared/cells.js";
import { listMovements } from "../../js/api/inventory.api.js";
import { getWarehouses, getItems, toOptions } from "../../js/api/lookups.api.js";

const MOVEMENT_TYPES = {
  goods_receipt: { label: "إذن إضافة", tone: "success" },
  goods_issue: { label: "إذن صرف", tone: "brand" },
  transfer_in: { label: "تحويل وارد", tone: "info" },
  transfer_out: { label: "تحويل صادر", tone: "warning" },
  adjustment_in: { label: "تسوية بالزيادة", tone: "success" },
  adjustment_out: { label: "تسوية بالعجز", tone: "danger" },
  initial_balance: { label: "رصيد افتتاحي", tone: "neutral" },
};

export default async function movementsPage() {
  const [warehouses, items] = await Promise.all([
    getWarehouses(),
    getItems(),
  ]);

  return listPage({
    title: "حركات المخزون",
    description: "كشف الحركات المخزنية الواردة والصادرة والتحويلات مع التكلفة والرصيد اللحظي.",
    tableId: "inv-movements",
    searchPlaceholder: "بحث برقم الحركة أو كود الصنف أو المرجع…",
    initialParams: { sort: "date", order: "desc" },
    fetch: listMovements,

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
      { key: "itemId", label: "الصنف", options: toOptions(items) },
      {
        key: "type",
        label: "نوع الحركة",
        options: Object.entries(MOVEMENT_TYPES).map(([val, item]) => ({
          value: val,
          label: item.label,
        })),
      },
    ],

    columns: [
      codeColumn("movementNumber", "رقم الحركة", { width: "9.5rem" }),
      dateColumn("date", "التاريخ", { width: "7.5rem" }),
      {
        key: "type",
        label: "نوع الحركة",
        width: "9rem",
        align: "center",
        render: (row) => {
          const t = MOVEMENT_TYPES[row.type] ?? { label: row.typeLabel ?? row.type, tone: "neutral" };
          return badge(t.label, { tone: t.tone, size: "sm" });
        },
      },
      nameColumn("itemName", "itemCode", "الصنف", { width: "15rem" }),
      textColumn("warehouseName", "المخزن", { width: "10rem" }),
      {
        key: "quantity",
        label: "الكمية",
        numeric: true,
        width: "7.5rem",
        render: (row) => {
          const isIn = row.direction === "in" || row.type === "goods_receipt" || row.type === "transfer_in" || row.type === "adjustment_in";
          return el(
            "span",
            { class: isIn ? "text-success-400 tabular font-semibold" : "text-ink tabular" },
            `${isIn ? "+" : "−"}${integer(row.quantity ?? 0)}`,
          );
        },
      },
      moneyColumn("costPerUnit", "تكلفة الوحدة"),
      moneyColumn("totalCost", "إجمالي التكلفة"),
      codeColumn("reference", "المرجع", { width: "8.5rem" }),
      quantityColumn("balanceAfter", "الرصيد بعدها"),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 5 },
            { value: integer(rows.reduce((sum, r) => sum + (r.quantity ?? 0), 0)), numeric: true },
            { value: "", colspan: 1 },
            { value: totalCell(money.sumBy(rows, "totalCost")), numeric: true },
            { value: "", colspan: 2 },
          ]
        : null,

    onRowClick: (row) => navigate(`/inv/items/${row.itemId}`),

    rowActions: (row) =>
      buttonGroup(
        iconButton("eye", { label: "ملف الصنف", onClick: () => navigate(`/inv/items/${row.itemId}`) }),
      ),

    stats: async () => {
      const { data, meta } = await listMovements({ perPage: 500 });
      const inbound = data.filter((m) => m.direction === "in" || m.type === "goods_receipt" || m.type === "transfer_in" || m.type === "adjustment_in");
      const outbound = data.filter((m) => m.direction === "out" || m.type === "goods_issue" || m.type === "transfer_out" || m.type === "adjustment_out");
      const totalCostSum = money.sumBy(data, "totalCost");

      return [
        statTile({
          label: "إجمالي الحركات المُسجَّلة",
          value: integer(meta.total),
          tone: "neutral",
          icon: "inventory",
        }),
        statTile({
          label: "حركات الإضافة / الوارد",
          value: integer(inbound.length),
          hint: `${amount(money.sumBy(inbound, "totalCost"))} تكلفة`,
          tone: "success",
          icon: "checkCircle",
        }),
        statTile({
          label: "حركات الصرف / الصادر",
          value: integer(outbound.length),
          hint: `${amount(money.sumBy(outbound, "totalCost"))} تكلفة منصرفة`,
          tone: "brand",
          icon: "money",
        }),
        statTile({
          label: "إجمالي قيمة الحركات",
          value: amount(totalCostSum),
          tone: "info",
          icon: "reports",
        }),
      ];
    },
  });
}

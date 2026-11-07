/**
 * الجرد الفعلي للمخزون.
 *
 * إدارة عمليات الجرد الدوري والسنوي، وتجميد الأرصدة الدفترية واحتساب فروق الجرد وترحيلها.
 */

import { el } from "../../js/core/dom.js";
import { buttonGroup, iconButton, button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import { listPage, confirmThenRun } from "../_shared/list-page.js";
import {
  codeColumn,
  textColumn,
  countColumn,
  moneyColumn,
  dateColumn,
  statusColumn,
  totalCell,
} from "../_shared/cells.js";
import { listStockCounts, startStockCount } from "../../js/api/inventory.api.js";
import { getWarehouses, toOptions } from "../../js/api/lookups.api.js";

export default async function countsPage() {
  const warehouses = await getWarehouses();

  return listPage({
    title: "الجرد الفعلي للمخزون",
    description: "مطابقة الأرصدة الفعلية على الرف مع الأرصدة الدفترية واحتساب الفروق وترحيلها لتسويات مخزنية.",
    tableId: "inv-counts",
    searchPlaceholder: "بحث برقم الجرد أو اسم المستودع…",
    initialParams: { sort: "date", order: "desc" },
    fetch: listStockCounts,

    actions: () => [
      button({
        label: "التسويات المخزنية",
        variant: "secondary",
        icon: "reports",
        onClick: () => navigate("/inv/adjustments"),
      }),
      button({
        label: "أرصدة المخزون",
        variant: "ghost",
        icon: "inventory",
        onClick: () => navigate("/inv/balances"),
      }),
    ],

    filters: [
      { key: "warehouseId", label: "المخزن", options: toOptions(warehouses) },
      {
        key: "status",
        label: "حالة الجرد",
        options: [
          { value: "scheduled", label: "مجدول" },
          { value: "counting", label: "جرد جارٍ" },
          { value: "completed", label: "مكتمل ومُسوّى" },
        ],
      },
    ],

    columns: [
      codeColumn("countNumber", "رقم الجرد", { width: "10.5rem" }),
      textColumn("warehouseName", "المستودع الخاضع للجرد", { width: "14rem" }),
      dateColumn("date", "تاريخ الجرد"),
      countColumn("itemsCounted", "الأصناف المحصورة"),
      countColumn("variancesCount", "أصناف بفروق"),
      moneyColumn("varianceValue", "قيمة الفروق", { signed: true }),
      statusColumn(),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 3 },
            { value: integer(rows.reduce((sum, r) => sum + (r.itemsCounted ?? 0), 0)), numeric: true },
            { value: integer(rows.reduce((sum, r) => sum + (r.variancesCount ?? 0), 0)), numeric: true },
            { value: totalCell(money.sumBy(rows, "varianceValue"), { signed: true }), numeric: true },
            { value: "", colspan: 1 },
          ]
        : null,

    onRowClick: (row) => navigate(`/inv/counts/${row.id}`),

    rowActions: (row, context) =>
      buttonGroup(
        row.status === "scheduled"
          ? iconButton("play", {
              label: "بدء الجرد وتجميد الدفتري",
              permission: "inv.count.manage",
              onClick: () =>
                confirmThenRun(
                  {
                    title: `بدء الجرد ${row.countNumber}؟`,
                    message: "بدء الجرد يُجمّد الأرصدة الدفترية لحظيًا لمقارنتها بالعد الفعلي على الرف.",
                    confirmLabel: "بدء الجرد",
                    tone: "primary",
                  },
                  () => startStockCount(row.id),
                  { success: "بدأ الجرد وجُمّدت الأرصدة الدفترية بنجاح.", context },
                ),
            })
          : null,
        iconButton("eye", { label: "تفاصيل الجرد", onClick: () => navigate(`/inv/counts/${row.id}`) }),
      ),

    stats: async () => {
      const { data, meta } = await listStockCounts({ perPage: 100 });
      const completed = data.filter((c) => c.status === "completed");
      const active = data.filter((c) => c.status === "counting");
      const scheduled = data.filter((c) => c.status === "scheduled");

      return [
        statTile({
          label: "إجمالي عمليات الجرد",
          value: integer(meta.total),
          tone: "neutral",
          icon: "inventory",
        }),
        statTile({
          label: "جرد مكتمل ومُسوّى",
          value: integer(completed.length),
          hint: "تم إثبات الفروق وترحيلها",
          tone: "success",
          icon: "checkCircle",
        }),
        statTile({
          label: "جرد جارٍ حاليًا",
          value: integer(active.length),
          hint: "أرصدة دفترية مجمّدة",
          tone: active.length ? "warning" : "neutral",
          icon: "clock",
        }),
        statTile({
          label: "جرد مجدول قادم",
          value: integer(scheduled.length),
          tone: "info",
          icon: "calendar",
        }),
      ];
    },
  });
}

/**
 * تتبّع صلاحية المخزون.
 *
 * تقرير التعرّض المالي للتشغيلات المنتهية والقاربة على الانتهاء لتفادي الخسائر وتوجيه أولوية الصرف.
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
import { getExpiryReport } from "../../js/api/inventory.api.js";

export default async function expiryPage() {
  return listPage({
    title: "تتبّع صلاحية المخزون",
    description: "رصد الأصناف المنتهية والمهددة بالانتهاء وقيمة التعرّض المالي لاتخاذ إجراءات الصرف أو الإتلاف.",
    tableId: "inv-expiry",
    searchPlaceholder: "بحث برقم التشغيلة أو كود الصنف أو المخزن…",
    initialParams: { sort: "expiryDate", order: "asc" },
    fetch: async (params) => {
      const report = await getExpiryReport(params);
      const rows = report.rows ?? [];
      const search = (params.search ?? "").trim().toLowerCase();
      const filtered = rows.filter((r) => {
        if (search && !r.itemName?.toLowerCase().includes(search) && !r.batchNumber?.toLowerCase().includes(search)) return false;
        if (params.status && r.status !== params.status) return false;
        return true;
      });
      const page = params.page ?? 1;
      const perPage = params.perPage ?? 25;
      const start = (page - 1) * perPage;
      const pageData = filtered.slice(start, start + perPage);

      return {
        data: pageData,
        meta: {
          page,
          perPage,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / perPage),
        },
      };
    },

    actions: () => [
      button({
        label: "سجل التشغيلات",
        variant: "secondary",
        icon: "box",
        onClick: () => navigate("/inv/batches"),
      }),
      button({
        label: "تسجيل تسوية تلف",
        variant: "primary",
        icon: "minus",
        permission: "inv.adjust",
        onClick: () => navigate("/inv/adjustments"),
      }),
    ],

    filters: [
      {
        key: "status",
        label: "حالة الصلاحية",
        options: [
          { value: "near_expiry", label: "قاربت على الانتهاء" },
          { value: "expired", label: "منتهية الصلاحية" },
        ],
      },
    ],

    columns: [
      codeColumn("batchNumber", "رقم التشغيلة", { width: "11rem" }),
      nameColumn("itemName", "itemCode", "الصنف", { width: "16rem" }),
      textColumn("warehouseName", "المستودع", { width: "11rem" }),
      quantityColumn("quantity", "الكمية المتبقية"),
      dateColumn("expiryDate", "تاريخ الانتهاء"),
      moneyColumn("value", "قيمة التعرّض"),
      statusColumn(),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 3 },
            { value: integer(rows.reduce((sum, r) => sum + (r.quantity ?? 0), 0)), numeric: true },
            { value: "", colspan: 1 },
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
      const report = await getExpiryReport();
      const expiredRows = report.rows.filter((r) => r.status === "expired");
      const nearRows = report.rows.filter((r) => r.status === "near_expiry");
      const totalExposure = money.sumBy(report.rows, "value");

      return [
        statTile({
          label: "إجمالي قيمة التعرّض المالي",
          value: amount(totalExposure),
          hint: "قيمة المخزون المهدد بالانتهاء أو منتهي",
          tone: "danger",
          icon: "alertTriangle",
        }),
        statTile({
          label: "تشغيلات منتهية الصلاحية",
          value: integer(expiredRows.length),
          hint: `${amount(money.sumBy(expiredRows, "value"))} خسارة مؤكدة تستوجب الإتلاف`,
          tone: expiredRows.length ? "danger" : "neutral",
          icon: "xCircle",
        }),
        statTile({
          label: "قاربت على الانتهاء",
          value: integer(nearRows.length),
          hint: `${amount(money.sumBy(nearRows, "value"))} قابلة للتدارك بالصرف السريع`,
          tone: nearRows.length ? "warning" : "success",
          icon: "clock",
        }),
      ];
    },
  });
}

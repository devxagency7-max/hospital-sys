/**
 * مراكز التكلفة.
 *
 * متابعة مراكز التكلفة التشغيلية والإدارية وتوزيع الإيرادات والمصروفات عليها.
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
  moneyColumn,
  statusColumn,
  totalCell,
} from "../_shared/cells.js";
import { listCostCenters, getCostCenterAnalysis } from "../../js/api/accounting.api.js";

export default async function costCentersPage() {
  return listPage({
    title: "مراكز التكلفة",
    description: "توزيع المصروفات التشغيلية والإدارية والإيرادات على مراكز المسؤولية لتحليل الربحية.",
    tableId: "gl-cost-centers",
    searchPlaceholder: "بحث بكود المركز أو الاسم…",
    initialParams: { sort: "code", order: "asc" },
    fetch: async (params) => {
      const [listRes, analysisRes] = await Promise.all([
        listCostCenters(params),
        getCostCenterAnalysis(params),
      ]);
      const analysisMap = new Map((analysisRes?.centers ?? []).map((c) => [String(c.id), c]));

      const rows = (listRes.data ?? []).map((cc) => {
        const a = analysisMap.get(String(cc.id)) ?? {};
        const expenses = a.expenses ?? 0;
        const revenues = a.revenues ?? 0;
        return {
          ...cc,
          allocatedExpenses: expenses,
          allocatedRevenues: revenues,
          net: money.subtract(revenues, expenses),
        };
      });

      return { data: rows, meta: listRes.meta };
    },

    actions: () => [
      button({
        label: "دفتر الأستاذ العام",
        variant: "secondary",
        icon: "reports",
        onClick: () => navigate("/gl/ledger"),
      }),
      button({
        label: "دليل الحسابات",
        variant: "ghost",
        icon: "inventory",
        onClick: () => navigate("/gl/accounts"),
      }),
    ],

    columns: [
      codeColumn("code", "كود المركز", { width: "10rem" }),
      nameColumn("name", "nameEn", "مركز التكلفة", { width: "18rem" }),
      textColumn("managerName", "المسؤول / المشرف", { width: "13rem", muted: true }),
      moneyColumn("allocatedExpenses", "المصروفات المحمّلة"),
      moneyColumn("allocatedRevenues", "الإيرادات المحمّلة"),
      moneyColumn("net", "صافي المركز", { signed: true }),
      statusColumn(),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 3 },
            { value: totalCell(money.sumBy(rows, "allocatedExpenses")), numeric: true },
            { value: totalCell(money.sumBy(rows, "allocatedRevenues")), numeric: true },
            { value: totalCell(money.sumBy(rows, "net"), { signed: true }), numeric: true },
            { value: "", colspan: 1 },
          ]
        : null,

    stats: async () => {
      const [listRes, analysis] = await Promise.all([
        listCostCenters({ perPage: 100 }),
        getCostCenterAnalysis(),
      ]);
      const totalExpenses = analysis?.totalExpenses ?? 0;
      const totalRevenues = analysis?.totalRevenues ?? 0;

      return [
        statTile({
          label: "إجمالي مراكز التكلفة",
          value: integer(listRes.meta?.total ?? 0),
          tone: "neutral",
          icon: "box",
        }),
        statTile({
          label: "إجمالي المصروفات المحمّلة",
          value: amount(totalExpenses),
          tone: "brand",
          icon: "money",
        }),
        statTile({
          label: "إجمالي الإيرادات المحمّلة",
          value: amount(totalRevenues),
          tone: "success",
          icon: "checkCircle",
        }),
        statTile({
          label: "صافي مساهمة المراكز",
          value: amount(money.subtract(totalRevenues, totalExpenses)),
          tone: money.subtract(totalRevenues, totalExpenses) >= 0 ? "success" : "danger",
          icon: "reports",
        }),
      ];
    },
  });
}

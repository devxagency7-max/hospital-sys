/**
 * تقييم المخزون.
 *
 * تقرير تقييم المخزون المقارن (FIFO والمتوسط المرجّح) وتوزيع القيمة حسب المستودعات.
 */

import { el, cx, clear } from "../../js/core/dom.js";
import { buttonGroup, iconButton, button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile, card, statGrid } from "../../components/common/card.js";
import { amount, integer, percent } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import { listPage } from "../_shared/list-page.js";
import {
  nameColumn,
  textColumn,
  quantityColumn,
  moneyColumn,
  tagColumn,
  totalCell,
  countColumn,
} from "../_shared/cells.js";
import { formModal, selectField, value } from "../_shared/forms.js";
import { getValuation, compareCostingMethods } from "../../js/api/inventory.api.js";
import { getWarehouses, getItems, toOptions } from "../../js/api/lookups.api.js";

const METHODS = {
  fifo: { label: "FIFO", tone: "brand" },
  weighted_average: { label: "متوسط مرجح", tone: "info" },
};

export default async function valuationPage() {
  const [warehouses, items] = await Promise.all([
    getWarehouses(),
    getItems(),
  ]);

  const valuationData = await getValuation();

  return listPage({
    title: "تقييم المخزون",
    description: "حساب القيمة الإجمالية للمخزون السلعي وطبقات التكلفة المقارنة بين FIFO والمتوسط المرجّح.",
    tableId: "inv-valuation",
    searchPlaceholder: "بحث باسم الصنف أو الكود أو المخزن…",
    initialParams: { sort: "totalValue", order: "desc" },
    fetch: async (params) => {
      const res = await getValuation(params);
      const rows = res.rows ?? [];
      const search = (params.search ?? "").trim().toLowerCase();
      const filtered = rows.filter((r) => {
        if (search && !r.itemName?.toLowerCase().includes(search) && !r.itemCode?.toLowerCase().includes(search)) return false;
        if (params.warehouseId && String(r.warehouseId) !== String(params.warehouseId)) return false;
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

    actions: (context) => [
      button({
        label: "مقارنة طرق التقييم",
        variant: "primary",
        icon: "refresh",
        permission: "inv.valuation.view",
        onClick: () => openCompareModal(items, warehouses),
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
    ],

    before: async () => {
      if (!valuationData?.byWarehouse?.length) return null;

      return card({
        title: "توزيع قيمة المخزون عبر المستودعات",
        subtitle: "مطابقة رصيد كل مخزن مع الحسابات الرقابية",
        body: el(
          "div",
          { class: "grid grid-cols-1 md:grid-cols-3 gap-3" },
          ...valuationData.byWarehouse.map((w) =>
            el(
              "div",
              { class: "p-3 border border-line rounded-xl bg-subtle/50 flex flex-col justify-between" },
              el(
                "div",
                { class: "flex items-center justify-between" },
                el("span", { class: "font-semibold text-sm text-ink" }, w.warehouseName),
                badge(`${integer(w.items)} صنف`, { tone: "neutral", size: "sm" }),
              ),
              el(
                "div",
                { class: "mt-3 flex items-baseline justify-between" },
                el("span", { class: "text-xs text-muted" }, `${integer(w.quantity)} وحدة`),
                el("span", { class: "text-base font-bold tabular text-ink" }, amount(w.value)),
              ),
            ),
          ),
        ),
      });
    },

    columns: [
      nameColumn("itemName", "itemCode", "الصنف", { width: "16rem" }),
      textColumn("warehouseName", "المخزن", { width: "11rem" }),
      quantityColumn("quantity", "الرصيد الفعلي"),
      moneyColumn("averageCost", "متوسط التكلفة"),
      moneyColumn("totalValue", "القيمة الإجمالية"),
      tagColumn("method", "طريقة التقييم", METHODS, { width: "8.5rem" }),
      countColumn("layersCount", "طبقات التكلفة"),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 2 },
            { value: integer(rows.reduce((sum, r) => sum + (r.quantity ?? 0), 0)), numeric: true },
            { value: "", colspan: 1 },
            { value: totalCell(money.sumBy(rows, "totalValue")), numeric: true },
            { value: "", colspan: 2 },
          ]
        : null,

    onRowClick: (row) => navigate(`/inv/items/${row.itemId}`),

    rowActions: (row) =>
      buttonGroup(
        iconButton("eye", { label: "ملف الصنف", onClick: () => navigate(`/inv/items/${row.itemId}`) }),
      ),

    stats: async () => {
      const data = await getValuation();
      const totals = data.totals ?? {};

      return [
        statTile({
          label: "إجمالي قيمة المخزون",
          value: amount(totals.totalValue ?? 0),
          hint: "القيمة الدفترية الرسمية للمخزون",
          tone: "brand",
          icon: "money",
        }),
        statTile({
          label: "إجمالي الوحدات المخزنية",
          value: integer(totals.totalQuantity ?? 0),
          tone: "success",
          icon: "box",
        }),
        statTile({
          label: "عدد الأصناف المقيّمة",
          value: integer(totals.itemsCount ?? 0),
          tone: "neutral",
          icon: "inventory",
        }),
        statTile({
          label: "متوسط تكلفة الوحدة",
          value: amount(totals.averageCostPerUnit ?? 0),
          tone: "info",
          icon: "reports",
        }),
      ];
    },
  });
}

/* ========================================================================== */

function openCompareModal(items, warehouses) {
  let selectedItemId = items[0]?.id ?? 1;
  let selectedWarehouseId = warehouses[0]?.id ?? 1;
  let resultHost = el("div", { class: "mt-4" });

  async function updateComparison() {
    clear(resultHost);
    try {
      const cmp = await compareCostingMethods({
        itemId: selectedItemId,
        warehouseId: selectedWarehouseId,
      });

      resultHost.appendChild(
        el(
          "div",
          { class: "space-y-4" },
          el(
            "div",
            { class: "grid grid-cols-1 md:grid-cols-2 gap-4" },
            // FIFO Card
            el(
              "div",
              { class: "p-4 border-2 border-brand-500/30 rounded-xl bg-brand-50/10 space-y-2" },
              el("div", { class: "flex items-center justify-between font-bold text-brand-600" },
                el("span", {}, "الوارد أولاً صادر أولاً (FIFO)"),
                badge("الأحدث تكلفة", { tone: "brand", size: "sm" }),
              ),
              el("div", { class: "flex justify-between text-sm pt-2" },
                el("span", { class: "text-muted" }, "قيمة مخزون آخر المدة:"),
                el("span", { class: "font-bold tabular text-ink" }, amount(cmp.fifo.totalValue)),
              ),
              el("div", { class: "flex justify-between text-sm" },
                el("span", { class: "text-muted" }, "تكلفة المنصرف:"),
                el("span", { class: "tabular text-ink" }, amount(cmp.fifo.totalIssuedCost)),
              ),
              el("div", { class: "flex justify-between text-sm" },
                el("span", { class: "text-muted" }, "متوسط تكلفة الرصيد:"),
                el("span", { class: "tabular text-ink" }, amount(cmp.fifo.averageCost)),
              ),
              el("div", { class: "flex justify-between text-xs text-faint" },
                el("span", {}, "عدد طبقات التكلفة:"),
                el("span", { class: "tabular" }, integer(cmp.fifo.layers?.length ?? 0)),
              ),
            ),
            // Weighted Average Card
            el(
              "div",
              { class: "p-4 border border-line rounded-xl bg-subtle/40 space-y-2" },
              el("div", { class: "flex items-center justify-between font-bold text-ink" },
                el("span", {}, "المتوسط المرجّح"),
                badge("المتحرك", { tone: "info", size: "sm" }),
              ),
              el("div", { class: "flex justify-between text-sm pt-2" },
                el("span", { class: "text-muted" }, "قيمة مخزون آخر المدة:"),
                el("span", { class: "font-bold tabular text-ink" }, amount(cmp.weightedAverage.totalValue)),
              ),
              el("div", { class: "flex justify-between text-sm" },
                el("span", { class: "text-muted" }, "تكلفة المنصرف:"),
                el("span", { class: "tabular text-ink" }, amount(cmp.weightedAverage.totalIssuedCost)),
              ),
              el("div", { class: "flex justify-between text-sm" },
                el("span", { class: "text-muted" }, "متوسط تكلفة الرصيد:"),
                el("span", { class: "tabular text-ink" }, amount(cmp.weightedAverage.averageCost)),
              ),
            ),
          ),

          // Differences
          el(
            "div",
            { class: "p-3 bg-subtle border border-line rounded-xl flex items-center justify-between text-sm" },
            el("span", { class: "font-semibold text-muted" }, "الفارق الدفتري لقيمة المخزون (FIFO − المتوسط):"),
            el("span", { class: "font-bold text-base tabular text-brand-600" }, amount(cmp.difference.closingValue)),
          ),
        ),
      );
    } catch (err) {
      resultHost.appendChild(
        el("p", { class: "text-danger-400 text-sm p-3 bg-danger-50 rounded-xl" }, "تعذر جلب بيانات المقارنة لهذا الصنف والمخزن."),
      );
    }
  }

  formModal({
    title: "مقارنة طرق التقييم المخزني",
    subtitle: "مقارنة حية بالأرقام الفعلية بين أثر FIFO والمتوسط المرجح على تكلفة المنصرف وقيمة المخزون",
    size: "lg",
    submitLabel: "إغلاق",

    body: () => {
      const container = el(
        "div",
        { class: "space-y-4" },
        el(
          "div",
          { class: "grid grid-cols-1 md:grid-cols-2 gap-3.5" },
          selectField({
            label: "الصنف",
            value: String(selectedItemId),
            options: items.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` })),
            onChange: value((v) => {
              selectedItemId = Number(v);
              updateComparison();
            }),
          }),
          selectField({
            label: "المخزن",
            value: String(selectedWarehouseId),
            options: warehouses.map((w) => ({ value: w.id, label: w.name })),
            onChange: value((v) => {
              selectedWarehouseId = Number(v);
              updateComparison();
            }),
          }),
        ),
        resultHost,
      );

      setTimeout(() => updateComparison(), 50);
      return container;
    },

    onSubmit: () => {},
  });
}

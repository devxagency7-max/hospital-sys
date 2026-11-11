/**
 * تفاصيل جلسة الجرد المخزني والفروقات (Stock Count Detail).
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { openModal } from "../../components/common/modal.js";
import { amount, date, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { exportStyledExcel, printReport } from "../_shared/print.js";
import { getStockCount, startStockCount, closeStockCount } from "../../js/api/inventory.api.js";

export default async function countDetailPage(context) {
  const countId = context.params?.id;
  const count = await getStockCount(countId);
  const lines = count.lines || [];
  const totals = count.totals || {};

  const container = el("div", { class: "flex flex-col gap-6 p-4 md:p-6" });

  const topNav = el(
    "div",
    { class: "flex items-center justify-between flex-wrap gap-3" },
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap" },
      button({
        label: "العودة للجرد المخزني",
        variant: "ghost",
        icon: "chevronStart",
        onClick: () => navigate("/inv/counts"),
      }),
      el("span", { class: "text-muted" }, "/"),
      el("span", { class: "font-semibold text-ink" }, `جلسة جرد: ${count.countNumber || `#${count.id}`}`),
      badge(count.warehouseName || "المخزن الرئيسي", { tone: "info" }),
      badge(countStatusLabel(count.status), { tone: countStatusTone(count.status) }),
    ),
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap" },
      button({
        label: "تصدير ورقة الجرد Excel",
        variant: "secondary",
        icon: "download",
        onClick: () => exportCountExcel(count),
      }),
      button({
        label: "طباعة محضر الجرد (PDF)",
        variant: "primary",
        icon: "print",
        onClick: () => printCountPdf(count),
      }),
      count.status === "scheduled"
        ? button({
            label: "بدء الجرد وتجميد الرصيد",
            variant: "warning",
            icon: "play",
            onClick: async () => {
              if (!confirm("هل أنت متأكد من بدء الجرد وتجميد الأرصدة الدفترية لهذا المخزن؟")) return;
              try {
                await startStockCount(count.id);
                navigate(`/inv/counts/${count.id}`);
              } catch (err) {
                alert(`تعذر بدء الجرد: ${err.message || err}`);
              }
            },
          })
        : null,
      count.status === "in_progress"
        ? button({
            label: "إغلاق الجرد وترحيل التسويات",
            variant: "success",
            icon: "check",
            onClick: () => openCloseCountModal(count, () => navigate(`/inv/counts/${count.id}`)),
          })
        : null,
    ),
  );

  const stats = el(
    "div",
    { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" },
    statTile({
      title: "عدد الأصناف المجرودة",
      value: `${integer(totals.lines ?? lines.length)} صنف`,
      tone: "primary",
      icon: "layers",
      hint: count.warehouseName || "المخزن الرئيسي",
    }),
    statTile({
      title: "الأصناف ذات الفروقات",
      value: `${integer(totals.withVariance ?? lines.filter((l) => l.variance !== 0).length)} صنف`,
      tone: (totals.withVariance || 0) > 0 ? "warning" : "success",
      icon: "alertTriangle",
      hint: (totals.withVariance || 0) > 0 ? "يوجد عجز أو زيادة تتطلب تسوية" : "تطابق تام مع الدفاتر",
    }),
    statTile({
      title: "إجمالي كمية الفرق",
      value: `${integer(totals.varianceQuantity ?? 0)} وحدة`,
      tone: (totals.varianceQuantity ?? 0) < 0 ? "danger" : "neutral",
      icon: "shuffle",
      hint: (totals.varianceQuantity ?? 0) < 0 ? "صافي عجز بالكمية" : "صافي زيادة أو توازن",
    }),
    statTile({
      title: "القيمة المالية للفروقات",
      value: amount(totals.varianceValue ?? 0),
      tone: Number(totals.varianceValue ?? 0) < 0 ? "danger" : Number(totals.varianceValue ?? 0) > 0 ? "info" : "success",
      icon: "wallet",
      hint: count.status === "closed" ? "تم ترحيل قيد التسوية المخزنية" : "فروقات تقديرية قبل الإغلاق",
    }),
  );

  const infoSection = el(
    "div",
    { class: "rounded-xl border border-border bg-surface p-5 shadow-sm" },
    el("h2", { class: "text-base font-bold text-ink mb-4 pb-2 border-b border-border" }, "بيانات جلسة الجرد واللجنة"),
    el(
      "div",
      { class: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm" },
      infoBox("رقم الجلسة", count.countNumber || `#${count.id}`),
      infoBox("المستودع / المخزن", count.warehouseName || "—"),
      infoBox("تاريخ الجدولة", date(count.countDate)),
      infoBox("تاريخ البدء الفعلي", date(count.startDate)),
      infoBox("تاريخ الإغلاق", date(count.closedDate)),
      infoBox("مسؤول الجرد", count.createdBy || count.countManager || "أمين المخزن"),
      infoBox("حالة الجرد", countStatusLabel(count.status)),
      infoBox("ملاحظات الجرد", count.notes || "—"),
    ),
  );

  const linesSection = el(
    "div",
    { class: "rounded-xl border border-border bg-surface p-5 shadow-sm" },
    el(
      "div",
      { class: "flex items-center justify-between mb-4 pb-2 border-b border-border flex-wrap gap-2" },
      el("h2", { class: "text-base font-bold text-ink" }, "كشف بنود وأصناف الجرد"),
      el("span", { class: "text-xs text-muted" }, `إجمالي البنود: ${lines.length}`),
    ),
    el(
      "div",
      { class: "overflow-x-auto" },
      el(
        "table",
        { class: "w-full text-sm text-right border-collapse" },
        el(
          "thead",
          { class: "bg-surface-alt text-muted text-xs font-semibold border-b border-border" },
          el(
            "tr",
            {},
            el("th", { class: "p-3" }, "كود الصنف"),
            el("th", { class: "p-3" }, "اسم الصنف"),
            el("th", { class: "p-3" }, "الوحدة"),
            el("th", { class: "p-3 text-left" }, "الرصيد الدفتري"),
            el("th", { class: "p-3 text-left" }, "الرصيد الفعلي"),
            el("th", { class: "p-3 text-left font-bold" }, "الفرق (كمية)"),
            el("th", { class: "p-3 text-left" }, "متوسط التكلفة"),
            el("th", { class: "p-3 text-left font-bold" }, "قيمة الفرق"),
          ),
        ),
        el(
          "tbody",
          { class: "divide-y divide-border" },
          lines.length === 0
            ? el("tr", {}, el("td", { colspan: 8, class: "p-6 text-center text-muted" }, "لا توجد بنود في هذا الجرد"))
            : lines.map((line) => {
                const diff = Number(line.variance ?? 0);
                const diffTone = diff < 0 ? "text-danger" : diff > 0 ? "text-info" : "text-success";
                return el(
                  "tr",
                  { class: "hover:bg-surface-alt/50 transition-colors" },
                  el("td", { class: "p-3 font-semibold text-ink font-mono text-xs" }, line.itemCode || `#${line.itemId}`),
                  el("td", { class: "p-3 font-semibold text-ink" }, line.itemName),
                  el("td", { class: "p-3 text-muted text-xs" }, line.unit || "وحدة"),
                  el("td", { class: "p-3 text-left font-mono" }, integer(line.bookQuantity)),
                  el("td", { class: "p-3 text-left font-mono font-semibold" }, integer(line.countedQuantity)),
                  el(
                    "td",
                    { class: `p-3 text-left font-mono font-bold ${diffTone}` },
                    diff > 0 ? `+${diff}` : String(diff),
                  ),
                  el("td", { class: "p-3 text-left font-mono text-muted" }, amount(line.unitCost ?? 0)),
                  el(
                    "td",
                    { class: `p-3 text-left font-mono font-bold ${diffTone}` },
                    amount(line.varianceValue ?? (diff * Number(line.unitCost ?? 0))),
                  ),
                );
              }),
        ),
      ),
    ),
  );

  container.append(topNav, stats, infoSection, linesSection);
  return container;
}

function infoBox(label, value) {
  return el(
    "div",
    { class: "flex flex-col gap-1 p-2.5 rounded-lg bg-surface-alt/40 border border-border/50" },
    el("span", { class: "text-xs text-muted font-medium" }, label),
    el("span", { class: "text-sm text-ink font-semibold break-words" }, String(value ?? "—")),
  );
}

function countStatusLabel(status) {
  switch (status) {
    case "scheduled":
      return "مجدول — لم يبدأ بعد";
    case "in_progress":
      return "قيد التنفيذ الفعلي";
    case "closed":
      return "مغلق ومُسوّى دفتريًا";
    default:
      return status ?? "مجدول";
  }
}

function countStatusTone(status) {
  switch (status) {
    case "closed":
      return "success";
    case "in_progress":
      return "warning";
    default:
      return "neutral";
  }
}

function openCloseCountModal(count, onDone) {
  const reasonInput = el("input", {
    type: "text",
    class: "w-full p-2.5 rounded-lg border border-border bg-surface text-ink text-sm",
    value: "إغلاق الجرد الدوري السنوي واعتماد فروقات الجرد",
  });

  const form = el(
    "div",
    { class: "flex flex-col gap-4 text-sm" },
    el("p", { class: "text-muted" }, "سيتم إنشاء حركات تسوية مخزنية آلية لكل صنف يوجد به عجز أو زيادة، وترحيل القيد المحاسبي للفروقات إلى حساب أرباح/خسائر الجرد."),
    el(
      "div",
      { class: "flex flex-col gap-1" },
      el("label", { class: "font-semibold text-ink text-xs" }, "بيان الإغلاق والتسوية"),
      reasonInput,
    ),
  );

  const modal = openModal({
    title: `إغلاق محضر الجرد: ${count.countNumber || `#${count.id}`}`,
    content: form,
    actions: [
      button({ label: "إلغاء", variant: "ghost", onClick: () => modal.close() }),
      button({
        label: "تأكيد الإغلاق والتسوية الدفترية",
        variant: "success",
        onClick: async () => {
          try {
            await closeStockCount(count.id, {
              notes: reasonInput.value,
              closedDate: new Date().toISOString().slice(0, 10),
            });
            modal.close();
            if (onDone) onDone();
          } catch (err) {
            alert(`تعذر إغلاق الجرد: ${err.message || err}`);
          }
        },
      }),
    ],
  });
}

function exportCountExcel(count) {
  const columns = [
    { key: "code", label: "كود الصنف", width: 14 },
    { key: "name", label: "اسم الصنف", width: 30 },
    { key: "unit", label: "الوحدة", width: 12 },
    { key: "book", label: "الرصيد الدفتري", width: 16 },
    { key: "counted", label: "الرصيد الفعلي", width: 16 },
    { key: "variance", label: "فرق الكمية", width: 16 },
    { key: "cost", label: "متوسط التكلفة", width: 16 },
    { key: "varianceVal", label: "قيمة الفرق", width: 18 },
  ];

  const rows = (count.lines || []).map((l) => ({
    code: l.itemCode || `#${l.itemId}`,
    name: l.itemName,
    unit: l.unit || "وحدة",
    book: l.bookQuantity,
    counted: l.countedQuantity,
    variance: l.variance,
    cost: l.unitCost ?? 0,
    varianceVal: l.varianceValue ?? 0,
  }));

  exportStyledExcel({
    reportTitle: `محضر جرد مخزني: ${count.countNumber || `#${count.id}`} — ${count.warehouseName || "المخزن الرئيسي"}`,
    sourceName: "إدارة المخازن والمستودعات الطبية",
    columns,
    rows,
    metaInfo: [
      { label: "رقم الجرد", value: count.countNumber || `#${count.id}` },
      { label: "المخزن", value: count.warehouseName || "المخزن الرئيسي" },
      { label: "تاريخ الجرد", value: date(count.countDate) },
      { label: "الحالة", value: countStatusLabel(count.status) },
      { label: "إجمالي الأصناف", value: integer(count.lines?.length ?? 0) },
      { label: "قيمة الفروقات", value: amount(count.totals?.varianceValue ?? 0) },
    ],
    filename: `Stock_Count_${count.countNumber || count.id}`,
  });
}

function printCountPdf(count) {
  const content = el("div", { class: "p-4 space-y-4" },
    el("div", { class: "grid grid-cols-4 gap-3 p-3 bg-gray-50 border rounded text-xs mb-4" },
      el("div", {}, `رقم الجلسة: ${count.countNumber || `#${count.id}`}`),
      el("div", {}, `المخزن: ${count.warehouseName || "المخزن الرئيسي"}`),
      el("div", {}, `تاريخ الجرد: ${date(count.countDate)}`),
      el("div", {}, `الحالة: ${countStatusLabel(count.status)}`),
      el("div", {}, `عدد الأصناف: ${integer(count.lines?.length ?? 0)}`),
      el("div", {}, `أصناف بها فروقات: ${integer(count.totals?.withVariance ?? 0)}`),
      el("div", { class: "col-span-2 font-bold text-blue-700" }, `إجمالي قيمة الفروقات: ${amount(count.totals?.varianceValue ?? 0)}`),
    ),
    el("table", { class: "w-full text-xs text-right border-collapse border" },
      el("thead", { class: "bg-gray-100 font-bold border-b" },
        el("tr", {},
          el("th", { class: "p-2 border" }, "كود الصنف"),
          el("th", { class: "p-2 border" }, "اسم الصنف"),
          el("th", { class: "p-2 border" }, "الوحدة"),
          el("th", { class: "p-2 border text-left" }, "الدفتري"),
          el("th", { class: "p-2 border text-left" }, "الفعلي"),
          el("th", { class: "p-2 border text-left" }, "فرق الكمية"),
          el("th", { class: "p-2 border text-left font-bold" }, "قيمة الفرق"),
        )
      ),
      el("tbody", {},
        (count.lines || []).map((l) =>
          el("tr", { class: "border-b" },
            el("td", { class: "p-2 border font-mono" }, l.itemCode || `#${l.itemId}`),
            el("td", { class: "p-2 border font-semibold" }, l.itemName),
            el("td", { class: "p-2 border text-gray-600" }, l.unit || "وحدة"),
            el("td", { class: "p-2 border text-left font-mono" }, integer(l.bookQuantity)),
            el("td", { class: "p-2 border text-left font-mono" }, integer(l.countedQuantity)),
            el("td", { class: `p-2 border text-left font-mono font-bold ${l.variance < 0 ? "text-red-600" : l.variance > 0 ? "text-blue-600" : "text-green-600"}` },
              l.variance > 0 ? `+${l.variance}` : String(l.variance)
            ),
            el("td", { class: "p-2 border text-left font-mono font-bold" }, amount(l.varianceValue ?? 0)),
          )
        )
      )
    )
  );

  printReport({
    title: `محضر جرد المستودع — ${count.warehouseName || "المخزن الرئيسي"} (${count.countNumber || count.id})`,
    sourceName: "إدارة المخازن والمستلزمات الطبية",
    content,
  });
}

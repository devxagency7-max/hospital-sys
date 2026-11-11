/**
 * ملف الصنف بالمخازن (Inventory Item Detail & Stock Card).
 *
 * كارت الصنف الكامل: الأرصدة في كل مخزن وصيدلية، أسعار الشراء والبيع للمريض،
 * التشغيلات وتواريخ الصلاحية، وسجل حركات الصرف والإضافة.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, date, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { exportStyledExcel, printReport } from "../_shared/print.js";
import { getItem } from "../../js/api/inventory.api.js";
import { can } from "../../js/core/permissions.js";

const MOVEMENT_TYPE_MAP = {
  receipt: { label: "إذن إضافة", tone: "success" },
  issue: { label: "إذن صرف", tone: "warning" },
  transfer: { label: "تحويل مخزني", tone: "info" },
  opening: { label: "رصيد افتتاحي", tone: "brand" },
  adjustment: { label: "تسوية مخزنية", tone: "neutral" },
};

export default async function itemDetailPage(context) {
  const itemId = context.params?.id;
  const item = await getItem(itemId);

  const container = el("div", { class: "flex flex-col gap-6 p-4 md:p-6" });

  // 1. شريط التنقل العلوي والأزرار
  const topNav = el(
    "div",
    { class: "flex items-center justify-between flex-wrap gap-3" },
    el(
      "div",
      { class: "flex items-center gap-2" },
      button({
        label: "العودة لسجل الأصناف",
        variant: "ghost",
        icon: "chevronStart",
        onClick: () => navigate("/inv/items"),
      }),
      el("span", { class: "text-muted" }, "/"),
      el("span", { class: "font-semibold text-ink" }, `صنف: ${item.name}`),
      badge(item.categoryName || "صنف طبي", { tone: "brand" }),
    ),
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap" },
      button({
        label: "تصدير كارت الصنف Excel",
        variant: "secondary",
        icon: "download",
        onClick: () => exportItemExcel(item),
      }),
      button({
        label: "طباعة كارت الصنف (PDF)",
        variant: "primary",
        icon: "print",
        onClick: () => printItemPdf(item),
      }),
      can("pricing.manage")
        ? button({
            label: "مراجعة واعتماد سعر البيع",
            variant: "secondary",
            icon: "check",
            onClick: () => navigate("/inv/price-reviews"),
          })
        : null,
    ),
  );

  // 2. بطاقة الصنف التعريفية الرئيسية (Hero Item Card)
  const heroCard = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm" },
    el(
      "div",
      { class: "flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-subtle pb-4 mb-4" },
      el(
        "div",
        { class: "flex items-center gap-4" },
        el(
          "div",
          {
            class: "w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-sm",
            style: "background: linear-gradient(135deg, #1e3a8a, #0284c7);",
          },
          "💊",
        ),
        el(
          "div",
          { class: "flex flex-col" },
          el("h2", { class: "text-lg font-bold text-ink" }, item.name),
          el(
            "div",
            { class: "flex items-center gap-2 mt-1 text-xs text-muted" },
            el("span", { class: "font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded" }, item.code),
            el("span", {}, "·"),
            el("span", {}, `الوحدة: ${item.unitName || "وحدة"}`),
            el("span", {}, "·"),
            el("span", {}, `طريقة التقييم: ${item.costingMethod === "lifo" ? "الوارد أخيرًا صادر أولاً" : "الوارد أولاً صادر أولاً (FIFO)"}`),
          ),
        ),
      ),
      el(
        "div",
        { class: "flex items-center gap-3 flex-wrap" },
        badge(item.status === "active" ? "صنف نشط" : "معطل", {
          tone: item.status === "active" ? "success" : "danger",
        }),
        badge(`حد إعادة الطلب: ${integer(item.reorderPoint || 0)}`, { tone: "warning" }),
      ),
    ),
    el(
      "div",
      { class: "grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs" },
      infoBox("متوسط تكلفة الشراء", amount(item.averageCost || item.purchasePrice || 0), "text-ink"),
      infoBox("سعر البيع للمريض", amount(item.salePrice || 0), "text-brand-700 dark:text-brand-400 font-bold"),
      infoBox("هامش الربح المعتمد", `${item.marginPct ?? 25}%`, "text-success-700 dark:text-success-400 font-bold"),
      infoBox("الحد الأدنى للأمان", `${integer(item.minLevel || 0)} ${item.unitName || ""}`, "text-muted"),
    ),
  );

  // 3. بطاقات المؤشرات (Stat Cards)
  const totalQty = (item.balances || []).reduce((sum, b) => sum + (b.onHand || 0), 0);
  const totalVal = (item.balances || []).reduce((sum, b) => sum + (b.value || 0), 0);

  const statsSection = el(
    "div",
    { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" },
    statTile({
      label: "إجمالي الرصيد بالمخازن",
      value: `${integer(totalQty)} ${item.unitName || ""}`,
      tone: totalQty > (item.reorderPoint || 0) ? "brand" : "danger",
      icon: "inventory",
    }),
    statTile({
      label: "إجمالي القيمة المخزنية",
      value: amount(totalVal),
      tone: "info",
      icon: "money",
    }),
    statTile({
      label: "عدد التشغيلات المتاحة",
      value: integer((item.batches || []).length),
      tone: "purple",
      icon: "activity",
    }),
    statTile({
      label: "المخازن والصيدليات المتوفر بها",
      value: `${(item.balances || []).filter((b) => b.onHand > 0).length} موقع`,
      tone: "success",
      icon: "hospital",
    }),
  );

  // 4. جدول الأرصدة في المخازن والصيدليات
  const balancesCard = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm overflow-hidden flex flex-col gap-3" },
    el(
      "div",
      { class: "flex items-center justify-between" },
      el("h3", { class: "text-sm font-bold text-ink" }, "الأرصدة الحالية بحسب المخزن والصيدلية"),
      badge(`إجمالي المواقع: ${(item.balances || []).length}`, { tone: "brand" }),
    ),
    renderBalancesTable(item.balances || [], item.unitName),
  );

  // 5. جدول التشغيلات وتواريخ الصلاحية (Batches & Expiry)
  const batchesCard = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm overflow-hidden flex flex-col gap-3" },
    el(
      "div",
      { class: "flex items-center justify-between" },
      el("h3", { class: "text-sm font-bold text-ink" }, "سجل التشغيلات وتواريخ الصلاحية (Batches)"),
      badge(`عدد التشغيلات: ${(item.batches || []).length}`, { tone: "purple" }),
    ),
    renderBatchesTable(item.batches || [], item.unitName),
  );

  // 6. حركات المخزون الأخيرة (Movements)
  const movementsCard = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm overflow-hidden flex flex-col gap-3" },
    el(
      "div",
      { class: "flex items-center justify-between" },
      el("h3", { class: "text-sm font-bold text-ink" }, "سجل حركات الصرف والإضافة الأخيرة"),
      badge(`آخر ${(item.movements || []).length} حركة`, { tone: "info" }),
    ),
    renderMovementsTable(item.movements || [], item.unitName),
  );

  container.append(topNav, heroCard, statsSection, balancesCard, batchesCard, movementsCard);
  return container;
}

function infoBox(label, valText, extraClass = "") {
  return el(
    "div",
    { class: "flex flex-col gap-1 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-subtle" },
    el("span", { class: "text-muted text-[11px]" }, label),
    el("span", { class: `font-semibold text-sm ${extraClass}` }, valText),
  );
}

function renderBalancesTable(balances, unitName) {
  const table = el("table", { class: "w-full border-collapse text-right text-xs" });

  const thead = el(
    "thead",
    {},
    el(
      "tr",
      { class: "border-b border-subtle bg-slate-50 dark:bg-slate-800/40 text-muted" },
      el("th", { class: "p-3 font-semibold" }, "المستودع / الصيدلية"),
      el("th", { class: "p-3 font-semibold text-center w-28" }, "الرصيد الفعلي"),
      el("th", { class: "p-3 font-semibold text-center w-28" }, "المحجوز"),
      el("th", { class: "p-3 font-semibold text-center w-28" }, "المتاح للصرف"),
      el("th", { class: "p-3 font-semibold text-left w-36" }, "متوسط التكلفة"),
      el("th", { class: "p-3 font-semibold text-left w-36" }, "القيمة الإجمالية"),
    ),
  );

  const tbody = el("tbody", {});
  if (!balances.length) {
    tbody.appendChild(
      el("tr", {}, el("td", { colspan: 6, class: "p-6 text-center text-muted" }, "لا توجد أرصدة مسجلة في أي مخزن.")),
    );
  } else {
    balances.forEach((b) => {
      tbody.appendChild(
        el(
          "tr",
          { class: "border-b border-subtle hover:bg-slate-50/50 dark:hover:bg-slate-800/20" },
          el("td", { class: "p-3 font-semibold text-ink" }, b.warehouseName),
          el("td", { class: "p-3 text-center font-bold text-ink" }, `${integer(b.onHand || 0)} ${unitName || ""}`),
          el("td", { class: "p-3 text-center text-muted" }, `${integer(b.reserved || 0)}`),
          el("td", { class: "p-3 text-center font-bold text-success-600" }, `${integer(b.available || 0)}`),
          el("td", { class: "p-3 text-left font-mono" }, amount(b.averageCost || 0)),
          el("td", { class: "p-3 text-left font-mono font-bold text-ink" }, amount(b.value || 0)),
        ),
      );
    });
  }

  table.append(thead, tbody);
  return el("div", { class: "overflow-x-auto" }, table);
}

function renderBatchesTable(batches, unitName) {
  const table = el("table", { class: "w-full border-collapse text-right text-xs" });

  const thead = el(
    "thead",
    {},
    el(
      "tr",
      { class: "border-b border-subtle bg-slate-50 dark:bg-slate-800/40 text-muted" },
      el("th", { class: "p-3 font-semibold text-center w-36" }, "رقم التشغيلة (Batch)"),
      el("th", { class: "p-3 font-semibold" }, "المخزن الموجود به"),
      el("th", { class: "p-3 font-semibold text-center w-32" }, "تاريخ الاستلام"),
      el("th", { class: "p-3 font-semibold text-center w-32" }, "تاريخ الصلاحية"),
      el("th", { class: "p-3 font-semibold text-center w-28" }, "الكمية المتبقية"),
      el("th", { class: "p-3 font-semibold text-left w-32" }, "تكلفة الوحدة"),
      el("th", { class: "p-3 font-semibold text-left w-32" }, "القيمة الإجمالية"),
    ),
  );

  const tbody = el("tbody", {});
  if (!batches.length) {
    tbody.appendChild(
      el("tr", {}, el("td", { colspan: 7, class: "p-6 text-center text-muted" }, "لا توجد تشغيلات مسجلة لهذا الصنف.")),
    );
  } else {
    batches.forEach((b) => {
      tbody.appendChild(
        el(
          "tr",
          { class: "border-b border-subtle hover:bg-slate-50/50 dark:hover:bg-slate-800/20" },
          el("td", { class: "p-3 text-center font-mono font-bold text-ink" }, b.batchNumber),
          el("td", { class: "p-3 text-muted" }, b.warehouseName),
          el("td", { class: "p-3 text-center text-muted" }, b.receivedDate ? date(b.receivedDate) : "—"),
          el(
            "td",
            { class: "p-3 text-center" },
            b.expiryDate
              ? badge(date(b.expiryDate), { tone: new Date(b.expiryDate) < new Date() ? "danger" : "warning" })
              : el("span", { class: "text-muted" }, "غير محدد"),
          ),
          el("td", { class: "p-3 text-center font-bold text-ink" }, `${integer(b.quantity || 0)} ${unitName || ""}`),
          el("td", { class: "p-3 text-left font-mono" }, amount(b.unitCost || 0)),
          el("td", { class: "p-3 text-left font-mono font-bold text-ink" }, amount(b.value || 0)),
        ),
      );
    });
  }

  table.append(thead, tbody);
  return el("div", { class: "overflow-x-auto" }, table);
}

function renderMovementsTable(movements, unitName) {
  const table = el("table", { class: "w-full border-collapse text-right text-xs" });

  const thead = el(
    "thead",
    {},
    el(
      "tr",
      { class: "border-b border-subtle bg-slate-50 dark:bg-slate-800/40 text-muted" },
      el("th", { class: "p-3 font-semibold text-center w-28" }, "التاريخ"),
      el("th", { class: "p-3 font-semibold text-center w-28" }, "نوع الحركة"),
      el("th", { class: "p-3 font-semibold text-center w-36" }, "المرجع / المستند"),
      el("th", { class: "p-3 font-semibold" }, "الموقع / المخزن"),
      el("th", { class: "p-3 font-semibold text-center w-28" }, "الكمية"),
      el("th", { class: "p-3 font-semibold text-left w-32" }, "سعر الوحدة"),
      el("th", { class: "p-3 font-semibold w-40" }, "القائم بالحركة"),
    ),
  );

  const tbody = el("tbody", {});
  if (!movements.length) {
    tbody.appendChild(
      el("tr", {}, el("td", { colspan: 7, class: "p-6 text-center text-muted" }, "لا توجد حركات سابقة لهذا الصنف.")),
    );
  } else {
    movements.forEach((m) => {
      const typeInfo = MOVEMENT_TYPE_MAP[m.type] || { label: m.typeLabel || m.type, tone: "neutral" };
      tbody.appendChild(
        el(
          "tr",
          { class: "border-b border-subtle hover:bg-slate-50/50 dark:hover:bg-slate-800/20" },
          el("td", { class: "p-3 text-center text-muted" }, date(m.date)),
          el("td", { class: "p-3 text-center" }, badge(typeInfo.label, { tone: typeInfo.tone, size: "sm" })),
          el("td", { class: "p-3 text-center font-mono font-bold text-ink" }, m.reference || "—"),
          el("td", { class: "p-3 text-muted" }, m.warehouseName || "—"),
          el("td", { class: "p-3 text-center font-bold text-ink" }, `${integer(m.quantity || 0)} ${unitName || ""}`),
          el("td", { class: "p-3 text-left font-mono" }, m.unitCost ? amount(m.unitCost) : "—"),
          el("td", { class: "p-3 text-muted" }, m.performedBy || "—"),
        ),
      );
    });
  }

  table.append(thead, tbody);
  return el("div", { class: "overflow-x-auto" }, table);
}

function exportItemExcel(item) {
  const headers = [
    { label: "المستودع / الصيدلية", align: "right" },
    { label: "الرصيد الفعلي", align: "center" },
    { label: "المحجوز", align: "center" },
    { label: "المتاح للصرف", align: "center" },
    { label: "متوسط التكلفة", align: "left" },
    { label: "إجمالي القيمة (ج.م)", align: "left" },
  ];

  const rows = (item.balances || []).map((b) => [
    b.warehouseName,
    b.onHand || 0,
    b.reserved || 0,
    b.available || 0,
    b.averageCost || 0,
    b.value || 0,
  ]);

  const totalVal = (item.balances || []).reduce((sum, b) => sum + (b.value || 0), 0);
  const totalQty = (item.balances || []).reduce((sum, b) => sum + (b.onHand || 0), 0);
  const totals = ["الإجمالي العام", totalQty, "—", "—", "—", totalVal];

  exportStyledExcel({
    title: `كارت صنف مخزني — ${item.name}`,
    period: `كود الصنف: ${item.code} · التصنيف: ${item.categoryName || ""}`,
    headers,
    rows,
    totals,
  });
}

function printItemPdf(item) {
  const headers = [
    { label: "الموقع / المستودع", align: "right" },
    { label: "الرصيد", align: "center" },
    { label: "المتاح", align: "center" },
    { label: "متوسط التكلفة", align: "left" },
    { label: "إجمالي القيمة", align: "left" },
  ];

  const rows = (item.balances || []).map((b) => [
    b.warehouseName,
    integer(b.onHand || 0),
    integer(b.available || 0),
    amount(b.averageCost || 0),
    amount(b.value || 0),
  ]);

  const totalVal = (item.balances || []).reduce((sum, b) => sum + (b.value || 0), 0);
  const totals = ["الإجمالي", "—", "—", "—", amount(totalVal)];

  printReport({
    title: `كارت صنف مخزني — ${item.name}`,
    subtitle: `كود: ${item.code} · سعر البيع للمريض: ${amount(item.salePrice || 0)}`,
    period: `الوحدة: ${item.unitName || ""} · حد الطلب: ${integer(item.reorderPoint || 0)}`,
    headers,
    rows,
    totals,
    signatures: ["أمين المخزن", "رئيس قسم الصيدلية", "الاعتماد المالي"],
  });
}

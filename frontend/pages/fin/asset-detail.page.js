/**
 * بطاقة وسجل الأصل الثابت وإهلاكه (Fixed Asset Card).
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { openModal } from "../../components/common/modal.js";
import { amount, date, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { exportStyledExcel, printReport } from "../_shared/print.js";
import { getAsset, disposeAsset } from "../../js/api/finance.api.js";

export default async function assetDetailPage(context) {
  const assetId = context.params?.id;
  const asset = await getAsset(assetId);

  const container = el("div", { class: "flex flex-col gap-6 p-4 md:p-6" });

  const topNav = el(
    "div",
    { class: "flex items-center justify-between flex-wrap gap-3" },
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap" },
      button({
        label: "العودة للأصول الثابتة",
        variant: "ghost",
        icon: "chevronStart",
        onClick: () => navigate("/fin/assets"),
      }),
      el("span", { class: "text-muted" }, "/"),
      el("span", { class: "font-semibold text-ink" }, `${asset.name} (${asset.code})`),
      badge(statusLabel(asset.status), { tone: statusTone(asset.status) }),
      badge(asset.categoryName || "أصل ثابت", { tone: "info" }),
    ),
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap" },
      button({
        label: "تصدير بطاقة الأصل Excel",
        variant: "secondary",
        icon: "download",
        onClick: () => exportAssetExcel(asset),
      }),
      button({
        label: "طباعة بطاقة الأصل (PDF)",
        variant: "primary",
        icon: "print",
        onClick: () => printAssetPdf(asset),
      }),
      asset.status !== "disposed"
        ? button({
            label: "استبعاد / تخريد الأصل",
            variant: "danger",
            icon: "trash",
            onClick: () => openDisposeModal(asset, () => navigate(`/fin/assets/${asset.id}`)),
          })
        : null,
    ),
  );

  const cost = Number(asset.acquisitionCost ?? asset.cost ?? 0);
  const accDep = Number(asset.accumulatedDepreciation ?? asset.accumulated ?? 0);
  const nbv = Number(asset.netBookValue ?? (cost - accDep));
  const salvage = Number(asset.salvageValue ?? 0);

  const stats = el(
    "div",
    { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" },
    statTile({
      title: "تكلفة الاقتناء",
      value: amount(cost),
      tone: "primary",
      icon: "tag",
      hint: `تاريخ الشراء: ${date(asset.purchaseDate ?? asset.acquisitionDate)}`,
    }),
    statTile({
      title: "مجمع الإهلاك",
      value: amount(accDep),
      tone: "warning",
      icon: "trendingDown",
      hint: `القيمة التخريدية: ${amount(salvage)}`,
    }),
    statTile({
      title: "صافي القيمة الدفترية",
      value: amount(nbv),
      tone: "success",
      icon: "wallet",
      hint: `${Math.round(cost > 0 ? (nbv / cost) * 100 : 0)}% من التكلفة الأصلية`,
    }),
    statTile({
      title: "العمر الإنتاجي والطريقة",
      value: `${asset.usefulLifeYears ?? 5} سنوات`,
      tone: "neutral",
      icon: "clock",
      hint: asset.methodLabel || "القسط الثابت",
    }),
  );

  const infoSection = el(
    "div",
    { class: "rounded-xl border border-border bg-surface p-5 shadow-sm" },
    el("h2", { class: "text-base font-bold text-ink mb-4 pb-2 border-b border-border" }, "بيانات الأصل والموقع"),
    el(
      "div",
      { class: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm" },
      infoItem("كود الأصل", asset.code),
      infoItem("اسم الأصل", asset.name),
      infoItem("الفئة", asset.categoryName || "—"),
      infoItem("الرقم التسلسلي", asset.serialNumber || "—"),
      infoItem("الموقع / القسم", asset.location || "المبنى الرئيسي"),
      infoItem("مركز التكلفة", asset.costCenterId ? `مركز #${asset.costCenterId}` : "عام المستشفى"),
      infoItem("طريقة الإهلاك", asset.methodLabel || "القسط الثابت"),
      infoItem("تاريخ الشراء", date(asset.purchaseDate ?? asset.acquisitionDate)),
      infoItem("تكلفة الأصل", amount(cost)),
      infoItem("القيمة التخريدية", amount(salvage)),
      infoItem("حساب الأصل (GL)", asset.assetAccountId ? `#${asset.assetAccountId}` : "—"),
      infoItem("حساب مجمع الإهلاك (GL)", asset.accumulatedAccountId ? `#${asset.accumulatedAccountId}` : "—"),
    ),
  );

  let disposalBanner = null;
  if (asset.status === "disposed") {
    disposalBanner = el(
      "div",
      { class: "rounded-xl border border-danger/30 bg-danger/5 p-4 flex items-center justify-between flex-wrap gap-3" },
      el(
        "div",
        { class: "flex items-center gap-3" },
        el("span", { class: "text-danger font-bold text-lg" }, "⚠️"),
        el(
          "div",
          {},
          el("div", { class: "font-bold text-danger text-sm" }, "تم استبعاد / تخريد هذا الأصل من السجلات"),
          el(
            "div",
            { class: "text-xs text-muted mt-0.5" },
            `تاريخ الاستبعاد: ${date(asset.disposalDate)} | عائد البيع: ${amount(asset.disposalProceeds ?? 0)}`,
          ),
        ),
      ),
      badge("مستبعد", { tone: "danger" }),
    );
  }

  const scheduleRows = asset.schedule || [];
  const scheduleSection = el(
    "div",
    { class: "rounded-xl border border-border bg-surface p-5 shadow-sm" },
    el(
      "div",
      { class: "flex items-center justify-between mb-4 pb-2 border-b border-border flex-wrap gap-2" },
      el("h2", { class: "text-base font-bold text-ink" }, "جدول الإهلاك (Depreciation Schedule)"),
      el("span", { class: "text-xs text-muted" }, `إجمالي الفترات المجدولة: ${scheduleRows.length}`),
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
            el("th", { class: "p-3" }, "الفترة"),
            el("th", { class: "p-3" }, "التاريخ"),
            el("th", { class: "p-3 text-left" }, "رصيد أول المدة"),
            el("th", { class: "p-3 text-left" }, "قسط الإهلاك"),
            el("th", { class: "p-3 text-left" }, "مجمع الإهلاك"),
            el("th", { class: "p-3 text-left font-bold" }, "رصيد آخر المدة"),
          ),
        ),
        el(
          "tbody",
          { class: "divide-y divide-border" },
          scheduleRows.length === 0
            ? el("tr", {}, el("td", { colspan: 6, class: "p-6 text-center text-muted" }, "لا يوجد جدول إهلاك مسجل"))
            : scheduleRows.slice(0, 36).map((s) =>
                el(
                  "tr",
                  { class: "hover:bg-surface-alt/50 transition-colors" },
                  el("td", { class: "p-3 font-semibold text-ink" }, `#${s.period}`),
                  el("td", { class: "p-3 text-muted" }, date(s.date)),
                  el("td", { class: "p-3 text-left font-mono" }, amount(s.opening)),
                  el("td", { class: "p-3 text-left font-mono text-warning font-semibold" }, amount(s.depreciation)),
                  el("td", { class: "p-3 text-left font-mono text-muted" }, amount(s.accumulated)),
                  el("td", { class: "p-3 text-left font-mono font-bold text-success" }, amount(s.closing)),
                ),
              ),
        ),
      ),
    ),
  );

  container.append(topNav, stats, disposalBanner, infoSection, scheduleSection);
  return container;
}

function infoItem(label, value) {
  return el(
    "div",
    { class: "flex flex-col gap-1 p-2.5 rounded-lg bg-surface-alt/40 border border-border/50" },
    el("span", { class: "text-xs text-muted font-medium" }, label),
    el("span", { class: "text-sm text-ink font-semibold break-words" }, String(value ?? "—")),
  );
}

function statusLabel(status) {
  switch (status) {
    case "active":
      return "نشط وقيد التشغيل";
    case "disposed":
      return "مستبعد / مُخرَّد";
    case "depreciated":
      return "مُهلك بالكامل";
    default:
      return status ?? "نشط";
  }
}

function statusTone(status) {
  switch (status) {
    case "active":
      return "success";
    case "disposed":
      return "danger";
    case "depreciated":
      return "warning";
    default:
      return "neutral";
  }
}

function openDisposeModal(asset, onDone) {
  const proceedsInput = el("input", {
    type: "number",
    class: "w-full p-2.5 rounded-lg border border-border bg-surface text-ink text-sm",
    placeholder: "0.00",
    value: "0",
  });
  const reasonInput = el("input", {
    type: "text",
    class: "w-full p-2.5 rounded-lg border border-border bg-surface text-ink text-sm",
    placeholder: "مثال: بيع خردة / عدم الجدوى الاقتصادية",
    value: "بيع خردة",
  });

  const form = el(
    "div",
    { class: "flex flex-col gap-4 text-sm" },
    el("p", { class: "text-muted" }, "سيتم إيقاف إهلاك الأصل وترحيل قيد الأرباح/الخسائر الرأسمالية الناتج عن الاستبعاد."),
    el(
      "div",
      { class: "flex flex-col gap-1" },
      el("label", { class: "font-semibold text-ink text-xs" }, "عائد الاستبعاد / البيع (جنيه)"),
      proceedsInput,
    ),
    el(
      "div",
      { class: "flex flex-col gap-1" },
      el("label", { class: "font-semibold text-ink text-xs" }, "سبب الاستبعاد"),
      reasonInput,
    ),
  );

  const modal = openModal({
    title: `استبعاد الأصل: ${asset.name} (${asset.code})`,
    content: form,
    actions: [
      button({ label: "إلغاء", variant: "ghost", onClick: () => modal.close() }),
      button({
        label: "تأكيد الاستبعاد",
        variant: "danger",
        onClick: async () => {
          try {
            await disposeAsset(asset.id, {
              proceeds: Number(proceedsInput.value || 0),
              reason: reasonInput.value,
              date: new Date().toISOString().slice(0, 10),
            });
            modal.close();
            if (onDone) onDone();
          } catch (err) {
            alert(`تعذر الاستبعاد: ${err.message || err}`);
          }
        },
      }),
    ],
  });
}

function exportAssetExcel(asset) {
  const cost = Number(asset.acquisitionCost ?? asset.cost ?? 0);
  const accDep = Number(asset.accumulatedDepreciation ?? asset.accumulated ?? 0);
  const nbv = Number(asset.netBookValue ?? (cost - accDep));

  const columns = [
    { key: "period", label: "الفترة", width: 12 },
    { key: "date", label: "التاريخ", width: 15 },
    { key: "opening", label: "رصيد أول المدة", width: 18 },
    { key: "depreciation", label: "قسط الإهلاك", width: 18 },
    { key: "accumulated", label: "مجمع الإهلاك", width: 18 },
    { key: "closing", label: "رصيد آخر المدة", width: 18 },
  ];

  const rows = (asset.schedule || []).map((s) => ({
    period: `#${s.period}`,
    date: date(s.date),
    opening: s.opening,
    depreciation: s.depreciation,
    accumulated: s.accumulated,
    closing: s.closing,
  }));

  exportStyledExcel({
    reportTitle: `بطاقة أصل ثابت: ${asset.name} (${asset.code})`,
    sourceName: "سجل الأصول الثابتة والإهلاك",
    columns,
    rows,
    metaInfo: [
      { label: "كود الأصل", value: asset.code },
      { label: "الفئة", value: asset.categoryName || "أصل ثابت" },
      { label: "الموقع", value: asset.location || "المبنى الرئيسي" },
      { label: "التكلفة التاريخية", value: amount(cost) },
      { label: "مجمع الإهلاك", value: amount(accDep) },
      { label: "صافي القيمة الدفترية", value: amount(nbv) },
    ],
    filename: `Asset_${asset.code}_Schedule`,
  });
}

function printAssetPdf(asset) {
  const cost = Number(asset.acquisitionCost ?? asset.cost ?? 0);
  const accDep = Number(asset.accumulatedDepreciation ?? asset.accumulated ?? 0);
  const nbv = Number(asset.netBookValue ?? (cost - accDep));

  const content = el("div", { class: "p-4 space-y-4" },
    el("div", { class: "grid grid-cols-3 gap-3 p-3 bg-gray-50 border rounded text-xs mb-4" },
      el("div", {}, `كود الأصل: ${asset.code}`),
      el("div", {}, `اسم الأصل: ${asset.name}`),
      el("div", {}, `الفئة: ${asset.categoryName || "—"}`),
      el("div", {}, `تاريخ الشراء: ${date(asset.purchaseDate ?? asset.acquisitionDate)}`),
      el("div", {}, `التكلفة: ${amount(cost)}`),
      el("div", {}, `صافي القيمة الدفترية: ${amount(nbv)}`),
    ),
    el("table", { class: "w-full text-xs text-right border-collapse border" },
      el("thead", { class: "bg-gray-100 font-bold border-b" },
        el("tr", {},
          el("th", { class: "p-2 border" }, "الفترة"),
          el("th", { class: "p-2 border" }, "التاريخ"),
          el("th", { class: "p-2 border text-left" }, "رصيد أول المدة"),
          el("th", { class: "p-2 border text-left" }, "قسط الإهلاك"),
          el("th", { class: "p-2 border text-left" }, "مجمع الإهلاك"),
          el("th", { class: "p-2 border text-left" }, "صافي القيمة الدفترية"),
        )
      ),
      el("tbody", {},
        (asset.schedule || []).slice(0, 36).map((s) =>
          el("tr", { class: "border-b" },
            el("td", { class: "p-2 border" }, `#${s.period}`),
            el("td", { class: "p-2 border" }, date(s.date)),
            el("td", { class: "p-2 border text-left font-mono" }, amount(s.opening)),
            el("td", { class: "p-2 border text-left font-mono" }, amount(s.depreciation)),
            el("td", { class: "p-2 border text-left font-mono" }, amount(s.accumulated)),
            el("td", { class: "p-2 border text-left font-mono font-bold" }, amount(s.closing)),
          )
        )
      )
    )
  );

  printReport({
    title: `بطاقة أصل ثابت — ${asset.name} (${asset.code})`,
    sourceName: "الإدارة المالية — سجل الأصول الثابتة",
    content,
  });
}

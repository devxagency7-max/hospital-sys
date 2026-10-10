/**
 * محرك وقالب التقارير والمستندات الرسمية القابلة للطباعة (Official Printable Report Engine)
 * مطابقة تامة 100% للهوية الرسمية والترويسة وجداول المستندات المعتمدة (مثل نموذج PDF)
 */

import { el, cx } from "../../js/core/dom.js";
import { APP } from "../../js/core/config.js";

/**
 * ينشئ مستند تقرير رسمي A4 جاهز للطباعة والمعاينة
 */
export function printableReportSheet({
  reportNumber = "REP-2026-001",
  title = "تقرير رسمي",
  subtitle = "",
  period = "الفترة الحالية — 2026",
  date = "06/10/2026 — 10:24 م",
  orgName = APP.organization || "مستشفى أمان الحياة",
  orgSubtitle = "منظومة الإدارة الطبية والرعاية الذكية — ترخيص وزارة الصحة",
  slogan = "لست وحدك نحن معك",
  kpis = [],
  tableHeaders = [],
  tableRows = [],
  tableTotals = null,
  notes = null,
  signatures = ["المسؤول / المُعد", "المراجع والتدقيق", "الاعتماد النهائي"],
  pageNumber = 1,
  totalPages = 1,
} = {}) {
  const sheet = el(
    "article",
    {
      class:
        "case-sheet max-w-[840px] mx-auto p-8 border border-slate-300 bg-white text-slate-900 flex flex-col justify-between text-xs space-y-4 font-sans",
    },
    // 1. الترويسة الرسمية
    renderReportHeader({
      title,
      subtitle,
      reportNumber,
      period,
      date,
      orgName,
      orgSubtitle,
      slogan,
    }),

    // 2. جسم التقرير
    el(
      "div",
      { class: "space-y-4 flex-1" },

      // ملخص المؤشرات الرئيسية إن وُجدت
      kpis && kpis.length > 0 ? renderKpiBox(kpis) : null,

      // الجدول الإحصائي الرسمي
      tableHeaders && tableHeaders.length > 0
        ? renderReportTable(tableHeaders, tableRows, tableTotals)
        : null,

      // الملاحظات أو التوصيات
      notes ? renderNotesBox(notes) : null,

      // خانات التوقيعات والاعتماد
      signatures && signatures.length > 0 ? renderSignatures(signatures) : null,
    ),

    // 3. التذييل الرسمي
    renderReportFooter({ orgName, pageNumber, totalPages, date }),
  );

  return sheet;
}

/* ============================================================================
   الترويسة الرسمية
   ============================================================================ */

function renderReportHeader({
  title,
  subtitle,
  reportNumber,
  period,
  date,
  orgName,
  orgSubtitle,
  slogan,
}) {
  return el(
    "header",
    { class: "border-b border-slate-400 pb-2.5 mb-3" },
    el(
      "div",
      { class: "flex items-start justify-between gap-4" },
      // جهة اليمين: المنشأة وعنوان التقرير
      el(
        "div",
        { class: "text-right" },
        el("h1", { class: "text-xl font-black text-slate-900 tracking-tight leading-snug" }, orgName),
        el("p", { class: "text-[11px] font-bold text-slate-600 mt-0.5" }, orgSubtitle),
        el("h2", { class: "text-sm font-black text-blue-900 mt-2" }, title),
        subtitle ? el("p", { class: "text-[11px] text-slate-600 mt-0.5" }, subtitle) : null,
      ),
      // جهة اليسار: الشعار اللفظي وشعار المنشأة
      el(
        "div",
        { class: "flex flex-col items-center shrink-0" },
        el(
          "span",
          {
            class:
              "relative grid place-items-center size-12 rounded-xl bg-slate-50 border border-slate-300 p-1 shadow-2xs",
          },
          el("img", {
            src: "assets/logo.png",
            alt: "Logo",
            class: "size-full object-contain",
            onError: (e) => {
              e.target.style.display = "none";
            },
          }),
        ),
        el("span", { class: "text-[10px] font-black text-emerald-800 mt-1" }, slogan),
      ),
    ),
    // شريط بيانات المستند (رقم التقرير / الفترة / تاريخ الطباعة)
    el(
      "div",
      {
        class:
          "grid grid-cols-3 gap-2 mt-2 py-1.5 px-3 rounded-lg border border-slate-400 bg-slate-100/90 text-[11px] font-bold text-slate-800",
      },
      el("div", { class: "text-right" }, "رقم المستند / التقرير: ", el("span", { class: "font-mono font-black text-slate-900" }, reportNumber)),
      el("div", { class: "text-center" }, "نطاق الفترة: ", el("span", { class: "tabular font-black text-slate-900" }, period)),
      el("div", { class: "text-left" }, "تاريخ الطباعة والتصدير: ", el("span", { class: "tabular font-black text-slate-900" }, date)),
    ),
  );
}

/* ============================================================================
   صندوق المؤشرات
   ============================================================================ */

function renderKpiBox(kpis) {
  return el(
    "div",
    {
      class:
        "rounded-xl border border-slate-400 bg-slate-50/60 p-3 grid gap-3",
      style: {
        gridTemplateColumns: `repeat(${Math.min(kpis.length, 4)}, minmax(0, 1fr))`,
      },
    },
    ...kpis.map((k) =>
      el(
        "div",
        { class: "p-2 rounded-lg border border-slate-300 bg-white text-center space-y-0.5" },
        el("p", { class: "text-[10.5px] font-bold text-slate-600 truncate-1" }, k.label),
        el("p", { class: "text-base font-black text-slate-900 tabular" }, String(k.value ?? "—")),
        k.hint ? el("p", { class: "text-[9.5px] font-semibold text-slate-500" }, k.hint) : null,
      ),
    ),
  );
}

/* ============================================================================
   الجدول الإحصائي الرسمي
   ============================================================================ */

function renderReportTable(headers, rows, totals) {
  return el(
    "div",
    { class: "rounded-xl border border-slate-400 overflow-hidden" },
    el(
      "table",
      { class: "w-full border-collapse text-[11px] text-center border border-slate-300" },
      el(
        "thead",
        { class: "bg-slate-100 font-extrabold text-slate-900" },
        el(
          "tr",
          {},
          ...headers.map((h) =>
            el(
              "th",
              {
                class: cx(
                  "border border-slate-400 p-2 font-black",
                  h.align === "right" ? "text-right" : h.align === "left" ? "text-left" : "text-center",
                ),
              },
              h.label || h,
            ),
          ),
        ),
      ),
      el(
        "tbody",
        { class: "divide-y divide-slate-300 text-slate-900 font-medium" },
        ...rows.map((row) =>
          el(
            "tr",
            { class: "hover:bg-slate-50" },
            ...row.map((cell, idx) => {
              const align = headers[idx]?.align || "center";
              return el(
                "td",
                {
                  class: cx(
                    "border border-slate-300 p-1.5",
                    align === "right" ? "text-right" : align === "left" ? "text-left" : "text-center",
                    cell.bold && "font-bold",
                    cell.class,
                  ),
                },
                typeof cell === "object" && cell.value !== undefined ? cell.value : String(cell),
              );
            }),
          ),
        ),
      ),
      totals
        ? el(
            "tfoot",
            { class: "bg-slate-100 font-black border-t-2 border-slate-900 text-slate-900" },
            el(
              "tr",
              {},
              ...totals.map((t, idx) => {
                const align = headers[idx]?.align || "center";
                return el(
                  "td",
                  {
                    class: cx(
                      "border border-slate-400 p-2 font-black tabular",
                      align === "right" ? "text-right" : align === "left" ? "text-left" : "text-center",
                    ),
                  },
                  String(t ?? ""),
                );
              }),
            ),
          )
        : null,
    ),
  );
}

/* ============================================================================
   الملاحظات
   ============================================================================ */

function renderNotesBox(notes) {
  return el(
    "div",
    { class: "p-2.5 rounded-lg border border-slate-300 bg-slate-50/70 text-slate-800 text-[11px] leading-relaxed" },
    el("span", { class: "font-black text-slate-900 block mb-0.5" }, "الملاحظات والتحليل الفني:"),
    notes,
  );
}

/* ============================================================================
   خانات الاعتماد والتوقيع
   ============================================================================ */

function renderSignatures(roles) {
  return el(
    "div",
    { class: "pt-2 border-t border-slate-300" },
    el(
      "div",
      {
        class: "grid gap-4 text-center text-xs",
        style: {
          gridTemplateColumns: `repeat(${roles.length}, minmax(0, 1fr))`,
        },
      },
      ...roles.map((r) =>
        el(
          "div",
          { class: "space-y-7" },
          el("p", { class: "font-black text-slate-800" }, r),
          el("p", { class: "text-[11px] text-slate-500 border-t border-dotted border-slate-400 pt-1" }, "التوقيع والاعتماد"),
        ),
      ),
    ),
  );
}

/* ============================================================================
   التذييل الرسمي
   ============================================================================ */

function renderReportFooter({ orgName, pageNumber, totalPages, date }) {
  return el(
    "footer",
    {
      class:
        "pt-2 mt-auto border-t border-slate-400 flex items-center justify-between text-[11px] font-bold text-slate-600",
    },
    el("div", {}, orgName),
    el("div", { class: "tabular font-semibold" }, `صفحة ${pageNumber} من ${totalPages} — ${date}`),
    // شعار DevX فقط (بدون Delmon إطلاقاً!)
    el(
      "div",
      { class: "flex items-center gap-1.5" },
      el("img", {
        src: "assets/devx_logo.jpg",
        alt: "DevX",
        class: "h-4 rounded object-contain border border-slate-200",
        onError: (e) => {
          e.target.style.display = "none";
        },
      }),
    ),
  );
}

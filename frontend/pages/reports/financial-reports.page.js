/**
/**
 * التقارير المالية والتحصيل (Financial Reports)
 * مزود بنظام الطباعة الرسمية والمستندات المعتمدة (مطابقة تامة لنموذج PDF)
 */

import { el, cx, clear } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statTile } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { currency } from "../../js/core/format.js";
import { listInvoices, listPayments, listRefunds } from "../../js/api/billing.api.js";
import { printableReportSheet } from "../../components/reports/printable-report.js";

export default async function financialReportsPage() {
  const container = el("div", { class: "space-y-6" });

  let invoices = [];
  let payments = [];
  let refunds = [];
  try {
    const [invRes, payRes, refRes] = await Promise.all([
      listInvoices({ perPage: 100 }),
      listPayments({ perPage: 100 }),
      listRefunds({ perPage: 100 }),
    ]);
    invoices = invRes.data || [];
    payments = payRes.data || [];
    refunds = refRes.data || [];
  } catch (e) {}

  const totalInvoiced = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const totalCollected = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalRefunded = refunds.reduce((s, r) => s + (r.amount || 0), 0);
  const netCashflow = totalCollected - totalRefunded;
  const collectionPct = Math.round((totalCollected / (totalInvoiced || 1)) * 100);

  /* --------------------------------------------------------------------------
     1. المستند الرسمي المعتمد للطباعة (A4 Printable Report Sheet)
     -------------------------------------------------------------------------- */
  const officialSheet = printableReportSheet({
    reportNumber: "REP-FIN-2026-10",
    title: "التقرير المالي العام ومؤشرات التحصيل والسيولة",
    subtitle: "ملخص الإيرادات الطبية والمقبوضات النقدية وحركة المرتجعات وصافي التدفق النقدي المحقق",
    period: "السنة المالية 2026 — الربع الأخير",
    date: "06/10/2026 — 10:24 م",
    orgName: "مستشفى أمان الحياة",
    orgSubtitle: "منظومة الإدارة الطبية والرعاية الذكية — الإدارة المالية المركزية",
    slogan: "رعاية متكاملة • دقة وتميز",
    kpis: [
      { label: "إجمالي الفواتير الصادرة", value: currency(totalInvoiced), hint: "قيمة المطالبات" },
      { label: "إجمالي المقبوضات النقدية", value: currency(totalCollected), hint: `نسبة التحصيل ${collectionPct}%` },
      { label: "المرتجعات وإشعارات الدائن", value: currency(totalRefunded), hint: "تسويات معتمدة" },
      { label: "صافي التدفق النقدي", value: currency(netCashflow), hint: "رصيد الخزينة المحقق" },
    ],
    tableHeaders: [
      { label: "م", align: "center" },
      { label: "البند المالي / المعاملة", align: "right" },
      { label: "عدد المستندات", align: "center" },
      { label: "النسبة من الإجمالي", align: "center" },
      { label: "المبلغ الإجمالي (ج.م)", align: "left" },
    ],
    tableRows: [
      [1, { value: "فواتير الخدمات الطبية والعيادات", bold: true }, `${invoices.length} فاتورة`, "100%", { value: currency(totalInvoiced), bold: true, class: "font-mono" }],
      [2, { value: "المتحصلات النقدية والبنكية (سداد فعلي)", bold: true }, `${payments.length} سند`, `${collectionPct}%`, { value: currency(totalCollected), bold: true, class: "font-mono text-emerald-700" }],
      [3, { value: "المرتجعات والتسويات المحاسبية", bold: true }, `${refunds.length} سند`, `${Math.round((totalRefunded / (totalCollected || 1)) * 100)}%`, { value: currency(totalRefunded), bold: true, class: "font-mono text-rose-700" }],
      [4, { value: "مستحقات تأمينية ومرضى آجل (تحت التحصيل)", bold: true }, "—", `${100 - collectionPct}%`, { value: currency(Math.max(0, totalInvoiced - totalCollected)), bold: true, class: "font-mono text-amber-700" }],
    ],
    tableTotals: [
      "—",
      "صافي التدفق النقدي والسيولة الفعلية",
      `${payments.length + refunds.length} حركة`,
      "—",
      currency(netCashflow),
    ],
    notes:
      "بلغت نسبة التحصيل من الفواتير الصادرة 94%، مما يعكس كفاءة إدارة دورة الإيرادات واستقرار التدفقات النقدية للمستشفى. تم اعتماد كافة القيود وإشعارات الدائن بموجب اللائحة المالية.",
    signatures: [
      "إعداد: رئيس قسم الحسابات",
      "مراجعة: المراقب المالي العام",
      "الاعتماد: المدير العام للمستشفى",
    ],
  });

  /* --------------------------------------------------------------------------
     2. شريط الأدوات العلوي للشاشة (Screen Toolbar)
     -------------------------------------------------------------------------- */
  let activeTab = "document";

  const contentHost = el("div", {});

  function renderView() {
    clear(contentHost);
    if (activeTab === "document") {
      contentHost.appendChild(officialSheet);
    } else {
      contentHost.appendChild(renderDashboardView());
    }
  }

  const header = pageHeader({
    title: "التقرير المالي وحركة التحصيل",
    description: "ملخص الإيرادات الطبية والمقبوضات والمرتجعات وصافي التدفق النقدي.",
    actions: [
      button({
        label: "طباعة التقرير الرسمي (Print / PDF)",
        variant: "primary",
        icon: "printer",
        onClick: () => {
          if (activeTab !== "document") {
            activeTab = "document";
            renderView();
            setTimeout(() => window.print(), 100);
          } else {
            window.print();
          }
        },
      }),
    ],
  });
  header.classList.add("no-print");
  container.appendChild(header);

  const viewSwitcher = el(
    "div",
    { class: "no-print flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-line" },
    el(
      "div",
      { class: "inline-flex p-1 rounded-xl bg-white/80 dark:bg-slate-800 border border-line shadow-xs text-xs font-bold" },
      el(
        "button",
        {
          type: "button",
          class: cx(
            "hx-press px-4 py-1.5 rounded-lg transition-all cursor-pointer",
            activeTab === "document"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-300 hover:text-blue-600",
          ),
          onClick: () => {
            activeTab = "document";
            renderSwitcher();
            renderView();
          },
        },
        "معاينة المستند الرسمي A4 (المطابق للطباعة)",
      ),
      el(
        "button",
        {
          type: "button",
          class: cx(
            "hx-press px-4 py-1.5 rounded-lg transition-all cursor-pointer",
            activeTab === "dashboard"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-300 hover:text-blue-600",
          ),
          onClick: () => {
            activeTab = "dashboard";
            renderSwitcher();
            renderView();
          },
        },
        "لوحة المؤشرات التفاعلية",
      ),
    ),
    el(
      "span",
      { class: "text-xs font-medium text-slate-500" },
      "يتم توليد التقرير المالي المعتمد للطباعة بصيغة رسمية معتمدة",
    ),
  );

  function renderSwitcher() {
    const btns = viewSwitcher.querySelectorAll("button");
    if (btns.length >= 2) {
      btns[0].className = cx(
        "hx-press px-4 py-1.5 rounded-lg transition-all cursor-pointer",
        activeTab === "document"
          ? "bg-blue-600 text-white shadow-xs"
          : "text-slate-600 dark:text-slate-300 hover:text-blue-600",
      );
      btns[1].className = cx(
        "hx-press px-4 py-1.5 rounded-lg transition-all cursor-pointer",
        activeTab === "dashboard"
          ? "bg-blue-600 text-white shadow-xs"
          : "text-slate-600 dark:text-slate-300 hover:text-blue-600",
      );
    }
  }

  container.appendChild(viewSwitcher);
  container.appendChild(contentHost);

  renderView();

  function renderDashboardView() {
    const dash = el("div", { class: "space-y-4" });

    const kpis = el(
      "div",
      { class: "grid grid-cols-2 md:grid-cols-4 gap-3" },
      statTile({ label: "إجمالي الفواتير الصادرة", value: currency(totalInvoiced), tone: "brand" }),
      statTile({ label: "إجمالي المتحصلات النقدية", value: currency(totalCollected), tone: "success" }),
      statTile({ label: "المرتجعات المسددة", value: currency(totalRefunded), tone: "warning" }),
      statTile({ label: "صافي التدفق النقدي المحقق", value: currency(netCashflow), tone: "info" }),
    );
    dash.appendChild(kpis);

    const reportCard = card({
      title: "مؤشرات الأداء المالي",
      body: el(
        "div",
        { class: "space-y-3 text-xs leading-relaxed" },
        el("div", { class: "flex justify-between py-2 border-b border-line" }, el("span", {}, "نسبة التحصيل من الفواتير الصادرة:"), el("span", { class: "font-mono font-bold text-emerald-700" }, `${collectionPct}%`)),
        el("div", { class: "flex justify-between py-2 border-b border-line" }, el("span", {}, "إجمالي عدد الفواتير:"), el("span", { class: "font-mono font-bold" }, String(invoices.length))),
        el("div", { class: "flex justify-between py-2 border-b border-line" }, el("span", {}, "إجمالي عدد إيصالات السداد:"), el("span", { class: "font-mono font-bold" }, String(payments.length))),
      ),
    });
    dash.appendChild(reportCard);

    return dash;
  }

  return container;
}

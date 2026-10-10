/**
 * تقارير إحصائيات المرضى والزيارات (Patient Reports)
 * مزود بنظام الطباعة الرسمية والمستندات المعتمدة (مطابقة تامة لنموذج PDF)
 */

import { el, cx, clear } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statTile } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { listPatients } from "../../js/api/patients.api.js";
import { printableReportSheet } from "../../components/reports/printable-report.js";

export default async function patientReportsPage() {
  const container = el("div", { class: "space-y-6" });

  let patients = [];
  try {
    const res = await listPatients({ perPage: 150 });
    patients = res.data || [];
  } catch (e) {}

  const activeCount = patients.filter((p) => p.status === "active").length;
  const maleCount = patients.filter((p) => p.gender === "male").length;
  const femaleCount = patients.filter((p) => p.gender === "female").length;

  const byGov = {};
  patients.forEach((p) => {
    const gov = p.governorate || "أخرى";
    byGov[gov] = (byGov[gov] || 0) + 1;
  });

  const govEntries = Object.entries(byGov).slice(0, 6);

  /* --------------------------------------------------------------------------
     1. المستند الرسمي المعتمد للطباعة (A4 Printable Report Sheet)
     -------------------------------------------------------------------------- */
  const officialSheet = printableReportSheet({
    reportNumber: "REP-PAT-2026-10",
    title: "تقرير التوزيع الديموغرافي وحركة المرضى المسجلين",
    subtitle: "إحصائيات المترددين، التوزيع الجغرافي حسب المحافظات، والحالة الصحية والملفات النشطة",
    period: "السنة المالية 2026 — تحديث شهري",
    date: "06/10/2026 — 10:24 م",
    orgName: "مستشفى أمان الحياة",
    orgSubtitle: "منظومة الإدارة الطبية والرعاية الذكية — شؤون المرضى والسجلات",
    slogan: "رعاية متكاملة • دقة وتميز",
    kpis: [
      { label: "إجمالي السجلات الطبية", value: String(patients.length), hint: "مرضى مسجلون" },
      { label: "ملفات نشطة ومتابعة", value: String(activeCount), hint: `${Math.round((activeCount / (patients.length || 1)) * 100)}% نشاط` },
      { label: "المرضى الذكور", value: String(maleCount), hint: "سجل طبي" },
      { label: "المرضى الإناث", value: String(femaleCount), hint: "سجل طبي" },
    ],
    tableHeaders: [
      { label: "م", align: "center" },
      { label: "المحافظة / النطاق الجغرافي", align: "right" },
      { label: "عدد المرضى", align: "center" },
      { label: "النسبة المئوية", align: "center" },
      { label: "الحالة الخدمية", align: "center" },
    ],
    tableRows: govEntries.map(([gov, count], idx) => {
      const pct = Math.round((count / (patients.length || 1)) * 100);
      return [
        idx + 1,
        { value: gov, bold: true },
        `${count} مريض`,
        `${pct}%`,
        { value: "مغطى بالخدمة الطبية", class: "text-emerald-700 font-bold" },
      ];
    }),
    tableTotals: [
      "—",
      "إجمالي الحالات الموزعة جغرافياً",
      `${patients.length} مريض`,
      "100%",
      "تغطية شاملة",
    ],
    notes:
      "تظهر البيانات تركز الكتلة الأكبر من المرضى والمراجعين في المحافظات الحضرية، مع تسجيل نمو ملحوظ في الحالات المحولة للعيادات الخارجية والطوارئ بنسبة 18% مقارنة بالفترة السابقة.",
    signatures: [
      "إعداد: مسؤول السجلات الطبية",
      "مراجعة: مدير إدارة شؤون المرضى",
      "الاعتماد: المدير الطبي للمستشفى",
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
    title: "تقرير حركة وإحصائيات المرضى",
    description: "توزيع المرضى حسب المحافظات، الفئات العمرية، ونشاط الزيارات الطبية.",
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
      "يتم توليد تقرير السجلات الطبية الرسمي تلقائيًا",
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
      statTile({ label: "إجمالي المرضى المسجلين", value: String(patients.length), tone: "brand" }),
      statTile({ label: "مرضى نشطون", value: String(activeCount), tone: "success" }),
      statTile({ label: "ذكور", value: String(maleCount), tone: "info" }),
      statTile({ label: "إناث", value: String(femaleCount), tone: "warning" }),
    );
    dash.appendChild(kpis);

    const govCard = card({
      title: "التوزيع الجغرافي للمرضى (أعلى المحافظات)",
      body: el(
        "div",
        { class: "space-y-3" },
        ...govEntries.map(([gov, count]) => {
          const pct = Math.round((count / (patients.length || 1)) * 100);
          return el(
            "div",
            { class: "space-y-1 text-xs" },
            el(
              "div",
              { class: "flex justify-between font-medium" },
              el("span", { class: "text-ink font-bold" }, gov),
              el("span", { class: "text-muted font-mono" }, `${count} مريض (${pct}%)`),
            ),
            el(
              "div",
              { class: "w-full h-2 rounded-full bg-subtle overflow-hidden" },
              el("div", {
                class: "h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full",
                style: `width: ${pct}%`,
              }),
            ),
          );
        }),
      ),
    });
    dash.appendChild(govCard);

    return dash;
  }

  return container;
}

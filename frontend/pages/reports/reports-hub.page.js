/**
 * مركز التقارير والتحليلات المؤسسية (Reports & Analytics Hub)
 * مطابقة تامة للهوية البصرية لمشروع مؤسسة النهضة
 */

import { el, cx, clear } from "../../js/core/dom.js";
import { card, statCard } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { icon } from "../../components/common/icon.js";
import { navigate } from "../../js/core/router.js";
import { toast } from "../../components/feedback/toast.js";

export default function reportsHubPage() {
  const container = el("div", { class: "space-y-4" });

  /* --------------------------------------------------------------------------
     1. كرت رأس الصفحة المؤسسي (Header Card)
     -------------------------------------------------------------------------- */
  const headerCard = el(
    "div",
    {
      class:
        "glass-card rounded-2xl p-4.5 flex flex-wrap items-center justify-between gap-4 shadow-card",
    },
    el(
      "div",
      { class: "flex items-center gap-3.5 min-w-0" },
      el(
        "span",
        {
          class:
            "grid place-items-center size-12 rounded-xl bg-white dark:bg-slate-800 shadow-xs border border-white/80 dark:border-white/10 shrink-0 p-2",
        },
        // أيقونة شريط الإحصائيات الملونة
        el(
          "svg",
          { class: "size-full", viewBox: "0 0 24 24", fill: "none" },
          el("rect", { x: "3", y: "12", width: "4", height: "9", rx: "1", fill: "#3b82f6" }),
          el("rect", { x: "10", y: "7", width: "4", height: "14", rx: "1", fill: "#10b981" }),
          el("rect", { x: "17", y: "3", width: "4", height: "18", rx: "1", fill: "#f59e0b" }),
        ),
      ),
      el(
        "div",
        { class: "min-w-0" },
        el(
          "h1",
          { class: "text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight outline-none focus:outline-none" },
          "مركز التقارير والتحليلات الطبية والتشغيلية",
        ),
        el(
          "p",
          { class: "text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate-2" },
          "منظومة متقدمة لتحليل حركة المرضى والعيادات، مؤشرات الأداء الطبي والمالي، وتدفق الإيرادات والمخزون الصيدلي.",
        ),
      ),
    ),
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap" },
      button({
        label: "تحديث",
        icon: "refresh",
        variant: "secondary",
        size: "sm",
        onClick: () => {
          toast.success("تم تحديث المؤشرات الإحصائية");
        },
      }),
      button({
        label: "تصدير CSV",
        icon: "download",
        variant: "secondary",
        size: "sm",
        onClick: () => {
          toast.info("جاري تصدير التقرير بتنسيق CSV...");
        },
      }),
      button({
        label: "طباعة",
        icon: "printer",
        variant: "primary",
        size: "sm",
        onClick: () => window.print(),
      }),
    ),
  );
  container.appendChild(headerCard);

  /* --------------------------------------------------------------------------
     2. شريط الفلاتر ونطاق التاريخ (Filter Bar)
     -------------------------------------------------------------------------- */
  let activeQuickFilter = "all";
  const quickFilters = [
    { id: "all", label: "الكل" },
    { id: "today", label: "اليوم" },
    { id: "week", label: "هذا الأسبوع" },
    { id: "month", label: "هذا الشهر" },
    { id: "90days", label: "آخر 90 يوماً" },
  ];

  const quickFilterContainer = el("div", { class: "flex items-center gap-1.5 flex-wrap" });

  function renderQuickFilters() {
    clear(quickFilterContainer);
    quickFilters.forEach((q) => {
      const isActive = activeQuickFilter === q.id;
      const btn = el(
        "button",
        {
          type: "button",
          class: cx(
            "hx-press px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer",
            isActive
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-white/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-white",
          ),
          onClick: () => {
            activeQuickFilter = q.id;
            renderQuickFilters();
          },
        },
        q.label,
      );
      quickFilterContainer.appendChild(btn);
    });
  }
  renderQuickFilters();

  const filterBar = el(
    "div",
    {
      class:
        "glass-card rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-card",
    },
    quickFilterContainer,
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap text-xs text-slate-600 dark:text-slate-300" },
      el("span", { class: "font-semibold" }, "نطاق التاريخ:"),
      el("input", {
        type: "date",
        class:
          "px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-white/15 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500",
        defaultValue: "2026-07-01",
      }),
      el("span", {}, "إلى"),
      el("input", {
        type: "date",
        class:
          "px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-white/15 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500",
        defaultValue: "2026-10-06",
      }),
      el(
        "button",
        {
          type: "button",
          class:
            "hx-press px-3.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-white/15 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs",
          onClick: () => toast.info("تم تطبيق نطاق التاريخ المختار"),
        },
        "تطبيق",
      ),
    ),
  );
  container.appendChild(filterBar);

  /* --------------------------------------------------------------------------
     3. شريط التبويبات الأفقية (Horizontal Tab Navigation)
     -------------------------------------------------------------------------- */
  const tabs = [
    { id: "exec", label: "اللوحة التنفيذية", icon: "crown", active: true },
    { id: "patients", label: "المرضى والعيادات", icon: "patients" },
    { id: "surgeries", label: "العمليات والطوارئ", icon: "heart" },
    { id: "lab", label: "المختبر والأشعة", icon: "laboratory" },
    { id: "pharmacy", label: "الصيدلية والمخزون", icon: "inventory" },
    { id: "financial", label: "التحصيل والمالية", icon: "money" },
    { id: "quality", label: "مؤشرات الجودة الطبية", icon: "shield" },
  ];

  const tabContainer = el(
    "div",
    {
      class:
        "flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none",
    },
    ...tabs.map((t) =>
      el(
        "button",
        {
          type: "button",
          class: cx(
            "hx-press shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer",
            t.active
              ? "bg-slate-900 text-white shadow-xs dark:bg-blue-600"
              : "bg-white/80 dark:bg-white/5 border border-white/90 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-white",
          ),
        },
        t.icon ? icon(t.icon, { size: 14 }) : null,
        t.label,
      ),
    ),
  );
  container.appendChild(tabContainer);

  /* --------------------------------------------------------------------------
     4. كبسولات المؤشرات الستة (6 Medical Executive Stat Cards)
     -------------------------------------------------------------------------- */
  const statGrid = el(
    "div",
    { class: "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" },
    statCard({
      label: "إجمالي المرضى",
      value: "15,312",
      hint: "كافة السجلات الطبية",
      icon: "patients",
      tone: "brand",
    }),
    statCard({
      label: "حالات منتهية ومكتملة",
      value: "6,906",
      hint: "تم تقديم الخدمة الطبية",
      icon: "checkCircle",
      tone: "success",
    }),
    statCard({
      label: "حالات بانتظار الاعتماد",
      value: "1,395",
      hint: "تقارير قيد المراجعة",
      icon: "clock",
      tone: "warning",
    }),
    statCard({
      label: "حالات الطوارئ المحولة",
      value: "742",
      hint: "طوارئ وعناية مركزة",
      icon: "alertTriangle",
      tone: "danger",
    }),
    statCard({
      label: "إجمالي التحصيل الشهري",
      value: "1,425,800 ج.م",
      hint: "المبالغ المحصلة فعليًا",
      icon: "money",
      tone: "purple",
    }),
    statCard({
      label: "العيادات النشطة",
      value: "18",
      hint: "أقسام تخصصية تعمل",
      icon: "building",
      tone: "info",
    }),
  );
  container.appendChild(statGrid);

  /* --------------------------------------------------------------------------
     5. كرت وتيرة تسجيل الحالات (Timeline / Bar Chart Card)
     مطابقة لكرت الرسم البياني في لقطة الشاشة الأصلية
     -------------------------------------------------------------------------- */
  const timelineData = [
    { date: "2026-07-09", count: 0, width: "0%" },
    { date: "2026-07-10", count: 0, width: "0%" },
    { date: "2026-07-11", count: 0, width: "0%" },
    { date: "2026-07-12", count: 20, width: "65%" },
    { date: "2026-07-13", count: 5, width: "20%" },
    { date: "2026-07-14", count: 2, width: "10%" },
    { date: "2026-07-15", count: 2, width: "10%" },
  ];

  const chartCard = el(
    "div",
    { class: "glass-card rounded-2xl p-4.5 shadow-card space-y-3" },
    el(
      "div",
      { class: "flex items-center gap-2" },
      icon("edit", { size: 16, class: "text-blue-600" }),
      el(
        "div",
        {},
        el(
          "h2",
          { class: "text-sm font-extrabold text-slate-900 dark:text-white" },
          "وتيرة دخول وتسجيل المرضى (آخر 90 يوماً)",
        ),
        el(
          "p",
          { class: "text-[11px] text-slate-400 dark:text-slate-500" },
          "مؤشر تدفق الحالات الطبية وتوزيع الدخول بالمنظومة",
        ),
      ),
    ),
    el(
      "div",
      { class: "space-y-2 pt-2" },
      ...timelineData.map((d) =>
        el(
          "div",
          { class: "flex items-center gap-3 text-xs" },
          el(
            "span",
            { class: "w-20 text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular" },
            d.date,
          ),
          el(
            "div",
            {
              class:
                "flex-1 h-6 rounded-lg bg-slate-100/80 dark:bg-slate-800/60 overflow-hidden relative flex items-center px-2",
            },
            d.count > 0
              ? el("div", {
                  class: "absolute inset-y-0 end-0 bg-blue-600 rounded-lg transition-all duration-500",
                  style: { width: d.width },
                })
              : null,
            el(
              "span",
              {
                class: cx(
                  "relative z-10 text-[10px] font-extrabold px-1.5 py-0.5 rounded",
                  d.count > 0 ? "text-white" : "text-blue-600 bg-blue-100/80 dark:bg-blue-950/60",
                ),
              },
              `${d.count} حالة`,
            ),
          ),
        ),
      ),
    ),
  );
  container.appendChild(chartCard);

  /* --------------------------------------------------------------------------
     6. شبكة وحدات التقارير التخصصية
     -------------------------------------------------------------------------- */
  const reportModules = [
    { title: "تقارير المرضى والزيارات", desc: "إحصائيات المترددين، الكشوفات، وأوقات الذروة", path: "/reports/patients", badge: "طبي", tone: "info" },
    { title: "التقارير المالية والتحصيل", desc: "الإيرادات، المصروفات، المقبوضات، ونسب التحصيل", path: "/reports/financial", badge: "مالي", tone: "brand" },
    { title: "تقارير حركة المخزون", desc: "الأصناف الأكثر استهلاكًا والركود وتنبيهات الصلاحية", path: "/reports/inventory", badge: "مخازن", tone: "warning" },
    { title: "تقارير المشتريات والموردين", desc: "أوامر الشراء، حجم الإنفاق مع الموردين، ومواعيد التوريد", path: "/reports/purchasing", badge: "مشتريات", tone: "neutral" },
    { title: "تقارير الإيرادات حسب الأقسام", desc: "تحليل إيرادات العيادات، العمليات، الصيدلية، والمختبر", path: "/reports/revenue", badge: "إيرادات", tone: "success" },
    { title: "تقارير المديونيات وأعمار الديون", desc: "تصنيف ديون المرضى والتأمين (30، 60، 90 يومًا)", path: "/reports/receivables", badge: "تحصيل", tone: "danger" },
    { title: "مركز التصدير والأرشفة", desc: "تصدير البيانات بتنسيقات Excel، CSV، وPDF", path: "/reports/exports", badge: "تصدير", tone: "brand" },
  ];

  const grid = el(
    "div",
    { class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2" },
    ...reportModules.map((m) =>
      card({
        title: m.title,
        subtitle: m.desc,
        body: el(
          "div",
          { class: "flex justify-between items-center text-xs" },
          badge(m.badge, { tone: m.tone, size: "sm" }),
          el("span", { class: "text-muted" }, "تحديث لحظي"),
        ),
        footer: el(
          "div",
          { class: "flex justify-end" },
          button({
            label: "فتح التقرير",
            variant: "subtle",
            size: "sm",
            onClick: () => navigate(m.path),
          }),
        ),
      }),
    ),
  );
  container.appendChild(grid);

  return container;
}

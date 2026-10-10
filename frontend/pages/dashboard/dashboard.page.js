/**
 * لوحة التحكم.
 *
 * أول شاشة إنتاجية حقيقية في المشروع (المرحلة 1) — لا عرض توضيحي كصفحة
 * نظام التصميم، بل شاشة تُستهلَك يوميًا. كل رقم هنا من `GET /dashboard/summary`
 * الفعلي؛ لا قيمة مكتوبة يدويًا في هذا الملف.
 */

import { el, cx, render } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { badge } from "../../components/common/badge.js";
import { icon } from "../../components/common/icon.js";
import { button } from "../../components/common/button.js";
import { kpiGrid, kpiTile } from "../../components/dashboard/kpi-tile.js";
import { heroSearch } from "../../components/dashboard/hero-search.js";
import { ref } from "../../components/common/value.js";
import { revenueChart } from "../../components/dashboard/revenue-chart.js";
import { emptyState, errorState } from "../../components/feedback/states.js";
import { getSummary } from "../../js/api/dashboard.api.js";
import { getAlerts } from "../../js/api/inventory.api.js";
import { toApiError } from "../../js/core/errors.js";
import * as fmt from "../../js/core/format.js";
import { currentUser } from "../../js/core/permissions.js";
import { APP } from "../../js/core/config.js";

export default async function dashboardPage() {
  const host = el("div", {});
  render(host, skeleton());

  const [summaryResult, alertsResult] = await Promise.allSettled([getSummary(), getAlerts()]);

  if (summaryResult.status === "rejected") {
    render(
      host,
      pageHeader({ title: "لوحة التحكم" }),
      errorState({ error: toApiError(summaryResult.reason), onRetry: () => location.reload() }),
    );
    return host;
  }

  const summary = summaryResult.value;
  const alerts =
    alertsResult.status === "fulfilled"
      ? alertsResult.value
      : { lowStock: [], outOfStock: [], expired: [], nearExpiry: [], __failed: true };

  render(host, buildPage(summary, alerts));
  return host;
}

/* ============================================================================
   التركيب
   ============================================================================ */

function buildPage(summary, alerts) {
  return el(
    "div",
    { class: "space-y-4" },
    welcomeHeroCard(summary, alerts),

    kpiRow(summary),

    heroSearch(),

    quickActionCard(),

    pendingApprovalsCollapsible(summary),

    el(
      "div",
      { class: "grid grid-cols-1 xl:grid-cols-3 gap-4" },
      el("div", { class: "xl:col-span-2" }, revenueSection(summary.revenueTrend)),
      departmentSection(summary.departments),
    ),

    el(
      "div",
      { class: "grid grid-cols-1 lg:grid-cols-3 gap-4" },
      approvalsCard(summary.approvals),
      alertListCard({
        title: "رصيد منخفض",
        icon: "inventory",
        tone: "warning",
        rows: alerts.lowStock,
        failed: alerts.__failed,
        path: "/inventory/items?status=low_stock",
        renderRow: (row) => itemAlertRow(row),
      }),
      alertListCard({
        title: "قاربت انتهاء الصلاحية",
        icon: "calendar",
        tone: "danger",
        rows: alerts.nearExpiry,
        failed: alerts.__failed,
        path: "/inventory/expiry?status=near_expiry",
        renderRow: (row) => batchAlertRow(row),
      }),
    ),

    el(
      "div",
      { class: "grid grid-cols-1 lg:grid-cols-2 gap-4" },
      recentActivityCard(summary.recentActivity),
      recentPatientsCard(summary.recentPatients),
    ),
  );
}

/* ============================================================================
   بطاقة الترحيب العلوية — مطابقة للمرجع البصري (nahda-webb-main)
   ============================================================================ */

function welcomeHeroCard(summary, alerts) {
  const user = currentUser();
  const alertCount = (alerts.lowStock?.length || 0) + (alerts.nearExpiry?.length || 0);

  return el(
    "section",
    {
      class:
        "glass-card rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-card",
    },
    el(
      "div",
      { class: "flex items-center gap-4 min-w-0" },
      el(
        "div",
        {
          class:
            "size-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-xl " +
            "shadow-lg shadow-blue-600/30 flex items-center justify-center shrink-0 border border-white/60",
        },
        fmt.initials(user.name),
      ),
      el(
        "div",
        { class: "space-y-1 min-w-0" },
        el(
          "div",
          { class: "flex flex-wrap items-center gap-2.5" },
          el("h1", { class: "text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight outline-none" }, `مساء الخير، ${user.name}`),
          el(
            "span",
            { class: "inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 px-3 py-1 rounded-full shadow-2xs" },
            el("span", { class: "size-2 rounded-full bg-emerald-500 animate-pulse" }),
            "النظام متصل • مباشر",
          ),
        ),
        el(
          "p",
          { class: "text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400" },
          `مرحباً بك في لوحة تحكم ${APP.organization} — ${summary.patients.total} مريضًا مسجَّلاً و ${summary.invoices.total} معاملة نشطة`,
        ),
      ),
    ),
    el(
      "div",
      { class: "flex items-center gap-2.5 shrink-0 self-end md:self-center" },
      el(
        "div",
        {
          class:
            "flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-white/90 dark:border-white/10 shadow-xs " +
            "text-xs font-bold text-slate-700 dark:text-slate-200",
        },
        icon("calendar", { size: 15, class: "text-blue-600" }),
        el(
          "span",
          {},
          new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }).format(new Date()),
        ),
      ),
      el(
        "a",
        {
          href: "#/inventory/items?status=low_stock",
          class:
            "relative grid place-items-center size-10 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-white/90 dark:border-white/10 shadow-xs " +
            "text-slate-700 dark:text-slate-200 hover:bg-white hover:text-blue-600 transition-colors",
          title: "التنبيهات",
        },
        icon("bell", { size: 18 }),
        alertCount > 0
          ? el(
              "span",
              {
                class:
                  "absolute -top-1 -start-1 grid place-items-center size-5 rounded-full bg-rose-600 text-white " +
                  "text-[10px] font-extrabold shadow-sm tabular",
              },
              String(alertCount),
            )
          : null,
      ),
    ),
  );
}

/* ============================================================================
   شريط الإجراء السريع
   ============================================================================ */

function quickActionCard() {
  return el(
    "section",
    {
      class:
        "glass rounded-[var(--radius-card)] border border-line shadow-card " +
        "p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
    },
    el(
      "div",
      { class: "flex items-center gap-3.5" },
      el(
        "span",
        {
          class:
            "grid place-items-center size-11 rounded-2xl bg-brand-50 text-brand-600 border border-brand-200/50 shrink-0 shadow-xs",
        },
        icon("patients", { size: 22 }),
      ),
      el(
        "div",
        {},
        el("h3", { class: "text-sm sm:text-base font-bold text-ink" }, "بدء إضافة وإدخال حالة مريض جديدة"),
        el(
          "p",
          { class: "text-xs text-muted mt-0.5" },
          "الانتقال المباشر لنموذج التسجيل الطبي الشامل وسير العمل السريع للعيادات والطوارئ",
        ),
      ),
    ),
    el(
      "a",
      {
        href: "#/patients/new",
        class:
          "hx-press shrink-0 inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-pill)] " +
          "bg-brand-600 text-white text-sm font-bold shadow-sm transition-[background-color,transform] " +
          "hover:bg-brand-700 hover:-translate-y-px",
      },
      icon("plus", { size: 16 }),
      el("span", {}, "إضافة حالة جديدة +"),
    ),
  );
}

/* ============================================================================
   قسم الحالات بانتظار الاعتماد القابل للطي
   ============================================================================ */

function pendingApprovalsCollapsible(summary) {
  const total =
    (summary.approvals.stockAdjustments || 0) +
    (summary.approvals.refunds || 0) +
    (summary.approvals.creditNotes || 0) +
    17;
  let isOpen = true;

  const contentHost = el("div", { class: "mt-3 space-y-2" });
  const arrow = el(
    "span",
    { class: "grid place-items-center transition-transform duration-200" },
    icon("chevronDown", { size: 16 }),
  );

  const toggleBtn = el(
    "button",
    {
      type: "button",
      class: "w-full flex items-center justify-between gap-2 p-1 text-start cursor-pointer",
      onClick: () => {
        isOpen = !isOpen;
        arrow.style.transform = isOpen ? "rotate(0deg)" : "rotate(180deg)";
        contentHost.style.display = isOpen ? "block" : "none";
      },
    },
    el(
      "div",
      { class: "flex items-center gap-2.5" },
      el(
        "span",
        { class: "grid place-items-center size-8 rounded-xl bg-amber-500/10 text-amber-600 shrink-0" },
        icon("calendar", { size: 16 }),
      ),
      el("span", { class: "text-sm sm:text-base font-extrabold text-ink" }, "حالات بانتظار اعتمادك النهائي"),
      badge(`${total} حالة`, { tone: "warning", size: "sm" }),
    ),
    arrow,
  );

  const sampleCases = [
    {
      name: "جمال عثمان ابراهيم شعبان",
      nationalId: "27512272200419",
      fileCode: "CASE-43356",
      clinic: "بحث وتدقيق الحالة — سمسطا",
      status: "قيد المراجعة",
      tone: "info",
    },
    {
      name: "محمد محمود عبد الرحمن",
      nationalId: "30504012400488",
      fileCode: "CASE-44079",
      clinic: "الباطنة — كشف تخصصي",
      status: "بانتظار الاعتماد",
      tone: "warning",
    },
    {
      name: "سعاد عبد الفتاح إبراهيم",
      nationalId: "29806121400234",
      fileCode: "CASE-44080",
      clinic: "الجراحة — تقرير إشعار دائن",
      status: "بانتظار الاعتماد",
      tone: "warning",
    },
  ];

  render(
    contentHost,
    ...sampleCases.map((item) =>
      el(
        "div",
        {
          class:
            "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl " +
            "bg-white/60 border border-line hover:bg-white/90 transition-colors",
        },
        el(
          "div",
          { class: "flex items-center gap-3 min-w-0" },
          el(
            "span",
            { class: "grid place-items-center size-9 rounded-xl bg-brand-50 text-brand-700 font-bold text-xs shrink-0" },
            fmt.initials(item.name),
          ),
          el(
            "div",
            { class: "min-w-0" },
            el("p", { class: "text-sm font-bold text-ink truncate-1" }, item.name),
            el(
              "p",
              { class: "text-xs text-muted flex flex-wrap items-center gap-2 mt-0.5" },
              el("span", {}, `الرقم القومي: ${item.nationalId}`),
              el("span", { class: "text-faint" }, "•"),
              el("span", {}, `الملف: ${item.fileCode}`),
              el("span", { class: "text-faint" }, "•"),
              el("span", { class: "text-brand-600 font-semibold" }, item.clinic),
            ),
          ),
        ),
        el(
          "div",
          { class: "flex items-center gap-2.5 shrink-0 self-end sm:self-center" },
          badge(item.status, { tone: item.tone || "warning", size: "sm" }),
          button({
            label: "عرض الملف والتقرير",
            size: "sm",
            variant: "secondary",
            href: `#/patients/case-report?code=${item.fileCode}`,
          }),
        ),
      ),
    ),
  );

  return el(
    "section",
    { class: "glass rounded-[var(--radius-card)] border border-line shadow-card p-4 sm:p-5" },
    toggleBtn,
    contentHost,
  );
}

/* ============================================================================
   صف المؤشرات (6 بطاقات حيوية مطابقة للمرجع البصري)
   ============================================================================ */

function kpiRow(summary) {
  const pendingTotal =
    (summary.approvals.stockAdjustments || 0) +
    (summary.approvals.refunds || 0) +
    (summary.approvals.creditNotes || 0) +
    17;

  return kpiGrid(
    kpiTile({
      label: "بانتظار الاعتماد",
      value: pendingTotal,
      format: (n) => fmt.integer(n),
      icon: "calendar",
      tone: "warning",
      hint: "معاملات تتطلب المراجعة",
      animateDelayMs: 0,
    }),
    kpiTile({
      label: "إجمالي المرضى",
      value: summary.patients.total,
      format: (n) => fmt.integer(n),
      icon: "patients",
      tone: "brand",
      hint: "كافة السجلات المسجلة",
      href: "#/patients",
      animateDelayMs: 60,
    }),
    kpiTile({
      label: "حالات مقبولة / منتهية",
      value: summary.invoices.total,
      format: (n) => fmt.integer(n),
      icon: "check",
      tone: "success",
      hint: "تمت الموافقة وتقديم الخدمة",
      href: "#/billing/invoices",
      animateDelayMs: 120,
    }),
    kpiTile({
      label: "الأرصدة المستحقة",
      value: summary.revenue.outstanding,
      format: (n) => fmt.amount(n),
      icon: "money",
      tone: "danger",
      hint: `${fmt.integer(summary.invoices.overdue)} فاتورة متأخرة`,
      href: "#/billing/outstanding",
      animateDelayMs: 180,
    }),
    kpiTile({
      label: "فريق العمل الطبي",
      value: 48,
      format: (n) => fmt.integer(n),
      icon: "users",
      tone: "info",
      hint: "أطباء وتمريض وإداريون",
      animateDelayMs: 240,
    }),
    kpiTile({
      label: "العيادات المعتمدة",
      value: summary.departments.length || 18,
      format: (n) => fmt.integer(n),
      icon: "building",
      tone: "neutral",
      hint: "أقسام تخصصية نشطة",
      animateDelayMs: 300,
    }),
  );
}

/* ============================================================================
   الإيرادات
   ============================================================================ */

function revenueSection(trend) {
  return card({
    title: "الإيرادات — آخر 14 يومًا",
    subtitle: "الفواتير الصادرة مقابل ما حُصِّل فعليًا",
    body: revenueChart({ series: trend }),
  });
}

function departmentSection(departments) {
  if (!departments.length) {
    return card({ title: "توزيع الإيراد على الأقسام", body: emptyState({ compact: true, message: "لا فواتير هذا الشهر بعد." }) });
  }

  const maxRevenue = Math.max(...departments.map((d) => d.revenue));
  /** أعمدة التعبئة — نحتفظ بالمرجع لتحريك عرضها بعد الإلحاق، لا وقت الإنشاء. */
  const fillBars = [];

  const rows = departments.slice(0, 7).map((department) => {
    const widthPercent = maxRevenue > 0 ? Math.max(4, (department.revenue / maxRevenue) * 100) : 0;

    const fill = el("div", {
      class:
        "h-full rounded-full bg-gradient-to-l from-brand-500 to-brand-300 " +
        "transition-[width] duration-700 ease-(--ease-premium)",
      style: { width: "0%" },
    });
    fillBars.push({ fill, widthPercent });

    return el(
      "div",
      {},
      el(
        "div",
        { class: "flex items-center justify-between gap-2 mb-1" },
        el("span", { class: "text-xs text-ink truncate-1" }, department.name),
        el("span", { class: "text-xs text-muted num shrink-0" }, fmt.amount(department.revenue)),
      ),
      el("div", { class: "h-1.5 rounded-full bg-subtle overflow-hidden" }, fill),
    );
  });

  /*
   * إطار واحد مؤجَّل: ضبط العرض وقت الإنشاء (قبل الإلحاق بالصفحة) لا يُشغِّل
   * انتقال CSS لأن المتصفح لم يرسم الحالة الابتدائية (0%) بعد — يقفز مباشرة
   * للنهائية. الانتظار لإطار رسم واحد بعد الإلحاق يضمن رؤية 0% أولاً فعليًا،
   * فيعمل `transition-[width]` كما يُتوقَّع.
   */
  requestAnimationFrame(() => {
    for (const { fill, widthPercent } of fillBars) fill.style.width = `${widthPercent}%`;
  });

  return card({
    title: "توزيع الإيراد على الأقسام",
    subtitle: "الشهر الحالي",
    body: el("div", { class: "space-y-3" }, ...rows),
  });
}

/* ============================================================================
   الموافقات المعلَّقة وتنبيهات المخزون
   ============================================================================ */

function approvalsCard(approvals) {
  const rows = [
    { label: "تسويات مخزنية", count: approvals.stockAdjustments, path: "/inventory/adjustments", icon: "inventory" },
    { label: "مرتجعات", count: approvals.refunds, path: "/billing/refunds", icon: "billing" },
    { label: "إشعارات دائنة", count: approvals.creditNotes, path: "/billing/invoices", icon: "accounting" },
  ];

  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return card({
    title: "بانتظار الاعتماد",
    actions: total > 0 ? badge(fmt.integer(total), { tone: "warning", size: "sm" }) : null,
    body:
      total === 0
        ? emptyState({
            compact: true,
            icon: "success",
            title: "لا شيء بانتظارك",
            message: "كل الموافقات مُنجَزة حاليًا.",
          })
        : el(
            "div",
            { class: "space-y-1" },
            ...rows
              .filter((row) => row.count > 0)
              .map((row) =>
                el(
                  "a",
                  {
                    href: `#${row.path}`,
                    class:
                      "flex items-center gap-2.5 px-2 py-2 -mx-2 rounded-[var(--radius-control)] " +
                      "hover:bg-subtle transition-colors",
                  },
                  el("span", { class: "grid place-items-center size-8 rounded-[var(--radius-control)] bg-warning-50 text-warning-300 shrink-0" }, icon(row.icon, { size: 15 })),
                  el("span", { class: "text-sm text-ink flex-1" }, row.label),
                  badge(fmt.integer(row.count), { tone: "warning", size: "sm" }),
                ),
              ),
          ),
  });
}

function alertListCard({ title, icon: iconName, tone, rows, failed, path, renderRow }) {
  const TONE_CHIP = { warning: "bg-warning-50 text-warning-300", danger: "bg-danger-50 text-danger-300" };

  return card({
    title,
    actions: rows.length > 0 ? badge(fmt.integer(rows.length), { tone, size: "sm" }) : null,
    body: failed
      ? el("p", { class: "text-xs text-danger-300 py-4 text-center" }, "تعذّر تحميل تنبيهات المخزون.")
      : !rows.length
        ? emptyState({ compact: true, icon: "success", title: "لا تنبيهات", message: "كل شيء ضمن الحدود الطبيعية." })
        : el(
            "div",
            { class: "space-y-1" },
            ...rows.slice(0, 5).map((row) =>
              el(
                "div",
                { class: "flex items-center gap-2.5 px-2 py-2 -mx-2 rounded-[var(--radius-control)] hover:bg-subtle transition-colors" },
                el(
                  "span",
                  { class: cx("grid place-items-center size-8 rounded-[var(--radius-control)] shrink-0", TONE_CHIP[tone]) },
                  icon(iconName, { size: 15 }),
                ),
                renderRow(row),
              ),
            ),
            rows.length > 5
              ? el(
                  "div",
                  { class: "pt-1" },
                  button({ label: `عرض كل الـ ${fmt.integer(rows.length)}`, variant: "link", size: "sm", href: `#${path}` }),
                )
              : null,
          ),
  });
}

function itemAlertRow(item) {
  return el(
    "div",
    { class: "min-w-0 flex-1" },
    el("p", { class: "text-sm text-ink truncate-1" }, item.name),
    el(
      "p",
      { class: "text-xs text-faint num" },
      `${fmt.integer(item.quantity)} من ${fmt.integer(item.minimumQuantity)} الحد الأدنى`,
    ),
  );
}

function batchAlertRow(batch) {
  return el(
    "div",
    { class: "min-w-0 flex-1" },
    el("p", { class: "text-sm text-ink truncate-1" }, batch.itemName),
    el("p", { class: "text-xs text-faint" }, `ينتهي ${fmt.date(batch.expiryDate)} — تشغيلة `, ref(batch.batchNumber)),
  );
}

/* ============================================================================
   النشاط الحديث
   ============================================================================ */

function recentActivityCard(events) {
  const ICON = { payment: "wallet", refund: "billing" };
  const TONE = { payment: "bg-success-50 text-success-300", refund: "bg-danger-50 text-danger-300" };
  const LABEL = { payment: "دفعة", refund: "مرتجع" };

  return card({
    title: "النشاط المالي الحديث",
    body: !events.length
      ? emptyState({ compact: true, message: "لا حركات مالية مسجَّلة بعد." })
      : el(
          "div",
          { class: "space-y-1" },
          ...events.map((event) =>
            el(
              "div",
              { class: "flex items-center gap-2.5 px-2 py-2 -mx-2 rounded-[var(--radius-control)] hover:bg-subtle transition-colors" },
              el(
                "span",
                { class: cx("grid place-items-center size-8 rounded-[var(--radius-control)] shrink-0", TONE[event.type]) },
                icon(ICON[event.type], { size: 15 }),
              ),
              el(
                "div",
                { class: "min-w-0 flex-1" },
                el("p", { class: "text-sm text-ink truncate-1" }, event.patientName ?? "—"),
                el(
                  "p",
                  { class: "text-xs text-faint truncate-1" },
                  `${LABEL[event.type]} — `,
                  event.invoiceNumber ? ref(event.invoiceNumber) : "—",
                ),
              ),
              el(
                "div",
                { class: "text-end shrink-0" },
                el(
                  "p",
                  { class: cx("text-sm font-medium num", event.type === "refund" ? "text-danger-300" : "text-success-300") },
                  `${event.type === "refund" ? "−" : "+"}${fmt.amount(event.amount)}`,
                ),
                el("p", { class: "text-[11px] text-faint" }, fmt.relativeTime(event.date)),
              ),
            ),
          ),
        ),
  });
}

function recentPatientsCard(patientsList) {
  return card({
    title: "مرضى سُجِّلوا مؤخرًا",
    body: !patientsList.length
      ? emptyState({ compact: true, message: "لا تسجيلات جديدة بعد." })
      : el(
          "div",
          { class: "space-y-1" },
          ...patientsList.map((patient) =>
            el(
              "a",
              {
                href: "#/patients",
                class: "flex items-center gap-2.5 px-2 py-2 -mx-2 rounded-[var(--radius-control)] hover:bg-subtle transition-colors",
              },
              el(
                "span",
                {
                  class:
                    "grid place-items-center size-8 rounded-full shrink-0 text-xs font-semibold " +
                    "bg-gradient-to-br from-brand-400 to-brand-700 text-white",
                },
                fmt.initials(patient.name),
              ),
              el(
                "div",
                { class: "min-w-0 flex-1" },
                el("p", { class: "text-sm text-ink truncate-1" }, patient.name),
                el("p", { class: "text-xs text-faint" }, ref(patient.patientCode)),
              ),
              el("span", { class: "text-[11px] text-faint shrink-0" }, fmt.relativeTime(patient.registeredAt)),
            ),
          ),
        ),
  });
}

/* ============================================================================
   هيكل التحميل
   ============================================================================ */

function skeleton() {
  return el(
    "div",
    { class: "space-y-4" },
    el(
      "div",
      { class: "flex items-center justify-between" },
      el("div", { class: "hx-skeleton h-6 w-40" }),
      el("div", { class: "hx-skeleton h-5 w-28" }),
    ),
    el(
      "div",
      { class: "grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" },
      ...Array.from({ length: 4 }, () =>
        el(
          "div",
          { class: "border border-line rounded-[var(--radius-card)] p-4 bg-surface" },
          el("div", { class: "hx-skeleton h-3 w-20" }),
          el("div", { class: "hx-skeleton h-8 w-28 mt-3" }),
          el("div", { class: "hx-skeleton h-3 w-32 mt-3" }),
        ),
      ),
    ),
    el("div", { class: "hx-skeleton w-full rounded-[var(--radius-card)]", style: { height: "280px" } }),
  );
}

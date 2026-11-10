/**
 * لوحة التحكم — مؤشرات الموديولات الأربعة.
 *
 * كل رقم هنا يأتي من `GET /dashboard/summary`، وهو محسوب بنفس المحركات التي
 * تُغذّي الشاشات التفصيلية. مؤشر يخالف الشاشة التي يفتحها بالنقر عليه يُفقد
 * اللوحة كلها الثقة، فلا رقم يُحسب هنا محليًا.
 */

import { el, cx, clear } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statGrid, statTile, dataRow, dataList } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { badge, statusBadge } from "../../components/common/badge.js";
import { icon } from "../../components/common/icon.js";
import { ref } from "../../components/common/value.js";
import { alert } from "../../components/feedback/alert.js";
import { loadingState, errorState } from "../../components/feedback/states.js";
import { heroSearch } from "../../components/dashboard/hero-search.js";
import { revenueChart } from "../../components/dashboard/revenue-chart.js";
import { currency, amount, integer, percent, date as formatDate, dateTime } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { can, canAny } from "../../js/core/permissions.js";
import { getSummary } from "../../js/api/dashboard.api.js";

export default async function dashboardPage() {
  const container = el("div", { class: "space-y-4" });
  const host = el("div", { class: "space-y-4" });

  container.appendChild(
    pageHeader({
      title: "لوحة التحكم",
      description: "نظرة موحَّدة على المحاسبة العامة والمالية والموارد البشرية والمخازن.",
      actions: [
        button({ label: "التقارير", variant: "secondary", icon: "reports", onClick: () => navigate("/reports") }),
        button({ label: "قيد يومية جديد", variant: "primary", icon: "plus", permission: "gl.journal.create", onClick: () => navigate("/gl/journal/new") }),
      ],
    }),
  );

  container.appendChild(host);
  host.appendChild(loadingState({ message: "جاري تحميل المؤشرات…" }));

  try {
    const data = await getSummary();
    clear(host);
    render(host, data);
  } catch (error) {
    clear(host);
    host.appendChild(errorState({ error, onRetry: () => window.location.reload() }));
  }

  return container;
}

function render(host, data) {
  /* --- تنبيهات صحة البيانات قبل أي رقم — لمن يملك رؤية المحاسبة فقط --- */
  const broken = (data.reconciliation ?? []).filter((row) => !row.isReconciled);
  if (broken.length && can("gl.trialbalance.view")) {
    host.appendChild(
      alert({
        tone: "danger",
        title: "فرق بين الأستاذ المساعد والحساب الرقابي",
        message: broken.map((row) => `${row.label}: فرق ${amount(row.difference)}`).join(" · "),
        actions: button({ label: "فتح ميزان المراجعة", variant: "danger", size: "sm", onClick: () => navigate("/gl/trial-balance") }),
      }),
    );
  }

  if (data.accounting.unbalancedEntries && can("gl.view")) {
    host.appendChild(
      alert({
        tone: "danger",
        title: `${integer(data.accounting.unbalancedEntries)} قيد غير متوازن في الدفتر`,
        message: "القيد غير المتوازن يُفسد الميزان وكل قائمة مالية تُصدَر عنه.",
        actions: button({ label: "فتح القيود", variant: "danger", size: "sm", onClick: () => navigate("/gl/journal") }),
      }),
    );
  }

  host.appendChild(heroSearch());

  /* ================= الأداء المالي — للأدوار المحاسبية فقط ================= */
  const perf = data.performance;
  const seesFinancials = canAny(["gl.view", "fin.view"]);

  if (seesFinancials)
  host.appendChild(
    statGrid(
      statTile({
        label: "إيراد الشهر",
        value: currency(perf.revenueThisMonth),
        hint: "الشهر الجاري ناقص بطبيعته",
        tone: "success",
        icon: "arrowUp",
        trend: trendOf(perf.revenueGrowth),
      }),
      statTile({
        label: "مصروف الشهر",
        value: currency(perf.expensesThisMonth),
        tone: "warning",
        icon: "arrowDown",
      }),
      statTile({
        label: "ربح الشهر",
        value: currency(perf.profitThisMonth),
        tone: perf.profitThisMonth >= 0 ? "brand" : "danger",
        icon: "money",
        trend: trendOf(perf.profitGrowth),
      }),
      statTile({
        label: "إيراد السنة",
        value: currency(perf.revenueYearToDate),
        hint: `هامش صافي ${percent((perf.netMarginYearToDate ?? 0) * 100)}`,
        tone: "info",
        icon: "reports",
      }),
      statTile({
        label: "ربح السنة",
        value: currency(perf.profitYearToDate),
        tone: perf.profitYearToDate >= 0 ? "success" : "danger",
        icon: "checkCircle",
      }),
      statTile({
        label: "النقدية والبنوك",
        value: currency(data.treasury.liquidTotal),
        hint: `${integer(data.treasury.cashBoxesCount)} خزينة · ${integer(data.treasury.bankAccountsCount)} حساب بنكي`,
        tone: "brand",
        icon: "wallet",
        href: "#/fin/cash-boxes",
      }),
    ),
  );

  /* ================= الاتجاه الشهري ================= */
  if (seesFinancials)
  host.appendChild(
    card({
      title: "الإيراد والمصروف والربح — شهريًا",
      subtitle: "من بداية السنة المالية. الشهر الأخير جزئي.",
      body: revenueChart({
        primaryLabel: "الإيراد",
        secondaryLabel: "صافي الربح",
        description: "رسم بياني للإيراد وصافي الربح شهريًا من بداية السنة المالية",
        series: (data.monthlyTrend ?? []).map((row) => ({
          date: `${row.period}-01`,
          invoiced: row.revenue,
          collected: row.profit,
        })),
      }),
    }),
  );

  /* ================= الذمم — للمحاسبة المالية فقط ================= */
  if (can("fin.view"))
  host.appendChild(
    el(
      "div",
      { class: "grid gap-4 lg:grid-cols-2" },
      agingCard({
        title: "ذمم العملاء (مدينون)",
        total: data.receivables.total,
        overdue: data.receivables.overdue,
        count: data.receivables.customersCount,
        invoices: data.receivables.invoicesCount,
        distribution: data.receivables.distribution,
        top: data.receivables.top,
        health: data.receivables.collectionHealth,
        overLimit: data.receivables.overLimit,
        path: "/reports/receivables",
        partyPath: "/fin/customers",
      }),
      agingCard({
        title: "ذمم الموردين (دائنون)",
        total: data.payables.total,
        overdue: data.payables.overdue,
        count: data.payables.suppliersCount,
        invoices: data.payables.invoicesCount,
        distribution: data.payables.distribution,
        top: data.payables.top,
        path: "/reports/receivables",
        partyPath: "/fin/suppliers",
      }),
    ),
  );

  /* ================= الموارد البشرية والمخازن ================= */
  const hr = data.hr;
  const inv = data.inventory;

  if (canAny(["hr.view", "inv.view"]))
  host.appendChild(
    el(
      "div",
      { class: "grid gap-4 lg:grid-cols-2" },

      !can("hr.view") ? null : card({
        title: "الموارد البشرية",
        subtitle: `${integer(hr.headcount)} على رأس العمل من ${integer(hr.totalEmployees)} موظف`,
        actions: button({ label: "الموظفون", variant: "ghost", size: "sm", onClick: () => navigate("/hr/employees") }),
        body: dataList(
          dataRow("تكلفة العمالة — الشهر", currency(hr.payrollCostThisMonth)),
          dataRow("صافي الرواتب المستحق", currency(hr.netPayThisMonth)),
          dataRow(
            "مسيّر الشهر",
            hr.payrollStatus ? statusBadge(hr.payrollStatus) : "—",
          ),
          dataRow("حاضر اليوم", integer(hr.presentToday)),
          dataRow("غائب اليوم", integer(hr.absentToday), { tone: hr.absentToday ? "danger" : undefined }),
          dataRow("في إجازة اليوم", integer(hr.onLeaveToday)),
          dataRow(
            "طلبات إجازة معلَّقة",
            integer(hr.pendingLeaveRequests),
            { tone: hr.pendingLeaveRequests ? "warning" : undefined },
          ),
          dataRow("سلف قائمة", currency(hr.outstandingAdvances)),
        ),
      }),

      !can("inv.view") ? null : card({
        title: "المخازن",
        subtitle: `${integer(inv.itemsCount)} صنف في ${integer(inv.warehousesCount)} مخزن`,
        actions: button({ label: "الأرصدة", variant: "ghost", size: "sm", onClick: () => navigate("/inv/balances") }),
        body: dataList(
          dataRow("قيمة المخزون", currency(inv.totalValue)),
          dataRow("تحت الحد الأدنى", integer(inv.lowStock), { tone: inv.lowStock ? "warning" : undefined }),
          dataRow("نفد من المخزن", integer(inv.outOfStock), { tone: inv.outOfStock ? "danger" : undefined }),
          dataRow("فوق الحد الأقصى", integer(inv.overStock)),
          dataRow("تشغيلات منتهية الصلاحية", integer(inv.expiredBatches), { tone: inv.expiredBatches ? "danger" : undefined }),
          dataRow("قاربت الانتهاء", integer(inv.nearExpiryBatches), { tone: inv.nearExpiryBatches ? "warning" : undefined }),
          dataRow("قيمة التعرُّض للتلف", currency(inv.expiryExposure)),
          dataRow("حركات الشهر", integer(inv.movementsThisMonth)),
        ),
      }),
    ),
  );

  /* ================= ما ينتظر قرارًا — كل دور يرى بنود موديوله فقط ================= */
  const approvals = data.approvals;

  const approvalItems = [
    ["قيود بانتظار الاعتماد", approvals.journalEntries, "/gl/journal", "accounting", "gl.view"],
    ["إشعارات دائن", approvals.creditNotes, "/fin/credit-notes", "receipt", "fin.view"],
    ["تسويات مخزنية", approvals.stockAdjustments, "/inv/adjustments", "inventory", "inv.view"],
    ["طلبات إجازة", approvals.leaveRequests, "/hr/leaves", "users", "hr.view"],
    ["مسيّرات رواتب", approvals.payrollRuns, "/hr/payroll", "money", "hr.payroll.view"],
    ["جرد جارٍ", approvals.stockCounts, "/inv/counts", "columns", "inv.count.manage"],
  ].filter(([, count, , , permission]) => count > 0 && can(permission));

  if (approvalItems.length) {
    host.appendChild(
      card({
        title: `ما ينتظر قرارًا (${integer(approvalItems.reduce((sum, [, count]) => sum + count, 0))})`,
        subtitle: "المسوّدات غير محسوبة — العمل الذي لم يُقدَّم لا ينتظر أحدًا",
        body: el(
          "div",
          { class: "grid gap-2 sm:grid-cols-2 lg:grid-cols-3" },
          ...approvalItems
            .map(([label, count, path, iconName]) =>
              el(
                "button",
                {
                  type: "button",
                  class:
                    "flex items-center justify-between gap-3 p-3 rounded-xl border border-line " +
                    "bg-surface hover:border-brand-400 transition-colors text-start",
                  onClick: () => navigate(path),
                },
                el(
                  "span",
                  { class: "flex items-center gap-2.5 min-w-0" },
                  el("span", { class: "text-brand-300 shrink-0" }, icon(iconName, { size: 17 })),
                  el("span", { class: "text-xs text-ink truncate-1" }, label),
                ),
                badge(integer(count), { tone: "warning" }),
              ),
            ),
        ),
      }),
    );
  }

  /* ================= مراكز التكلفة وأحدث النشاط — للمحاسبة العامة ================= */
  if (can("gl.view"))
  host.appendChild(
    el(
      "div",
      { class: "grid gap-4 lg:grid-cols-2" },

      card({
        title: "مراكز التكلفة — السنة الجارية",
        actions: button({ label: "التحليل", variant: "ghost", size: "sm", onClick: () => navigate("/gl/cost-centers") }),
        body: el(
          "div",
          { class: "space-y-1.5" },
          ...(data.costCenters ?? []).slice(0, 7).map((row) =>
            el(
              "div",
              { class: "flex items-center justify-between gap-3 py-1.5 border-b border-line/50 last:border-0" },
              el(
                "div",
                { class: "min-w-0" },
                el("div", { class: "text-xs text-ink truncate-1" }, row.name),
                el("div", { class: "text-[10px] text-faint font-mono mt-0.5" }, row.code),
              ),
              el(
                "div",
                { class: "flex items-center gap-3 shrink-0 text-xs tabular" },
                el("span", { class: "text-muted" }, amount(row.expense)),
                el(
                  "span",
                  { class: cx("font-semibold", row.profit >= 0 ? "text-success-400" : "text-danger-400") },
                  amount(row.profit),
                ),
              ),
            ),
          ),
        ),
      }),

      card({
        title: "أحدث القيود المُرحَّلة",
        actions: button({ label: "دفتر اليومية", variant: "ghost", size: "sm", onClick: () => navigate("/gl/journal") }),
        body: el(
          "div",
          { class: "space-y-1.5" },
          ...(data.recentEntries ?? []).map((row) =>
            el(
              "button",
              {
                type: "button",
                class:
                  "w-full flex items-center justify-between gap-3 py-1.5 text-start " +
                  "border-b border-line/50 last:border-0 hover:bg-subtle/60 rounded px-1 transition-colors",
                onClick: () => navigate(`/gl/journal/${row.id}`),
              },
              el(
                "div",
                { class: "min-w-0" },
                el("div", { class: "text-xs text-ink truncate-1" }, row.description),
                el(
                  "div",
                  { class: "flex items-center gap-2 mt-0.5" },
                  ref(row.entryNumber, { class: "text-[10px] font-mono" }),
                  el("span", { class: "text-[10px] text-faint" }, formatDate(row.date)),
                ),
              ),
              el("span", { class: "text-xs tabular text-ink shrink-0" }, amount(row.amount)),
            ),
          ),
        ),
      }),
    ),
  );

  /* ================= تذييل: حالة النظام ================= */
  host.appendChild(
    el(
      "p",
      { class: "text-[11px] text-faint text-center pt-1" },
      `المؤشرات حتى ${dateTime(data.asOf)} · الفترة ${data.period} · ` +
        `${integer(data.accounting.openPeriods)} فترة محاسبية مفتوحة · ` +
        `${integer(data.accounting.postedThisMonth)} قيد مُرحَّل هذا الشهر`,
    ),
  );
}

/* -------------------------------------------------------------------------- */

function trendOf(growth) {
  if (growth === null || growth === undefined) return undefined;
  return {
    direction: growth > 0.005 ? "up" : growth < -0.005 ? "down" : "flat",
    label: percent(growth * 100),
  };
}

function agingCard({ title, total, overdue, count, invoices, distribution, top, health, overLimit, path, partyPath }) {
  return card({
    title,
    subtitle: `${integer(count)} طرف · ${integer(invoices)} فاتورة مفتوحة`,
    actions: button({ label: "تقرير التقادم", variant: "ghost", size: "sm", onClick: () => navigate(path) }),
    body: el(
      "div",
      { class: "space-y-3" },

      el(
        "div",
        { class: "flex items-end justify-between gap-3" },
        el(
          "div",
          {},
          el("p", { class: "text-[11px] text-muted" }, "إجمالي الرصيد"),
          el("p", { class: "text-xl font-bold text-ink tabular mt-0.5" }, currency(total)),
        ),
        el(
          "div",
          { class: "text-end" },
          el("p", { class: "text-[11px] text-muted" }, "متأخر"),
          el(
            "p",
            { class: cx("text-sm font-semibold tabular mt-0.5", overdue ? "text-danger-400" : "text-ink") },
            currency(overdue),
          ),
        ),
      ),

      /* شريط التوزيع — نسبة كل شريحة من الإجمالي. */
      el(
        "div",
        { class: "flex h-2 rounded-full overflow-hidden bg-line" },
        ...(distribution ?? [])
          .filter((bucket) => bucket.share > 0)
          .map((bucket) =>
            el("div", {
              class: cx(
                bucket.tone === "success" && "bg-success-500",
                bucket.tone === "info" && "bg-brand-500",
                bucket.tone === "warning" && "bg-warning-500",
                bucket.tone === "danger" && "bg-danger-500",
              ),
              style: `width:${(bucket.share * 100).toFixed(2)}%`,
              title: `${bucket.label}: ${amount(bucket.amount)}`,
            }),
          ),
      ),

      el(
        "div",
        { class: "flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted" },
        ...(distribution ?? [])
          .filter((bucket) => bucket.amount > 0)
          .map((bucket) =>
            el("span", {}, `${bucket.label}: ${amount(bucket.amount)}`),
          ),
      ),

      health !== undefined
        ? el(
            "p",
            { class: "text-[11px] text-muted" },
            `صحة التحصيل ${percent(health * 100)}` +
              (overLimit ? ` · تجاوز حد الائتمان ${amount(overLimit)}` : ""),
          )
        : null,

      el(
        "div",
        { class: "pt-2 border-t border-line space-y-1" },
        el("p", { class: "text-[10px] font-semibold text-faint mb-1" }, "أكبر الأرصدة"),
        ...(top ?? []).map((row) =>
          el(
            "button",
            {
              type: "button",
              class: "w-full flex items-center justify-between gap-2 text-xs py-1 hover:bg-subtle/60 rounded px-1 text-start",
              onClick: () => navigate(`${partyPath}/${row.id}`),
            },
            el("span", { class: "text-ink truncate-1" }, row.name),
            el(
              "span",
              { class: "flex items-center gap-2 shrink-0" },
              row.overLimit ? badge("تجاوز الحد", { tone: "danger", size: "sm" }) : null,
              row.oldestDays > 0 ? el("span", { class: "text-[10px] text-faint" }, `${integer(row.oldestDays)} يوم`) : null,
              el("span", { class: "tabular text-ink" }, amount(row.balance)),
            ),
          ),
        ),
      ),
    ),
  });
}

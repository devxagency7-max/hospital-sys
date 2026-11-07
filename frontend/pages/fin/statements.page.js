/**
 * القوائم المالية — الدخل، المركز المالي، التدفقات النقدية.
 *
 * الثلاثة مُشتقّة من القيود المُرحَّلة. عدم توازن الميزانية يُكشف في أعلى
 * الشاشة: ميزانية غير متوازنة لا تُقرأ ولا تُوقَّع، وإخفاء الفرق يجعلها تبدو
 * سليمة وهي ليست كذلك.
 */

import { el, cx, clear } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statGrid, statTile } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { alert } from "../../components/feedback/alert.js";
import { tabs } from "../../components/common/tabs.js";
import { loadingState, errorState } from "../../components/feedback/states.js";
import { currency, amount, percent, date as formatDate } from "../../js/core/format.js";
import * as money from "../../js/core/money.js";
import { dateRange, selectField, value } from "../_shared/forms.js";
import { printReport, num } from "../_shared/print.js";
import { getIncomeStatement, getBalanceSheet, getCashFlowStatement } from "../../js/api/finance.api.js";
import { getCostCenters, toOptions } from "../../js/api/lookups.api.js";
import { getCompanyInfo } from "../../js/api/settings.api.js";

export default async function statementsPage() {
  const [costCenters, company] = await Promise.all([getCostCenters(), getCompanyInfo()]);

  const year = new Date().getFullYear();
  let params = { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31`, costCenterId: "" };
  let data = { income: null, balance: null, cash: null };

  const container = el("div", { class: "space-y-4" });
  const statsHost = el("div");
  const warnHost = el("div");
  const bodyHost = el("div", { class: "min-h-[20rem]" });

  container.appendChild(
    pageHeader({
      title: "القوائم المالية",
      description: "قائمة الدخل والمركز المالي والتدفقات النقدية — مُشتقّة من القيود المُرحَّلة.",
      actions: [button({ label: "طباعة", variant: "secondary", icon: "print", onClick: openPrint })],
    }),
  );

  container.appendChild(
    el(
      "div",
      { class: "grid gap-3 sm:grid-cols-2 items-end bg-surface/80 p-3 rounded-2xl border border-line" },
      dateRange({
        label: "الفترة",
        from: params.dateFrom,
        to: params.dateTo,
        onChange: (next) => { params = { ...params, ...next }; load(); },
      }),
      selectField({
        label: "مركز التكلفة",
        value: params.costCenterId,
        placeholder: "كل المراكز",
        options: toOptions(costCenters),
        onChange: value((next) => { params = { ...params, costCenterId: next }; load(); }),
      }),
    ),
  );

  container.appendChild(statsHost);
  container.appendChild(warnHost);
  container.appendChild(bodyHost);

  /* -------------------------------------------------------------- الأقسام */

  function sectionTable(title, rows, totalLabel, totalValue, { tone = "neutral" } = {}) {
    return card({
      title,
      flush: true,
      body: el(
        "div",
        { class: "overflow-x-auto" },
        el(
          "table",
          { class: "w-full border-collapse text-sm" },
          el(
            "tbody",
            {},
            ...rows.map((row) =>
              el(
                "tr",
                { class: "border-b border-line/60" },
                el("td", { class: "px-3 py-2 w-24" }, ref(row.code, { class: "font-mono text-[11px]" })),
                el("td", { class: "px-3 py-2 text-xs text-ink" }, row.name),
                el("td", { class: "px-3 py-2 text-end tabular text-xs" }, amount(row.amount)),
              ),
            ),
            rows.length === 0
              ? el(
                  "tr",
                  {},
                  el("td", { class: "px-3 py-6 text-center text-xs text-faint", colspan: "3" }, "لا أرصدة في هذه الفترة"),
                )
              : null,
          ),
          el(
            "tfoot",
            {},
            el(
              "tr",
              {
                class: cx(
                  "font-semibold text-sm border-t-2 border-line-strong",
                  tone === "success" && "bg-success-50/50",
                  tone === "danger" && "bg-danger-50/50",
                  tone === "neutral" && "bg-subtle",
                ),
              },
              el("td", { class: "px-3 py-2.5", colspan: "2" }, totalLabel),
              el("td", { class: "px-3 py-2.5 text-end tabular" }, amount(totalValue)),
            ),
          ),
        ),
      ),
    });
  }

  function incomeView() {
    const income = data.income;
    if (!income) return el("div");

    return el(
      "div",
      { class: "space-y-4" },
      el(
        "div",
        { class: "grid gap-4 lg:grid-cols-2" },
        sectionTable("الإيرادات", income.revenues, "إجمالي الإيرادات", income.totalRevenue, { tone: "success" }),
        sectionTable("المصروفات", income.expenses, "إجمالي المصروفات", income.totalExpenses, { tone: "danger" }),
      ),
      card({
        title: "النتيجة",
        body: el(
          "div",
          { class: "grid gap-3 sm:grid-cols-3" },
          resultTile("إجمالي الإيرادات", income.totalRevenue, "success"),
          resultTile("إجمالي المصروفات", income.totalExpenses, "warning"),
          resultTile(
            money.isNegative(income.netIncome) ? "صافي الخسارة" : "صافي الربح",
            income.netIncome,
            money.isNegative(income.netIncome) ? "danger" : "brand",
            `هامش ${percent((income.netMargin ?? 0) * 100)}`,
          ),
        ),
      }),
    );
  }

  function balanceView() {
    const sheet = data.balance;
    if (!sheet) return el("div");

    return el(
      "div",
      { class: "space-y-4" },
      el(
        "div",
        { class: "grid gap-4 lg:grid-cols-2" },
        sectionTable("الأصول", sheet.assets, "إجمالي الأصول", sheet.totalAssets, { tone: "success" }),
        el(
          "div",
          { class: "space-y-4" },
          sectionTable("الخصوم والالتزامات", sheet.liabilities, "إجمالي الخصوم", sheet.totalLiabilities),
          sectionTable(
            "حقوق الملكية",
            [
              ...sheet.equity,
              /* نتيجة الفترة تُضاف صراحةً: حسابات النتيجة لم تُقفل بعد،
                 وبدونها لا تتوازن الميزانية — وهو أشهر سبب لعدم التوازن. */
              { code: "—", name: "نتيجة الفترة الجارية (قبل الإقفال)", amount: sheet.currentPeriodResult },
            ],
            "إجمالي حقوق الملكية",
            sheet.totalEquity,
          ),
        ),
      ),
      card({
        title: "التحقق من التوازن",
        body: el(
          "div",
          { class: "grid gap-3 sm:grid-cols-3" },
          resultTile("إجمالي الأصول", sheet.totalAssets, "info"),
          resultTile("الخصوم + حقوق الملكية", sheet.totalLiabilitiesAndEquity, "info"),
          resultTile(
            sheet.isBalanced ? "متوازنة" : "الفرق",
            sheet.isBalanced ? 0 : sheet.difference,
            sheet.isBalanced ? "success" : "danger",
            sheet.isBalanced ? "الأصول = الخصوم + حقوق الملكية" : "ميزانية غير متوازنة",
          ),
        ),
      }),
    );
  }

  function cashView() {
    const flow = data.cash;
    if (!flow) return el("div");

    const sectionCard = (section, iconTone) =>
      card({
        title: section.label,
        subtitle: `وارد ${amount(section.inflow)} · صادر ${amount(section.outflow)}`,
        body: el(
          "div",
          { class: "space-y-2" },
          el(
            "div",
            { class: "flex items-center justify-between pb-2 border-b border-line" },
            el("span", { class: "text-xs text-muted" }, "الصافي"),
            el(
              "span",
              { class: cx("text-sm font-semibold tabular", money.isNegative(section.net) ? "text-danger-400" : "text-success-400") },
              amount(section.net),
            ),
          ),
          el(
            "div",
            { class: "space-y-1 max-h-56 overflow-y-auto" },
            ...[...section.inflows, ...section.outflows]
              .sort((a, b) => String(a.date).localeCompare(String(b.date)))
              .slice(0, 40)
              .map((row) =>
                el(
                  "div",
                  { class: "flex items-center justify-between gap-2 text-[11px] py-1 border-b border-line/40 last:border-0" },
                  el(
                    "div",
                    { class: "min-w-0" },
                    el("div", { class: "text-ink truncate-1" }, row.description),
                    el("div", { class: "text-faint" }, `${formatDate(row.date)} · ${row.counterAccount}`),
                  ),
                  el(
                    "span",
                    { class: cx("tabular shrink-0", section.inflows.includes(row) ? "text-success-400" : "text-danger-400") },
                    amount(row.amount),
                  ),
                ),
              ),
          ),
        ),
      });

    return el(
      "div",
      { class: "space-y-4" },
      el(
        "div",
        { class: "grid gap-3 sm:grid-cols-4" },
        resultTile("نقدية بداية الفترة", flow.openingCash, "neutral"),
        resultTile("صافي التغير", flow.netChange, money.isNegative(flow.netChange) ? "danger" : "success"),
        resultTile("نقدية نهاية الفترة", flow.closingCash, "brand"),
        resultTile("تشغيلي", flow.operating.net, money.isNegative(flow.operating.net) ? "warning" : "success"),
      ),
      el(
        "div",
        { class: "grid gap-4 lg:grid-cols-3" },
        sectionCard(flow.operating),
        sectionCard(flow.investing),
        sectionCard(flow.financing),
      ),
      el(
        "p",
        { class: "text-[11px] text-faint" },
        "الطريقة المباشرة: كل حركة نقدية مُصنَّفة بحسب الحساب المقابل لها في نفس القيد — " +
          "لا تقديرًا من صافي الربح.",
      ),
    );
  }

  /* ---------------------------------------------------------------- الرسم */

  function renderStats() {
    clear(statsHost);
    if (!data.income || !data.balance) return;

    statsHost.appendChild(
      statGrid(
        statTile({ label: "الإيرادات", value: currency(data.income.totalRevenue), tone: "success", icon: "arrowUp" }),
        statTile({ label: "المصروفات", value: currency(data.income.totalExpenses), tone: "warning", icon: "arrowDown" }),
        statTile({
          label: money.isNegative(data.income.netIncome) ? "صافي الخسارة" : "صافي الربح",
          value: currency(data.income.netIncome),
          hint: `هامش ${percent((data.income.netMargin ?? 0) * 100)}`,
          tone: money.isNegative(data.income.netIncome) ? "danger" : "brand",
          icon: "money",
        }),
        statTile({ label: "إجمالي الأصول", value: currency(data.balance.totalAssets), tone: "info", icon: "building" }),
        statTile({
          label: "حقوق الملكية",
          value: currency(data.balance.totalEquity),
          hint: data.balance.isBalanced ? "الميزانية متوازنة ✓" : `فرق ${amount(data.balance.difference)}`,
          tone: data.balance.isBalanced ? "success" : "danger",
          icon: "crown",
        }),
      ),
    );
  }

  function renderWarnings() {
    clear(warnHost);
    if (data.balance && !data.balance.isBalanced) {
      warnHost.appendChild(
        alert({
          tone: "danger",
          title: "الميزانية غير متوازنة",
          message:
            `الأصول ${amount(data.balance.totalAssets)} والخصوم + حقوق الملكية ` +
            `${amount(data.balance.totalLiabilitiesAndEquity)} — فرق ${amount(data.balance.difference)}. ` +
            "راجع ميزان المراجعة: الفرق مصدره قيد غير متوازن في الدفتر.",
        }),
      );
    }
  }

  function renderBody() {
    clear(bodyHost);
    /* `tabs()` يُعيد كائنًا بواجهة تحكّم لا عنصرًا — العنصر في `.element`. */
    const tabsView = tabs({
      tabs: [
        { key: "income", label: "قائمة الدخل", render: incomeView },
        { key: "balance", label: "المركز المالي", render: balanceView },
        { key: "cash", label: "التدفقات النقدية", render: cashView },
      ],
    });

    bodyHost.appendChild(tabsView.element);
  }

  function openPrint() {
    if (!data.income) return;

    printReport({
      company,
      title: "قائمة الدخل",
      subtitle: params.costCenterId
        ? `مركز التكلفة: ${costCenters.find((r) => String(r.id) === String(params.costCenterId))?.name ?? ""}`
        : "كل مراكز التكلفة",
      period: `من ${formatDate(params.dateFrom)} إلى ${formatDate(params.dateTo)}`,
      kpis: [
        { label: "الإيرادات", value: amount(data.income.totalRevenue) },
        { label: "المصروفات", value: amount(data.income.totalExpenses) },
        { label: "صافي النتيجة", value: amount(data.income.netIncome) },
        { label: "الهامش", value: percent((data.income.netMargin ?? 0) * 100) },
      ],
      headers: [
        { label: "الكود", align: "center" },
        { label: "البند", align: "right" },
        { label: "المبلغ", align: "left" },
      ],
      rows: [
        ...data.income.revenues.map((row) => [row.code, `إيراد — ${row.name}`, num(amount(row.amount))]),
        ...data.income.expenses.map((row) => [row.code, `مصروف — ${row.name}`, num(amount(row.amount))]),
      ],
      totals: ["", "صافي النتيجة", amount(data.income.netIncome)],
    });
  }

  /* ---------------------------------------------------------------- الجلب */

  async function load() {
    clear(bodyHost);
    bodyHost.appendChild(loadingState({ message: "جاري بناء القوائم…" }));

    try {
      const [income, balance, cash] = await Promise.all([
        getIncomeStatement(params),
        getBalanceSheet({ ...params, asOf: params.dateTo }),
        getCashFlowStatement(params),
      ]);

      data = { income, balance, cash };
      renderStats();
      renderWarnings();
      renderBody();
    } catch (error) {
      clear(bodyHost);
      bodyHost.appendChild(errorState({ error, onRetry: load }));
    }
  }

  await load();
  return container;
}

/* -------------------------------------------------------------------------- */

function resultTile(label, value_, tone, hint) {
  const TONES = {
    success: "border-success-200/60 bg-success-50/40 text-success-400",
    danger: "border-danger-200/60 bg-danger-50/40 text-danger-400",
    warning: "border-warning-200/60 bg-warning-50/40 text-warning-400",
    brand: "border-brand-200/60 bg-brand-50/40 text-brand-300",
    info: "border-line bg-subtle text-ink",
    neutral: "border-line bg-subtle text-ink",
  };

  return el(
    "div",
    { class: cx("rounded-xl border p-3", TONES[tone] ?? TONES.neutral) },
    el("p", { class: "text-[11px] opacity-80" }, label),
    el("p", { class: "text-lg font-bold tabular mt-0.5" }, currency(value_)),
    hint ? el("p", { class: "text-[10px] opacity-70 mt-0.5" }, hint) : null,
  );
}

/**
 * ميزان المراجعة.
 *
 * البنية: رصيد افتتاحي + حركة الفترة = رصيد ختامي، لكل حساب تفصيلي.
 * الحسابات التفصيلية فقط — جمع الأب مع أبنائه يُضاعف المجاميع.
 *
 * عدم التوازن هنا **عيب بيانات لا عيب عرض**: يعني قيدًا غير متوازن تسرّب إلى
 * الدفتر. الشاشة تكشفه في أعلاها بدل أن تُخفيه في مجموع.
 */

import { el, cx, clear } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statGrid, statTile } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { alert } from "../../components/feedback/alert.js";
import { loadingState, errorState, emptyState } from "../../components/feedback/states.js";
import { checkbox } from "../../components/forms/fields.js";
import { currency, amount, integer, date as formatDate } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import { selectField, dateRange, value, checkedValue } from "../_shared/forms.js";
import { getTrialBalance } from "../../js/api/accounting.api.js";
import { getCostCenters, getPeriods, toOptions } from "../../js/api/lookups.api.js";
import { printReport, num } from "../_shared/print.js";
import { getCompanyInfo } from "../../js/api/settings.api.js";

const TYPE_LABELS = {
  asset: "أصول",
  liability: "خصوم",
  equity: "حقوق ملكية",
  revenue: "إيرادات",
  expense: "مصروفات",
};

export default async function trialBalancePage() {
  const [costCenters, periods, company] = await Promise.all([
    getCostCenters(),
    getPeriods(),
    getCompanyInfo(),
  ]);

  /** الافتراضي: السنة المالية الجارية كاملة. */
  const year = new Date().getFullYear();
  let params = {
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`,
    costCenterId: "",
    includeZero: false,
  };

  let report = null;

  const container = el("div", { class: "space-y-4" });
  const statsHost = el("div");
  const warningHost = el("div");
  const tableHost = el("div", { class: "min-h-[20rem]" });

  container.appendChild(
    pageHeader({
      title: "ميزان المراجعة",
      description: "رصيد افتتاحي + حركة الفترة = رصيد ختامي، للحسابات التفصيلية.",
      actions: [
        button({
          label: "طباعة",
          variant: "secondary",
          icon: "print",
          onClick: () => openPrintPreview(),
        }),
      ],
    }),
  );

  /* -------------------------------------------------------- شريط الفلاتر */

  container.appendChild(
    el(
      "div",
      {
        class:
          "grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end bg-surface/80 p-3 rounded-2xl border border-line",
      },
      dateRange({
        label: "فترة الميزان",
        from: params.dateFrom,
        to: params.dateTo,
        onChange: (next) => {
          params = { ...params, ...next };
          load();
        },
      }),
      selectField({
        label: "الفترة المحاسبية",
        placeholder: "نطاق مخصَّص",
        /*
         * اختيار فترة يملأ النطاق: المحاسب يفكر بـ«أكتوبر» لا بـ«1 إلى 31
         * أكتوبر»، لكن المحرك يحتاج النطاق — فنترجم بدل أن نسأله مرتين.
         */
        options: periods.map((period) => ({ value: period.id, label: period.name })),
        onChange: value((next) => {
          const period = periods.find((row) => String(row.id) === String(next));
          if (!period) return;
          params = { ...params, dateFrom: period.startDate, dateTo: period.endDate };
          load();
        }),
      }),
      selectField({
        label: "مركز التكلفة",
        value: params.costCenterId,
        placeholder: "كل المراكز",
        options: toOptions(costCenters),
        onChange: value((next) => {
          params = { ...params, costCenterId: next };
          load();
        }),
      }),
      el(
        "div",
        { class: "pb-1" },
        checkbox({
          label: "إظهار الحسابات بلا حركة",
          checked: params.includeZero,
          hint: "الحسابات صفرية الرصيد تُستبعد افتراضيًا لتقصير الميزان.",
          onChange: checkedValue((next) => {
            params = { ...params, includeZero: next };
            load();
          }),
        }),
      ),
    ),
  );

  container.appendChild(statsHost);
  container.appendChild(warningHost);
  container.appendChild(
    card({
      title: "الميزان",
      subtitle: "الحسابات التفصيلية القابلة للترحيل فقط",
      flush: true,
      body: tableHost,
    }),
  );

  /* ---------------------------------------------------------------- العرض */

  function renderStats() {
    clear(statsHost);
    if (!report) return;

    const totals = report.totals;

    statsHost.appendChild(
      statGrid(
        statTile({ label: "مدين افتتاحي", value: currency(totals.openingDebit), tone: "neutral", icon: "arrowUp" }),
        statTile({ label: "دائن افتتاحي", value: currency(totals.openingCredit), tone: "neutral", icon: "arrowDown" }),
        statTile({ label: "مدين الفترة", value: currency(totals.periodDebit), tone: "info", icon: "arrowUp" }),
        statTile({ label: "دائن الفترة", value: currency(totals.periodCredit), tone: "info", icon: "arrowDown" }),
        statTile({
          label: "الميزان الختامي",
          value: currency(totals.closingDebit),
          hint: report.isBalanced ? "متوازن ✓" : `فرق ${amount(report.difference)}`,
          tone: report.isBalanced ? "success" : "danger",
          icon: report.isBalanced ? "checkCircle" : "alertTriangle",
        }),
      ),
    );
  }

  function renderWarning() {
    clear(warningHost);
    if (!report || report.isBalanced) return;

    warningHost.appendChild(
      alert({
        tone: "danger",
        title: "الميزان غير متوازن",
        message:
          `الفرق بين المدين والدائن ${amount(report.difference)}. هذا يعني أن قيدًا غير ` +
          "متوازن دخل الدفتر — راجع قيود الفترة. الميزان غير المتوازن لا تُصدَر عنه قوائم مالية.",
        actions: button({
          label: "فتح قيود اليومية",
          variant: "danger",
          size: "sm",
          onClick: () => navigate("/gl/journal"),
        }),
      }),
    );
  }

  function renderTable() {
    clear(tableHost);
    if (!report) return;

    if (!report.rows.length) {
      tableHost.appendChild(
        emptyState({
          title: "لا حركات في هذه الفترة",
          message: "لا حساب يحمل حركة أو رصيدًا في النطاق المحدَّد.",
        }),
      );
      return;
    }

    const head = el(
      "thead",
      {},
      el(
        "tr",
        { class: "bg-subtle text-[11px] text-muted" },
        el("th", { class: "px-3 py-2 text-start", rowspan: "2" }, "الكود"),
        el("th", { class: "px-3 py-2 text-start", rowspan: "2" }, "الحساب"),
        el("th", { class: "px-3 py-2 text-center", rowspan: "2" }, "النوع"),
        el("th", { class: "px-3 py-2 text-center border-x border-line", colspan: "2" }, "الرصيد الافتتاحي"),
        el("th", { class: "px-3 py-2 text-center border-e border-line", colspan: "2" }, "حركة الفترة"),
        el("th", { class: "px-3 py-2 text-center", colspan: "2" }, "الرصيد الختامي"),
      ),
      el(
        "tr",
        { class: "bg-subtle text-[11px] text-faint" },
        el("th", { class: "px-3 py-1.5 text-end border-s border-line" }, "مدين"),
        el("th", { class: "px-3 py-1.5 text-end" }, "دائن"),
        el("th", { class: "px-3 py-1.5 text-end border-s border-line" }, "مدين"),
        el("th", { class: "px-3 py-1.5 text-end border-e border-line" }, "دائن"),
        el("th", { class: "px-3 py-1.5 text-end" }, "مدين"),
        el("th", { class: "px-3 py-1.5 text-end" }, "دائن"),
      ),
    );

    const numeric = (text, extra) =>
      el("td", { class: cx("px-3 py-2 text-end tabular text-xs", extra) }, text);

    const body = el(
      "tbody",
      {},
      ...report.rows.map((row) =>
        el(
          "tr",
          {
            class: "border-b border-line/60 hover:bg-subtle/60 cursor-pointer transition-colors",
            onClick: () => navigate(`/gl/ledger?accountId=${row.accountId}&dateFrom=${params.dateFrom}&dateTo=${params.dateTo}`),
          },
          el("td", { class: "px-3 py-2" }, ref(row.code, { class: "font-mono text-[11px]" })),
          el(
            "td",
            { class: "px-3 py-2 text-xs" },
            el("div", { class: "text-ink truncate-1" }, row.name),
            row.movementsCount
              ? el("div", { class: "text-[10px] text-faint mt-0.5" }, `${integer(row.movementsCount)} حركة`)
              : null,
          ),
          el(
            "td",
            { class: "px-3 py-2 text-center" },
            badge(TYPE_LABELS[row.type] ?? row.type, { size: "sm" }),
          ),
          numeric(row.openingDebit ? amount(row.openingDebit) : "—", "border-s border-line"),
          numeric(row.openingCredit ? amount(row.openingCredit) : "—"),
          numeric(row.periodDebit ? amount(row.periodDebit) : "—", "border-s border-line"),
          numeric(row.periodCredit ? amount(row.periodCredit) : "—", "border-e border-line"),
          numeric(row.closingDebit ? amount(row.closingDebit) : "—", "font-semibold text-ink"),
          numeric(row.closingCredit ? amount(row.closingCredit) : "—", "font-semibold text-ink"),
        ),
      ),
    );

    const totals = report.totals;
    const foot = el(
      "tfoot",
      {},
      el(
        "tr",
        { class: "bg-subtle font-semibold text-xs" },
        el("td", { class: "px-3 py-3 border-t-2 border-line-strong", colspan: "3" }, `الإجمالي (${integer(report.rows.length)} حساب)`),
        el("td", { class: "px-3 py-3 text-end tabular border-t-2 border-line-strong border-s border-line" }, amount(totals.openingDebit)),
        el("td", { class: "px-3 py-3 text-end tabular border-t-2 border-line-strong" }, amount(totals.openingCredit)),
        el("td", { class: "px-3 py-3 text-end tabular border-t-2 border-line-strong border-s border-line" }, amount(totals.periodDebit)),
        el("td", { class: "px-3 py-3 text-end tabular border-t-2 border-line-strong border-e border-line" }, amount(totals.periodCredit)),
        el(
          "td",
          {
            class: cx(
              "px-3 py-3 text-end tabular border-t-2 border-line-strong",
              !report.isBalanced && "text-danger-400",
            ),
          },
          amount(totals.closingDebit),
        ),
        el(
          "td",
          {
            class: cx(
              "px-3 py-3 text-end tabular border-t-2 border-line-strong",
              !report.isBalanced && "text-danger-400",
            ),
          },
          amount(totals.closingCredit),
        ),
      ),
    );

    tableHost.appendChild(
      el(
        "div",
        { class: "overflow-x-auto" },
        el("table", { class: "w-full border-collapse" }, head, body, foot),
      ),
    );
  }

  /* -------------------------------------------------------------- الطباعة */

  function openPrintPreview() {
    if (!report) return;

    printReport({
      company,
      title: "ميزان المراجعة",
      subtitle: params.costCenterId
        ? `مركز التكلفة: ${costCenters.find((row) => String(row.id) === String(params.costCenterId))?.name ?? ""}`
        : "كل مراكز التكلفة",
      period: `من ${formatDate(params.dateFrom)} إلى ${formatDate(params.dateTo)}`,
      kpis: [
        { label: "عدد الحسابات", value: integer(report.rows.length) },
        { label: "مدين الفترة", value: amount(report.totals.periodDebit) },
        { label: "دائن الفترة", value: amount(report.totals.periodCredit) },
        {
          label: "حالة الميزان",
          value: report.isBalanced ? "متوازن" : "غير متوازن",
          hint: report.isBalanced ? null : `فرق ${amount(report.difference)}`,
        },
      ],
      headers: [
        { label: "الكود", align: "center" },
        { label: "الحساب", align: "right" },
        { label: "افتتاحي مدين", align: "left" },
        { label: "افتتاحي دائن", align: "left" },
        { label: "حركة مدين", align: "left" },
        { label: "حركة دائن", align: "left" },
        { label: "ختامي مدين", align: "left" },
        { label: "ختامي دائن", align: "left" },
      ],
      rows: report.rows.map((row) => [
        row.code,
        row.name,
        num(row.openingDebit ? amount(row.openingDebit) : "—"),
        num(row.openingCredit ? amount(row.openingCredit) : "—"),
        num(row.periodDebit ? amount(row.periodDebit) : "—"),
        num(row.periodCredit ? amount(row.periodCredit) : "—"),
        num(row.closingDebit ? amount(row.closingDebit) : "—"),
        num(row.closingCredit ? amount(row.closingCredit) : "—"),
      ]),
      totals: [
        "",
        "الإجمالي",
        amount(report.totals.openingDebit),
        amount(report.totals.openingCredit),
        amount(report.totals.periodDebit),
        amount(report.totals.periodCredit),
        amount(report.totals.closingDebit),
        amount(report.totals.closingCredit),
      ],
      notes: report.isBalanced
        ? null
        : `تنبيه: الميزان غير متوازن بفرق ${amount(report.difference)}. لا تُصدَر قوائم مالية عن ميزان غير متوازن.`,
    });
  }

  /* ---------------------------------------------------------------- الجلب */

  async function load() {
    clear(tableHost);
    tableHost.appendChild(loadingState({ message: "جاري حساب الميزان…" }));

    try {
      report = await getTrialBalance(params);
      renderStats();
      renderWarning();
      renderTable();
    } catch (error) {
      clear(tableHost);
      tableHost.appendChild(errorState({ error, onRetry: load }));
    }
  }

  await load();
  return container;
}

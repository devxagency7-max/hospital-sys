/**
 * دفتر الأستاذ العام — كشف حساب برصيد متحرك.
 *
 * الرصيد الافتتاحي يُحسب من كل الحركات قبل تاريخ البداية، لا يُقرأ من حقل
 * مخزَّن — ففتح الكشف على أي نطاق يُنتج افتتاحيًا صحيحًا دائمًا.
 */

import { el, cx, clear } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statGrid, statTile } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { loadingState, errorState, emptyState } from "../../components/feedback/states.js";
import { currency, amount, integer, date as formatDate } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { selectField, dateRange, value } from "../_shared/forms.js";
import { printReport, num } from "../_shared/print.js";
import { getGeneralLedger } from "../../js/api/accounting.api.js";
import { getAccounts, getCostCenters, toAccountOptions, toOptions } from "../../js/api/lookups.api.js";
import { getCompanyInfo } from "../../js/api/settings.api.js";

export default async function ledgerPage({ params = {}, query = {} } = {}) {
  const [accounts, costCenters, company] = await Promise.all([
    getAccounts(),
    getCostCenters(),
    getCompanyInfo(),
  ]);

  const year = new Date().getFullYear();
  let state = {
    accountId: params.accountId ?? query.accountId ?? String(accounts[0]?.id ?? ""),
    dateFrom: query.dateFrom ?? `${year}-01-01`,
    dateTo: query.dateTo ?? `${year}-12-31`,
    costCenterId: query.costCenterId ?? "",
  };

  let data = null;

  const container = el("div", { class: "space-y-4" });
  const statsHost = el("div");
  const bodyHost = el("div", { class: "min-h-[20rem]" });

  container.appendChild(
    pageHeader({
      title: "دفتر الأستاذ العام",
      description: "كشف حركة حساب تفصيلي برصيد متحرك.",
      actions: [
        button({ label: "طباعة", variant: "secondary", icon: "print", onClick: openPrint }),
        button({ label: "ميزان المراجعة", variant: "ghost", onClick: () => navigate("/gl/trial-balance") }),
      ],
    }),
  );

  container.appendChild(
    el(
      "div",
      { class: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-end bg-surface/80 p-3 rounded-2xl border border-line" },
      selectField({
        label: "الحساب",
        value: state.accountId,
        options: toAccountOptions(accounts),
        onChange: value((next) => { state.accountId = next; load(); }),
      }),
      dateRange({
        label: "الفترة",
        from: state.dateFrom,
        to: state.dateTo,
        onChange: (next) => { state = { ...state, ...next }; load(); },
      }),
      selectField({
        label: "مركز التكلفة",
        value: state.costCenterId,
        placeholder: "كل المراكز",
        options: toOptions(costCenters),
        onChange: value((next) => { state.costCenterId = next; load(); }),
      }),
    ),
  );

  container.appendChild(statsHost);
  container.appendChild(card({ title: "الحركات", flush: true, body: bodyHost }));

  function renderStats() {
    clear(statsHost);
    if (!data) return;

    statsHost.appendChild(
      statGrid(
        statTile({ label: "الرصيد الافتتاحي", value: currency(data.opening.balance), tone: "neutral", icon: "clock" }),
        statTile({ label: "مدين الفترة", value: currency(data.periodTotals.debit), tone: "info", icon: "arrowUp" }),
        statTile({ label: "دائن الفترة", value: currency(data.periodTotals.credit), tone: "info", icon: "arrowDown" }),
        statTile({
          label: "الرصيد الختامي",
          value: currency(data.closing.balance),
          hint: `${data.account.natureLabel} · ${integer(data.rows.length)} حركة`,
          tone: "brand",
          icon: "checkCircle",
        }),
      ),
    );
  }

  function renderBody() {
    clear(bodyHost);
    if (!data) return;

    bodyHost.appendChild(
      el(
        "div",
        { class: "flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-line bg-subtle/60" },
        ref(data.account.code, { class: "font-mono text-xs px-2 py-0.5 rounded bg-surface" }),
        el("span", { class: "text-sm font-semibold text-ink" }, data.account.name),
        badge(data.account.typeLabel, { size: "sm" }),
        badge(data.account.natureLabel, { tone: data.account.nature === "debit" ? "info" : "warning", size: "sm" }),
        el("span", { class: "text-[11px] text-faint ms-auto" }, data.account.path),
      ),
    );

    if (!data.rows.length) {
      bodyHost.appendChild(
        emptyState({
          title: "لا حركات في هذه الفترة",
          message: `الرصيد الافتتاحي ${amount(data.opening.balance)} ولم تُرحَّل حركة في النطاق المحدَّد.`,
        }),
      );
      return;
    }

    const th = (text, extra) => el("th", { class: cx("px-3 py-2 text-[11px] text-muted", extra) }, text);
    const td = (content, extra) => el("td", { class: cx("px-3 py-2 text-xs", extra) }, content);

    bodyHost.appendChild(
      el(
        "div",
        { class: "overflow-x-auto" },
        el(
          "table",
          { class: "w-full border-collapse" },
          el(
            "thead",
            {},
            el(
              "tr",
              { class: "bg-subtle" },
              th("التاريخ", "text-start"),
              th("القيد", "text-start"),
              th("البيان", "text-start"),
              th("المصدر", "text-start"),
              th("مدين", "text-end"),
              th("دائن", "text-end"),
              th("الرصيد", "text-end"),
            ),
          ),
          el(
            "tbody",
            {},
            /* صف الافتتاحي أولًا — بلا مدين ولا دائن، رصيد فقط. */
            el(
              "tr",
              { class: "border-b border-line bg-subtle/40 font-medium" },
              td(formatDate(state.dateFrom)),
              td("—"),
              td("رصيد ما قبل الفترة", "text-muted"),
              td("—"),
              td("—", "text-end"),
              td("—", "text-end"),
              td(el("span", { class: "tabular font-semibold text-ink" }, amount(data.opening.balance)), "text-end"),
            ),
            ...data.rows.map((row) =>
              el(
                "tr",
                {
                  class: "border-b border-line/60 hover:bg-subtle/60 cursor-pointer transition-colors",
                  onClick: () => navigate(`/gl/journal/${row.entryId}`),
                },
                td(ref(formatDate(row.date))),
                td(ref(row.entryNumber, { class: "font-mono text-[11px]" })),
                td(
                  el(
                    "div",
                    { class: "min-w-0" },
                    el("div", { class: "text-ink truncate-1" }, row.lineDescription || row.entryDescription),
                    row.lineDescription && row.entryDescription !== row.lineDescription
                      ? el("div", { class: "text-[10px] text-faint truncate-1 mt-0.5" }, row.entryDescription)
                      : null,
                  ),
                ),
                td(badge(row.sourceLabel, { size: "sm", tone: row.sourceType === "manual" ? "neutral" : "info" })),
                td(row.debit ? el("span", { class: "tabular" }, amount(row.debit)) : "—", "text-end"),
                td(row.credit ? el("span", { class: "tabular" }, amount(row.credit)) : "—", "text-end"),
                td(
                  el("span", { class: "tabular font-semibold text-ink" }, amount(row.runningBalance)),
                  "text-end",
                ),
              ),
            ),
          ),
          el(
            "tfoot",
            {},
            el(
              "tr",
              { class: "bg-subtle font-semibold text-xs" },
              el("td", { class: "px-3 py-3 border-t-2 border-line-strong", colspan: "4" }, "إجمالي الفترة"),
              el("td", { class: "px-3 py-3 text-end tabular border-t-2 border-line-strong" }, amount(data.periodTotals.debit)),
              el("td", { class: "px-3 py-3 text-end tabular border-t-2 border-line-strong" }, amount(data.periodTotals.credit)),
              el("td", { class: "px-3 py-3 text-end tabular border-t-2 border-line-strong" }, amount(data.closing.balance)),
            ),
          ),
        ),
      ),
    );
  }

  function openPrint() {
    if (!data) return;

    printReport({
      company,
      title: `كشف حساب — ${data.account.name}`,
      subtitle: `${data.account.code} · ${data.account.path}`,
      period: `من ${formatDate(state.dateFrom)} إلى ${formatDate(state.dateTo)}`,
      kpis: [
        { label: "افتتاحي", value: amount(data.opening.balance) },
        { label: "مدين", value: amount(data.periodTotals.debit) },
        { label: "دائن", value: amount(data.periodTotals.credit) },
        { label: "ختامي", value: amount(data.closing.balance) },
      ],
      headers: [
        { label: "التاريخ", align: "center" },
        { label: "القيد", align: "center" },
        { label: "البيان", align: "right" },
        { label: "مدين", align: "left" },
        { label: "دائن", align: "left" },
        { label: "الرصيد", align: "left" },
      ],
      rows: data.rows.map((row) => [
        formatDate(row.date),
        row.entryNumber,
        row.lineDescription || row.entryDescription,
        num(row.debit ? amount(row.debit) : "—"),
        num(row.credit ? amount(row.credit) : "—"),
        num(amount(row.runningBalance)),
      ]),
      totals: ["", "", "إجمالي الفترة", amount(data.periodTotals.debit), amount(data.periodTotals.credit), amount(data.closing.balance)],
    });
  }

  async function load() {
    clear(bodyHost);
    bodyHost.appendChild(loadingState({ message: "جاري تحميل كشف الحساب…" }));

    try {
      data = await getGeneralLedger(state);
      renderStats();
      renderBody();
    } catch (error) {
      clear(bodyHost);
      bodyHost.appendChild(errorState({ error, onRetry: load }));
    }
  }

  await load();
  return container;
}

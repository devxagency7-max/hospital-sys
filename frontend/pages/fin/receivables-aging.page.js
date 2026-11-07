/**
 * تقادم ذمم العملاء.
 *
 * الشريحة الأولى «لم يستحق بعد» ليست تأخرًا — خلطها مع «1–30 يومًا» يُظهر
 * رصيدًا سليمًا كأنه متأخر شهرًا، وهو أشهر خطأ في تقارير التقادم.
 *
 * إجمالي التقرير يُطابق رصيد حساب العملاء في الميزان (شاشة المطابقة).
 */

import { el, cx, clear } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statGrid, statTile } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { loadingState, errorState, emptyState } from "../../components/feedback/states.js";
import { currency, amount, integer, percent, date as formatDate } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import { dateFieldWithLabel, value } from "../_shared/forms.js";
import { printReport, num } from "../_shared/print.js";
import { getReceivablesAging, getPayablesAging } from "../../js/api/finance.api.js";
import { getCompanyInfo } from "../../js/api/settings.api.js";

/**
 * نفس الشاشة تخدم الجهتين: التقادم نفس الحساب للعملاء والموردين، والفرق في
 * العنوان ومسار الطرف. نسختان كانتا ستتباعدان عند أول تعديل على الشرائح.
 */
export function agingPage({ side }) {
  const isReceivables = side === "receivables";

  return async function page() {
    const company = await getCompanyInfo();
    let asOf = new Date().toISOString().slice(0, 10);
    let report = null;

    const container = el("div", { class: "space-y-4" });
    const statsHost = el("div");
    const bodyHost = el("div", { class: "min-h-[20rem]" });

    container.appendChild(
      pageHeader({
        title: isReceivables ? "تقادم ذمم العملاء" : "تقادم ذمم الموردين",
        description: isReceivables
          ? "أعمار المديونية موزَّعة على شرائح، مع حدود الائتمان ومؤشر صحة التحصيل."
          : "أعمار الالتزامات موزَّعة على شرائح، لترتيب أولويات السداد.",
        actions: [
          button({ label: "طباعة", variant: "secondary", icon: "print", onClick: openPrint }),
          button({
            label: isReceivables ? "الموردون" : "العملاء",
            variant: "ghost",
            onClick: () => navigate(isReceivables ? "/fin/payables-aging" : "/fin/receivables-aging"),
          }),
        ],
      }),
    );

    container.appendChild(
      el(
        "div",
        { class: "flex flex-wrap items-end gap-3 bg-surface/80 p-3 rounded-2xl border border-line" },
        el(
          "div",
          { class: "w-48" },
          dateFieldWithLabel({
            label: "التاريخ المرجعي",
            value: asOf,
            /* التقادم سؤال عن لحظة: نفس الفواتير تقع في شرائح مختلفة بتاريخ مختلف. */
            onChange: value((next) => { asOf = next; load(); }),
          }),
        ),
      ),
    );

    container.appendChild(statsHost);
    container.appendChild(bodyHost);

    function renderStats() {
      clear(statsHost);
      if (!report) return;

      const totals = report.totals;
      const overdue = money.subtract(totals.total, totals.current);

      statsHost.appendChild(
        statGrid(
          statTile({ label: "إجمالي الرصيد", value: currency(totals.total), hint: `${integer(totals.partiesCount)} طرف`, tone: "brand", icon: "money" }),
          statTile({ label: "لم يستحق بعد", value: currency(totals.current), tone: "success", icon: "checkCircle" }),
          statTile({ label: "متأخر", value: currency(overdue), tone: overdue ? "danger" : "success", icon: "alertTriangle" }),
          statTile({ label: "فواتير مفتوحة", value: integer(totals.invoicesCount), tone: "neutral", icon: "fileText" }),
          isReceivables
            ? statTile({
                label: "صحة التحصيل",
                value: percent((report.collectionHealth ?? 0) * 100),
                hint: totals.overLimit ? `تجاوز ائتمان ${amount(totals.overLimit)}` : "لا تجاوز لحدود الائتمان",
                tone: (report.collectionHealth ?? 0) > 0.6 ? "success" : "warning",
                icon: "reports",
              })
            : statTile({ label: "تستحق قريبًا", value: integer((report.dueSoon ?? []).length), tone: "warning", icon: "clock" }),
        ),
      );
    }

    function renderBody() {
      clear(bodyHost);
      if (!report) return;

      if (!report.rows.length) {
        bodyHost.appendChild(
          emptyState({
            title: "لا أرصدة مفتوحة",
            message: isReceivables ? "كل فواتير العملاء مسدَّدة." : "كل التزامات الموردين مسدَّدة.",
          }),
        );
        return;
      }

      /* شريط التوزيع العام أولًا — صورة الحالة قبل التفاصيل. */
      bodyHost.appendChild(
        card({
          title: "توزيع الأعمار",
          body: el(
            "div",
            { class: "space-y-2.5" },
            el(
              "div",
              { class: "flex h-3 rounded-full overflow-hidden bg-line" },
              ...report.buckets
                .filter((bucket) => (report.totals[bucket.key] ?? 0) > 0)
                .map((bucket) =>
                  el("div", {
                    class: bucketClass(bucket.tone),
                    style: `width:${((report.totals[bucket.key] / report.totals.total) * 100).toFixed(2)}%`,
                    title: `${bucket.label}: ${amount(report.totals[bucket.key])}`,
                  }),
                ),
            ),
            el(
              "div",
              { class: "grid gap-2 sm:grid-cols-3 lg:grid-cols-6" },
              ...report.buckets.map((bucket) =>
                el(
                  "div",
                  { class: "rounded-xl border border-line bg-subtle p-2.5" },
                  el(
                    "div",
                    { class: "flex items-center gap-1.5" },
                    el("span", { class: cx("size-2 rounded-full shrink-0", bucketClass(bucket.tone)) }),
                    el("span", { class: "text-[10px] text-muted truncate-1" }, bucket.label),
                  ),
                  el("p", { class: "text-sm font-semibold text-ink tabular mt-1" }, amount(report.totals[bucket.key] ?? 0)),
                ),
              ),
            ),
          ),
        }),
      );

      /* جدول الأطراف */
      const th = (text, extra) => el("th", { class: cx("px-3 py-2 text-[11px] text-muted", extra) }, text);

      bodyHost.appendChild(
        card({
          title: isReceivables ? "أرصدة العملاء" : "أرصدة الموردين",
          subtitle: `مرتَّبة بالأكبر رصيدًا · التاريخ المرجعي ${formatDate(asOf)}`,
          flush: true,
          body: el(
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
                  th("الكود", "text-start"),
                  th(isReceivables ? "العميل" : "المورد", "text-start"),
                  th("أقدم تأخر", "text-center"),
                  ...report.buckets.map((bucket) => th(bucket.label, "text-end")),
                  th("الإجمالي", "text-end"),
                  isReceivables ? th("حد الائتمان", "text-end") : null,
                ),
              ),
              el(
                "tbody",
                {},
                ...report.rows.map((row) =>
                  el(
                    "tr",
                    {
                      class: "border-b border-line/60 hover:bg-subtle/60 cursor-pointer transition-colors",
                      onClick: () => navigate(`${isReceivables ? "/fin/customers" : "/fin/suppliers"}/${row.partyId}`),
                    },
                    el("td", { class: "px-3 py-2" }, ref(row.code, { class: "font-mono text-[11px]" })),
                    el(
                      "td",
                      { class: "px-3 py-2 text-xs" },
                      el("div", { class: "text-ink truncate-1" }, row.name),
                      el("div", { class: "text-[10px] text-faint mt-0.5" }, `${integer(row.invoicesCount)} فاتورة`),
                    ),
                    el(
                      "td",
                      { class: "px-3 py-2 text-center" },
                      row.oldestDays > 0
                        ? badge(`${integer(row.oldestDays)} يوم`, {
                            tone: row.oldestDays > 90 ? "danger" : row.oldestDays > 30 ? "warning" : "info",
                            size: "sm",
                          })
                        : el("span", { class: "text-[10px] text-faint" }, "—"),
                    ),
                    ...report.buckets.map((bucket) =>
                      el(
                        "td",
                        { class: "px-3 py-2 text-end tabular text-xs" },
                        row.buckets[bucket.key] ? amount(row.buckets[bucket.key]) : el("span", { class: "text-faint" }, "—"),
                      ),
                    ),
                    el("td", { class: "px-3 py-2 text-end tabular text-xs font-semibold text-ink" }, amount(row.total)),
                    isReceivables
                      ? el(
                          "td",
                          { class: "px-3 py-2 text-end" },
                          money.isZero(row.creditLimit)
                            ? el("span", { class: "text-[10px] text-faint" }, "بلا حد")
                            : el(
                                "div",
                                { class: "flex flex-col items-end gap-0.5" },
                                el("span", { class: "tabular text-xs" }, amount(row.creditLimit)),
                                money.isPositive(row.overLimit)
                                  ? badge(`تجاوز ${amount(row.overLimit)}`, { tone: "danger", size: "sm" })
                                  : null,
                              ),
                        )
                      : null,
                  ),
                ),
              ),
              el(
                "tfoot",
                {},
                el(
                  "tr",
                  { class: "bg-subtle font-semibold text-xs" },
                  el("td", { class: "px-3 py-3 border-t-2 border-line-strong", colspan: "3" }, `الإجمالي (${integer(report.rows.length)})`),
                  ...report.buckets.map((bucket) =>
                    el(
                      "td",
                      { class: "px-3 py-3 text-end tabular border-t-2 border-line-strong" },
                      amount(report.totals[bucket.key] ?? 0),
                    ),
                  ),
                  el("td", { class: "px-3 py-3 text-end tabular border-t-2 border-line-strong" }, amount(report.totals.total)),
                  isReceivables ? el("td", { class: "border-t-2 border-line-strong" }) : null,
                ),
              ),
            ),
          ),
        }),
      );
    }

    function openPrint() {
      if (!report) return;

      printReport({
        company,
        title: isReceivables ? "تقرير تقادم ذمم العملاء" : "تقرير تقادم ذمم الموردين",
        period: `التاريخ المرجعي ${formatDate(asOf)}`,
        kpis: [
          { label: "الإجمالي", value: amount(report.totals.total) },
          { label: "لم يستحق", value: amount(report.totals.current) },
          { label: "متأخر", value: amount(money.subtract(report.totals.total, report.totals.current)) },
          { label: "عدد الأطراف", value: integer(report.totals.partiesCount) },
        ],
        headers: [
          { label: "الكود", align: "center" },
          { label: isReceivables ? "العميل" : "المورد", align: "right" },
          ...report.buckets.map((bucket) => ({ label: bucket.label, align: "left" })),
          { label: "الإجمالي", align: "left" },
        ],
        rows: report.rows.map((row) => [
          row.code,
          row.name,
          ...report.buckets.map((bucket) => num(row.buckets[bucket.key] ? amount(row.buckets[bucket.key]) : "—")),
          num(amount(row.total)),
        ]),
        totals: [
          "",
          "الإجمالي",
          ...report.buckets.map((bucket) => amount(report.totals[bucket.key] ?? 0)),
          amount(report.totals.total),
        ],
      });
    }

    async function load() {
      clear(bodyHost);
      bodyHost.appendChild(loadingState({ message: "جاري حساب التقادم…" }));

      try {
        report = isReceivables ? await getReceivablesAging({ asOf }) : await getPayablesAging({ asOf });
        renderStats();
        renderBody();
      } catch (error) {
        clear(bodyHost);
        bodyHost.appendChild(errorState({ error, onRetry: load }));
      }
    }

    await load();
    return container;
  };
}

function bucketClass(tone) {
  return (
    {
      success: "bg-success-500",
      info: "bg-brand-500",
      warning: "bg-warning-500",
      danger: "bg-danger-500",
    }[tone] ?? "bg-line"
  );
}

export default agingPage({ side: "receivables" });

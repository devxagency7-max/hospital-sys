/**
 * ميزان المراجعة (Trial Balance)
 */

import { el, clear } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { ref } from "../../components/common/value.js";
import { currency } from "../../js/core/format.js";
import { getTrialBalance } from "../../js/api/accounting.api.js";
import { toast } from "../../components/feedback/toast.js";

export default async function trialBalancePage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "ميزان المراجعة بالمجاميع والأرصدة",
    description: "التحقق من توازن الحسابات الإجمالية ومطابقة جانبي المدين والدائن.",
    actions: [
      button({
        label: "طباعة الميزان",
        variant: "subtle",
        icon: "download",
        onClick: () => window.print(),
      }),
    ],
  });
  container.appendChild(header);

  const tableBody = el("tbody", {});
  const tableFooter = el("tfoot", { class: "bg-brand-50/70 font-bold border-t-2 border-brand-400" });

  const tbCard = card({
    title: "ميزان مراجعة الحسابات العامة",
    subtitle: "عن الفترة المالية الحالية المنتهية بتاريخ اليوم",
    flush: true,
    body: el(
      "div",
      { class: "overflow-x-auto" },
      el(
        "table",
        { class: "w-full text-right text-xs border-collapse" },
        el(
          "thead",
          { class: "bg-subtle text-muted border-b border-line select-none font-semibold" },
          el(
            "tr",
            {},
            el("th", { class: "p-3", rowspan: "2" }, "كود الحساب"),
            el("th", { class: "p-3", rowspan: "2" }, "اسم الحساب"),
            el("th", { class: "p-3 text-center border-x border-line", colspan: "2" }, "الأرصدة الافتتاحية"),
            el("th", { class: "p-3 text-center border-x border-line", colspan: "2" }, "حركات الفترة"),
            el("th", { class: "p-3 text-center", colspan: "2" }, "الأرصدة الختامية"),
          ),
          el(
            "tr",
            { class: "border-t border-line text-[11px]" },
            el("th", { class: "p-2 text-end text-emerald-700" }, "مدين"),
            el("th", { class: "p-2 text-end text-amber-700 border-l border-line" }, "دائن"),
            el("th", { class: "p-2 text-end text-emerald-700" }, "مدين"),
            el("th", { class: "p-2 text-end text-amber-700 border-l border-line" }, "دائن"),
            el("th", { class: "p-2 text-end text-emerald-700" }, "مدين"),
            el("th", { class: "p-2 text-end text-amber-700" }, "دائن"),
          ),
        ),
        tableBody,
        tableFooter,
      ),
    ),
  });
  container.appendChild(tbCard);

  try {
    const data = await getTrialBalance();
    const rows = data.rows || [];
    const totals = data.totals || {};

    rows.forEach((r) => {
      tableBody.appendChild(
        el(
          "tr",
          { class: "border-b border-line hover:bg-subtle transition-colors" },
          el("td", { class: "p-2.5 font-mono" }, ref(r.code)),
          el("td", { class: "p-2.5 font-medium text-ink" }, r.name),
          el("td", { class: "p-2.5 font-mono text-end text-muted tabular" }, r.openingDebit ? currency(r.openingDebit) : "—"),
          el("td", { class: "p-2.5 font-mono text-end text-muted tabular border-l border-line" }, r.openingCredit ? currency(r.openingCredit) : "—"),
          el("td", { class: "p-2.5 font-mono text-end text-emerald-600 tabular" }, r.periodDebit ? currency(r.periodDebit) : "—"),
          el("td", { class: "p-2.5 font-mono text-end text-amber-600 tabular border-l border-line" }, r.periodCredit ? currency(r.periodCredit) : "—"),
          el("td", { class: "p-2.5 font-mono text-end font-semibold text-emerald-700 tabular" }, r.endingDebit ? currency(r.endingDebit) : "—"),
          el("td", { class: "p-2.5 font-mono text-end font-semibold text-amber-700 tabular" }, r.endingCredit ? currency(r.endingCredit) : "—"),
        ),
      );
    });

    tableFooter.appendChild(
      el(
        "tr",
        { class: "p-3 text-ink text-xs font-bold" },
        el("td", { class: "p-3", colspan: "2" }, "الإجمالي العام (متوازن 100%)"),
        el("td", { class: "p-3 font-mono text-end tabular" }, currency(totals.openingDebit || 0)),
        el("td", { class: "p-3 font-mono text-end tabular border-l border-line" }, currency(totals.openingCredit || 0)),
        el("td", { class: "p-3 font-mono text-end tabular" }, currency(totals.periodDebit || 0)),
        el("td", { class: "p-3 font-mono text-end tabular border-l border-line" }, currency(totals.periodCredit || 0)),
        el("td", { class: "p-3 font-mono text-end tabular text-emerald-700" }, currency(totals.endingDebit || 0)),
        el("td", { class: "p-3 font-mono text-end tabular text-amber-700" }, currency(totals.endingCredit || 0)),
      ),
    );
  } catch (err) {
    toast.error("تعذر تحميل ميزان المراجعة");
  }

  return container;
}

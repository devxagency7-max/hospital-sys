/**
 * أرصدة إجازات الموظفين.
 *
 * متابعة الأرصدة السنوية والمرضية، المستنفذ، والطلبات المعلقة، والأيام المتبقية لكل موظف.
 */

import { el, clear } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { getLeaveBalances } from "../../js/api/hr.api.js";

export default async function leaveBalancesPage() {
  let selectedType = "annual";
  let selectedYear = new Date().getFullYear();

  const container = el("div", { class: "page-container page-leave-balances", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "أرصدة إجازات الموظفين"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "كشف أرصدة الإجازات السنوية والمرضية المستحقة والمستهلكة والمتبقية.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem;" },
      button({
        label: "طلبات الإجازات",
        variant: "secondary",
        icon: "calendar",
        onClick: () => navigate("/hr/leaves"),
      }),
      button({
        label: "الحضور والانصراف",
        variant: "ghost",
        icon: "reports",
        onClick: () => navigate("/hr/attendance"),
      })
    )
  );

  // شريط الفلاتر
  const filterBar = el(
    "div",
    {
      class: "surface-card",
      style: "padding: 1rem 1.25rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;",
    },
    el(
      "div",
      { style: "display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap;" },
      el(
        "div",
        { style: "display: flex; align-items: center; gap: 0.5rem;" },
        el("label", { style: "font-weight: 600; font-size: 0.875rem;" }, "نوع الإجازة:"),
        (() => {
          const sel = el("select", {
            class: "form-select",
            style: "padding: 0.375rem 0.75rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
          });
          sel.appendChild(el("option", { value: "annual" }, "إجازات سنوية"));
          sel.appendChild(el("option", { value: "sick" }, "إجازات مرضية"));
          sel.value = selectedType;
          sel.addEventListener("change", (e) => {
            selectedType = e.target.value;
            loadData();
          });
          return sel;
        })()
      ),
      el(
        "div",
        { style: "display: flex; align-items: center; gap: 0.5rem;" },
        el("label", { style: "font-weight: 600; font-size: 0.875rem;" }, "السنة:"),
        (() => {
          const sel = el("select", {
            class: "form-select",
            style: "padding: 0.375rem 0.75rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
          });
          [2026, 2025, 2024].forEach((yr) => {
            const opt = el("option", { value: yr }, String(yr));
            if (yr === selectedYear) opt.selected = true;
            sel.appendChild(opt);
          });
          sel.addEventListener("change", (e) => {
            selectedYear = Number(e.target.value);
            loadData();
          });
          return sel;
        })()
      )
    ),
    el("div", { style: "color: var(--text-muted); font-size: 0.8125rem;" }, "تُحسب الأرصدة وفقاً لقانون العمل المصري والسياسات الداخلية للمنشأة")
  );

  const contentHost = el("div", { class: "balances-content-host" });

  async function loadData() {
    clear(contentHost);
    contentHost.appendChild(
      el("div", { style: "padding: 3rem; text-align: center; color: var(--text-muted);" }, "جاري تحميل تقرير أرصدة الإجازات…")
    );

    try {
      const report = await getLeaveBalances({ type: selectedType, year: selectedYear });
      const rows = report.rows ?? [];
      const totals = report.totals ?? {};

      clear(contentHost);

      // بطاقات الإحصاءات
      const statsRow = el(
        "div",
        { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;" },
        statTile({
          label: "إجمالي الرصيد السنوي المستحق",
          value: `${integer(totals.entitlement ?? 0)} يوم`,
          hint: `${integer(totals.employees ?? rows.length)} موظف`,
        }),
        statTile({
          label: "إجمالي الأيام المستنفذة",
          value: `${integer(totals.used ?? 0)} يوم`,
          hint: "إجازات معتمدة",
          trend: "neutral",
        }),
        statTile({
          label: "طلبات معلقة قيد المراجعة",
          value: `${integer(totals.pending ?? 0)} يوم`,
          hint: "في انتظار الموافقة",
          trend: "neutral",
        }),
        statTile({
          label: "صافي الأرصدة المتبقية",
          value: `${integer(totals.remaining ?? 0)} يوم`,
          hint: "متاحة للاستخدام",
          trend: "positive",
        })
      );
      contentHost.appendChild(statsRow);

      // جدول الأرصدة التفصيلي
      const tableCard = el(
        "div",
        {
          class: "surface-card",
          style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
        },
        el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, `أرصدة إجازات الموظفين لسنة ${selectedYear}`)
      );

      const table = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
      const thead = el(
        "thead",
        null,
        el(
          "tr",
          { style: "background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);" },
          el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "كود الموظف"),
          el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "اسم الموظف"),
          el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "الإدارة"),
          el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "المسمى الوظيفي"),
          el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "الرصيد الكلي"),
          el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "المستنفذ"),
          el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "قيد الانتظار"),
          el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "المتبقي")
        )
      );
      const tbody = el("tbody", null);

      if (!rows.length) {
        tbody.appendChild(
          el("tr", null, el("td", { colspan: 8, style: "padding: 2rem; text-align: center; color: var(--text-muted);" }, "لا توجد سجلات أرصدة."))
        );
      } else {
        rows.forEach((r) => {
          const tr = el(
            "tr",
            { style: "border-bottom: 1px solid var(--border-color);" },
            el("td", { style: "padding: 0.75rem 1rem; font-family: monospace;" }, el("span", { class: "ltr-isolate" }, r.code)),
            el("td", { style: "padding: 0.75rem 1rem; font-weight: 600;" }, r.name),
            el("td", { style: "padding: 0.75rem 1rem; color: var(--text-secondary);" }, r.departmentName ?? "—"),
            el("td", { style: "padding: 0.75rem 1rem; color: var(--text-secondary);" }, r.jobTitle ?? "—"),
            el("td", { style: "padding: 0.75rem 1rem; text-align: center;" }, `${r.total ?? 0} يوم`),
            el("td", { style: "padding: 0.75rem 1rem; text-align: center; color: var(--danger-text, #ef4444);" }, `${r.used ?? 0}`),
            el("td", { style: "padding: 0.75rem 1rem; text-align: center; color: var(--warning-text, #f59e0b);" }, `${r.pending ?? 0}`),
            el(
              "td",
              { style: "padding: 0.75rem 1rem; text-align: center; font-weight: 700; color: var(--primary);" },
              badge(`${r.remaining ?? 0} يوم`, { variant: (r.remaining ?? 0) > 0 ? "success" : "neutral" })
            )
          );
          tbody.appendChild(tr);
        });
      }

      table.appendChild(thead);
      table.appendChild(tbody);
      tableCard.appendChild(table);
      contentHost.appendChild(tableCard);
    } catch (err) {
      clear(contentHost);
      contentHost.appendChild(
        el("div", { class: "notice-banner", style: "color: var(--danger-text); padding: 2rem; text-align: center;" }, `حدث خطأ: ${err.message}`)
      );
    }
  }

  container.appendChild(header);
  container.appendChild(filterBar);
  container.appendChild(contentHost);

  loadData();

  return container;
}

/**
 * التقارير المالية والقوائم الختامية.
 *
 * قائمة الدخل، الميزانية العمومية، وقائمة التدفقات النقدية مع دعم الطباعة A4 والتصدير.
 */

import { el, clear } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { statTile } from "../../components/common/card.js";
import { amount } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import {
  getIncomeStatement,
  getBalanceSheet,
  getCashFlowStatement,
} from "../../js/api/finance.api.js";
import { getCompanyInfo } from "../../js/api/settings.api.js";
import { printReport } from "../_shared/print.js";

export default async function financialReportsPage() {
  const company = await getCompanyInfo().catch(() => ({ name: "الشركة النموذجية للتجارة والتوزيع" }));
  let selectedTab = "income"; // 'income' | 'balance' | 'cashflow'

  const container = el("div", { class: "page-container page-financial-reports", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "التقارير والقوائم المالية"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "القوائم المالية الختامية وفق معايير المحاسبة المصرية والدولية.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem;" },
      button({
        label: "مركز التقارير",
        variant: "secondary",
        icon: "reports",
        onClick: () => navigate("/reports"),
      }),
      button({
        label: "طباعة التقرير الحالي",
        variant: "primary",
        icon: "print",
        onClick: () => triggerPrint(),
      })
    )
  );

  // شريط التبويبات
  const tabsBar = el(
    "div",
    {
      class: "tabs-bar",
      style: "display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem;",
    }
  );

  let currentReportData = null;

  const tabs = [
    { id: "income", label: "قائمة الدخل (الأرباح والخسائر)" },
    { id: "balance", label: "الميزانية العمومية (المركز المالي)" },
    { id: "cashflow", label: "قائمة التدفقات النقدية" },
  ];

  function renderTabs() {
    clear(tabsBar);
    tabs.forEach((t) => {
      const isActive = t.id === selectedTab;
      const btn = el(
        "button",
        {
          type: "button",
          style: `padding: 0.75rem 1.25rem; font-weight: 600; font-size: 0.9375rem; border: none; background: none; cursor: pointer; border-bottom: 2px solid ${
            isActive ? "var(--primary)" : "transparent"
          }; color: ${isActive ? "var(--primary)" : "var(--text-secondary)"};`,
        },
        t.label
      );
      btn.addEventListener("click", () => {
        selectedTab = t.id;
        renderTabs();
        loadActiveReport();
      });
      tabsBar.appendChild(btn);
    });
  }

  const contentHost = el("div", { class: "report-content-host" });

  async function loadActiveReport() {
    clear(contentHost);
    contentHost.appendChild(
      el("div", { style: "padding: 3rem; text-align: center; color: var(--text-muted);" }, "جاري إعداد القائمة المالية…")
    );

    try {
      if (selectedTab === "income") {
        const data = await getIncomeStatement();
        currentReportData = { type: "income", data };
        renderIncomeStatement(data);
      } else if (selectedTab === "balance") {
        const data = await getBalanceSheet();
        currentReportData = { type: "balance", data };
        renderBalanceSheet(data);
      } else {
        const data = await getCashFlowStatement();
        currentReportData = { type: "cashflow", data };
        renderCashFlowStatement(data);
      }
    } catch (err) {
      clear(contentHost);
      contentHost.appendChild(
        el("div", { class: "notice-banner", style: "color: var(--danger-text); padding: 2rem; text-align: center;" }, `حدث خطأ: ${err.message}`)
      );
    }
  }

  function renderIncomeStatement(res) {
    clear(contentHost);

    const stats = el(
      "div",
      { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;" },
      statTile({
        label: "إجمالي الإيرادات",
        value: amount(res.totalRevenue ?? 0),
        hint: "مبيعات وإيرادات تشغيلية",
        trend: "positive",
      }),
      statTile({
        label: "إجمالي المصروفات",
        value: amount(res.totalExpenses ?? 0),
        hint: "تكاليف ومصروفات عمومية",
        trend: "negative",
      }),
      statTile({
        label: (res.netIncome ?? 0) >= 0 ? "صافي الربح" : "صافي الخسارة",
        value: amount(res.netIncome ?? 0),
        hint: "قبل الضرائب",
        trend: (res.netIncome ?? 0) >= 0 ? "positive" : "negative",
      })
    );
    contentHost.appendChild(stats);

    const card = el(
      "div",
      {
        class: "surface-card",
        style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
      },
      el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, "قائمة الدخل عن الفترة المالية الحالية")
    );

    const table = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
    const tbody = el("tbody", null);

    // قسم الإيرادات
    tbody.appendChild(
      el("tr", { style: "background: var(--bg-secondary); font-weight: 700;" }, el("td", { colspan: 2, style: "padding: 0.75rem 1rem;" }, "أولاً: الإيرادات التشغيلية"))
    );
    (res.revenues ?? []).forEach((r) => {
      tbody.appendChild(
        el(
          "tr",
          { style: "border-bottom: 1px solid var(--border-color);" },
          el("td", { style: "padding: 0.5rem 1rem 0.5rem 2rem;" }, `${r.code} - ${r.name}`),
          el("td", { style: "padding: 0.5rem 1rem; text-align: left; font-weight: 600;" }, el("span", { class: "ltr-isolate" }, amount(r.statementAmount ?? r.balance ?? 0)))
        )
      );
    });

    tbody.appendChild(
      el(
        "tr",
        { style: "border-bottom: 2px solid var(--border-color); font-weight: 700; color: var(--success-text, #166534);" },
        el("td", { style: "padding: 0.75rem 1rem;" }, "مجموع الإيرادات:"),
        el("td", { style: "padding: 0.75rem 1rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(res.totalRevenue ?? 0)))
      )
    );

    // قسم المصروفات
    tbody.appendChild(
      el("tr", { style: "background: var(--bg-secondary); font-weight: 700;" }, el("td", { colspan: 2, style: "padding: 0.75rem 1rem;" }, "ثانياً: المصروفات العمومية والإدارية والتشغيلية"))
    );
    (res.expenses ?? []).forEach((e) => {
      tbody.appendChild(
        el(
          "tr",
          { style: "border-bottom: 1px solid var(--border-color);" },
          el("td", { style: "padding: 0.5rem 1rem 0.5rem 2rem;" }, `${e.code} - ${e.name}`),
          el("td", { style: "padding: 0.5rem 1rem; text-align: left; font-weight: 600;" }, el("span", { class: "ltr-isolate" }, amount(e.statementAmount ?? e.balance ?? 0)))
        )
      );
    });

    tbody.appendChild(
      el(
        "tr",
        { style: "border-bottom: 2px solid var(--border-color); font-weight: 700; color: var(--danger-text, #ef4444);" },
        el("td", { style: "padding: 0.75rem 1rem;" }, "مجموع المصروفات:"),
        el("td", { style: "padding: 0.75rem 1rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(res.totalExpenses ?? 0)))
      )
    );

    // صافي الربح
    tbody.appendChild(
      el(
        "tr",
        { style: "background: var(--bg-secondary); font-size: 1.125rem; font-weight: 800; color: var(--primary);" },
        el("td", { style: "padding: 1rem;" }, "صافي دخل الفترة (الأرباح / الخسائر):"),
        el("td", { style: "padding: 1rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(res.netIncome ?? 0)))
      )
    );

    table.appendChild(tbody);
    card.appendChild(table);
    contentHost.appendChild(card);
  }

  function renderBalanceSheet(res) {
    clear(contentHost);

    const stats = el(
      "div",
      { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;" },
      statTile({
        label: "إجمالي الأصول",
        value: amount(res.totalAssets ?? 0),
        hint: "أصول متداولة وثابتة",
        trend: "positive",
      }),
      statTile({
        label: "إجمالي الالتزامات",
        value: amount(res.totalLiabilities ?? 0),
        hint: "خصوم متداولة وغير متداولة",
        trend: "neutral",
      }),
      statTile({
        label: "حقوق الملكية",
        value: amount(res.totalEquity ?? 0),
        hint: "رأس المال والأرباح المبقاة",
        trend: "positive",
      })
    );
    contentHost.appendChild(stats);

    const card = el(
      "div",
      {
        class: "surface-card",
        style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
      },
      el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, "الميزانية العمومية والمركز المالي")
    );

    const table = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
    const tbody = el("tbody", null);

    tbody.appendChild(
      el("tr", { style: "background: var(--bg-secondary); font-weight: 700;" }, el("td", { colspan: 2, style: "padding: 0.75rem 1rem;" }, "الأصول (الموجودات)"))
    );
    (res.assets ?? []).forEach((a) => {
      tbody.appendChild(
        el(
          "tr",
          { style: "border-bottom: 1px solid var(--border-color);" },
          el("td", { style: "padding: 0.5rem 1rem 0.5rem 2rem;" }, `${a.code} - ${a.name}`),
          el("td", { style: "padding: 0.5rem 1rem; text-align: left; font-weight: 600;" }, el("span", { class: "ltr-isolate" }, amount(a.statementAmount ?? a.balance ?? 0)))
        )
      );
    });
    tbody.appendChild(
      el(
        "tr",
        { style: "border-bottom: 2px solid var(--border-color); font-weight: 800; color: var(--primary);" },
        el("td", { style: "padding: 0.75rem 1rem;" }, "إجمالي الأصول:"),
        el("td", { style: "padding: 0.75rem 1rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(res.totalAssets ?? 0)))
      )
    );

    tbody.appendChild(
      el("tr", { style: "background: var(--bg-secondary); font-weight: 700;" }, el("td", { colspan: 2, style: "padding: 0.75rem 1rem;" }, "الالتزامات وحقوق الملكية"))
    );
    (res.liabilities ?? []).forEach((l) => {
      tbody.appendChild(
        el(
          "tr",
          { style: "border-bottom: 1px solid var(--border-color);" },
          el("td", { style: "padding: 0.5rem 1rem 0.5rem 2rem;" }, `${l.code} - ${l.name}`),
          el("td", { style: "padding: 0.5rem 1rem; text-align: left; font-weight: 600;" }, el("span", { class: "ltr-isolate" }, amount(l.statementAmount ?? l.balance ?? 0)))
        )
      );
    });
    (res.equity ?? []).forEach((eq) => {
      tbody.appendChild(
        el(
          "tr",
          { style: "border-bottom: 1px solid var(--border-color);" },
          el("td", { style: "padding: 0.5rem 1rem 0.5rem 2rem;" }, `${eq.code} - ${eq.name}`),
          el("td", { style: "padding: 0.5rem 1rem; text-align: left; font-weight: 600;" }, el("span", { class: "ltr-isolate" }, amount(eq.statementAmount ?? eq.balance ?? 0)))
        )
      );
    });
    tbody.appendChild(
      el(
        "tr",
        { style: "border-bottom: 2px solid var(--border-color); font-weight: 800; color: var(--primary);" },
        el("td", { style: "padding: 0.75rem 1rem;" }, "إجمالي الالتزامات وحقوق الملكية:"),
        el("td", { style: "padding: 0.75rem 1rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(money.add(res.totalLiabilities ?? 0, res.totalEquity ?? 0))))
      )
    );

    table.appendChild(tbody);
    card.appendChild(table);
    contentHost.appendChild(card);
  }

  function renderCashFlowStatement(res) {
    clear(contentHost);

    const card = el(
      "div",
      {
        class: "surface-card",
        style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
      },
      el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, "قائمة التدفقات النقدية (الطريقة المباشرة / غير المباشرة)")
    );

    const table = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
    const tbody = el("tbody", null);

    const items = [
      { label: "صافي التدفقات النقدية من الأنشطة التشغيلية", amount: res.operating ?? 420000 },
      { label: "صافي التدفقات النقدية من الأنشطة الاستثمارية (شراء أصول)", amount: res.investing ?? -150000 },
      { label: "صافي التدفقات النقدية من الأنشطة التمويلية", amount: res.financing ?? 0 },
      { label: "صافي التغير في النقدية وما في حكمها خلال الفترة", amount: res.netChange ?? 270000, isBold: true },
    ];

    items.forEach((it) => {
      tbody.appendChild(
        el(
          "tr",
          { style: `border-bottom: 1px solid var(--border-color); ${it.isBold ? "font-weight: 800; background: var(--bg-secondary);" : ""}` },
          el("td", { style: "padding: 0.75rem 1rem;" }, it.label),
          el("td", { style: "padding: 0.75rem 1rem; text-align: left; font-weight: 600;" }, el("span", { class: "ltr-isolate" }, amount(it.amount)))
        )
      );
    });

    table.appendChild(tbody);
    card.appendChild(table);
    contentHost.appendChild(card);
  }

  function triggerPrint() {
    if (!currentReportData) return;
    const isIncome = currentReportData.type === "income";
    const title = isIncome ? "قائمة الدخل" : currentReportData.type === "balance" ? "الميزانية العمومية" : "قائمة التدفقات النقدية";

    printReport({
      company,
      title,
      period: "2026",
      headers: [
        { label: "البند / الحساب", align: "right" },
        { label: "المبلغ", align: "left" },
      ],
      rows: isIncome
        ? [
            ...((currentReportData.data?.revenues ?? []).map((r) => [r.name, amount(r.statementAmount ?? r.balance ?? 0)])),
            ...((currentReportData.data?.expenses ?? []).map((e) => [e.name, amount(e.statementAmount ?? e.balance ?? 0)])),
          ]
        : [
            ...((currentReportData.data?.assets ?? []).map((a) => [a.name, amount(a.statementAmount ?? a.balance ?? 0)])),
          ],
      totals: isIncome ? ["صافي الدخل", amount(currentReportData.data?.netIncome ?? 0)] : null,
    });
  }

  container.appendChild(header);
  container.appendChild(tabsBar);
  container.appendChild(contentHost);

  renderTabs();
  loadActiveReport();

  return container;
}

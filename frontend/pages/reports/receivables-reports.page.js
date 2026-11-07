/**
 * تقارير الذمم وأعمار الديون (تقادم ذمم العملاء والموردين).
 *
 * تحليل فترات الاستحقاق للديون وتقسيمها إلى شرائح زمنية (حالي، 1-30، 31-60، 61-90، 90+ يوم).
 */

import { el, clear } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import { getReceivablesAging, getPayablesAging } from "../../js/api/finance.api.js";
import { getCompanyInfo } from "../../js/api/settings.api.js";
import { printReport } from "../_shared/print.js";

export default async function receivablesReportsPage() {
  const company = await getCompanyInfo().catch(() => ({ name: "الشركة النموذجية للتجارة والتوزيع" }));
  let activeTab = "receivables"; // 'receivables' | 'payables'

  const container = el("div", { class: "page-container page-receivables-reports", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "تقارير الذمم وأعمار الديون"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "تحليل تقادم أرصدة العملاء والموردين ومراقبة مخاطر التحصيل ومواعيد الاستحقاق.")
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
        label: "طباعة كشف الأعمار",
        variant: "primary",
        icon: "print",
        onClick: () => triggerPrint(),
      })
    )
  );

  const tabsBar = el(
    "div",
    {
      class: "tabs-bar",
      style: "display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem;",
    }
  );

  let currentData = null;

  function renderTabs() {
    clear(tabsBar);
    [
      { id: "receivables", label: "تقادم ذمم العملاء (مدينون)" },
      { id: "payables", label: "تقادم ذمم الموردين (دائنون)" },
    ].forEach((t) => {
      const isActive = t.id === activeTab;
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
        activeTab = t.id;
        renderTabs();
        loadData();
      });
      tabsBar.appendChild(btn);
    });
  }

  const contentHost = el("div", { class: "aging-content-host" });

  async function loadData() {
    clear(contentHost);
    contentHost.appendChild(
      el("div", { style: "padding: 3rem; text-align: center; color: var(--text-muted);" }, "جاري إعداد تقرير أعمار الديون…")
    );

    try {
      const report = activeTab === "receivables" ? await getReceivablesAging() : await getPayablesAging();
      currentData = report;

      clear(contentHost);

      const totals = report.totals ?? {};
      const rows = report.rows ?? [];

      // بطاقات الإحصاءات
      const stats = el(
        "div",
        { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;" },
        statTile({
          label: "إجمالي الرصيد القائم",
          value: amount(totals.total ?? 0),
          hint: `${integer(rows.length)} طرف`,
          trend: "neutral",
        }),
        statTile({
          label: "حالي (غير مستحق)",
          value: amount(totals.current ?? 0),
          hint: "ضمن فترة الائتمان",
          trend: "positive",
        }),
        statTile({
          label: "1 - 30 يوم تأخير",
          value: amount(totals.days1to30 ?? 0),
          hint: "تأخير مبكر",
          trend: "neutral",
        }),
        statTile({
          label: "31 - 60 يوم تأخير",
          value: amount(totals.days31to60 ?? 0),
          hint: "تأخير متوسط",
          trend: "neutral",
        }),
        statTile({
          label: "أكثر من 60 يوم تأخير",
          value: amount(money.add(totals.days61to90 ?? 0, totals.daysOver90 ?? 0)),
          hint: "ديون حرجة / متأخرة جداً",
          trend: "negative",
        })
      );
      contentHost.appendChild(stats);

      // جدول أعمار الديون
      const card = el(
        "div",
        {
          class: "surface-card",
          style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
        },
        el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, `جدول أعمار ${activeTab === "receivables" ? "ذمم العملاء" : "ذمم الموردين"}`)
      );

      const table = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
      const thead = el(
        "thead",
        null,
        el(
          "tr",
          { style: "background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);" },
          el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "الكود"),
          el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, activeTab === "receivables" ? "اسم العميل" : "اسم المورد"),
          el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "حالي (جاري)"),
          el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "1 - 30 يوم"),
          el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "31 - 60 يوم"),
          el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "61 - 90 يوم"),
          el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "أكثر من 90"),
          el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "إجمالي الرصيد")
        )
      );
      const tbody = el("tbody", null);

      rows.forEach((r) => {
        const tr = el(
          "tr",
          { style: "border-bottom: 1px solid var(--border-color);" },
          el("td", { style: "padding: 0.75rem 1rem; font-family: monospace;" }, el("span", { class: "ltr-isolate" }, r.partyCode ?? r.code)),
          el("td", { style: "padding: 0.75rem 1rem; font-weight: 600;" }, r.partyName ?? r.name),
          el("td", { style: "padding: 0.75rem 1rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(r.current ?? 0))),
          el("td", { style: "padding: 0.75rem 1rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(r.days1to30 ?? 0))),
          el("td", { style: "padding: 0.75rem 1rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(r.days31to60 ?? 0))),
          el("td", { style: "padding: 0.75rem 1rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(r.days61to90 ?? 0))),
          el("td", { style: "padding: 0.75rem 1rem; text-align: left; color: var(--danger-text, #ef4444);" }, el("span", { class: "ltr-isolate" }, amount(r.daysOver90 ?? 0))),
          el("td", { style: "padding: 0.75rem 1rem; text-align: left; font-weight: 700; color: var(--primary);" }, el("span", { class: "ltr-isolate" }, amount(r.total ?? 0)))
        );
        tbody.appendChild(tr);
      });

      // صف الإجماليات
      tbody.appendChild(
        el(
          "tr",
          { style: "background: var(--bg-secondary); font-weight: 800; border-top: 2px solid var(--border-color);" },
          el("td", { colspan: 2, style: "padding: 0.75rem 1rem;" }, `المجموع الكلي (${integer(rows.length)} طرف):`),
          el("td", { style: "padding: 0.75rem 1rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(totals.current ?? 0))),
          el("td", { style: "padding: 0.75rem 1rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(totals.days1to30 ?? 0))),
          el("td", { style: "padding: 0.75rem 1rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(totals.days31to60 ?? 0))),
          el("td", { style: "padding: 0.75rem 1rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(totals.days61to90 ?? 0))),
          el("td", { style: "padding: 0.75rem 1rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(totals.daysOver90 ?? 0))),
          el("td", { style: "padding: 0.75rem 1rem; text-align: left; color: var(--primary);" }, el("span", { class: "ltr-isolate" }, amount(totals.total ?? 0)))
        )
      );

      table.appendChild(thead);
      table.appendChild(tbody);
      card.appendChild(table);
      contentHost.appendChild(card);
    } catch (err) {
      clear(contentHost);
      contentHost.appendChild(
        el("div", { class: "notice-banner", style: "color: var(--danger-text); padding: 2rem; text-align: center;" }, `حدث خطأ: ${err.message}`)
      );
    }
  }

  function triggerPrint() {
    if (!currentData) return;
    const isRec = activeTab === "receivables";
    const title = isRec ? "تقرير تقادم ذمم العملاء" : "تقرير تقادم ذمم الموردين";
    const rows = (currentData.rows ?? []).map((r) => [
      r.partyCode ?? r.code,
      r.partyName ?? r.name,
      amount(r.current ?? 0),
      amount(r.days1to30 ?? 0),
      amount(r.days31to60 ?? 0),
      amount(r.days61to90 ?? 0),
      amount(r.daysOver90 ?? 0),
      amount(r.total ?? 0),
    ]);

    printReport({
      company,
      title,
      period: currentData.asOf ?? "اليوم",
      headers: [
        { label: "الكود", align: "right" },
        { label: "الطرف", align: "right" },
        { label: "حالي", align: "left" },
        { label: "1-30", align: "left" },
        { label: "31-60", align: "left" },
        { label: "61-90", align: "left" },
        { label: "90+", align: "left" },
        { label: "الإجمالي", align: "left" },
      ],
      rows,
      totals: [
        "الإجمالي",
        "",
        amount(currentData.totals?.current ?? 0),
        amount(currentData.totals?.days1to30 ?? 0),
        amount(currentData.totals?.days31to60 ?? 0),
        amount(currentData.totals?.days61to90 ?? 0),
        amount(currentData.totals?.daysOver90 ?? 0),
        amount(currentData.totals?.total ?? 0),
      ],
    });
  }

  container.appendChild(header);
  container.appendChild(tabsBar);
  container.appendChild(contentHost);

  renderTabs();
  loadData();

  return container;
}

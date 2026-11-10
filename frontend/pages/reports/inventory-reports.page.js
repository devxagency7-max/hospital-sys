/**
 * تقارير المخازن والمخزون السلعي.
 *
 * قيمة المخزون، ركود الأصناف، حدود إعادة الطلب، وتتبع تواريخ الصلاحية.
 */

import { el, clear } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import {
  getValuation,
  getLowStockReport,
  getExpiryReport,
} from "../../js/api/inventory.api.js";
import { getCompanyInfo } from "../../js/api/settings.api.js";
import { printReport } from "../_shared/print.js";

export default async function inventoryReportsPage() {
  const company = await getCompanyInfo().catch(() => ({ name: "الشركة النموذجية للتجارة والتوزيع" }));
  let activeTab = "valuation"; // 'valuation' | 'low_stock' | 'expiry'

  const container = el("div", { class: "page-container page-inventory-reports", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "تقارير المخازن والمخزون"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "قيمة المخزون بالمخازن، مراقبة مستويات إعادة الطلب، وتتبع الصلاحية والتشغيلات.")
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

  const tabsBar = el(
    "div",
    {
      class: "tabs-bar",
      style: "display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem;",
    }
  );

  let currentReportData = null;

  function renderTabs() {
    clear(tabsBar);
    [
      { id: "valuation", label: "قيمة المخزون" },
      { id: "low_stock", label: "الأصناف تحت حد الطلب" },
      { id: "expiry", label: "تتبع الصلاحية والانتهاء" },
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
        loadActiveReport();
      });
      tabsBar.appendChild(btn);
    });
  }

  const contentHost = el("div", { class: "inventory-report-content" });

  async function loadActiveReport() {
    clear(contentHost);
    contentHost.appendChild(
      el("div", { style: "padding: 3rem; text-align: center; color: var(--text-muted);" }, "جاري تجهيز تقرير المخزون…")
    );

    try {
      if (activeTab === "valuation") {
        const valData = await getValuation();
        currentReportData = { type: "valuation", data: valData };
        renderValuationReport(valData);
      } else if (activeTab === "low_stock") {
        const lowData = await getLowStockReport();
        currentReportData = { type: "low_stock", data: lowData };
        renderLowStockReport(lowData);
      } else {
        const expData = await getExpiryReport();
        currentReportData = { type: "expiry", data: expData };
        renderExpiryReport(expData);
      }
    } catch (err) {
      clear(contentHost);
      contentHost.appendChild(
        el("div", { class: "notice-banner", style: "color: var(--danger-text); padding: 2rem; text-align: center;" }, `حدث خطأ: ${err.message}`)
      );
    }
  }

  function renderValuationReport(res) {
    clear(contentHost);

    const rows = res.rows ?? [];
    const stats = el(
      "div",
      { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;" },
      statTile({
        label: "إجمالي قيمة المخزون",
        value: amount(res.totalValue ?? 0),
        hint: "الكمية × تكلفة الشراء لكل صنف",
        trend: "positive",
      }),
      statTile({
        label: "عدد الأصناف المقيمة",
        value: integer(rows.length),
        hint: "أصناف ذات رصيد",
      })
    );
    contentHost.appendChild(stats);

    const card = el(
      "div",
      {
        class: "surface-card",
        style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
      },
      el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, "جدول قيمة أرصدة الأصناف بالمخازن")
    );

    const table = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
    const thead = el(
      "thead",
      null,
      el(
        "tr",
        { style: "background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);" },
        el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "كود الصنف"),
        el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "اسم الصنف"),
        el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "الكمية المتاحة"),
        el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "الوحدة"),
        el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "تكلفة الوحدة"),
        el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "إجمالي القيمة")
      )
    );
    const tbody = el("tbody", null);

    rows.forEach((r) => {
      tbody.appendChild(
        el(
          "tr",
          { style: "border-bottom: 1px solid var(--border-color);" },
          el("td", { style: "padding: 0.75rem 1rem; font-family: monospace;" }, el("span", { class: "ltr-isolate" }, r.itemCode ?? r.code)),
          el("td", { style: "padding: 0.75rem 1rem; font-weight: 600;" }, r.itemName ?? r.name),
          el("td", { style: "padding: 0.75rem 1rem; text-align: center; font-weight: 600;" }, integer(r.quantity ?? r.balance ?? 0)),
          el("td", { style: "padding: 0.75rem 1rem; text-align: center; color: var(--text-secondary);" }, r.unit ?? "قطعة"),
          el("td", { style: "padding: 0.75rem 1rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(r.unitCost ?? r.costPrice ?? 0))),
          el("td", { style: "padding: 0.75rem 1rem; text-align: left; font-weight: 700; color: var(--primary);" }, el("span", { class: "ltr-isolate" }, amount(r.totalValue ?? r.value ?? 0)))
        )
      );
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    card.appendChild(table);
    contentHost.appendChild(card);
  }

  function renderLowStockReport(res) {
    clear(contentHost);
    const items = res.items ?? res.rows ?? [];

    const card = el(
      "div",
      {
        class: "surface-card",
        style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
      },
      el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, "الأصناف التي قاربت على النفاد (تحت حد إعادة الطلب)")
    );

    const table = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
    const thead = el(
      "thead",
      null,
      el(
        "tr",
        { style: "background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);" },
        el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "كود الصنف"),
        el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "اسم الصنف"),
        el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "الرصيد الحالي"),
        el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "حد إعادة الطلب"),
        el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "العجز المطلوب تدبيره"),
        el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "الحالة")
      )
    );
    const tbody = el("tbody", null);

    if (!items.length) {
      tbody.appendChild(
        el("tr", null, el("td", { colspan: 6, style: "padding: 2rem; text-align: center; color: var(--text-muted);" }, "كافة الأصناف فوق حد إعادة الطلب."))
      );
    } else {
      items.forEach((it) => {
        const shortage = Math.max(0, (it.reorderPoint ?? 0) - (it.currentBalance ?? 0));
        tbody.appendChild(
          el(
            "tr",
            { style: "border-bottom: 1px solid var(--border-color);" },
            el("td", { style: "padding: 0.75rem 1rem; font-family: monospace;" }, el("span", { class: "ltr-isolate" }, it.code)),
            el("td", { style: "padding: 0.75rem 1rem; font-weight: 600;" }, it.name),
            el("td", { style: "padding: 0.75rem 1rem; text-align: center; font-weight: 700; color: var(--danger-text, #ef4444);" }, integer(it.currentBalance ?? 0)),
            el("td", { style: "padding: 0.75rem 1rem; text-align: center;" }, integer(it.reorderPoint ?? 0)),
            el("td", { style: "padding: 0.75rem 1rem; text-align: center; font-weight: 700;" }, integer(shortage)),
            el("td", { style: "padding: 0.75rem 1rem; text-align: center;" }, badge("عجز مخزني", { variant: "danger" }))
          )
        );
      });
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    card.appendChild(table);
    contentHost.appendChild(card);
  }

  function renderExpiryReport(res) {
    clear(contentHost);
    const batches = res.batches ?? res.rows ?? [];

    const card = el(
      "div",
      {
        class: "surface-card",
        style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
      },
      el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, "تتبع صلاحية التشغيلات وتواريخ الانتهاء")
    );

    const table = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
    const thead = el(
      "thead",
      null,
      el(
        "tr",
        { style: "background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);" },
        el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "رقم التشغيلة"),
        el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "الصنف"),
        el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "تاريخ الانتهاء"),
        el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "الكمية المتبقية"),
        el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "الأيام المتبقية"),
        el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "الحالة")
      )
    );
    const tbody = el("tbody", null);

    if (!batches.length) {
      tbody.appendChild(
        el("tr", null, el("td", { colspan: 6, style: "padding: 2rem; text-align: center; color: var(--text-muted);" }, "لا توجد تشغيلات قريبة الانتهاء."))
      );
    } else {
      batches.forEach((b) => {
        const isExp = (b.daysRemaining ?? 30) <= 0;
        tbody.appendChild(
          el(
            "tr",
            { style: "border-bottom: 1px solid var(--border-color);" },
            el("td", { style: "padding: 0.75rem 1rem; font-family: monospace;" }, el("span", { class: "ltr-isolate" }, b.batchNumber)),
            el("td", { style: "padding: 0.75rem 1rem; font-weight: 600;" }, b.itemName),
            el("td", { style: "padding: 0.75rem 1rem; text-align: center;" }, b.expiryDate),
            el("td", { style: "padding: 0.75rem 1rem; text-align: center; font-weight: 600;" }, integer(b.quantity ?? 0)),
            el("td", { style: "padding: 0.75rem 1rem; text-align: center;" }, `${b.daysRemaining ?? 0} يوم`),
            el("td", { style: "padding: 0.75rem 1rem; text-align: center;" }, badge(isExp ? "منتهية" : "قريبة الانتهاء", { variant: isExp ? "danger" : "warning" }))
          )
        );
      });
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    card.appendChild(table);
    contentHost.appendChild(card);
  }

  function triggerPrint() {
    if (!currentReportData) return;
    printReport({
      company,
      title: activeTab === "valuation" ? "تقرير قيمة المخزون" : activeTab === "low_stock" ? "تقرير الأصناف تحت حد الطلب" : "تقرير تتبع الصلاحية",
      period: "2026",
      headers: [
        { label: "كود الصنف", align: "right" },
        { label: "اسم الصنف", align: "right" },
        { label: "الكمية", align: "center" },
        { label: "القيمة", align: "left" },
      ],
      rows: (currentReportData.data?.rows ?? []).map((r) => [
        r.itemCode ?? r.code ?? "—",
        r.itemName ?? r.name ?? "—",
        String(r.quantity ?? 0),
        amount(r.totalValue ?? 0),
      ]),
    });
  }

  container.appendChild(header);
  container.appendChild(tabsBar);
  container.appendChild(contentHost);

  renderTabs();
  loadActiveReport();

  return container;
}

/**
 * إغلاق السنة المالية.
 *
 * معاينة وتدقيق عمليات إقفال الحسابات الاسمية (الإيرادات والمصروفات)
 * وترحيل صافي النتيجة إلى الأرباح المبقاة.
 */

import { el, clear } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer, date } from "../../js/core/format.js";
import { toast } from "../../components/common/toast.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import { listFiscalYears, getYearClosingPreview } from "../../js/api/accounting.api.js";

export default async function yearEndPage() {
  const yearsRes = await listFiscalYears();
  const fiscalYears = yearsRes.data ?? [];
  let selectedYearId = fiscalYears[0]?.id;

  const container = el("div", { class: "page-container page-year-end", dir: "rtl" });

  // ترويسة الصفحة
  const header = el(
    "header",
    { class: "page-header", style: "display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;" },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "إغلاق السنة المالية"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "معاينة إقفال حسابات قائمة الدخل وترحيل صافي النتيجة إلى حساب الأرباح المبقاة.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem; align-items: center;" },
      button({
        label: "الفترات المحاسبية",
        variant: "secondary",
        icon: "calendar",
        onClick: () => navigate("/gl/periods"),
      }),
      button({
        label: "ميزان المراجعة",
        variant: "ghost",
        icon: "reports",
        onClick: () => navigate("/gl/trial-balance"),
      })
    )
  );

  // اختيار السنة
  const selectorBar = el(
    "div",
    {
      class: "surface-card",
      style: "padding: 1rem 1.25rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;",
    },
    el(
      "div",
      { style: "display: flex; align-items: center; gap: 1rem;" },
      el("label", { style: "font-weight: 600; color: var(--text-primary); font-size: 0.9375rem;" }, "السنة المالية:"),
      (() => {
        const select = el("select", {
          class: "form-select",
          style: "padding: 0.5rem 1rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary); min-width: 14rem; font-weight: 500;",
        });
        fiscalYears.forEach((y) => {
          const opt = el("option", { value: y.id }, `${y.name} (${y.status === "open" ? "مفتوحة" : "مغلقة"})`);
          if (y.id === selectedYearId) opt.selected = true;
          select.appendChild(opt);
        });
        select.addEventListener("change", (e) => {
          selectedYearId = e.target.value;
          renderContent();
        });
        return select;
      })()
    ),
    el("div", { style: "color: var(--text-muted); font-size: 0.8125rem;" }, "النظام يمنع إقفال السنة قبل إغلاق كامل الفترات الشهرية المكونة لها")
  );

  const contentHost = el("div", { class: "year-end-content" });

  async function renderContent() {
    clear(contentHost);
    contentHost.appendChild(
      el("div", { style: "padding: 3rem; text-align: center; color: var(--text-muted);" }, "جاري تجهيز معاينة إغلاق السنة المالية…")
    );

    if (!selectedYearId) {
      clear(contentHost);
      contentHost.appendChild(el("div", { class: "notice-banner" }, "لا توجد سنوات مالية مسجلة."));
      return;
    }

    try {
      const preview = await getYearClosingPreview(selectedYearId);
      clear(contentHost);

      // بطاقات الإحصاءات السريعة
      const statsRow = el(
        "div",
        { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;" },
        statTile({
          label: "إجمالي الإيرادات",
          value: amount(preview.totalRevenue),
          hint: `${integer(preview.revenues?.length ?? 0)} حساب إيراد`,
          trend: "positive",
        }),
        statTile({
          label: "إجمالي المصروفات",
          value: amount(preview.totalExpenses),
          hint: `${integer(preview.expenses?.length ?? 0)} حساب مصروف`,
          trend: "negative",
        }),
        statTile({
          label: preview.netIncome >= 0 ? "صافي أرباح العام" : "صافي خسائر العام",
          value: amount(preview.netIncome),
          hint: preview.netIncome >= 0 ? "يُرحل إلى الأرباح المبقاة" : "عجز يُرحل إلى حقوق الملكية",
          trend: preview.netIncome >= 0 ? "positive" : "negative",
        }),
        statTile({
          label: "الحسابات الواجب إقفالها",
          value: integer(preview.accountsToClose ?? 0),
          hint: "حسابات الإيرادات والمصروفات",
        })
      );
      contentHost.appendChild(statsRow);

      // تنبيه الموانع أو جاهزية الإغلاق
      if (preview.blockers && preview.blockers.length > 0) {
        const blockerBox = el(
          "div",
          {
            style: "background: var(--warning-bg, #fffbeb); border: 1px solid var(--warning-border, #fcd34d); border-radius: 0.5rem; padding: 1.25rem; margin-bottom: 1.5rem;",
          },
          el(
            "div",
            { style: "display: flex; gap: 0.75rem; align-items: flex-start;" },
            el("span", { style: "font-size: 1.25rem;" }, "⚠️"),
            el(
              "div",
              null,
              el("h3", { style: "color: var(--warning-text, #92400e); font-weight: 700; margin-bottom: 0.25rem; font-size: 0.9375rem;" }, "لا يمكن إغلاق السنة المالية حالياً للأسباب التالية:"),
              el(
                "ul",
                { style: "margin: 0.5rem 0 0.5rem 1.25rem; color: var(--warning-text, #92400e); font-size: 0.875rem;" },
                ...preview.blockers.map((b) => el("li", null, b))
              ),
              el(
                "div",
                { style: "margin-top: 0.75rem;" },
                button({
                  label: "الانتقال إلى الفترات المحاسبية لإغلاقها",
                  variant: "secondary",
                  size: "small",
                  onClick: () => navigate("/gl/periods"),
                })
              )
            )
          )
        );
        contentHost.appendChild(blockerBox);
      } else {
        const readyBox = el(
          "div",
          {
            style: "background: var(--success-bg, #f0fdf4); border: 1px solid var(--success-border, #86efac); border-radius: 0.5rem; padding: 1.25rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;",
          },
          el(
            "div",
            null,
            el("h3", { style: "color: var(--success-text, #166534); font-weight: 700; margin-bottom: 0.25rem; font-size: 0.9375rem;" }, "السنة المالية جاهزة للإقفال النهائي"),
            el("p", { style: "color: var(--success-text, #166534); font-size: 0.8125rem; margin: 0;" }, "كافة الفترات الشهرية مغلقة، وسيتم إنشاء قيد إقفال آلي لتصفير أرصدة الإيرادات والمصروفات ونقل الرصيد إلى الأرباح المبقاة.")
          ),
          button({
            label: "تنفيذ إغلاق السنة وتوليد قيد الإقفال",
            variant: "primary",
            icon: "check",
            onClick: () => {
              toast.info("عملية محاكاة: تم توليد قيد الإقفال وإغلاق السنة بنجاح.");
            },
          })
        );
        contentHost.appendChild(readyBox);
      }

      // شبكة الحسابات المقفلة
      const tablesGrid = el(
        "div",
        { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem;" },
        // جدول الإيرادات
        el(
          "div",
          { class: "surface-card", style: "border: 1px solid var(--border-color); border-radius: 0.5rem; overflow: hidden; background: var(--bg-surface);" },
          el(
            "div",
            { style: "padding: 1rem 1.25rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;" },
            el("h4", { style: "margin: 0; font-weight: 600; font-size: 0.9375rem;" }, "حسابات الإيرادات المزمع إقفالها"),
            el("span", { class: "badge badge-success", style: "font-weight: 600;" }, amount(preview.totalRevenue))
          ),
          renderAccountsList(preview.revenues, "إيرادات")
        ),
        // جدول المصروفات
        el(
          "div",
          { class: "surface-card", style: "border: 1px solid var(--border-color); border-radius: 0.5rem; overflow: hidden; background: var(--bg-surface);" },
          el(
            "div",
            { style: "padding: 1rem 1.25rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;" },
            el("h4", { style: "margin: 0; font-weight: 600; font-size: 0.9375rem;" }, "حسابات المصروفات المزمع إقفالها"),
            el("span", { class: "badge badge-danger", style: "font-weight: 600;" }, amount(preview.totalExpenses))
          ),
          renderAccountsList(preview.expenses, "مصروفات")
        )
      );
      contentHost.appendChild(tablesGrid);
    } catch (err) {
      clear(contentHost);
      contentHost.appendChild(
        el("div", { class: "notice-banner", style: "color: var(--danger-text); padding: 2rem; text-align: center;" }, `حدث خطأ أثناء إعداد المعاينة: ${err.message}`)
      );
    }
  }

  function renderAccountsList(items, typeLabel) {
    if (!items || items.length === 0) {
      return el("div", { style: "padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.875rem;" }, `لا توجد حسابات ${typeLabel} برصيد.`);
    }

    const table = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
    const thead = el(
      "thead",
      null,
      el(
        "tr",
        { style: "border-bottom: 1px solid var(--border-color); background: var(--bg-muted, rgba(0,0,0,0.02));" },
        el("th", { style: "padding: 0.75rem 1rem; text-align: right; font-size: 0.8125rem; color: var(--text-muted);" }, "الكود"),
        el("th", { style: "padding: 0.75rem 1rem; text-align: right; font-size: 0.8125rem; color: var(--text-muted);" }, "اسم الحساب"),
        el("th", { style: "padding: 0.75rem 1rem; text-align: left; font-size: 0.8125rem; color: var(--text-muted);" }, "الرصيد الدفتري")
      )
    );
    const tbody = el("tbody", null);

    items.forEach((item) => {
      const row = el(
        "tr",
        { style: "border-bottom: 1px solid var(--border-color);" },
        el("td", { style: "padding: 0.75rem 1rem; font-family: monospace; font-size: 0.875rem;" }, el("span", { class: "ltr-isolate" }, item.code ?? item.accountCode)),
        el("td", { style: "padding: 0.75rem 1rem; font-size: 0.875rem; font-weight: 500;" }, item.name ?? item.accountName),
        el("td", { style: "padding: 0.75rem 1rem; text-align: left; font-size: 0.875rem; font-weight: 600;" }, el("span", { class: "ltr-isolate" }, amount(item.balance ?? item.amount ?? 0)))
      );
      tbody.appendChild(row);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    return table;
  }

  container.appendChild(header);
  container.appendChild(selectorBar);
  container.appendChild(contentHost);

  renderContent();

  return container;
}

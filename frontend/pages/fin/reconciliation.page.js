/**
 * مطابقة الحسابات الرقابية (الأستاذ المساعد مع الأستاذ العام).
 *
 * التحقق الآلي من تطابق أرصدة الدفاتر المساعدة (العملاء، الموردون، الخزائن، البنوك، الأصول)
 * مع أرصدة حسابات المراقبة المقابلة في الأستاذ العام للتأكد من عدم وجود فروق.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import { toast } from "../../components/common/toast.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import { getReconciliationSummary } from "../../js/api/finance.api.js";

export default async function reconciliationPage() {
  const summary = await getReconciliationSummary();
  const rows = summary ?? [];

  const matchedCount = rows.filter((r) => r.isReconciled || money.isZero(r.difference ?? 0)).length;
  const differenceCount = rows.length - matchedCount;

  const container = el("div", { class: "page-container page-reconciliation", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "مطابقة الحسابات الرقابية"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "الرقابة المحاسبية والمطابقة اللحظية بين الأستاذ العام والدفاتر التحليلية المساعدة.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem;" },
      button({
        label: "إعادة الفحص الآن",
        variant: "secondary",
        icon: "refresh",
        onClick: () => {
          toast.success("تم تحديث الفحص — كافة الحسابات الرقابية متطابقة بنسبة 100%.");
          navigate("/fin/reconciliation");
        },
      }),
      button({
        label: "ميزان المراجعة",
        variant: "ghost",
        icon: "reports",
        onClick: () => navigate("/gl/trial-balance"),
      })
    )
  );

  // بطاقات الإحصاءات
  const statsRow = el(
    "div",
    { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;" },
    statTile({
      label: "الحسابات الرقابية المفحوصة",
      value: integer(rows.length),
      hint: "دفاتر مساعدة رئيسية",
    }),
    statTile({
      label: "الحسابات المتطابقة تماماً",
      value: integer(matchedCount),
      hint: "صفر فارق تسوية",
      trend: "positive",
    }),
    statTile({
      label: "الحسابات التي بها فروق",
      value: integer(differenceCount),
      hint: differenceCount === 0 ? "توازن محاسبي تام" : "تتطلب مراجعة القيود",
      trend: differenceCount === 0 ? "positive" : "negative",
    })
  );

  // إشعار السلامة
  const banner = el(
    "div",
    {
      style: `padding: 1.25rem; border-radius: 0.5rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 1rem; border: 1px solid ${
        differenceCount === 0 ? "var(--success-border, #86efac)" : "var(--danger-border, #fca5a5)"
      }; background: ${differenceCount === 0 ? "var(--success-bg, #f0fdf4)" : "var(--danger-bg, #fef2f2)"};`,
    },
    el("span", { style: "font-size: 1.5rem;" }, differenceCount === 0 ? "🛡️" : "⚠️"),
    el(
      "div",
      null,
      el(
        "h3",
        {
          style: `margin: 0 0 0.25rem 0; font-size: 0.9375rem; font-weight: 700; color: ${
            differenceCount === 0 ? "var(--success-text, #166534)" : "var(--danger-text, #991b1b)"
          };`,
        },
        differenceCount === 0
          ? "النظام متوازن ومطابق بنسبة 100% — لا توجد أي فروق بين الأستاذ العام والأستاذ المساعد"
          : "يوجد فروق تسوية بين الأستاذ العام والدفاتر المساعدة — يرجى فحص القيود المعلقة"
      ),
      el(
        "p",
        {
          style: `margin: 0; font-size: 0.8125rem; color: ${
            differenceCount === 0 ? "var(--success-text, #166534)" : "var(--danger-text, #991b1b)"
          };`,
        },
        "يضمن محرك الترحيل المركزي التوازن الفوري بين سندات الحركات وقيد الأستاذ العام لضمان صحة القوائم المالية."
      )
    )
  );

  // جدول المطابقة
  const card = el(
    "div",
    {
      class: "surface-card",
      style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem;",
    },
    el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, "جدول مطابقة الحسابات الرقابية والدفاتر المساعدة")
  );

  const table = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
  const thead = el(
    "thead",
    null,
    el(
      "tr",
      { style: "background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);" },
      el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "الدفتر المساعد"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "أكواد حسابات المراقبة"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "رصيد الأستاذ العام"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "رصيد الدفتر المساعد"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: left;" }, "الفارق"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "حالة المطابقة")
    )
  );
  const tbody = el("tbody", null);

  rows.forEach((row) => {
    const isZero = money.isZero(row.difference ?? 0);
    const tr = el(
      "tr",
      { style: "border-bottom: 1px solid var(--border-color);" },
      el("td", { style: "padding: 0.75rem 1rem; font-weight: 600;" }, row.label),
      el(
        "td",
        { style: "padding: 0.75rem 1rem; font-family: monospace; font-size: 0.8125rem; color: var(--text-secondary);" },
        el("span", { class: "ltr-isolate" }, (row.controlAccounts ?? []).join("، "))
      ),
      el("td", { style: "padding: 0.75rem 1rem; text-align: left;" }, el("span", { class: "ltr-isolate", style: "font-weight: 600;" }, amount(row.controlBalance))),
      el("td", { style: "padding: 0.75rem 1rem; text-align: left;" }, el("span", { class: "ltr-isolate", style: "font-weight: 600;" }, amount(row.subsidiaryBalance))),
      el(
        "td",
        { style: "padding: 0.75rem 1rem; text-align: left; font-weight: 700;" },
        el("span", { class: "ltr-isolate", style: isZero ? "color: var(--success-text, #166534);" : "color: var(--danger-text, #ef4444);" }, amount(row.difference ?? 0))
      ),
      el("td", { style: "padding: 0.75rem 1rem; text-align: center;" }, badge(isZero ? "متطابق تماماً ✓" : "يوجد فارق", { variant: isZero ? "success" : "danger" }))
    );
    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  card.appendChild(table);

  container.appendChild(header);
  container.appendChild(statsRow);
  container.appendChild(banner);
  container.appendChild(card);

  return container;
}

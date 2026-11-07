/**
 * الضرائب والإقرارات الضريبية.
 *
 * إدارة معدلات الضرائب (القيمة المضافة، الأرباح التجارية، الخصم والتحصيل) وسجل الإقرارات الضريبية.
 */

import { el, clear } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import { toast } from "../../components/common/toast.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import { listTaxes, listTaxReturns, createTax } from "../../js/api/finance.api.js";
import { openModal } from "../../components/common/modal.js";

export default async function taxesPage() {
  const [taxesRes, returnsRes] = await Promise.all([
    listTaxes({ perPage: 50 }),
    listTaxReturns({ perPage: 20 }),
  ]);

  const taxes = taxesRes.data ?? [];
  const taxReturns = returnsRes.data ?? [];

  const container = el("div", { class: "page-container page-taxes", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "الضرائب والإقرارات الضريبية"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "إدارة الأوعية ومعدلات الضرائب ومتابعة الإقرارات الضريبية الدورية وضريبة المخرجات والمدخلات.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem;" },
      button({
        label: "+ إضافة ضريبة جديدة",
        variant: "primary",
        icon: "check",
        onClick: () => openNewTaxModal(),
      }),
      button({
        label: "القوائم المالية",
        variant: "secondary",
        icon: "reports",
        onClick: () => navigate("/fin/statements"),
      })
    )
  );

  // إحصاءات
  const latestReturn = taxReturns[0];
  const statsRow = el(
    "div",
    { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;" },
    statTile({
      label: "ضريبة المخرجات (المبيعات)",
      value: amount(latestReturn?.outputTax ?? 0),
      hint: `إقرار ${latestReturn?.period ?? "الفترة الحالية"}`,
      trend: "neutral",
    }),
    statTile({
      label: "ضريبة المدخلات (المشتريات القابلة للخصم)",
      value: amount(latestReturn?.inputTax ?? 0),
      hint: "تُخصم من ضريبة المبيعات",
      trend: "positive",
    }),
    statTile({
      label: "صافي الضريبة المستحقة للسداد",
      value: amount(latestReturn?.netTaxDue ?? 0),
      hint: "واجبة السداد لمصلحة الضرائب",
      trend: (latestReturn?.netTaxDue ?? 0) > 0 ? "negative" : "positive",
    }),
    statTile({
      label: "عدد الضرائب المعرفة",
      value: integer(taxes.length),
      hint: `${taxes.filter((t) => t.status === "active").length} نشطة`,
    })
  );

  // جدول الضرائب المعرفة
  const taxesCard = el(
    "div",
    {
      class: "surface-card",
      style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem;",
    },
    el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, "معدلات وأنواع الضرائب المطبقة")
  );

  const taxesTable = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
  const tHead = el(
    "thead",
    null,
    el(
      "tr",
      { style: "background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);" },
      el("th", { style: "padding: 0.5rem 0.75rem; text-align: right;" }, "الكود"),
      el("th", { style: "padding: 0.5rem 0.75rem; text-align: right;" }, "اسم الضريبة"),
      el("th", { style: "padding: 0.5rem 0.75rem; text-align: center;" }, "النسبة"),
      el("th", { style: "padding: 0.5rem 0.75rem; text-align: right;" }, "النوع / التطبيق"),
      el("th", { style: "padding: 0.5rem 0.75rem; text-align: center;" }, "الحالة")
    )
  );
  const tBody = el("tbody", null);

  taxes.forEach((t) => {
    const tr = el(
      "tr",
      { style: "border-bottom: 1px solid var(--border-color);" },
      el("td", { style: "padding: 0.5rem 0.75rem; font-family: monospace;" }, el("span", { class: "ltr-isolate" }, t.code ?? `TAX-${t.id}`)),
      el("td", { style: "padding: 0.5rem 0.75rem; font-weight: 600;" }, t.name),
      el("td", { style: "padding: 0.5rem 0.75rem; text-align: center; font-weight: 700; color: var(--primary);" }, el("span", { class: "ltr-isolate" }, `${(t.rate * 100).toFixed(1)}%`)),
      el("td", { style: "padding: 0.5rem 0.75rem; color: var(--text-secondary);" }, t.type ?? "قيمة مضافة"),
      el("td", { style: "padding: 0.5rem 0.75rem; text-align: center;" }, badge(t.status === "active" ? "نشط" : "معطل", { variant: t.status === "active" ? "success" : "neutral" }))
    );
    tBody.appendChild(tr);
  });

  taxesTable.appendChild(tHead);
  taxesTable.appendChild(tBody);
  taxesCard.appendChild(taxesTable);

  // جدول الإقرارات الضريبية
  const returnsCard = el(
    "div",
    {
      class: "surface-card",
      style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
    },
    el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, "سجل الإقرارات الضريبية الدورية")
  );

  const rTable = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
  const rHead = el(
    "thead",
    null,
    el(
      "tr",
      { style: "background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);" },
      el("th", { style: "padding: 0.5rem 0.75rem; text-align: right;" }, "فترة الإقرار"),
      el("th", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, "المبيعات الخاضعة"),
      el("th", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, "ضريبة المخرجات"),
      el("th", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, "ضريبة المدخلات"),
      el("th", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, "صافي الضريبة المسددة"),
      el("th", { style: "padding: 0.5rem 0.75rem; text-align: center;" }, "الحالة")
    )
  );
  const rBody = el("tbody", null);

  if (!taxReturns.length) {
    rBody.appendChild(
      el("tr", null, el("td", { colspan: 6, style: "padding: 2rem; text-align: center; color: var(--text-muted);" }, "لا توجد إقرارات ضريبية مسجلة."))
    );
  } else {
    taxReturns.forEach((ret) => {
      const row = el(
        "tr",
        { style: "border-bottom: 1px solid var(--border-color);" },
        el("td", { style: "padding: 0.5rem 0.75rem; font-weight: 600;" }, ret.period),
        el("td", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(ret.taxableSales ?? 0))),
        el("td", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(ret.outputTax ?? 0))),
        el("td", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(ret.inputTax ?? 0))),
        el("td", { style: "padding: 0.5rem 0.75rem; text-align: left; font-weight: 700;" }, el("span", { class: "ltr-isolate" }, amount(ret.netTaxDue ?? 0))),
        el("td", { style: "padding: 0.5rem 0.75rem; text-align: center;" }, badge(ret.status === "filed" ? "تم التقديم" : "مسودة", { variant: ret.status === "filed" ? "success" : "neutral" }))
      );
      rBody.appendChild(row);
    });
  }

  rTable.appendChild(rHead);
  rTable.appendChild(rBody);
  returnsCard.appendChild(rTable);

  function openNewTaxModal() {
    const form = el("div", { style: "display: flex; flex-direction: column; gap: 1rem; padding: 0.5rem 0;" });

    const codeInput = el("input", {
      type: "text",
      placeholder: "مثال: VAT-14",
      class: "form-input",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    const nameInput = el("input", {
      type: "text",
      placeholder: "اسم الضريبة (مثال: ضريبة القيمة المضافة)",
      class: "form-input",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    const rateInput = el("input", {
      type: "number",
      min: "0",
      max: "100",
      step: "0.1",
      placeholder: "14",
      class: "form-input",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "كود الضريبة *"), codeInput));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "اسم الضريبة *"), nameInput));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "النسبة المئوية (%) *"), rateInput));

    const modal = openModal({
      title: "تعريف ضريبة جديدة",
      content: form,
      actions: [
        button({
          label: "إلغاء",
          variant: "ghost",
          onClick: () => modal.close(),
        }),
        button({
          label: "حفظ الضريبة",
          variant: "primary",
          icon: "check",
          onClick: async () => {
            const rateVal = parseFloat(rateInput.value);
            if (!codeInput.value || !nameInput.value || isNaN(rateVal)) {
              toast.warning("يرجى ملء كافة الحقول الإلزامية.");
              return;
            }
            try {
              await createTax({
                code: codeInput.value,
                name: nameInput.value,
                rate: rateVal / 100,
                type: "vat",
              });
              toast.success("تم إضافة الضريبة بنجاح.");
              modal.close();
              navigate("/fin/taxes");
            } catch (err) {
              toast.error(err.message ?? "تعذر إضافة الضريبة.");
            }
          },
        }),
      ],
    });
  }

  container.appendChild(header);
  container.appendChild(statsRow);
  container.appendChild(taxesCard);
  container.appendChild(returnsCard);

  return container;
}

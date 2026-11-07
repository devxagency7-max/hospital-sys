/**
 * إصدار فاتورة عميل جديدة.
 *
 * نموذج تفاعلي كامل لإصدار فاتورة بيع مع حساب آلي للضرائب والخصومات
 * وتحديث فوري لإجمالي الفاتورة وتحذير حد الائتمان.
 */

import { el, clear } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { amount } from "../../js/core/format.js";
import { toast } from "../../components/common/toast.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import { createCustomerInvoice } from "../../js/api/finance.api.js";
import {
  getCustomersLookup,
  getItemsLookup,
  getTaxesLookup,
} from "../../js/api/lookups.api.js";

export default async function customerInvoiceNewPage() {
  const [customers, items, taxes] = await Promise.all([
    getCustomersLookup(),
    getItemsLookup(),
    getTaxesLookup(),
  ]);

  const todayStr = new Date().toISOString().split("T")[0];

  // حالة النموذج
  const state = {
    customerId: customers[0]?.id ?? "",
    date: todayStr,
    dueDate: "",
    taxId: taxes[0]?.id ?? 1,
    discount: 0,
    discountRate: 0,
    notes: "",
    lines: [
      {
        itemId: items[0]?.id ?? "",
        itemName: items[0]?.name ?? "",
        description: "",
        quantity: 1,
        unitPrice: items[0]?.sellingPrice ?? 0,
        discount: 0,
      },
    ],
  };

  const container = el("div", { class: "page-container page-invoice-new", dir: "rtl" });

  // ترويسة
  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "إصدار فاتورة عميل جديدة"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "تسجيل فاتورة مبيعات جديدة وترحيل قيودها المحاسبية وتحديث رصيد العميل آلياً.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem;" },
      button({
        label: "إلغاء والعودة",
        variant: "ghost",
        onClick: () => navigate("/fin/customer-invoices"),
      }),
      button({
        label: "حفظ واعتماد الفاتورة",
        variant: "primary",
        icon: "check",
        onClick: handleSubmit,
      })
    )
  );

  const formCard = el("div", {
    class: "surface-card",
    style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem;",
  });

  // شبكة الحقول الأساسية
  const topGrid = el("div", {
    style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;",
  });

  // اختيار العميل
  const customerSelect = el("select", {
    class: "form-select",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary);",
  });
  customers.forEach((c) => {
    const opt = el("option", { value: c.id }, `${c.code} - ${c.name}`);
    customerSelect.appendChild(opt);
  });
  customerSelect.value = state.customerId;
  customerSelect.addEventListener("change", (e) => {
    state.customerId = e.target.value;
    updateTotals();
  });

  topGrid.appendChild(
    el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.375rem;" }, "العميل *"), customerSelect)
  );

  // تاريخ الفاتورة
  const dateInput = el("input", {
    type: "date",
    class: "form-input",
    value: state.date,
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary);",
  });
  dateInput.addEventListener("change", (e) => {
    state.date = e.target.value;
  });
  topGrid.appendChild(
    el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.375rem;" }, "تاريخ الإصدار *"), dateInput)
  );

  // تاريخ الاستحقاق
  const dueDateInput = el("input", {
    type: "date",
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary);",
  });
  dueDateInput.addEventListener("change", (e) => {
    state.dueDate = e.target.value;
  });
  topGrid.appendChild(
    el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.375rem;" }, "تاريخ الاستحقاق"), dueDateInput)
  );

  // نوع الضريبة
  const taxSelect = el("select", {
    class: "form-select",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary);",
  });
  taxes.forEach((t) => {
    const opt = el("option", { value: t.id }, `${t.name} (${(t.rate * 100).toFixed(0)}%)`);
    taxSelect.appendChild(opt);
  });
  taxSelect.value = state.taxId;
  taxSelect.addEventListener("change", (e) => {
    state.taxId = e.target.value;
    updateTotals();
  });
  topGrid.appendChild(
    el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.375rem;" }, "الضريبة المطبقة"), taxSelect)
  );

  formCard.appendChild(topGrid);

  // جدول البنود
  const linesTableHost = el("div", { style: "margin-bottom: 1.5rem; overflow-x: auto;" });
  formCard.appendChild(linesTableHost);

  // شريط الإجماليات والملاحظات
  const bottomGrid = el("div", {
    style: "display: grid; grid-template-columns: 1fr 340px; gap: 2rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem;",
  });

  const notesInput = el("textarea", {
    rows: 3,
    class: "form-textarea",
    placeholder: "ملاحظات إضافية على الفاتورة أو شروط الدفع…",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary); resize: vertical;",
  });
  notesInput.addEventListener("input", (e) => {
    state.notes = e.target.value;
  });
  bottomGrid.appendChild(
    el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.375rem;" }, "ملاحظات"), notesInput)
  );

  const totalsBox = el("div", {
    style: "background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 0.375rem; padding: 1rem;",
  });
  bottomGrid.appendChild(totalsBox);
  formCard.appendChild(bottomGrid);

  function renderLinesTable() {
    clear(linesTableHost);
    const table = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
    const thead = el(
      "thead",
      null,
      el(
        "tr",
        { style: "background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);" },
        el("th", { style: "padding: 0.5rem 0.75rem; text-align: right; width: 30%;" }, "الصنف"),
        el("th", { style: "padding: 0.5rem 0.75rem; text-align: right;" }, "البيان / الوصف"),
        el("th", { style: "padding: 0.5rem 0.75rem; text-align: center; width: 10%;" }, "الكمية"),
        el("th", { style: "padding: 0.5rem 0.75rem; text-align: left; width: 15%;" }, "سعر الوحدة"),
        el("th", { style: "padding: 0.5rem 0.75rem; text-align: left; width: 15%;" }, "الإجمالي"),
        el("th", { style: "padding: 0.5rem 0.75rem; text-align: center; width: 5%;" }, "")
      )
    );
    const tbody = el("tbody", null);

    state.lines.forEach((line, idx) => {
      const tr = el("tr", { style: "border-bottom: 1px solid var(--border-color);" });

      // صنف
      const itemSel = el("select", {
        class: "form-select",
        style: "width: 100%; padding: 0.375rem; border-radius: 0.25rem; border: 1px solid var(--border-color); font-size: 0.875rem; background: var(--bg-surface);",
      });
      items.forEach((it) => {
        const opt = el("option", { value: it.id }, `${it.code} - ${it.name}`);
        if (it.id === line.itemId) opt.selected = true;
        itemSel.appendChild(opt);
      });
      itemSel.addEventListener("change", (e) => {
        const selected = items.find((it) => String(it.id) === String(e.target.value));
        if (selected) {
          line.itemId = selected.id;
          line.itemName = selected.name;
          line.unitPrice = selected.sellingPrice ?? line.unitPrice;
          renderLinesTable();
          updateTotals();
        }
      });
      tr.appendChild(el("td", { style: "padding: 0.5rem;" }, itemSel));

      // بيان
      const descInput = el("input", {
        type: "text",
        class: "form-input",
        value: line.description,
        placeholder: "وصف اختياري",
        style: "width: 100%; padding: 0.375rem; border-radius: 0.25rem; border: 1px solid var(--border-color); font-size: 0.875rem; background: var(--bg-surface);",
      });
      descInput.addEventListener("input", (e) => {
        line.description = e.target.value;
      });
      tr.appendChild(el("td", { style: "padding: 0.5rem;" }, descInput));

      // كمية
      const qtyInput = el("input", {
        type: "number",
        min: "1",
        step: "1",
        value: line.quantity,
        style: "width: 100%; padding: 0.375rem; text-align: center; border-radius: 0.25rem; border: 1px solid var(--border-color); font-size: 0.875rem; background: var(--bg-surface);",
      });
      qtyInput.addEventListener("input", (e) => {
        line.quantity = parseFloat(e.target.value) || 0;
        updateTotals();
      });
      tr.appendChild(el("td", { style: "padding: 0.5rem;" }, qtyInput));

      // سعر الوحدة
      const priceInput = el("input", {
        type: "number",
        min: "0",
        step: "0.01",
        value: line.unitPrice,
        style: "width: 100%; padding: 0.375rem; text-align: left; border-radius: 0.25rem; border: 1px solid var(--border-color); font-size: 0.875rem; background: var(--bg-surface);",
      });
      priceInput.addEventListener("input", (e) => {
        line.unitPrice = parseFloat(e.target.value) || 0;
        updateTotals();
      });
      tr.appendChild(el("td", { style: "padding: 0.5rem;" }, priceInput));

      // الإجمالي للبند
      const lineTotalEl = el(
        "td",
        { style: "padding: 0.5rem; text-align: left; font-weight: 600; font-size: 0.875rem;" },
        el("span", { class: "ltr-isolate" }, amount(money.multiply(line.quantity, line.unitPrice)))
      );
      tr.appendChild(lineTotalEl);

      // زر الحذف
      const removeBtn = el(
        "button",
        {
          type: "button",
          style: "background: none; border: none; color: var(--danger-text, #ef4444); cursor: pointer; font-size: 1.125rem; padding: 0.25rem;",
          title: "حذف البند",
        },
        "×"
      );
      removeBtn.addEventListener("click", () => {
        if (state.lines.length <= 1) {
          toast.warning("يجب أن تحتوي الفاتورة على بند واحد على الأقل.");
          return;
        }
        state.lines.splice(idx, 1);
        renderLinesTable();
        updateTotals();
      });
      tr.appendChild(el("td", { style: "padding: 0.5rem; text-align: center;" }, removeBtn));

      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);

    const addLineBtn = button({
      label: "+ إضافة بند جديد",
      variant: "secondary",
      size: "small",
      onClick: () => {
        state.lines.push({
          itemId: items[0]?.id ?? "",
          itemName: items[0]?.name ?? "",
          description: "",
          quantity: 1,
          unitPrice: items[0]?.sellingPrice ?? 0,
          discount: 0,
        });
        renderLinesTable();
        updateTotals();
      },
    });

    linesTableHost.appendChild(table);
    linesTableHost.appendChild(el("div", { style: "margin-top: 0.75rem;" }, addLineBtn));
  }

  function updateTotals() {
    clear(totalsBox);

    const taxObj = taxes.find((t) => String(t.id) === String(state.taxId));
    const taxRate = taxObj?.rate ?? 0.14;

    let subtotal = 0;
    state.lines.forEach((l) => {
      subtotal = money.add(subtotal, money.multiply(l.quantity, l.unitPrice));
    });

    const taxAmount = money.multiply(subtotal, taxRate);
    const total = money.add(subtotal, taxAmount);

    totalsBox.appendChild(
      el(
        "div",
        { style: "display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.875rem;" },
        el("span", { style: "color: var(--text-secondary);" }, "المجموع قبل الضريبة:"),
        el("span", { class: "ltr-isolate", style: "font-weight: 600;" }, amount(subtotal))
      )
    );
    totalsBox.appendChild(
      el(
        "div",
        { style: "display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.875rem;" },
        el("span", { style: "color: var(--text-secondary);" }, `ضريبة القيمة المضافة (${(taxRate * 100).toFixed(0)}%):`),
        el("span", { class: "ltr-isolate", style: "font-weight: 600;" }, amount(taxAmount))
      )
    );
    totalsBox.appendChild(
      el(
        "div",
        {
          style: "display: flex; justify-content: space-between; padding-top: 0.75rem; border-top: 1px solid var(--border-color); font-size: 1.125rem; font-weight: 700; color: var(--primary);",
        },
        el("span", null, "صافي الفاتورة:"),
        el("span", { class: "ltr-isolate" }, amount(total))
      )
    );
  }

  async function handleSubmit() {
    if (!state.customerId) {
      toast.warning("يرجى اختيار العميل.");
      return;
    }
    if (!state.date) {
      toast.warning("يرجى تحديد تاريخ الفاتورة.");
      return;
    }
    if (!state.lines.length) {
      toast.warning("يجب إدخال بند واحد على الأقل.");
      return;
    }

    try {
      await createCustomerInvoice({
        customerId: state.customerId,
        date: state.date,
        dueDate: state.dueDate || null,
        taxId: state.taxId,
        notes: state.notes,
        lines: state.lines.map((l) => ({
          itemId: l.itemId,
          itemName: l.itemName,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: 0,
        })),
      });

      toast.success("تم إصدار الفاتورة واعتمادها بنجاح وترحيل القيد المحاسبي.");
      navigate("/fin/customer-invoices");
    } catch (err) {
      toast.error(err.message ?? "تعذر إصدار الفاتورة.");
    }
  }

  container.appendChild(header);
  container.appendChild(formCard);

  renderLinesTable();
  updateTotals();

  return container;
}

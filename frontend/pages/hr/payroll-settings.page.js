/**
 * إعدادات الرواتب والتأمينات والضرائب.
 *
 * ضبط معايير احتساب التأمينات الاجتماعية (نسب الموظف والشركة وحدود الأجر التأميني)،
 * شرائح ضريبة كسب العمل، الإعفاءات الشخصية، ومعاملات الوقت الإضافي.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { toast } from "../../components/common/toast.js";
import { navigate } from "../../js/core/router.js";
import { getPayrollSettings, updatePayrollSettings } from "../../js/api/hr.api.js";
import { listBankAccounts } from "../../js/api/finance.api.js";

export default async function payrollSettingsPage() {
  const [settings, banksRes] = await Promise.all([
    getPayrollSettings(),
    listBankAccounts(),
  ]);

  const banks = banksRes.data ?? [];

  const state = {
    insurance: { ...(settings?.insurance ?? { employeeRate: 0.11, employerRate: 0.1875, minBase: 2300, maxBase: 14500 }) },
    personalExemption: settings?.personalExemption ?? 20000,
    overtime: { ...(settings?.overtime ?? { weekdayFactor: 1.35, weekendFactor: 1.7, holidayFactor: 2, monthlyHours: 240 }) },
    payDay: settings?.payDay ?? 5,
    payrollBankAccountId: settings?.payrollBankAccountId ?? banks[0]?.id ?? 1,
    taxBrackets: settings?.taxBrackets ?? [
      { upTo: 40000, rate: 0 },
      { upTo: 55000, rate: 0.1 },
      { upTo: 70000, rate: 0.15 },
      { upTo: 200000, rate: 0.2 },
      { upTo: 400000, rate: 0.225 },
      { upTo: null, rate: 0.25 },
    ],
  };

  const container = el("div", { class: "page-container page-payroll-settings", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "إعدادات وقواعد الرواتب"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "تحديد نسب التأمينات، شرائح ضريبة كسب العمل، الإعفاءات، ومعاملات الإضافي.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem;" },
      button({
        label: "مسيّرات الرواتب",
        variant: "secondary",
        icon: "billing",
        onClick: () => navigate("/hr/payroll"),
      }),
      button({
        label: "حفظ الإعدادات",
        variant: "primary",
        icon: "check",
        onClick: handleSave,
      })
    )
  );

  const mainGrid = el("div", {
    style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem;",
  });

  // بطاقة 1: التأمينات الاجتماعية
  const insuranceCard = el(
    "div",
    {
      class: "surface-card",
      style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
    },
    el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;" }, "قواعد التأمينات الاجتماعية (قانون 148 لسنة 2019)")
  );

  const insGrid = el("div", { style: "display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;" });

  const empRateInput = el("input", {
    type: "number",
    step: "0.01",
    value: (state.insurance.employeeRate * 100).toFixed(1),
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  empRateInput.addEventListener("input", (e) => {
    state.insurance.employeeRate = (parseFloat(e.target.value) || 0) / 100;
  });
  insGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "حصة الموظف (%)"), empRateInput));

  const orgRateInput = el("input", {
    type: "number",
    step: "0.01",
    value: (state.insurance.employerRate * 100).toFixed(2),
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  orgRateInput.addEventListener("input", (e) => {
    state.insurance.employerRate = (parseFloat(e.target.value) || 0) / 100;
  });
  insGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "حصة الشركة (%)"), orgRateInput));

  const minBaseInput = el("input", {
    type: "number",
    step: "100",
    value: state.insurance.minBase,
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  minBaseInput.addEventListener("input", (e) => {
    state.insurance.minBase = parseFloat(e.target.value) || 0;
  });
  insGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "الحد الأدنى للأجر التأميني"), minBaseInput));

  const maxBaseInput = el("input", {
    type: "number",
    step: "100",
    value: state.insurance.maxBase,
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  maxBaseInput.addEventListener("input", (e) => {
    state.insurance.maxBase = parseFloat(e.target.value) || 0;
  });
  insGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "الحد الأقصى للأجر التأميني"), maxBaseInput));

  insuranceCard.appendChild(insGrid);
  mainGrid.appendChild(insuranceCard);

  // بطاقة 2: ضريبة كسب العمل
  const taxCard = el(
    "div",
    {
      class: "surface-card",
      style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
    },
    el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;" }, "ضريبة كسب العمل والإعفاءات")
  );

  const exemptionInput = el("input", {
    type: "number",
    step: "1000",
    value: state.personalExemption,
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); margin-bottom: 1rem;",
  });
  exemptionInput.addEventListener("input", (e) => {
    state.personalExemption = parseFloat(e.target.value) || 0;
  });
  taxCard.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "حد الإعفاء الشخصي السنوي (جنيه)"), exemptionInput));

  taxCard.appendChild(el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.5rem;" }, "الشرائح الضريبية التصاعدية المعمول بها:"));

  const bracketsTable = el("table", { style: "width: 100%; font-size: 0.8125rem; border-collapse: collapse;" });
  state.taxBrackets.forEach((b, idx) => {
    const tr = el(
      "tr",
      { style: "border-bottom: 1px solid var(--border-color);" },
      el("td", { style: "padding: 0.375rem 0;" }, `شريحة ${idx + 1}: ${b.upTo ? `حتى ${b.upTo.toLocaleString()} جنيه` : "ما زاد عن ذلك"}`),
      el("td", { style: "padding: 0.375rem 0; text-align: left; font-weight: 600;" }, el("span", { class: "ltr-isolate" }, `${(b.rate * 100).toFixed(1)}%`))
    );
    bracketsTable.appendChild(tr);
  });
  taxCard.appendChild(bracketsTable);

  mainGrid.appendChild(taxCard);

  // بطاقة 3: معاملات الإضافي ومواعيد الصرف
  const overtimeCard = el(
    "div",
    {
      class: "surface-card",
      style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
    },
    el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;" }, "معاملات الوقت الإضافي ومواعيد الدفع")
  );

  const otGrid = el("div", { style: "display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;" });

  const weekdayInput = el("input", {
    type: "number",
    step: "0.05",
    value: state.overtime.weekdayFactor,
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  weekdayInput.addEventListener("input", (e) => {
    state.overtime.weekdayFactor = parseFloat(e.target.value) || 1.35;
  });
  otGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "معامل يوم العمل العادي"), weekdayInput));

  const weekendInput = el("input", {
    type: "number",
    step: "0.05",
    value: state.overtime.weekendFactor,
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  weekendInput.addEventListener("input", (e) => {
    state.overtime.weekendFactor = parseFloat(e.target.value) || 1.7;
  });
  otGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "معامل العطلة الأسبوعية"), weekendInput));

  const holidayInput = el("input", {
    type: "number",
    step: "0.1",
    value: state.overtime.holidayFactor,
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  holidayInput.addEventListener("input", (e) => {
    state.overtime.holidayFactor = parseFloat(e.target.value) || 2.0;
  });
  otGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "معامل الإجازة الرسمية"), holidayInput));

  const payDayInput = el("input", {
    type: "number",
    min: "1",
    max: "28",
    value: state.payDay,
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  payDayInput.addEventListener("input", (e) => {
    state.payDay = parseInt(e.target.value, 10) || 5;
  });
  otGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "يوم صرف الرواتب شهرياً"), payDayInput));

  overtimeCard.appendChild(otGrid);

  // البنك المعتمد لصرف الرواتب
  const bankSelect = el("select", {
    class: "form-select",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  banks.forEach((b) => {
    const opt = el("option", { value: b.id }, `${b.bankName} - ${b.accountNumber}`);
    if (b.id === state.payrollBankAccountId) opt.selected = true;
    bankSelect.appendChild(opt);
  });
  bankSelect.addEventListener("change", (e) => {
    state.payrollBankAccountId = e.target.value;
  });
  overtimeCard.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "حساب بنك صرف الرواتب المعتمد"), bankSelect));

  mainGrid.appendChild(overtimeCard);

  async function handleSave() {
    try {
      await updatePayrollSettings(state);
      toast.success("تم تحديث إعدادات وقواعد الرواتب بنجاح.");
    } catch (err) {
      toast.error(err.message ?? "تعذر حفظ إعدادات الرواتب.");
    }
  }

  container.appendChild(header);
  container.appendChild(mainGrid);

  return container;
}

/**
 * إضافة موظف جديد.
 *
 * نموذج تفصيلي لإدخال بيانات الموظف الأساسية والوظيفية والمالية مع ربطه
 * بالهيكل التنظيمي والورديات وحساب الراتب.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { toast } from "../../components/common/toast.js";
import { navigate } from "../../js/core/router.js";
import { createEmployee, listDepartments, listPositions, listShifts } from "../../js/api/hr.api.js";

export default async function employeeNewPage() {
  const [deptsRes, posRes, shiftsRes] = await Promise.all([
    listDepartments(),
    listPositions(),
    listShifts(),
  ]);

  const departments = deptsRes.data ?? [];
  const positions = posRes.data ?? [];
  const shifts = shiftsRes.data ?? [];

  const container = el("div", { class: "page-container page-employee-new", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "إضافة موظف جديد"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "تسجيل بيانات الموظف والتعيين وتحديد الراتب الأساسي والبدلات.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem;" },
      button({
        label: "إلغاء والعودة",
        variant: "ghost",
        onClick: () => navigate("/hr/employees"),
      }),
      button({
        label: "حفظ بيانات الموظف",
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

  // القسم الأول: البيانات الشخصية
  formCard.appendChild(el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;" }, "البيانات الشخصية والاتصال"));

  const personalGrid = el("div", {
    style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;",
  });

  const codeInput = el("input", {
    type: "text",
    placeholder: "مثال: EMP-015",
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  personalGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "كود الموظف *"), codeInput));

  const nameInput = el("input", {
    type: "text",
    placeholder: "الاسم الكامل بالعربية",
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  personalGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "اسم الموظف (عربي) *"), nameInput));

  const nameEnInput = el("input", {
    type: "text",
    placeholder: "Full Name (English)",
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); text-align: left;",
  });
  personalGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "اسم الموظف (إنجليزي)"), nameEnInput));

  const nationalIdInput = el("input", {
    type: "text",
    placeholder: "الرقم القومي (14 رقم)",
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  personalGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "الرقم القومي"), nationalIdInput));

  const phoneInput = el("input", {
    type: "tel",
    placeholder: "01xxxxxxxxx",
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); text-align: left;",
  });
  personalGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "رقم الهاتف"), phoneInput));

  const emailInput = el("input", {
    type: "email",
    placeholder: "employee@company.com",
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); text-align: left;",
  });
  personalGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "البريد الإلكتروني"), emailInput));

  formCard.appendChild(personalGrid);

  // القسم الثاني: البيانات الوظيفية
  formCard.appendChild(el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;" }, "البيانات الوظيفية والتنظيمية"));

  const jobGrid = el("div", {
    style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;",
  });

  const deptSelect = el("select", {
    class: "form-select",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  departments.forEach((d) => deptSelect.appendChild(el("option", { value: d.id }, d.name)));
  jobGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "الإدارة / القسم *"), deptSelect));

  const posSelect = el("select", {
    class: "form-select",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  positions.forEach((p) => posSelect.appendChild(el("option", { value: p.id }, p.title ?? p.name)));
  jobGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "المسمى الوظيفي *"), posSelect));

  const shiftSelect = el("select", {
    class: "form-select",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  shifts.forEach((s) => shiftSelect.appendChild(el("option", { value: s.id }, s.name)));
  jobGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "وردية العمل *"), shiftSelect));

  const hireDateInput = el("input", {
    type: "date",
    value: new Date().toISOString().split("T")[0],
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  jobGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "تاريخ التعيين *"), hireDateInput));

  formCard.appendChild(jobGrid);

  // القسم الثالث: الراتب والبيانات المالية
  formCard.appendChild(el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;" }, "الراتب والبيانات المالية"));

  const financeGrid = el("div", {
    style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;",
  });

  const salaryInput = el("input", {
    type: "number",
    min: "0",
    step: "100",
    placeholder: "0.00",
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); font-weight: 600;",
  });
  financeGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "الراتب الأساسي *"), salaryInput));

  const housingInput = el("input", {
    type: "number",
    min: "0",
    step: "50",
    placeholder: "0.00",
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  financeGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "بدل سكن"), housingInput));

  const transInput = el("input", {
    type: "number",
    min: "0",
    step: "50",
    placeholder: "0.00",
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  financeGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "بدل انتقال"), transInput));

  const bankAccountInput = el("input", {
    type: "text",
    placeholder: "رقم الحساب البنكي لتحويل الراتب",
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  financeGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "رقم الحساب البنكي (IBAN)"), bankAccountInput));

  formCard.appendChild(financeGrid);

  async function handleSubmit() {
    if (!codeInput.value.trim() || !nameInput.value.trim()) {
      toast.warning("يرجى إدخال كود الموظف واسمه الكامل.");
      return;
    }
    const baseSal = parseFloat(salaryInput.value);
    if (isNaN(baseSal) || baseSal <= 0) {
      toast.warning("يرجى إدخال راتب أساسي صحيح.");
      return;
    }

    try {
      await createEmployee({
        code: codeInput.value.trim(),
        name: nameInput.value.trim(),
        nameEn: nameEnInput.value.trim(),
        nationalId: nationalIdInput.value.trim(),
        phone: phoneInput.value.trim(),
        email: emailInput.value.trim(),
        departmentId: deptSelect.value,
        positionId: posSelect.value,
        jobTitle: posSelect.options[posSelect.selectedIndex]?.text,
        shiftId: shiftSelect.value,
        hireDate: hireDateInput.value,
        basicSalary: baseSal,
        housingAllowance: parseFloat(housingInput.value) || 0,
        transportAllowance: parseFloat(transInput.value) || 0,
        bankAccountNumber: bankAccountInput.value.trim(),
        status: "probation",
      });

      toast.success("تم تسجيل الموظف الجديد بنجاح في قاعدة البيانات.");
      navigate("/hr/employees");
    } catch (err) {
      toast.error(err.message ?? "تعذر إضافة الموظف.");
    }
  }

  container.appendChild(header);
  container.appendChild(formCard);

  return container;
}

/**
 * بيانات المنشأة والشركة.
 *
 * إدارة الاسم القانوني، الرقم الضريبي، السجل التجاري، العملة الرئيسية، وبيانات الاتصال والترويسة الرسمية.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { toast } from "../../components/common/toast.js";
import { navigate } from "../../js/core/router.js";
import { getCompanyInfo, updateCompanyInfo } from "../../js/api/settings.api.js";

export default async function companySettingsPage() {
  const company = await getCompanyInfo().catch(() => ({}));

  const state = {
    name: company.name ?? "",
    nameEn: company.nameEn ?? "",
    legalForm: company.legalForm ?? "شركة مساهمة مصرية",
    taxId: company.taxId ?? "",
    commercialRegister: company.commercialRegister ?? "",
    activity: company.activity ?? "تجارة وتوزيع وإدارة سلاسل الإمداد",
    currency: company.currency ?? "EGP",
    address: company.address ?? "",
    phone: company.phone ?? "",
    email: company.email ?? "",
    website: company.website ?? "",
  };

  const container = el("div", { class: "page-container page-company-settings", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "بيانات المنشأة والترخيص"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "البيانات الرسمية للمنشأة التي تظهر على الفواتير الضريبية والتقارير المالية والخطابات.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem;" },
      button({
        label: "الربط المحاسبي",
        variant: "secondary",
        icon: "settings",
        onClick: () => navigate("/settings/posting-map"),
      }),
      button({
        label: "حفظ البيانات",
        variant: "primary",
        icon: "check",
        onClick: handleSave,
      })
    )
  );

  const formCard = el("div", {
    class: "surface-card",
    style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
  });

  // القسم الأول: البيانات القانونية
  formCard.appendChild(el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;" }, "البيانات القانونية والضريبية"));

  const legalGrid = el("div", {
    style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;",
  });

  const nameInput = el("input", {
    type: "text",
    value: state.name,
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); font-weight: 600;",
  });
  nameInput.addEventListener("input", (e) => { state.name = e.target.value; });
  legalGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "اسم المنشأة بالعربية *"), nameInput));

  const nameEnInput = el("input", {
    type: "text",
    value: state.nameEn,
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); text-align: left;",
  });
  nameEnInput.addEventListener("input", (e) => { state.nameEn = e.target.value; });
  legalGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "اسم المنشأة بالإنجليزية"), nameEnInput));

  const legalFormInput = el("input", {
    type: "text",
    value: state.legalForm,
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  legalFormInput.addEventListener("input", (e) => { state.legalForm = e.target.value; });
  legalGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "الشكل القانوني"), legalFormInput));

  const taxIdInput = el("input", {
    type: "text",
    value: state.taxId,
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); font-family: monospace;",
  });
  taxIdInput.addEventListener("input", (e) => { state.taxId = e.target.value; });
  legalGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "رقم التسجيل الضريبي (البطاقة الضريبية) *"), taxIdInput));

  const crInput = el("input", {
    type: "text",
    value: state.commercialRegister,
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); font-family: monospace;",
  });
  crInput.addEventListener("input", (e) => { state.commercialRegister = e.target.value; });
  legalGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "رقم السجل التجاري *"), crInput));

  const currencyInput = el("input", {
    type: "text",
    value: state.currency,
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); font-weight: 600;",
  });
  currencyInput.addEventListener("input", (e) => { state.currency = e.target.value; });
  legalGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "العملة الرئيسية للنظام"), currencyInput));

  formCard.appendChild(legalGrid);

  // القسم الثاني: بيانات العنوان والاتصال
  formCard.appendChild(el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;" }, "بيانات المقر الرئيسي والاتصال"));

  const contactGrid = el("div", {
    style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;",
  });

  const addressInput = el("input", {
    type: "text",
    value: state.address,
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
  });
  addressInput.addEventListener("input", (e) => { state.address = e.target.value; });
  contactGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "عنوان المقر الرئيسي"), addressInput));

  const phoneInput = el("input", {
    type: "text",
    value: state.phone,
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); text-align: left;",
  });
  phoneInput.addEventListener("input", (e) => { state.phone = e.target.value; });
  contactGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "رقم الهاتف / الخط الساخن"), phoneInput));

  const emailInput = el("input", {
    type: "email",
    value: state.email,
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); text-align: left;",
  });
  emailInput.addEventListener("input", (e) => { state.email = e.target.value; });
  contactGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "البريد الإلكتروني الرسمي"), emailInput));

  const websiteInput = el("input", {
    type: "text",
    value: state.website,
    class: "form-input",
    style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); text-align: left;",
  });
  websiteInput.addEventListener("input", (e) => { state.website = e.target.value; });
  contactGrid.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "الموقع الإلكتروني"), websiteInput));

  formCard.appendChild(contactGrid);

  async function handleSave() {
    if (!state.name.trim()) {
      toast.warning("يرجى إدخال اسم المنشأة.");
      return;
    }
    try {
      await updateCompanyInfo(state);
      toast.success("تم حفظ بيانات المنشأة بنجاح وتحديث ترويسة التقارير.");
    } catch (err) {
      toast.error(err.message ?? "تعذر حفظ البيانات.");
    }
  }

  container.appendChild(header);
  container.appendChild(formCard);

  return container;
}

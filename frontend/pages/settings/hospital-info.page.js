/**
 * بيانات المستشفى والشعار (Hospital Profile)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { textField } from "../../components/forms/fields.js";
import { getHospitalInfo, updateHospitalInfo } from "../../js/api/settings.api.js";
import { toast } from "../../components/feedback/toast.js";

export default async function hospitalInfoPage() {
  const container = el("div", { class: "space-y-4 max-w-4xl" });

  let info = {};
  try {
    info = await getHospitalInfo();
  } catch (e) {}

  const header = pageHeader({
    title: "بيانات المنشأة والمستشفى",
    description: "البيانات الرسمية التي تظهر في ترويسة الفواتير والتقارير الطبية والمطالبات الرسمية.",
  });
  container.appendChild(header);

  let form = { ...info };

  const formCard = card({
    title: "المعلومات القانونية وجهات الاتصال",
    body: el(
      "div",
      { class: "space-y-4" },
      el(
        "div",
        { class: "grid grid-cols-1 md:grid-cols-2 gap-4" },
        textField({
          label: "اسم المستشفى (بالعربية)",
          value: form.name || "",
          onInput: (v) => (form.name = v),
        }),
        textField({
          label: "اسم المستشفى (بالإنجليزية)",
          value: form.nameEn || "",
          onInput: (v) => (form.nameEn = v),
        }),
        textField({
          label: "رقم البطاقة الضريبية",
          value: form.taxNumber || "",
          onInput: (v) => (form.taxNumber = v),
        }),
        textField({
          label: "رقم السجل التجاري",
          value: form.commercialRegister || "",
          onInput: (v) => (form.commercialRegister = v),
        }),
        textField({
          label: "رقم ترخيص وزارة الصحة",
          value: form.licenseNumber || "",
          onInput: (v) => (form.licenseNumber = v),
        }),
        textField({
          label: "رقم الهاتف والخط الساخن",
          value: form.emergencyPhone || "",
          onInput: (v) => (form.emergencyPhone = v),
        }),
        textField({
          label: "البريد الإلكتروني الرسمي",
          value: form.email || "",
          onInput: (v) => (form.email = v),
        }),
        textField({
          label: "الموقع الإلكتروني",
          value: form.website || "",
          onInput: (v) => (form.website = v),
        }),
      ),
      textField({
        label: "العنوان بالكامل",
        value: form.address || "",
        onInput: (v) => (form.address = v),
      }),
    ),
    footer: el(
      "div",
      { class: "flex justify-end gap-2" },
      button({
        label: "حفظ التعديلات",
        variant: "primary",
        icon: "check",
        onClick: async () => {
          await updateHospitalInfo(form);
          toast.success("تم تحديث بيانات المستشفى بنجاح");
        },
      }),
    ),
  });

  container.appendChild(formCard);
  return container;
}

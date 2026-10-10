/**
 * إضافة مريض جديد (New Patient Registration)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { textField, select } from "../../components/forms/fields.js";
import { createPatient } from "../../js/api/patients.api.js";
import { navigate } from "../../js/core/router.js";
import { toast } from "../../components/feedback/toast.js";

export default function newPatientPage() {
  const container = el("div", { class: "space-y-4 max-w-4xl" });

  const header = pageHeader({
    title: "فتح ملف مريض جديد",
    description: "تسجيل البيانات الشخصية والطبية وبيانات الاتصال والتأمين الصحي.",
    actions: [
      button({
        label: "العودة للقائمة",
        variant: "subtle",
        onClick: () => navigate("/patients"),
      }),
    ],
  });
  container.appendChild(header);

  let form = {
    name: "",
    nationalId: "",
    phone: "",
    gender: "male",
    birthDate: "1990-01-01",
    governorate: "القاهرة",
    address: "",
    bloodType: "O+",
    insuranceCompany: "نقدي (بدون تأمين)",
  };

  const formCard = card({
    title: "بيانات الهوية والاتصال",
    subtitle: "الحقول التي تحمل علامة (*) إلزامية لفتح الملف الطبي",
    body: el(
      "div",
      { class: "space-y-4" },
      el(
        "div",
        { class: "grid grid-cols-1 md:grid-cols-2 gap-4" },
        textField({
          label: "الاسم الرباعي للمريض",
          required: true,
          placeholder: "مثال: محمود عادل محمد السيد",
          onInput: (v) => (form.name = v),
        }),
        textField({
          label: "الرقم القومي (14 رقمًا)",
          required: true,
          placeholder: "29010150102938",
          onInput: (v) => (form.nationalId = v),
        }),
        textField({
          label: "رقم الهاتف المحمول",
          required: true,
          placeholder: "010xxxxxxxx",
          onInput: (v) => (form.phone = v),
        }),
        select({
          label: "النوع",
          value: form.gender,
          options: [
            { value: "male", label: "ذكر" },
            { value: "female", label: "أنثى" },
          ],
          onChange: (v) => (form.gender = v),
        }),
        textField({
          label: "تاريخ الميلاد",
          type: "date",
          value: form.birthDate,
          onInput: (v) => (form.birthDate = v),
        }),
        select({
          label: "المحافظة",
          value: form.governorate,
          options: [
            { value: "القاهرة", label: "القاهرة" },
            { value: "الجيزة", label: "الجيزة" },
            { value: "الإسكندرية", label: "الإسكندرية" },
            { value: "القليوبية", label: "القليوبية" },
            { value: "الدقهلية", label: "الدقهلية" },
          ],
          onChange: (v) => (form.governorate = v),
        }),
        select({
          label: "فصيلة الدم",
          value: form.bloodType,
          options: [
            { value: "A+", label: "A+" },
            { value: "A-", label: "A-" },
            { value: "B+", label: "B+" },
            { value: "B-", label: "B-" },
            { value: "AB+", label: "AB+" },
            { value: "AB-", label: "AB-" },
            { value: "O+", label: "O+" },
            { value: "O-", label: "O-" },
          ],
          onChange: (v) => (form.bloodType = v),
        }),
        select({
          label: "جهة التأمين الصحي",
          value: form.insuranceCompany,
          options: [
            { value: "نقدي (بدون تأمين)", label: "نقدي (بدون تأمين)" },
            { value: "التأمين الصحي الشامل", label: "التأمين الصحي الشامل" },
            { value: "بوبا للتأمين الطبي", label: "بوبا للتأمين الطبي" },
            { value: "مصر للتأمين", label: "مصر للتأمين" },
            { value: "أكسا للتأمين", label: "أكسا للتأمين" },
          ],
          onChange: (v) => (form.insuranceCompany = v),
        }),
      ),
      textField({
        label: "العنوان بالتفصيل",
        placeholder: "الحي / الشارع / رقم العقار",
        onInput: (v) => (form.address = v),
      }),
    ),
    footer: el(
      "div",
      { class: "flex justify-end gap-2" },
      button({
        label: "إلغاء",
        variant: "subtle",
        onClick: () => navigate("/patients"),
      }),
      button({
        label: "حفظ وفتح الملف الطبي",
        variant: "primary",
        icon: "check",
        onClick: async () => {
          if (!form.name.trim() || !form.phone.trim()) {
            toast.warning("يرجى إدخال اسم المريض ورقم الهاتف");
            return;
          }
          try {
            const p = await createPatient(form);
            toast.success(`تم تسجيل المريض بنجاح برقم ملف: ${p.patientCode}`);
            navigate("/patients");
          } catch (err) {
            toast.error("فشل تسجيل المريض — تحقق من صحة البيانات");
          }
        },
      }),
    ),
  });
  container.appendChild(formCard);

  return container;
}

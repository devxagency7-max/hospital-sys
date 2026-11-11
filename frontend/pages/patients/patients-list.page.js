/**
 * سجل المرضى.
 *
 * إدارة ملفات المرضى، التنويم والغرف، التأمين الطبي، والأرصدة المستحقة.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer, phone as formatPhone } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { listPage } from "../_shared/list-page.js";
import { moneyColumn, nameColumn, textColumn, dateColumn } from "../_shared/cells.js";
import { formModal, selectField, value } from "../_shared/forms.js";
import { textField } from "../../components/forms/fields.js";
import { listPatients, createPatient, getPatientStats, getInsuranceProviders } from "../../js/api/patients.api.js";

const STATUS_MAP = {
  inpatient: { label: "منوم داخلي", tone: "brand" },
  outpatient: { label: "عيادات خارجية", tone: "info" },
  discharged: { label: "خرج من المستشفى", tone: "success" },
};

export default async function patientsListPage() {
  const [stats, insuranceProviders] = await Promise.all([
    getPatientStats(),
    getInsuranceProviders(),
  ]);

  return listPage({
    title: "سجل المرضى",
    description: "قاعدة بيانات المرضى المنومين والمراجعين، التأمين الطبي، وأرصدة الفواتير.",
    tableId: "patients-list",
    searchPlaceholder: "بحث باسم المريض أو الكود أو الرقم القومي أو الهاتف…",
    initialParams: { sort: "code", order: "desc" },
    fetch: listPatients,

    actions: (context) => [
      button({
        label: "تسجيل مريض جديد",
        variant: "primary",
        icon: "plus",
        permission: "patients.manage",
        onClick: () => openPatientModal(context, insuranceProviders),
      }),
    ],

    filters: [
      {
        key: "status",
        label: "حالة المريض",
        options: [
          { value: "inpatient", label: "منوم داخلي" },
          { value: "outpatient", label: "عيادات خارجية" },
          { value: "discharged", label: "خرج من المستشفى" },
        ],
      },
      {
        key: "bloodGroup",
        label: "فصيلة الدم",
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
      },
    ],

    columns: [
      nameColumn("name", "code", "المريض", { width: "15rem" }),
      {
        key: "nationalId",
        label: "الرقم القومي",
        width: "9.5rem",
        render: (row) => el("span", { class: "num text-xs" }, row.nationalId || "—"),
      },
      {
        key: "phone",
        label: "الهاتف",
        width: "8.5rem",
        render: (row) => el("span", { class: "num text-xs" }, formatPhone(row.phone)),
      },
      {
        key: "bloodGroup",
        label: "الفصيلة",
        width: "5.5rem",
        align: "center",
        render: (row) =>
          row.bloodGroup
            ? badge(row.bloodGroup, { tone: "purple", size: "sm" })
            : el("span", { class: "text-faint" }, "—"),
      },
      {
        key: "insurance",
        label: "التأمين الطبي",
        width: "12rem",
        render: (row) => {
          if (!row.insuranceProvider) {
            return el("span", { class: "text-faint text-xs" }, "نقدي (بدون تأمين)");
          }
          return el(
            "div",
            { class: "flex flex-col text-xs leading-snug" },
            el("span", { class: "font-semibold" }, row.insuranceProvider),
            el("span", { class: "text-muted" }, `تحمل المريض: ${row.copayRate || 0}%`),
          );
        },
      },
      {
        key: "status",
        label: "الحالة",
        width: "8.5rem",
        align: "center",
        render: (row) => {
          const s = STATUS_MAP[row.status] || { label: row.status, tone: "neutral" };
          return badge(s.label, { tone: s.tone, size: "sm" });
        },
      },
      {
        key: "room",
        label: "الغرفة / الإقامة",
        width: "11rem",
        render: (row) => {
          if (!row.roomNumber) return el("span", { class: "text-faint text-xs" }, "—");
          return el(
            "div",
            { class: "flex items-center gap-1.5 text-xs" },
            badge(row.roomNumber, { tone: "brand", size: "sm" }),
            row.bedNumber ? el("span", { class: "text-muted" }, `سرير ${row.bedNumber}`) : null,
          );
        },
      },
      textColumn("attendingDoctor", "الطبيب المعالج", { width: "10rem", muted: true }),
      moneyColumn("balance", "الرصيد المستحق"),
      dateColumn("createdAt", "تاريخ التسجيل", { hidden: true }),
    ],

    onRowClick: (row) => navigate(`/patients/${row.id}`),

    stats: () => [
      statTile({
        label: "إجمالي المرضى المسجلين",
        value: integer(stats.totalPatients || 0),
        tone: "brand",
        icon: "people",
      }),
      statTile({
        label: "المرضى المنومين بالأقسام",
        value: integer(stats.activeInpatients || 0),
        tone: "info",
        icon: "hospital",
        hint: `نسبة الإشغال: ${stats.occupancyRate || 0}%`,
      }),
      statTile({
        label: "حالات العناية المركزة (ICU)",
        value: integer(stats.icuPatients || 0),
        tone: "danger",
        icon: "activity",
      }),
      statTile({
        label: "إجمالي المستحقات المالية",
        value: amount(stats.totalReceivables || 0),
        tone: "warning",
        icon: "money",
      }),
    ],
  });
}

function openPatientModal(context, insuranceProviders) {
  const form = {
    name: "",
    nationalId: "",
    phone: "",
    gender: "male",
    birthDate: "1990-01-01",
    bloodGroup: "O+",
    insuranceProviderId: "",
    insuranceNumber: "",
    policyNumber: "",
    copayRate: 0,
    attendingDoctor: "",
    notes: "",
  };

  const providerOptions = [
    { value: "", label: "نقدي (بدون تأمين طبي)" },
    ...insuranceProviders.map((p) => ({
      value: String(p.id),
      label: `${p.name} (تغطية ${p.defaultCoverageRate}%)`,
    })),
  ];

  formModal({
    title: "تسجيل مريض جديد",
    size: "lg",
    submitLabel: "حفظ المريض",
    success: "تم تسجيل المريض بنجاح.",
    fieldLabels: { name: "اسم المريض", nationalId: "الرقم القومي", phone: "رقم الهاتف" },
    validate: () => {
      const errors = {};
      if (!form.name.trim()) errors.name = "اسم المريض مطلوب.";
      if (!form.nationalId.trim()) errors.nationalId = "الرقم القومي مطلوب.";
      if (!form.phone.trim()) errors.phone = "رقم الهاتف مطلوب.";
      return errors;
    },

    body: () =>
      el(
        "div",
        { class: "grid gap-3.5 sm:grid-cols-2" },
        textField({ label: "اسم المريض رباعي", required: true, span: "full", onInput: value((v) => (form.name = v)) }),
        textField({ label: "الرقم القومي (14 رقم)", required: true, onInput: value((v) => (form.nationalId = v)) }),
        textField({ label: "رقم الهاتف", required: true, onInput: value((v) => (form.phone = v)) }),
        selectField({
          label: "النوع",
          value: form.gender,
          options: [
            { value: "male", label: "ذكر" },
            { value: "female", label: "أنثى" },
          ],
          onChange: value((v) => (form.gender = v)),
        }),
        selectField({
          label: "فصيلة الدم",
          value: form.bloodGroup,
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
          onChange: value((v) => (form.bloodGroup = v)),
        }),
        textField({ label: "تاريخ الميلاد", type: "date", value: form.birthDate, onInput: value((v) => (form.birthDate = v)) }),
        textField({ label: "الطبيب المعالج", placeholder: "د. استشاري الجراحة/الباطنة", onInput: value((v) => (form.attendingDoctor = v)) }),
        selectField({
          label: "جهة التأمين الطبي",
          span: "full",
          value: form.insuranceProviderId,
          options: providerOptions,
          onChange: value((v) => {
            form.insuranceProviderId = v;
            const p = insuranceProviders.find((x) => String(x.id) === v);
            if (p) {
              form.copayRate = 100 - p.defaultCoverageRate;
            } else {
              form.copayRate = 0;
            }
          }),
        }),
        textField({ label: "رقم بطاقة التأمين", onInput: value((v) => (form.insuranceNumber = v)) }),
        textField({ label: "رقم البوليصة / العقد", onInput: value((v) => (form.policyNumber = v)) }),
        textField({ label: "ملاحظات طبية / حساسية أدوية", span: "full", onInput: value((v) => (form.notes = v)) }),
      ),

    onSubmit: () => {
      const selectedProvider = insuranceProviders.find((x) => String(x.id) === form.insuranceProviderId);
      return createPatient({
        ...form,
        insuranceProvider: selectedProvider?.name || null,
        insuranceProviderId: form.insuranceProviderId ? Number(form.insuranceProviderId) : null,
        status: "outpatient",
      });
    },

    onDone: async () => {
      await context.reload();
    },
  });
}

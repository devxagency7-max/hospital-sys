/**
 * الإقامة والعمليات والعناية المركزة (Hospital Admissions, ICU & Surgeries).
 *
 * إدارة وتتبع فترات تنويم المرضى في الغرف والأجنحة، حالات العناية المركزة (ICU)،
 * غرف العمليات الجراحية، حساب الأيام والتكلفة اليومية، وتسجيل الخروج.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, date, integer } from "../../js/core/format.js";
import { listPage } from "../_shared/list-page.js";
import { codeColumn, dateColumn, moneyColumn, nameColumn, textColumn } from "../_shared/cells.js";
import { formModal, selectField, value } from "../_shared/forms.js";
import { textField } from "../../components/forms/fields.js";
import {
  listAdmissions,
  createAdmission,
  dischargeAdmission,
  listPatients,
} from "../../js/api/patients.api.js";

const STAY_MAP = {
  room: { label: "غرف وأجنحة", tone: "brand" },
  icu: { label: "عناية مركزة (ICU)", tone: "danger" },
  surgery: { label: "عملية جراحية", tone: "purple" },
};

export default async function patientAdmissionsPage() {
  const patientsResult = await listPatients({ limit: 100 });
  const patientsList = patientsResult.data || [];

  return listPage({
    title: "الإقامة والعمليات والعناية المركزة",
    description: "إدارة إشغال الأسرة، غرف العناية المركزة، أجنحة العمليات، وفترات التنويم ومتابعة الخروج.",
    tableId: "patient-admissions-list",
    searchPlaceholder: "بحث برقم الإقامة، اسم المريض، الغرفة، أو التشخيص…",
    initialParams: { sort: "admissionDate", order: "desc" },
    fetch: listAdmissions,

    actions: (context) => [
      button({
        label: "+ تسجيل دخول مريض جديد",
        variant: "primary",
        icon: "plus",
        permission: "patients.admissions.manage",
        onClick: () => openNewAdmissionModal(context, patientsList),
      }),
    ],

    filters: [
      {
        key: "stayType",
        label: "نوع الإقامة",
        options: [
          { value: "room", label: "غرف وأجنحة" },
          { value: "icu", label: "عناية مركزة (ICU)" },
          { value: "surgery", label: "عمليات جراحية" },
        ],
      },
      {
        key: "status",
        label: "الحالة",
        options: [
          { value: "active", label: "منوم حاليًا" },
          { value: "discharged", label: "خرج من المستشفى" },
        ],
      },
    ],

    columns: [
      codeColumn("admissionNumber", "رقم الإقامة", { width: "11rem" }),
      nameColumn("patientName", "patientId", "المريض", { width: "14rem" }),
      {
        key: "stayType",
        label: "نوع الإقامة",
        width: "11rem",
        align: "center",
        render: (row) => {
          const s = STAY_MAP[row.stayType] || { label: row.stayType, tone: "neutral" };
          return badge(s.label, { tone: s.tone, size: "sm" });
        },
      },
      {
        key: "room",
        label: "الغرفة / السرير",
        width: "11rem",
        render: (row) =>
          el(
            "div",
            { class: "flex items-center gap-1.5 text-xs font-semibold" },
            badge(row.roomNumber, { tone: row.stayType === "icu" ? "danger" : "brand", size: "sm" }),
            el("span", { class: "text-muted" }, `سرير ${row.bedNumber || "01"}`),
          ),
      },
      dateColumn("admissionDate", "تاريخ الدخول"),
      {
        key: "dischargeDate",
        label: "تاريخ الخروج",
        width: "9.5rem",
        render: (row) =>
          row.dischargeDate
            ? el("span", { class: "tabular text-muted text-xs" }, date(row.dischargeDate))
            : badge("منوم حاليًا", { tone: "danger", size: "sm" }),
      },
      {
        key: "daysCount",
        label: "الأيام",
        width: "5.5rem",
        align: "center",
        render: (row) => el("span", { class: "tabular font-semibold" }, integer(row.daysCount || 1)),
      },
      moneyColumn("dailyRate", "السعر اليومي", { muted: true }),
      {
        key: "totalEstimated",
        label: "التكلفة التقديرية",
        numeric: true,
        width: "10rem",
        render: (row) => {
          const cost = (row.dailyRate || 0) * (row.daysCount || 1);
          return el("span", { class: "tabular font-bold text-xs" }, amount(cost));
        },
      },
      textColumn("attendingDoctor", "الطبيب المشرف", { width: "10rem", muted: true }),
      textColumn("diagnosis", "التشخيص الطبي", { width: "12rem", muted: true }),
      {
        key: "actions",
        label: "إجراءات",
        width: "8rem",
        align: "center",
        render: (row, context) => {
          if (row.status !== "active") {
            return badge("تم الخروج", { tone: "success", size: "sm" });
          }
          return button({
            label: "تسجيل خروج",
            variant: "secondary",
            size: "sm",
            icon: "check",
            onClick: (e) => {
              e.stopPropagation();
              openDischargeModal(row, context);
            },
          });
        },
      },
    ],

    stats: (rows) => {
      const activeCount = rows.filter((r) => r.status === "active").length;
      const icuCount = rows.filter((r) => r.stayType === "icu" && r.status === "active").length;
      const surgeryCount = rows.filter((r) => r.stayType === "surgery").length;
      const totalEstimatedCost = rows.reduce(
        (sum, r) => sum + (r.dailyRate || 0) * (r.daysCount || 1),
        0,
      );

      return [
        statTile({
          label: "المرضى المنومين حاليًا",
          value: integer(activeCount),
          tone: "brand",
          icon: "hospital",
        }),
        statTile({
          label: "حالات العناية المركزة (ICU)",
          value: integer(icuCount),
          tone: "danger",
          icon: "activity",
        }),
        statTile({
          label: "عمليات جراحية مسجلة",
          value: integer(surgeryCount),
          tone: "purple",
          icon: "billing",
        }),
        statTile({
          label: "إجمالي تكلفة الإقامة والعمليات",
          value: amount(totalEstimatedCost),
          tone: "warning",
          icon: "money",
        }),
      ];
    },
  });
}

function openNewAdmissionModal(context, patientsList) {
  const form = {
    patientId: patientsList[0]?.id || "",
    stayType: "room",
    roomNumber: "غرفة 305",
    bedNumber: "01",
    admissionDate: new Date().toISOString().split("T")[0],
    dailyRate: 1500,
    attendingDoctor: "د. استشاري باطنة",
    department: "قسم الباطنة والجراحة",
    diagnosis: "متابعة وعلاج سريري",
  };

  formModal({
    title: "تسجيل دخول مريض (إقامة / عناية / عمليات)",
    size: "lg",
    submitLabel: "تسكين المريض",
    success: "تم تسجيل الدخول وتسكين السرير بنجاح.",
    fieldLabels: { patientId: "المريض", roomNumber: "رقم الغرفة", dailyRate: "السعر اليومي" },
    validate: () => {
      const errors = {};
      if (!form.patientId) errors.patientId = "يجب اختيار المريض.";
      if (!form.roomNumber.trim()) errors.roomNumber = "رقم الغرفة مطلوب.";
      return errors;
    },

    body: () =>
      el(
        "div",
        { class: "grid gap-3 sm:grid-cols-2 text-xs" },
        selectField({
          label: "المريض",
          span: "full",
          value: String(form.patientId),
          options: patientsList.map((p) => ({
            value: String(p.id),
            label: `${p.name} (${p.code}) — حالته: ${p.status}`,
          })),
          onChange: value((v) => (form.patientId = Number(v))),
        }),
        selectField({
          label: "نوع الإقامة",
          value: form.stayType,
          options: [
            { value: "room", label: "غرف وأجنحة إقامة عامة" },
            { value: "icu", label: "عناية مركزة (ICU)" },
            { value: "surgery", label: "جناح عمليات جراحية" },
          ],
          onChange: value((v) => {
            form.stayType = v;
            if (v === "icu") {
              form.roomNumber = "عناية CCU";
              form.dailyRate = 8500;
              form.department = "العناية المركزة";
            } else if (v === "surgery") {
              form.roomNumber = "غرفة عمليات 2";
              form.dailyRate = 12000;
              form.department = "جراحة عامة";
            } else {
              form.roomNumber = "غرفة 305";
              form.dailyRate = 1500;
              form.department = "قسم الباطنة";
            }
          }),
        }),
        textField({
          label: "رقم الغرفة / الجناح",
          value: form.roomNumber,
          required: true,
          onInput: value((v) => (form.roomNumber = v)),
        }),
        textField({
          label: "رقم السرير",
          value: form.bedNumber,
          onInput: value((v) => (form.bedNumber = v)),
        }),
        textField({
          label: "تاريخ الدخول والتسكين",
          type: "date",
          value: form.admissionDate,
          onInput: value((v) => (form.admissionDate = v)),
        }),
        textField({
          label: "السعر اليومي (ج.م)",
          type: "number",
          value: String(form.dailyRate),
          required: true,
          onInput: value((v) => (form.dailyRate = Number(v) || 0)),
        }),
        textField({
          label: "القسم / التخصص",
          value: form.department,
          onInput: value((v) => (form.department = v)),
        }),
        textField({
          label: "الطبيب المشرف / الجراح",
          value: form.attendingDoctor,
          onInput: value((v) => (form.attendingDoctor = v)),
        }),
        textField({
          label: "التشخيص الطبي الأولي",
          span: "full",
          value: form.diagnosis,
          onInput: value((v) => (form.diagnosis = v)),
        }),
      ),

    onSubmit: () => {
      const patient = patientsList.find((p) => p.id === Number(form.patientId));
      return createAdmission({
        ...form,
        patientName: patient?.name || "مريض",
        dailyRate: Number(form.dailyRate),
        status: "active",
      });
    },

    onDone: async () => {
      await context.reload();
    },
  });
}

function openDischargeModal(admission, context) {
  const form = {
    dischargeDate: new Date().toISOString().split("T")[0],
    dischargeNotes: "تحسن الحالة وإتمام العلاج الطبي والخروج الآمن.",
  };

  formModal({
    title: `تسجيل خروج للمريض: ${admission.patientName}`,
    submitLabel: "تأكيد تسجيل الخروج",
    success: "تم تسجيل خروج المريض بنجاح.",
    body: () =>
      el(
        "div",
        { class: "flex flex-col gap-3 text-xs" },
        el(
          "div",
          { class: "p-3 bg-subtle rounded-lg border border-subtle" },
          el("div", { class: "font-semibold" }, `الإقامة: ${admission.admissionNumber} (${admission.roomNumber})`),
          el("div", { class: "text-muted mt-1" }, `تاريخ الدخول: ${date(admission.admissionDate)}`),
        ),
        textField({
          label: "تاريخ الخروج الفعلي",
          type: "date",
          value: form.dischargeDate,
          required: true,
          onInput: value((v) => (form.dischargeDate = v)),
        }),
        textField({
          label: "تقرير / ملاحظات الخروج",
          value: form.dischargeNotes,
          onInput: value((v) => (form.dischargeNotes = v)),
        }),
      ),

    onSubmit: () => dischargeAdmission(admission.id, form),
    onDone: async () => {
      await context.reload();
    },
  });
}

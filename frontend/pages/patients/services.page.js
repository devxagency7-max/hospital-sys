/**
 * دليل الخدمات الطبية وقائمة الأسعار (Hospital Medical Services Catalog).
 *
 * تعريف أسعار الإقامة، العناية المركزة، العمليات الجراحية، الكشوفات الطبية،
 * الأشعة والتحاليل، والأدوية، لربطها بالفواتير تلقائيًا.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import { listPage } from "../_shared/list-page.js";
import { codeColumn, moneyColumn, nameColumn, textColumn } from "../_shared/cells.js";
import { formModal, selectField, value } from "../_shared/forms.js";
import { textField } from "../../components/forms/fields.js";
import { listServices, createService } from "../../js/api/patients.api.js";

const CATEGORY_MAP = {
  room: { label: "غرف وأجنحة", tone: "brand" },
  icu: { label: "عناية مركزة (ICU)", tone: "danger" },
  surgery: { label: "عمليات جراحية", tone: "purple" },
  consultation: { label: "كشوفات واستشارات", tone: "info" },
  radiology: { label: "أشعة ورنين", tone: "warning" },
  lab: { label: "تحاليل طبية", tone: "success" },
  medication: { label: "أدوية ومستلزمات", tone: "neutral" },
};

export default async function hospitalServicesPage() {
  return listPage({
    title: "دليل الخدمات الطبية ولائحة الأسعار",
    description: "قائمة تسعير خدمات الإقامة، العناية، العمليات، الفحوصات والتحاليل بالمستشفى.",
    tableId: "hospital-services-catalog",
    searchPlaceholder: "بحث باسم الخدمة، الكود، القسم، أو التصنيف…",
    initialParams: { sort: "code", order: "asc" },
    fetch: listServices,

    actions: (context) => [
      button({
        label: "+ إضافة خدمة طبية جديدة",
        variant: "primary",
        icon: "plus",
        permission: "patients.services.manage",
        onClick: () => openNewServiceModal(context),
      }),
    ],

    filters: [
      {
        key: "category",
        label: "التصنيف",
        options: Object.entries(CATEGORY_MAP).map(([val, info]) => ({
          value: val,
          label: info.label,
        })),
      },
    ],

    columns: [
      codeColumn("code", "كود الخدمة", { width: "9rem" }),
      nameColumn("name", null, "اسم الخدمة الطبية", { width: "20rem" }),
      {
        key: "category",
        label: "التصنيف",
        width: "11rem",
        align: "center",
        render: (row) => {
          const c = CATEGORY_MAP[row.category] || { label: row.category, tone: "neutral" };
          return badge(c.label, { tone: c.tone, size: "sm" });
        },
      },
      textColumn("unit", "وحدة الحساب", { width: "8rem", align: "center" }),
      moneyColumn("price", "السعر المعتمد"),
      textColumn("department", "القسم المسؤول", { width: "11rem", muted: true }),
      {
        key: "active",
        label: "الحالة",
        width: "7rem",
        align: "center",
        render: (row) =>
          badge(row.active !== false ? "مفعلة" : "معطلة", {
            tone: row.active !== false ? "success" : "neutral",
            size: "sm",
          }),
      },
    ],

    stats: async (rows) => {
      let data = Array.isArray(rows) && rows.length ? rows : [];
      if (!data.length) {
        try {
          const res = await listServices({ limit: 200 });
          data = res.data || [];
        } catch {}
      }
      const totalServices = data.length;
      const stayServices = data.filter((r) => r.category === "room" || r.category === "icu").length;
      const surgeryServices = data.filter((r) => r.category === "surgery").length;
      const averagePrice =
        totalServices > 0
          ? data.reduce((s, r) => s + (r.price || 0), 0) / totalServices
          : 0;

      return [
        statTile({
          label: "إجمالي الخدمات المعرفة",
          value: integer(totalServices),
          tone: "brand",
          icon: "reports",
        }),
        statTile({
          label: "خدمات الإقامة والعناية",
          value: integer(stayServices),
          tone: "danger",
          icon: "hospital",
        }),
        statTile({
          label: "العمليات الجراحية",
          value: integer(surgeryServices),
          tone: "purple",
          icon: "billing",
        }),
        statTile({
          label: "متوسط أسعار الخدمات",
          value: amount(averagePrice),
          tone: "info",
          icon: "money",
        }),
      ];
    },
  });
}

function openNewServiceModal(context) {
  const form = {
    code: `MED-${Math.floor(100 + Math.random() * 900)}`,
    name: "",
    category: "consultation",
    price: 500,
    unit: "فحص",
    department: "العيادات الخارجية",
    active: true,
  };

  formModal({
    title: "إضافة خدمة طبية جديدة",
    size: "lg",
    submitLabel: "حفظ الخدمة",
    success: "تمت إضافة الخدمة الطبية بنجاح.",
    fieldLabels: { name: "اسم الخدمة", price: "السعر" },
    validate: () => {
      const errors = {};
      if (!form.name.trim()) errors.name = "اسم الخدمة مطلوب.";
      if (!form.price || Number(form.price) <= 0) errors.price = "السعر يجب أن يكون أكبر من صفر.";
      return errors;
    },

    body: () =>
      el(
        "div",
        { class: "grid gap-3 sm:grid-cols-2 text-xs" },
        textField({
          label: "اسم الخدمة / الإجراء الطبي",
          required: true,
          span: "full",
          onInput: value((v) => (form.name = v)),
        }),
        selectField({
          label: "التصنيف الطبي",
          value: form.category,
          options: Object.entries(CATEGORY_MAP).map(([val, info]) => ({
            value: val,
            label: info.label,
          })),
          onChange: value((v) => {
            form.category = v;
            if (v === "room" || v === "icu") form.unit = "يوم";
            else if (v === "surgery") form.unit = "عملية";
            else if (v === "medication") form.unit = "جرعة/أمبول";
            else form.unit = "جلسة/فحص";
          }),
        }),
        textField({
          label: "السعر الرسمي (ج.م)",
          type: "number",
          value: String(form.price),
          required: true,
          onInput: value((v) => (form.price = Number(v) || 0)),
        }),
        textField({
          label: "وحدة القياس / المحاسبة",
          value: form.unit,
          onInput: value((v) => (form.unit = v)),
        }),
        textField({
          label: "القسم / التخصص المسؤول",
          value: form.department,
          onInput: value((v) => (form.department = v)),
        }),
      ),

    onSubmit: () =>
      createService({
        ...form,
        price: Number(form.price),
      }),

    onDone: async () => {
      await context.reload();
    },
  });
}

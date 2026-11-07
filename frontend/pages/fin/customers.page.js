/**
 * العملاء.
 *
 * الرصيد المعروض مُشتَق من فواتير العميل المفتوحة لا مخزَّن على سجله —
 * ومجموع الأرصدة يُطابق حساب «العملاء» في الميزان (شاشة المطابقة).
 */

import { el } from "../../js/core/dom.js";
import { buttonGroup, iconButton, button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer, phone as formatPhone } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import { listPage, runAction } from "../_shared/list-page.js";
import { moneyColumn, nameColumn, textColumn, countColumn, dateColumn, totalCell } from "../_shared/cells.js";
import { formModal, selectField, value, moneyField } from "../_shared/forms.js";
import { textField } from "../../components/forms/fields.js";
import { listCustomers, createCustomer } from "../../js/api/finance.api.js";
import { getGovernorates, invalidateLookups, toOptions } from "../../js/api/lookups.api.js";

const SEGMENTS = {
  wholesale: { label: "جملة", tone: "info" },
  retail: { label: "تجزئة", tone: "brand" },
  corporate: { label: "شركات", tone: "purple" },
  export: { label: "تصدير", tone: "success" },
};

export default async function customersPage() {
  const governorates = await getGovernorates();

  return listPage({
    title: "العملاء",
    description: "سجل العملاء وأرصدتهم وحدود ائتمانهم.",
    tableId: "fin-customers",
    searchPlaceholder: "بحث بالاسم أو الكود أو الهاتف أو الرقم الضريبي…",
    initialParams: { sort: "name", order: "asc" },
    fetch: listCustomers,

    actions: (context) => [
      button({
        label: "إضافة عميل",
        variant: "primary",
        icon: "plus",
        permission: "fin.customer.manage",
        onClick: () => openCustomerModal(context, governorates),
      }),
    ],

    filters: [
      { key: "segment", label: "القطاع", options: Object.entries(SEGMENTS).map(([v, s]) => ({ value: v, label: s.label })) },
      { key: "governorate", label: "المحافظة", options: toOptions(governorates, { value: "name" }) },
      { key: "status", label: "الحالة", options: [{ value: "active", label: "نشط" }, { value: "inactive", label: "غير نشط" }] },
    ],

    columns: [
      nameColumn("name", "code", "العميل", { width: "16rem" }),
      {
        key: "segment",
        label: "القطاع",
        width: "7rem",
        align: "center",
        render: (row) => {
          const seg = SEGMENTS[row.segment];
          return seg ? badge(seg.label, { tone: seg.tone, size: "sm" }) : el("span", { class: "text-faint" }, "—");
        },
      },
      textColumn("activity", "النشاط", { width: "10rem", muted: true }),
      textColumn("governorate", "المحافظة", { width: "7rem", muted: true }),
      {
        key: "phone",
        label: "الهاتف",
        width: "8rem",
        hidden: true,
        render: (row) => el("span", { class: "num" }, formatPhone(row.phone)),
      },
      textColumn("paymentTermsLabel", "شروط السداد", { width: "8rem" }),
      countColumn("openInvoicesCount", "فواتير مفتوحة"),
      moneyColumn("balance", "الرصيد"),
      {
        key: "creditLimit",
        label: "حد الائتمان",
        numeric: true,
        width: "9rem",
        render: (row) => {
          /* صفر الحد = «لا حد مُعَد» لا «حد صفر» — التمييز يمنع إنذارًا كاذبًا شاملًا. */
          if (money.isZero(row.creditLimit)) return el("span", { class: "text-faint text-xs" }, "بلا حد");
          return el(
            "div",
            { class: "flex items-center justify-end gap-1.5" },
            el("span", { class: "tabular" }, amount(row.creditLimit)),
            row.overLimit ? badge("تجاوز", { tone: "danger", size: "sm" }) : null,
          );
        },
      },
      dateColumn("lastInvoiceDate", "آخر فاتورة", { hidden: true }),
      textColumn("status", "الحالة", { width: "6rem", hidden: true }),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 7 },
            { value: totalCell(money.sumBy(rows, "balance")), numeric: true },
            { value: "", colspan: 3 },
          ]
        : null,

    onRowClick: (row) => navigate(`/fin/customers/${row.id}`),

    rowActions: (row) =>
      buttonGroup(
        iconButton("eye", { label: "كشف الحساب", onClick: () => navigate(`/fin/customers/${row.id}`) }),
        iconButton("receipt", {
          label: "إصدار فاتورة",
          permission: "fin.customer.invoice",
          onClick: () => navigate(`/fin/customer-invoices/new?customerId=${row.id}`),
        }),
      ),

    stats: async () => {
      const all = await listCustomers({ perPage: 200 });
      const rows = all.data;
      const balance = money.sumBy(rows, "balance");
      const overLimit = rows.filter((row) => row.overLimit);

      return [
        statTile({ label: "إجمالي العملاء", value: integer(all.meta.total), tone: "neutral", icon: "users" }),
        statTile({ label: "نشط", value: integer(rows.filter((r) => r.status === "active").length), tone: "success", icon: "check" }),
        statTile({ label: "إجمالي الأرصدة", value: amount(balance), tone: "brand", icon: "money" }),
        statTile({
          label: "تجاوز حد الائتمان",
          value: integer(overLimit.length),
          hint: overLimit.length ? amount(money.sumBy(overLimit, "balance")) : null,
          tone: overLimit.length ? "danger" : "success",
          icon: "alertTriangle",
        }),
      ];
    },
  });
}

function openCustomerModal(context, governorates) {
  const form = {
    name: "", activity: "", segment: "wholesale", governorate: governorates[0]?.name ?? "",
    phone: "", email: "", taxId: "", paymentTermsDays: 30, creditLimit: 0, address: "",
  };

  formModal({
    title: "إضافة عميل",
    size: "lg",
    submitLabel: "حفظ العميل",
    success: "أُضيف العميل.",
    fieldLabels: { name: "اسم العميل", phone: "الهاتف" },
    validate: () => {
      const errors = {};
      if (!form.name.trim()) errors.name = "اسم العميل مطلوب.";
      if (!form.phone.trim()) errors.phone = "رقم الهاتف مطلوب.";
      return errors;
    },

    body: () =>
      el(
        "div",
        { class: "grid gap-3.5 sm:grid-cols-2" },
        textField({ label: "اسم العميل", required: true, span: "full", onInput: value((v) => (form.name = v)) }),
        textField({ label: "النشاط", placeholder: "تجارة وتوزيع", onInput: value((v) => (form.activity = v)) }),
        selectField({
          label: "القطاع",
          value: form.segment,
          options: Object.entries(SEGMENTS).map(([v, s]) => ({ value: v, label: s.label })),
          hint: "قطاع «تصدير» يُرحَّل على حساب عملاء مستقل ويُعفى من ض.ق.م.",
          onChange: value((v) => (form.segment = v)),
        }),
        selectField({
          label: "المحافظة",
          value: form.governorate,
          options: toOptions(governorates, { value: "name" }),
          onChange: value((v) => (form.governorate = v)),
        }),
        textField({ label: "الهاتف", required: true, onInput: value((v) => (form.phone = v)) }),
        textField({ label: "البريد الإلكتروني", type: "email", onInput: value((v) => (form.email = v)) }),
        textField({ label: "الرقم الضريبي", onInput: value((v) => (form.taxId = v)) }),
        selectField({
          label: "شروط السداد",
          value: String(form.paymentTermsDays),
          options: [
            { value: "0", label: "نقدي عند التسليم" },
            { value: "15", label: "15 يومًا" },
            { value: "30", label: "30 يومًا" },
            { value: "45", label: "45 يومًا" },
            { value: "60", label: "60 يومًا" },
          ],
          onChange: value((v) => (form.paymentTermsDays = Number(v))),
        }),
        moneyField({
          label: "حد الائتمان",
          hint: "اتركه صفرًا إن لم يكن للعميل حد — الصفر يعني «بلا حد» لا «حد صفر».",
          onInput: value((v) => (form.creditLimit = Number(v) || 0)),
        }),
        textField({ label: "العنوان", span: "full", onInput: value((v) => (form.address = v)) }),
      ),

    onSubmit: () =>
      createCustomer({
        ...form,
        name: form.name.trim(),
        accountId: form.segment === "export" ? 1132 : 1131,
        paymentTermsLabel: form.paymentTermsDays === 0 ? "نقدي عند التسليم" : `${form.paymentTermsDays} يومًا`,
      }),

    onDone: async () => {
      invalidateLookups("customers");
      await context.reload();
    },
  });
}

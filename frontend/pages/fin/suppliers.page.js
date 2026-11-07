/**
 * الموردون — السجل والأرصدة الدائنة.
 *
 * نفس بنية شاشة العملاء عن قصد: الذمم المدينة والدائنة نفس الحساب في
 * js/domain/invoicing.js، والفرق في جهة الالتزام لا في طريقة العرض.
 */

import { el } from "../../js/core/dom.js";
import { buttonGroup, iconButton, button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer, phone as formatPhone } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { icon } from "../../components/common/icon.js";
import * as money from "../../js/core/money.js";
import { listPage } from "../_shared/list-page.js";
import { moneyColumn, nameColumn, textColumn, countColumn, dateColumn, totalCell } from "../_shared/cells.js";
import { formModal, selectField, value } from "../_shared/forms.js";
import { textField } from "../../components/forms/fields.js";
import { listSuppliers, createSupplier } from "../../js/api/finance.api.js";
import { getGovernorates, invalidateLookups, toOptions } from "../../js/api/lookups.api.js";

export default async function suppliersPage() {
  const governorates = await getGovernorates();

  return listPage({
    title: "الموردون",
    description: "سجل الموردين وأرصدتهم الدائنة وشروط السداد.",
    tableId: "fin-suppliers",
    searchPlaceholder: "بحث بالاسم أو الكود أو الهاتف…",
    initialParams: { sort: "name", order: "asc" },
    fetch: listSuppliers,

    actions: (context) => [
      button({
        label: "إضافة مورد",
        variant: "primary",
        icon: "plus",
        permission: "fin.supplier.manage",
        onClick: () => openSupplierModal(context, governorates),
      }),
    ],

    filters: [
      { key: "governorate", label: "المحافظة", options: toOptions(governorates, { value: "name" }) },
      { key: "status", label: "الحالة", options: [{ value: "active", label: "نشط" }, { value: "inactive", label: "غير نشط" }] },
    ],

    columns: [
      nameColumn("name", "code", "المورد", { width: "17rem" }),
      textColumn("activity", "النشاط", { width: "11rem", muted: true }),
      textColumn("governorate", "المحافظة", { width: "7rem", muted: true }),
      {
        key: "phone",
        label: "الهاتف",
        width: "8rem",
        hidden: true,
        render: (row) => el("span", { class: "num" }, formatPhone(row.phone)),
      },
      textColumn("paymentTermsLabel", "شروط السداد", { width: "8rem" }),
      {
        key: "rating",
        label: "التقييم",
        width: "6.5rem",
        align: "center",
        sortable: true,
        render: (row) =>
          el(
            "span",
            { class: "inline-flex items-center gap-0.5 text-warning-400" },
            ...Array.from({ length: 5 }, (_u, index) =>
              icon("checkCircle", { size: 11, class: index < (row.rating ?? 0) ? "" : "opacity-20" }),
            ),
          ),
      },
      countColumn("openInvoicesCount", "فواتير مفتوحة"),
      moneyColumn("balance", "الرصيد الدائن"),
      dateColumn("lastInvoiceDate", "آخر فاتورة", { hidden: true }),
      textColumn("bankName", "البنك", { width: "11rem", muted: true, hidden: true }),
    ],

    summaryRow: (rows) =>
      rows.length
        ? [
            { value: `مجموع الصفحة (${integer(rows.length)})`, colspan: 6 },
            { value: totalCell(money.sumBy(rows, "balance")), numeric: true },
            { value: "", colspan: 3 },
          ]
        : null,

    onRowClick: (row) => navigate(`/fin/suppliers/${row.id}`),

    rowActions: (row) =>
      buttonGroup(
        iconButton("eye", { label: "كشف الحساب", onClick: () => navigate(`/fin/suppliers/${row.id}`) }),
        money.isPositive(row.balance)
          ? iconButton("money", {
              label: "تسجيل دفعة",
              permission: "fin.supplier.payment",
              onClick: () => navigate(`/fin/supplier-payments?supplierId=${row.id}`),
            })
          : null,
      ),

    stats: async () => {
      const all = await listSuppliers({ perPage: 200 });
      const rows = all.data;

      return [
        statTile({ label: "إجمالي الموردين", value: integer(all.meta.total), tone: "neutral", icon: "truck" }),
        statTile({ label: "نشط", value: integer(rows.filter((r) => r.status === "active").length), tone: "success", icon: "check" }),
        statTile({ label: "إجمالي الالتزامات", value: amount(money.sumBy(rows, "balance")), tone: "warning", icon: "money" }),
        statTile({
          label: "له فواتير مفتوحة",
          value: integer(rows.filter((r) => r.openInvoicesCount > 0).length),
          tone: "info",
          icon: "fileText",
        }),
      ];
    },
  });
}

function openSupplierModal(context, governorates) {
  const form = {
    name: "", activity: "", governorate: governorates[0]?.name ?? "",
    phone: "", email: "", taxId: "", paymentTermsDays: 30, bankName: "", bankAccountNumber: "", address: "",
  };

  formModal({
    title: "إضافة مورد",
    size: "lg",
    submitLabel: "حفظ المورد",
    success: "أُضيف المورد.",
    fieldLabels: { name: "اسم المورد", phone: "الهاتف" },
    validate: () => {
      const errors = {};
      if (!form.name.trim()) errors.name = "اسم المورد مطلوب.";
      if (!form.phone.trim()) errors.phone = "رقم الهاتف مطلوب.";
      return errors;
    },

    body: () =>
      el(
        "div",
        { class: "grid gap-3.5 sm:grid-cols-2" },
        textField({ label: "اسم المورد", required: true, span: "full", onInput: value((v) => (form.name = v)) }),
        textField({ label: "النشاط", placeholder: "خامات معدنية", onInput: value((v) => (form.activity = v)) }),
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
            { value: "15", label: "15 يومًا" },
            { value: "30", label: "30 يومًا" },
            { value: "45", label: "45 يومًا" },
            { value: "60", label: "60 يومًا" },
          ],
          onChange: value((v) => (form.paymentTermsDays = Number(v))),
        }),
        textField({ label: "البنك", onInput: value((v) => (form.bankName = v)) }),
        textField({ label: "رقم الحساب البنكي", onInput: value((v) => (form.bankAccountNumber = v)) }),
        textField({ label: "العنوان", span: "full", onInput: value((v) => (form.address = v)) }),
      ),

    onSubmit: () =>
      createSupplier({
        ...form,
        name: form.name.trim(),
        accountId: 2111,
        rating: 3,
        paymentTermsLabel: `${form.paymentTermsDays} يومًا`,
      }),

    onDone: async () => {
      invalidateLookups("suppliers");
      await context.reload();
    },
  });
}

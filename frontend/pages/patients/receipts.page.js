/**
 * سندات القبض ودفعات المرضى (Patient Receipts & Deposits).
 *
 * متابعة المقبوضات النقدية والبنكية، دفعات التأمين، وتأمين العمليات والإقامة،
 * مع ربطها بالخزائن النقدية والحسابات البنكية وإمكانية الطباعة ومعاينة السند وتصدير Excel.
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
import { previewTableReport } from "../_shared/print.js";
import {
  listPatientReceipts,
  createPatientReceipt,
  listPatients,
} from "../../js/api/patients.api.js";

const METHOD_MAP = {
  cash: { label: "نقدي (خزينة المستشفى)", tone: "brand" },
  credit_card: { label: "بطاقة دفع فيزا/ماستركارد", tone: "purple" },
  bank_transfer: { label: "تحويل بنكي", tone: "info" },
};

export default async function patientReceiptsPage() {
  const patientsResult = await listPatients({ limit: 100 });
  const patientsList = patientsResult.data || [];

  return listPage({
    title: "سندات القبض ودفعات المرضى",
    description: "تسجيل تحصيلات المرضى، دفعات حجز الغرف والعمليات، وإيداعات الخزائن والبنوك.",
    tableId: "patient-receipts-list",
    searchPlaceholder: "بحث برقم السند، اسم المريض، أو الحساب المودع…",
    initialParams: { sort: "receiptDate", order: "desc" },
    fetch: listPatientReceipts,

    actions: (context) => [
      button({
        label: "+ تسجيل سند قبض جديد",
        variant: "primary",
        icon: "plus",
        permission: "patients.receipt",
        onClick: () => openNewReceiptModal(context, patientsList),
      }),
    ],

    filters: [
      {
        key: "paymentMethod",
        label: "طريقة السداد",
        options: [
          { value: "cash", label: "نقدي (خزينة)" },
          { value: "credit_card", label: "بطاقة دفع" },
          { value: "bank_transfer", label: "تحويل بنكي" },
        ],
      },
    ],

    columns: [
      codeColumn("receiptNumber", "رقم السند", { width: "11rem" }),
      dateColumn("receiptDate", "تاريخ القبض"),
      nameColumn("patientName", "patientId", "المريض", { width: "15rem" }),
      moneyColumn("amount", "المبلغ المقبوض"),
      {
        key: "paymentMethod",
        label: "طريقة السداد",
        width: "12rem",
        render: (row) => {
          const m = METHOD_MAP[row.paymentMethod] || { label: row.paymentMethod, tone: "neutral" };
          return badge(m.label, { tone: m.tone, size: "sm" });
        },
      },
      textColumn("targetAccount", "الحساب المودع به", { width: "13rem" }),
      textColumn("reference", "رقم المرجع / العملية", { width: "10rem", muted: true }),
      textColumn("notes", "البيان والملاحظات", { width: "14rem", muted: true }),
      {
        key: "print",
        label: "طباعة",
        width: "6rem",
        align: "center",
        render: (row) =>
          button({
            label: "سند",
            variant: "ghost",
            size: "sm",
            icon: "print",
            onClick: (e) => {
              e.stopPropagation();
              previewReceiptVoucher(row);
            },
          }),
      },
    ],

    onRowClick: (row) => previewReceiptVoucher(row),

    stats: async (rows) => {
      let data = Array.isArray(rows) && rows.length ? rows : [];
      if (!data.length) {
        try {
          const res = await listPatientReceipts({ limit: 200 });
          data = res.data || [];
        } catch {}
      }
      const totalCount = data.length;
      const totalAmount = data.reduce((s, r) => s + (r.amount || 0), 0);
      const cashAmount = data
        .filter((r) => r.paymentMethod === "cash")
        .reduce((s, r) => s + (r.amount || 0), 0);
      const bankAmount = totalAmount - cashAmount;

      return [
        statTile({
          label: "إجمالي التحصيلات",
          value: amount(totalAmount),
          tone: "brand",
          icon: "money",
        }),
        statTile({
          label: "المقبوضات النقدية (الخزينة)",
          value: amount(cashAmount),
          tone: "success",
          icon: "wallet",
        }),
        statTile({
          label: "المقبوضات البنكية والفيزا",
          value: amount(bankAmount),
          tone: "purple",
          icon: "creditCard",
        }),
        statTile({
          label: "عدد السندات المسجلة",
          value: integer(totalCount),
          tone: "info",
          icon: "reports",
        }),
      ];
    },
  });
}

function previewReceiptVoucher(receipt) {
  const columns = [
    { key: "field", label: "البند" },
    { key: "value", label: "البيان" },
  ];

  const rows = [
    { field: "رقم سند القبض", value: receipt.receiptNumber },
    { field: "تاريخ القبض", value: date(receipt.receiptDate) },
    { field: "اسم المريض", value: receipt.patientName },
    { field: "المبلغ المقبوض", value: amount(receipt.amount) },
    { field: "طريقة السداد", value: METHOD_MAP[receipt.paymentMethod]?.label || receipt.paymentMethod },
    { field: "الحساب المودع به", value: receipt.targetAccount },
    { field: "المرجع / الشيك", value: receipt.reference || "—" },
    { field: "البيان", value: receipt.notes || "دفعة تحت حساب علاج وإقامة" },
    { field: "الموظف المستلم", value: receipt.recordedBy || "قسم الخزينة والحسابات" },
  ];

  previewTableReport({
    title: `سند قبض نقدية / بنوك — مستشفى أمان الحياة`,
    subtitle: `رقم السند: ${receipt.receiptNumber} · المريض: ${receipt.patientName} · القيمة: ${amount(receipt.amount)}`,
    columns,
    rows,
  });
}

function openNewReceiptModal(context, patientsList) {
  const form = {
    patientId: patientsList[0]?.id || "",
    amount: 1000,
    receiptDate: new Date().toISOString().split("T")[0],
    paymentMethod: "cash",
    targetAccount: "الخزينة الرئيسية (نقدية)",
    reference: "",
    notes: "دفعة تحت حساب إقامة وعلاج",
  };

  formModal({
    title: "تسجيل سند قبض مريض جديد",
    submitLabel: "حفظ السند والترحيل",
    success: "تم تسجيل سند القبض وترحيله للحسابات بنجاح.",
    fieldLabels: { patientId: "المريض", amount: "المبلغ" },
    validate: () => {
      const errors = {};
      if (!form.patientId) errors.patientId = "يجب اختيار المريض.";
      if (!form.amount || Number(form.amount) <= 0) errors.amount = "المبلغ يجب أن يكون أكبر من صفر.";
      return errors;
    },

    body: () =>
      el(
        "div",
        { class: "flex flex-col gap-3 text-xs" },
        selectField({
          label: "المريض",
          value: String(form.patientId),
          options: patientsList.map((p) => ({
            value: String(p.id),
            label: `${p.name} (${p.code}) — رصيده: ${amount(p.balance)}`,
          })),
          onChange: value((v) => (form.patientId = Number(v))),
        }),
        textField({
          label: "المبلغ المحصل (ج.م)",
          type: "number",
          value: String(form.amount),
          required: true,
          onInput: value((v) => (form.amount = Number(v) || 0)),
        }),
        textField({
          label: "تاريخ السند",
          type: "date",
          value: form.receiptDate,
          onInput: value((v) => (form.receiptDate = v)),
        }),
        selectField({
          label: "طريقة السداد",
          value: form.paymentMethod,
          options: [
            { value: "cash", label: "نقدي (خزينة المستشفى)" },
            { value: "credit_card", label: "بطاقة دفع فيزا/ماستركارد" },
            { value: "bank_transfer", label: "تحويل بنكي" },
          ],
          onChange: value((v) => (form.paymentMethod = v)),
        }),
        selectField({
          label: "الحساب المودع به",
          value: form.targetAccount,
          options: [
            { value: "الخزينة الرئيسية (نقدية)", label: "الخزينة الرئيسية (نقدية)" },
            { value: "بنك مصر - حساب العمليات", label: "بنك مصر - حساب العمليات" },
            { value: "البنك الأهلي المصري", label: "البنك الأهلي المصري" },
          ],
          onChange: value((v) => (form.targetAccount = v)),
        }),
        textField({
          label: "رقم المرجع / الإيصال البنكي",
          placeholder: "رقم العملية أو الشيك إن وُجد",
          onInput: value((v) => (form.reference = v)),
        }),
        textField({
          label: "البيان والملاحظات",
          value: form.notes,
          onInput: value((v) => (form.notes = v)),
        }),
      ),

    onSubmit: () => {
      const patient = patientsList.find((p) => p.id === Number(form.patientId));
      return createPatientReceipt({
        patientId: Number(form.patientId),
        patientName: patient?.name || "مريض",
        amount: Number(form.amount),
        receiptDate: form.receiptDate,
        paymentMethod: form.paymentMethod,
        targetAccount: form.targetAccount,
        reference: form.reference,
        notes: form.notes,
      });
    },

    onDone: async () => {
      await context.reload();
    },
  });
}

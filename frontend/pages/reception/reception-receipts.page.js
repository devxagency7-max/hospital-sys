/**
 * سجل سندات قبض ودفعات الاستقبال (Reception Cashier Receipts).
 *
 * متابعة كافة سندات القبض والتحصيلات النقدية والبنكية الصادرة من مكاتب الاستقبال للمرضى.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { icon } from "../../components/common/icon.js";
import { statTile } from "../../components/common/card.js";
import { amount, date, dateTime, integer } from "../../js/core/format.js";
import { printReport, exportStyledExcel } from "../_shared/print.js";
import { listReceptionReceipts, listReceptionPatients, createReceptionReceipt } from "../../js/api/reception.api.js";
import { formModal, selectField, value } from "../_shared/forms.js";
import { textField } from "../../components/forms/fields.js";
import { navigate } from "../../js/core/router.js";

export default async function receptionReceiptsPage() {
  const container = el("div", { class: "flex flex-col gap-6 p-4 md:p-6" });

  const [receiptsData, patientsData] = await Promise.all([
    listReceptionReceipts({ perPage: 100 }),
    listReceptionPatients({ perPage: 100 }),
  ]);

  const receipts = receiptsData.data || [];
  const patients = patientsData.data || [];

  const totalCollected = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
  const cashCollected = receipts.filter((r) => r.paymentMethod === "cash").reduce((sum, r) => sum + (r.amount || 0), 0);
  const cardCollected = receipts.filter((r) => r.paymentMethod === "card").reduce((sum, r) => sum + (r.amount || 0), 0);

  // 1. ترويسة الصفحة
  const header = el(
    "header",
    { class: "flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-subtle pb-4" },
    el(
      "div",
      { class: "flex flex-col" },
      el(
        "div",
        { class: "flex items-center gap-2.5" },
        el("div", { class: "p-2 rounded-lg bg-brand-subtle text-brand" }, icon("creditCard", { size: 22 })),
        el("h1", { class: "text-xl font-bold text-ink" }, "سندات قبض ودفعات الاستقبال"),
        badge("الخزينة والمكاتب الأمامية", { tone: "brand" }),
      ),
      el(
        "p",
        { class: "text-xs text-muted mt-1" },
        "سجل المقبوضات النقدية والتحصيلات البنكية المسجلة من مكاتب الاستقبال لمستشفى أمان الحياة.",
      ),
    ),
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap" },
      button({
        label: "العودة لشاشة الاستعلام",
        variant: "ghost",
        icon: "chevronStart",
        onClick: () => navigate("/reception"),
      }),
      button({
        label: "تصدير سجل التحصيلات Excel",
        variant: "secondary",
        icon: "download",
        onClick: () => exportReceiptsExcel(receipts),
      }),
      button({
        label: "طباعة كشف المقبوضات (PDF)",
        variant: "secondary",
        icon: "print",
        onClick: () => printReceiptsPdf(receipts),
      }),
      button({
        label: "+ سند قبض جديد",
        variant: "primary",
        icon: "plus",
        onClick: () => openNewReceiptDialog(patients),
      }),
    ),
  );

  // 2. بطاقات إحصائيات المقبوضات
  const kpis = el(
    "section",
    { class: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4" },
    statTile({
      title: "إجمالي التحصيلات",
      value: amount(totalCollected),
      hint: `${integer(receipts.length)} سند قبض`,
      icon: "checkCircle",
      tone: "success",
    }),
    statTile({
      title: "التحصيل النقدي بالخزينة",
      value: amount(cashCollected),
      hint: "نقداً بالمكاتب الأمامية",
      icon: "creditCard",
      tone: "brand",
    }),
    statTile({
      title: "مدفوعات الفيزا والبطاقات",
      value: amount(cardCollected),
      hint: "أجهزة نقاط البيع POS",
      icon: "billing",
      tone: "purple",
    }),
    statTile({
      title: "متوسط السند المحصل",
      value: receipts.length > 0 ? amount(totalCollected / receipts.length) : amount(0),
      hint: "لكل معاملة استلام",
      icon: "activity",
      tone: "neutral",
    }),
  );

  // 3. جدول سندات القبض
  const tableCard = el(
    "section",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm flex flex-col gap-4" },
    el(
      "div",
      { class: "flex items-center justify-between flex-wrap gap-2 border-b border-subtle pb-3" },
      el("h2", { class: "text-sm font-bold text-ink" }, "قائمة سندات القبض المسجلة"),
      badge(`${receipts.length} سند قبض`, { tone: "neutral" }),
    ),
    buildReceiptsTable(receipts),
  );

  container.append(header, kpis, tableCard);
  return container;
}

function buildReceiptsTable(receipts) {
  if (receipts.length === 0) {
    return el("div", { class: "p-8 text-center text-xs text-muted" }, "لا توجد سندات قبض مسجلة حتى الآن.");
  }

  const table = el("table", { class: "w-full border-collapse text-right text-xs" });
  const thead = el(
    "thead",
    {},
    el(
      "tr",
      { class: "border-b border-subtle bg-subtle text-muted font-medium" },
      el("th", { class: "p-3" }, "التاريخ"),
      el("th", { class: "p-3" }, "رقم السند"),
      el("th", { class: "p-3" }, "كود الملف"),
      el("th", { class: "p-3" }, "اسم المريض"),
      el("th", { class: "p-3" }, "نوع التحصيل"),
      el("th", { class: "p-3" }, "طريقة السداد"),
      el("th", { class: "p-3" }, "الحساب / الخزينة"),
      el("th", { class: "p-3 text-left tabular" }, "المبلغ المحصل"),
      el("th", { class: "p-3 text-center" }, "طباعة الإيصال"),
    ),
  );

  const tbody = el("tbody", {});

  receipts.forEach((r) => {
    const tr = el(
      "tr",
      { class: "border-b border-subtle hover:bg-subtle/50 transition-colors" },
      el("td", { class: "p-3 text-muted tabular" }, date(r.date)),
      el("td", { class: "p-3 font-mono font-bold text-success" }, r.receiptNumber),
      el("td", { class: "p-3 font-mono text-brand font-medium" }, r.patientCode || "—"),
      el("td", { class: "p-3 font-semibold text-ink" }, r.patientName),
      el("td", { class: "p-3 text-muted" }, r.typeLabel || "سداد فاتورة"),
      el("td", { class: "p-3" }, badge(r.paymentMethodLabel || "نقدي", { tone: r.paymentMethod === "card" ? "purple" : "brand", size: "sm" })),
      el("td", { class: "p-3 text-muted" }, r.targetAccount || "الخزينة الرئيسية"),
      el("td", { class: "p-3 text-left tabular font-bold text-success text-sm" }, amount(r.amount)),
      el(
        "td",
        { class: "p-3 text-center" },
        button({
          label: "طباعة إيصال",
          variant: "ghost",
          size: "sm",
          icon: "print",
          onClick: () => printReceiptVoucher(r),
        }),
      ),
    );
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  return el("div", { class: "overflow-x-auto" }, table);
}

function exportReceiptsExcel(receipts) {
  const headers = [
    { label: "التاريخ", align: "center" },
    { label: "رقم السند", align: "center" },
    { label: "كود المريض", align: "center" },
    { label: "اسم المريض", align: "right" },
    { label: "نوع التحصيل", align: "center" },
    { label: "طريقة السداد", align: "center" },
    { label: "الحساب المودع به", align: "right" },
    { label: "المبلغ المحصل", align: "left" },
  ];

  const rows = receipts.map((r) => [
    date(r.date),
    r.receiptNumber,
    r.patientCode || "—",
    r.patientName,
    r.typeLabel || "سداد دفعة",
    r.paymentMethodLabel || "نقدي",
    r.targetAccount || "الخزينة الرئيسية",
    r.amount,
  ]);

  const total = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
  const totals = ["المجموع الإجمالي", "—", "—", `عدد السندات: ${receipts.length}`, "—", "—", "—", total];

  exportStyledExcel({
    title: "سجل سندات قبض وتحصيلات الاستقبال",
    period: `تاريخ التصدير: ${dateTime(new Date().toISOString())}`,
    headers,
    rows,
    totals,
  });
}

function printReceiptsPdf(receipts) {
  const headers = [
    { label: "التاريخ", align: "right" },
    { label: "رقم السند", align: "center" },
    { label: "كود المريض", align: "center" },
    { label: "اسم المريض", align: "right" },
    { label: "نوع التحصيل", align: "center" },
    { label: "طريقة السداد", align: "center" },
    { label: "المبلغ المحصل", align: "left" },
  ];

  const rows = receipts.map((r) => [
    date(r.date),
    r.receiptNumber,
    r.patientCode || "—",
    r.patientName,
    r.typeLabel || "سداد دفعة",
    r.paymentMethodLabel || "نقدي",
    amount(r.amount),
  ]);

  const total = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
  const totals = ["المجموع الإجمالي", "—", "—", `عدد السندات: ${receipts.length}`, "—", "—", amount(total)];

  printReport({
    title: "تقرير مقبوضات وتحصيلات مكتب الاستقبال",
    subtitle: `مستشفى أمان الحياة · كشف يومي بحركة الخزينة والتحصيل لـ ${receipts.length} سند قبض`,
    headers,
    rows,
    totals,
    notes: "تم مطابقة هذا الكشف مع أذونات الخزينة النقدية وسجلات نقاط البيع الإلكترونية POS.",
    signatures: ["أمين الخزينة والمحصل", "المراجعة الداخلية", "المدير المالي"],
  });
}

function printReceiptVoucher(receipt) {
  printReport({
    title: "إيصال استلام نقدية — مستشفى أمان الحياة",
    subtitle: `رقم السند: ${receipt.receiptNumber} · التاريخ: ${date(receipt.date)}`,
    headers: [
      { label: "رقم السند", align: "center" },
      { label: "المستلم منه", align: "right" },
      { label: "كود الملف", align: "center" },
      { label: "طريقة السداد", align: "center" },
      { label: "الخزينة المودع بها", align: "right" },
      { label: "المبلغ المحصل", align: "left" },
    ],
    rows: [
      [
        receipt.receiptNumber,
        receipt.patientName,
        receipt.patientCode || "—",
        receipt.paymentMethodLabel || "نقدي",
        receipt.targetAccount || "خزينة الاستقبال",
        amount(receipt.amount),
      ],
    ],
    totals: ["المجموع", "—", "—", "—", "—", amount(receipt.amount)],
    notes: `البيان: ${receipt.notes || "سداد تكاليف خدمات علاجية وإقامة بمستشفى أمان الحياة."}`,
    signatures: ["موظف الاستقبال والمحصل", "الختم الرسمي للمستشفى", "توقيع المستلم منه"],
  });
}

function openNewReceiptDialog(patients) {
  const form = {
    patientId: patients[0]?.id || "",
    amount: 1000,
    paymentMethod: "cash",
    targetAccount: "خزينة مكتب الاستقبال الرئيسي (1111)",
    notes: "سداد دفعة من الاستقبال",
  };

  formModal({
    title: "تسجيل سند قبض واستلام نقدية بالاستقبال",
    submitLabel: "حفظ السند والترحيل الفوري",
    success: "تم إصدار سند القبض بنجاح.",
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
        { class: "flex flex-col gap-3.5 text-xs" },
        selectField({
          label: "المريض المسدد",
          value: String(form.patientId),
          options: patients.map((p) => ({
            value: String(p.id),
            label: `${p.name} (${p.code}) — متبقي عليه: ${amount(p.balance || 0)}`,
          })),
          onChange: value((v) => (form.patientId = v)),
        }),
        textField({
          label: "المبلغ المحصل (ج.م)",
          type: "number",
          value: String(form.amount),
          required: true,
          onInput: value((v) => (form.amount = Number(v) || 0)),
        }),
        selectField({
          label: "طريقة السداد",
          value: form.paymentMethod,
          options: [
            { value: "cash", label: "نقداً بالخزينة (Cash)" },
            { value: "card", label: "بطاقة فيزا / ماستركارد (POS)" },
            { value: "bank_transfer", label: "تحويل بنكي / إنستاباي" },
          ],
          onChange: value((v) => (form.paymentMethod = v)),
        }),
        selectField({
          label: "الحساب المودع به",
          value: form.targetAccount,
          options: [
            { value: "خزينة مكتب الاستقبال الرئيسي (1111)", label: "خزينة مكتب الاستقبال الرئيسي (1111)" },
            { value: "الخزينة العامة للمستشفى (1112)", label: "الخزينة العامة للمستشفى (1112)" },
            { value: "حساب العمليات - بنك مصر (1121)", label: "حساب العمليات - بنك مصر (1121)" },
          ],
          onChange: value((v) => (form.targetAccount = v)),
        }),
        textField({
          label: "ملاحظات السداد",
          value: form.notes,
          onInput: value((v) => (form.notes = v)),
        }),
      ),
    onSubmit: async () => {
      const selectedP = patients.find((p) => String(p.id) === String(form.patientId));
      await createReceptionReceipt({
        patientId: Number(form.patientId),
        patientName: selectedP?.name || "",
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        targetAccount: form.targetAccount,
        notes: form.notes,
        type: "invoice_payment",
      });
    },
    onDone: () => {
      window.location.reload();
    },
  });
}

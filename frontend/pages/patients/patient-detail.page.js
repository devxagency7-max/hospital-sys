/**
 * الملف المالي والطبي للمريض (Patient Profile & Statement).
 *
 * كشف حساب تفصيلي، الفواتير، سندات القبض، وسجل الإقامة والعمليات والعناية المركزة.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, date, phone as formatPhone, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { previewTableReport, exportTableToCsv } from "../_shared/print.js";
import { formModal, selectField, value } from "../_shared/forms.js";
import { textField } from "../../components/forms/fields.js";
import {
  getPatient,
  getPatientStatement,
  createPatientReceipt,
} from "../../js/api/patients.api.js";

const STAY_LABELS = {
  room: { label: "إقامة غرف وأجنحة", tone: "brand" },
  icu: { label: "عناية مركزة (ICU)", tone: "danger" },
  surgery: { label: "عملية جراحية", tone: "purple" },
};

export default async function patientDetailPage(context) {
  const patientId = context.params?.id;
  const [patient, statementData] = await Promise.all([
    getPatient(patientId),
    getPatientStatement(patientId),
  ]);

  const container = el("div", { class: "flex flex-col gap-6 p-4 md:p-6" });

  // 1. شريط التنقل العلوي وزر الرجوع
  const topNav = el(
    "div",
    { class: "flex items-center justify-between flex-wrap gap-3" },
    el(
      "div",
      { class: "flex items-center gap-2" },
      button({
        label: "العودة لسجل المرضى",
        variant: "ghost",
        icon: "chevronStart",
        onClick: () => navigate("/patients"),
      }),
      el("span", { class: "text-muted" }, "/"),
      el("span", { class: "font-semibold" }, `ملف المريض #${patient.code}`),
    ),
    el(
      "div",
      { class: "flex items-center gap-2" },
      button({
        label: "تصدير كشف الحساب Excel",
        variant: "secondary",
        icon: "download",
        onClick: () => exportStatementExcel(patient, statementData),
      }),
      button({
        label: "معاينة وطباعة كشف الحساب (PDF)",
        variant: "primary",
        icon: "print",
        onClick: () => previewStatementPdf(patient, statementData),
      }),
      button({
        label: "+ تسجيل سند قبض",
        variant: "secondary",
        icon: "check",
        permission: "patients.receipt",
        onClick: () => openReceiptModal(patient, context),
      }),
    ),
  );

  // 2. بطاقة بيانات المريض الرئيسية (Hero Profile Card)
  const isMale = patient.gender === "male";
  const heroCard = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm" },
    el(
      "div",
      { class: "flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-subtle pb-4 mb-4" },
      el(
        "div",
        { class: "flex items-center gap-4" },
        el(
          "div",
          {
            class: "w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg text-white",
            style: "background: linear-gradient(135deg, var(--brand-solid, #0284c7), #0369a1);",
          },
          patient.name.charAt(0),
        ),
        el(
          "div",
          { class: "flex flex-col" },
          el(
            "div",
            { class: "flex items-center gap-2.5 flex-wrap" },
            el("h1", { class: "text-xl font-bold" }, patient.name),
            badge(patient.code, { tone: "brand" }),
            patient.bloodGroup ? badge(patient.bloodGroup, { tone: "purple" }) : null,
            badge(patient.status === "inpatient" ? "منوم حاليًا" : "خارجي", {
              tone: patient.status === "inpatient" ? "danger" : "info",
            }),
          ),
          el(
            "div",
            { class: "flex items-center gap-4 text-xs text-muted mt-1 flex-wrap" },
            el("span", {}, `النوع: ${isMale ? "ذكر" : "أنثى"}`),
            el("span", {}, `تاريخ الميلاد: ${date(patient.birthDate)}`),
            el("span", {}, `الرقم القومي: ${patient.nationalId}`),
            el("span", {}, `الهاتف: ${formatPhone(patient.phone)}`),
          ),
        ),
      ),
      el(
        "div",
        { class: "flex flex-col items-end justify-center bg-subtle p-3 rounded-lg border border-subtle min-w-[200px]" },
        el("span", { class: "text-xs text-muted" }, "صافي الرصيد المستحق"),
        el(
          "span",
          {
            class: "text-2xl font-bold tabular",
            style: patient.balance > 0 ? "color: var(--danger-solid, #ef4444);" : "color: var(--success-solid, #10b981);",
          },
          amount(patient.balance),
        ),
        el(
          "span",
          { class: "text-xs text-muted mt-0.5" },
          patient.balance > 0 ? "مستحق على المريض" : "الحساب مسدد بالكامل",
        ),
      ),
    ),
    // تفاصيل التأمين والإقامة
    el(
      "div",
      { class: "grid grid-cols-1 md:grid-cols-3 gap-4 text-xs" },
      el(
        "div",
        { class: "p-3 rounded-lg bg-surface border border-subtle" },
        el("span", { class: "text-muted block mb-1" }, "التأمين الطبي:"),
        el(
          "div",
          { class: "font-semibold text-sm" },
          patient.insuranceProvider || "نقدي (لا يوجد تأمين)",
        ),
        patient.insuranceNumber
          ? el("div", { class: "text-muted mt-0.5" }, `رقم الكارت: ${patient.insuranceNumber}`)
          : null,
        patient.copayRate !== undefined
          ? el("div", { class: "text-brand font-medium mt-0.5" }, `نسبة تحمل المريض: ${patient.copayRate}%`)
          : null,
      ),
      el(
        "div",
        { class: "p-3 rounded-lg bg-surface border border-subtle" },
        el("span", { class: "text-muted block mb-1" }, "موقع الإقامة الحالي:"),
        patient.roomNumber
          ? el(
              "div",
              { class: "font-semibold text-sm text-brand" },
              `${patient.roomNumber} — سرير ${patient.bedNumber || "01"}`,
            )
          : el("div", { class: "text-muted font-medium" }, "غير منوم حاليًا (مراجع عيادات)"),
        patient.attendingDoctor
          ? el("div", { class: "text-muted mt-0.5" }, `الطبيب: ${patient.attendingDoctor}`)
          : null,
      ),
      el(
        "div",
        { class: "p-3 rounded-lg bg-surface border border-subtle" },
        el("span", { class: "text-muted block mb-1" }, "إجمالي التعاملات:"),
        el(
          "div",
          { class: "font-semibold text-sm" },
          `${integer(patient.invoices?.length || 0)} فاتورة صادرة`,
        ),
        el(
          "div",
          { class: "text-muted mt-0.5" },
          `${integer(patient.receipts?.length || 0)} سند قبض مسجل`,
        ),
      ),
    ),
  );

  // 3. قسم كشف الحساب التفصيلي (Statement)
  const statementTable = buildStatementTable(statementData.entries || []);

  const statementSection = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm" },
    el(
      "div",
      { class: "flex items-center justify-between mb-4 flex-wrap gap-2" },
      el(
        "div",
        {},
        el("h2", { class: "text-base font-bold" }, "كشف الحساب المالي للمريض"),
        el(
          "p",
          { class: "text-xs text-muted" },
          "سجل الحركات المالية التفصيلية (فواتير، إقامة، سندات قبض) والرصيد التراكمي.",
        ),
      ),
      el(
        "div",
        { class: "flex items-center gap-2" },
        badge(`عدد الحركات: ${statementData.entries?.length || 0}`, { tone: "brand" }),
      ),
    ),
    statementTable,
  );

  // 4. قسم الإقامة والعمليات والعناية المركزة
  const admissionsSection = buildAdmissionsSection(patient.admissions || []);

  container.append(topNav, heroCard, statementSection, admissionsSection);
  return container;
}

function buildStatementTable(entries) {
  if (!entries || entries.length === 0) {
    return el("div", { class: "text-center py-8 text-muted text-sm" }, "لا توجد حركات مسجلة للمريض حتى الآن.");
  }

  const table = el("table", { class: "w-full border-collapse text-right text-xs" });
  const thead = el(
    "thead",
    {},
    el(
      "tr",
      { class: "border-b border-subtle bg-subtle text-muted font-medium" },
      el("th", { class: "p-3" }, "التاريخ"),
      el("th", { class: "p-3" }, "رقم المستند"),
      el("th", { class: "p-3" }, "نوع الحركة"),
      el("th", { class: "p-3" }, "البيان والتفاصيل"),
      el("th", { class: "p-3 text-left tabular" }, "مدين (+)"),
      el("th", { class: "p-3 text-left tabular" }, "دائن (-)"),
      el("th", { class: "p-3 text-left tabular" }, "الرصيد التراكمي"),
    ),
  );

  const tbody = el("tbody", {});
  entries.forEach((row) => {
    const isInvoice = row.type === "invoice";
    const tr = el(
      "tr",
      { class: "border-b border-subtle hover:bg-subtle transition-colors" },
      el("td", { class: "p-3 text-muted tabular" }, date(row.date)),
      el(
        "td",
        { class: "p-3 font-semibold text-brand" },
        row.refNumber ? badge(row.refNumber, { tone: isInvoice ? "brand" : "success", size: "sm" }) : "—",
      ),
      el("td", { class: "p-3" }, isInvoice ? "فاتورة علاج" : "سند قبض"),
      el("td", { class: "p-3 font-medium" }, row.description),
      el(
        "td",
        { class: "p-3 text-left tabular font-semibold", style: row.debit > 0 ? "color: var(--danger-solid, #ef4444);" : "" },
        row.debit > 0 ? amount(row.debit) : "—",
      ),
      el(
        "td",
        { class: "p-3 text-left tabular font-semibold", style: row.credit > 0 ? "color: var(--success-solid, #10b981);" : "" },
        row.credit > 0 ? amount(row.credit) : "—",
      ),
      el(
        "td",
        { class: "p-3 text-left tabular font-bold" },
        amount(row.balance),
      ),
    );
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);

  return el("div", { class: "overflow-x-auto" }, table);
}

function buildAdmissionsSection(admissions) {
  if (!admissions || admissions.length === 0) return el("div");

  const card = el(
    "div",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm" },
    el(
      "div",
      { class: "flex items-center justify-between mb-4" },
      el(
        "div",
        {},
        el("h2", { class: "text-base font-bold" }, "سجل الإقامة والعمليات والعناية المركزة"),
        el("p", { class: "text-xs text-muted" }, "فترات التنويم، نوع الإقامة، والطبيب المشرف."),
      ),
    ),
  );

  const table = el("table", { class: "w-full border-collapse text-right text-xs" });
  const thead = el(
    "thead",
    {},
    el(
      "tr",
      { class: "border-b border-subtle bg-subtle text-muted" },
      el("th", { class: "p-3" }, "رقم الإقامة"),
      el("th", { class: "p-3" }, "نوع الإقامة"),
      el("th", { class: "p-3" }, "الغرفة / السرير"),
      el("th", { class: "p-3" }, "تاريخ الدخول"),
      el("th", { class: "p-3" }, "تاريخ الخروج"),
      el("th", { class: "p-3" }, "المدة (أيام)"),
      el("th", { class: "p-3 text-left tabular" }, "السعر اليومي"),
      el("th", { class: "p-3 text-left tabular" }, "التكلفة التقديرية"),
      el("th", { class: "p-3" }, "الحالة"),
    ),
  );

  const tbody = el("tbody", {});
  admissions.forEach((a) => {
    const stayInfo = STAY_LABELS[a.stayType] || { label: a.stayType, tone: "brand" };
    const tr = el(
      "tr",
      { class: "border-b border-subtle" },
      el("td", { class: "p-3 font-semibold text-brand" }, a.admissionNumber),
      el("td", { class: "p-3" }, badge(stayInfo.label, { tone: stayInfo.tone, size: "sm" })),
      el("td", { class: "p-3 font-medium" }, `${a.roomNumber} - سرير ${a.bedNumber || "01"}`),
      el("td", { class: "p-3 tabular text-muted" }, date(a.admissionDate)),
      el("td", { class: "p-3 tabular text-muted" }, a.dischargeDate ? date(a.dischargeDate) : "حتى الآن"),
      el("td", { class: "p-3 tabular" }, integer(a.daysCount || 1)),
      el("td", { class: "p-3 text-left tabular" }, amount(a.dailyRate || 0)),
      el("td", { class: "p-3 text-left tabular font-semibold" }, amount((a.dailyRate || 0) * (a.daysCount || 1))),
      el(
        "td",
        { class: "p-3" },
        badge(a.status === "active" ? "منوم حاليًا" : "خرج", {
          tone: a.status === "active" ? "danger" : "success",
          size: "sm",
        }),
      ),
    );
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  card.appendChild(el("div", { class: "overflow-x-auto" }, table));
  return card;
}

function previewStatementPdf(patient, statementData) {
  const columns = [
    { key: "date", label: "التاريخ", render: (r) => date(r.date) },
    { key: "refNumber", label: "رقم المستند" },
    { key: "type", label: "نوع الحركة", render: (r) => (r.type === "invoice" ? "فاتورة" : "سند قبض") },
    { key: "description", label: "البيان والتفاصيل" },
    { key: "debit", label: "مدين (+)", numeric: true, render: (r) => (r.debit > 0 ? amount(r.debit) : "—") },
    { key: "credit", label: "دائن (-)", numeric: true, render: (r) => (r.credit > 0 ? amount(r.credit) : "—") },
    { key: "balance", label: "الرصيد", numeric: true, render: (r) => amount(r.balance) },
  ];

  previewTableReport({
    title: `كشف حساب مريض: ${patient.name}`,
    subtitle: `كود المريض: ${patient.code} · الرقم القومي: ${patient.nationalId} · التأمين: ${patient.insuranceProvider || "نقدي"} · الرصيد المستحق: ${amount(patient.balance)}`,
    columns,
    rows: statementData.entries || [],
  });
}

function exportStatementExcel(patient, statementData) {
  const columns = [
    { key: "date", label: "التاريخ", render: (r) => date(r.date) },
    { key: "refNumber", label: "رقم المستند" },
    { key: "type", label: "نوع الحركة", render: (r) => (r.type === "invoice" ? "فاتورة" : "سند قبض") },
    { key: "description", label: "البيان" },
    { key: "debit", label: "مدين", render: (r) => r.debit || 0 },
    { key: "credit", label: "دائن", render: (r) => r.credit || 0 },
    { key: "balance", label: "الرصيد التراكمي", render: (r) => r.balance || 0 },
  ];

  exportTableToCsv({
    title: `كشف_حساب_مريض_${patient.code}_${patient.name}`,
    columns,
    rows: statementData.entries || [],
  });
}

function openReceiptModal(patient, context) {
  const form = {
    amount: patient.balance > 0 ? patient.balance : 1000,
    paymentMethod: "cash",
    targetAccount: "الخزينة الرئيسية (نقدية)",
    notes: `دفعة من حساب المريض ${patient.name}`,
  };

  formModal({
    title: `تسجيل سند قبض للمريض: ${patient.name}`,
    submitLabel: "حفظ السند والترحيل",
    success: "تم تسجيل سند القبض بنجاح.",
    fieldLabels: { amount: "المبلغ" },
    validate: () => {
      const errors = {};
      if (!form.amount || Number(form.amount) <= 0) errors.amount = "المبلغ يجب أن يكون أكبر من صفر.";
      return errors;
    },
    body: () =>
      el(
        "div",
        { class: "flex flex-col gap-3" },
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
          label: "البيان / ملاحظات",
          value: form.notes,
          onInput: value((v) => (form.notes = v)),
        }),
      ),
    onSubmit: () =>
      createPatientReceipt({
        patientId: patient.id,
        patientName: patient.name,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        targetAccount: form.targetAccount,
        notes: form.notes,
      }),
    onDone: () => {
      window.location.reload();
    },
  });
}

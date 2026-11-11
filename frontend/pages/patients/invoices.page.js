/**
 * فواتير المرضى والخدمات الطبية.
 *
 * إصدار فواتير الإقامة، العناية المركزة، العمليات، الاستشارات، التحاليل والأشعة،
 * مع حساب نسب تغطية التأمين وتحمل المريض تلقائيًا، وإمكانية الطباعة ومعاينة PDF والتصدير إلى Excel.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, date, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { listPage } from "../_shared/list-page.js";
import { codeColumn, dateColumn, moneyColumn, nameColumn } from "../_shared/cells.js";
import { formModal, selectField, value } from "../_shared/forms.js";
import { textField } from "../../components/forms/fields.js";
import { previewTableReport } from "../_shared/print.js";
import {
  listPatientInvoices,
  createPatientInvoice,
  listPatients,
  listServices,
} from "../../js/api/patients.api.js";

const INVOICE_STATUS_MAP = {
  paid: { label: "مسددة بالكامل", tone: "success" },
  partially_paid: { label: "مسددة جزئيًا", tone: "warning" },
  unpaid: { label: "غير مسددة", tone: "danger" },
};

export default async function patientInvoicesPage() {
  const [patientsResult, servicesResult] = await Promise.all([
    listPatients({ limit: 100 }),
    listServices({ limit: 100 }),
  ]);

  const patientsList = patientsResult.data || [];
  const servicesCatalog = servicesResult.data || [];

  return listPage({
    title: "فواتير المرضى والخدمات الطبية",
    description: "إدارة ومتابعة فواتير الإقامة، العناية المركزة، الجراحة، والخدمات الطبية، وحصص التأمين الطبي.",
    tableId: "patient-invoices-list",
    searchPlaceholder: "بحث برقم الفاتورة، اسم المريض، أو كود التأمين…",
    initialParams: { sort: "issueDate", order: "desc" },
    fetch: listPatientInvoices,

    actions: (context) => [
      button({
        label: "إصدار فاتورة مريض جديدة",
        variant: "primary",
        icon: "plus",
        permission: "patients.invoice",
        onClick: () => openNewInvoiceModal(context, patientsList, servicesCatalog),
      }),
    ],

    filters: [
      {
        key: "status",
        label: "حالة السداد",
        options: [
          { value: "paid", label: "مسددة بالكامل" },
          { value: "partially_paid", label: "مسددة جزئيًا" },
          { value: "unpaid", label: "غير مسددة" },
        ],
      },
    ],

    columns: [
      codeColumn("invoiceNumber", "رقم الفاتورة", { width: "11rem" }),
      dateColumn("issueDate", "تاريخ الإصدار"),
      nameColumn("patientName", "patientCode", "المريض", { width: "14rem" }),
      {
        key: "insuranceProvider",
        label: "جهة التأمين",
        width: "11rem",
        render: (row) =>
          row.insuranceProvider
            ? el("span", { class: "font-medium text-xs text-brand" }, row.insuranceProvider)
            : el("span", { class: "text-faint text-xs" }, "نقدي"),
      },
      moneyColumn("subtotal", "إجمالي الخدمات", { hidden: true }),
      moneyColumn("insuranceAmount", "تحمل التأمين", { muted: true }),
      moneyColumn("patientAmount", "حصة المريض"),
      moneyColumn("paidAmount", "المسدد", { muted: true }),
      moneyColumn("remainingAmount", "المتبقي"),
      {
        key: "status",
        label: "الحالة",
        width: "9rem",
        align: "center",
        render: (row) => {
          const s = INVOICE_STATUS_MAP[row.status] || { label: row.status, tone: "neutral" };
          return badge(s.label, { tone: s.tone, size: "sm" });
        },
      },
      {
        key: "actions",
        label: "معاينة",
        width: "7rem",
        align: "center",
        render: (row) =>
          button({
            label: "فاتورة",
            variant: "ghost",
            size: "sm",
            icon: "eye",
            onClick: (e) => {
              e.stopPropagation();
              previewInvoiceBill(row);
            },
          }),
      },
    ],

    onRowClick: (row) => previewInvoiceBill(row),

    stats: (rows) => {
      const totalInvoices = rows.length;
      const totalAmount = rows.reduce((s, r) => s + (r.patientAmount || 0), 0);
      const totalInsurance = rows.reduce((s, r) => s + (r.insuranceAmount || 0), 0);
      const totalRemaining = rows.reduce((s, r) => s + (r.remainingAmount || 0), 0);

      return [
        statTile({
          label: "إجمالي الفواتير الصادرة",
          value: integer(totalInvoices),
          tone: "brand",
          icon: "billing",
        }),
        statTile({
          label: "مستحقات على المرضى",
          value: amount(totalAmount),
          tone: "info",
          icon: "money",
        }),
        statTile({
          label: "مساهمات التأمين الطبي",
          value: amount(totalInsurance),
          tone: "purple",
          icon: "shield",
        }),
        statTile({
          label: "المتبقي غير المحصل",
          value: amount(totalRemaining),
          tone: totalRemaining > 0 ? "danger" : "success",
          icon: "alertTriangle",
        }),
      ];
    },
  });
}

function previewInvoiceBill(invoice) {
  const columns = [
    { key: "serviceName", label: "الخدمة / الإجراء الطبي" },
    { key: "category", label: "القسم / التصنيف" },
    { key: "quantity", label: "الكمية / الأيام", numeric: true },
    { key: "unitPrice", label: "سعر الوحدة", numeric: true, render: (r) => amount(r.unitPrice) },
    { key: "totalPrice", label: "الإجمالي", numeric: true, render: (r) => amount(r.totalPrice) },
  ];

  const items = invoice.items || [
    {
      serviceName: "خدمات طبية ورعاية تمريضية",
      category: "خدمات عامة",
      quantity: 1,
      unitPrice: invoice.subtotal || invoice.patientAmount,
      totalPrice: invoice.subtotal || invoice.patientAmount,
    },
  ];

  previewTableReport({
    title: `فاتورة علاجية رقم: ${invoice.invoiceNumber}`,
    subtitle: `المريض: ${invoice.patientName} (${invoice.patientCode || ""}) · التاريخ: ${date(invoice.issueDate)} · جهة التأمين: ${invoice.insuranceProvider || "نقدي"} · المتبقي: ${amount(invoice.remainingAmount)}`,
    columns,
    rows: items,
  });
}

function openNewInvoiceModal(context, patientsList, servicesCatalog) {
  const lines = [
    {
      serviceId: servicesCatalog[0]?.id || "",
      serviceName: servicesCatalog[0]?.name || "إقامة جناح خاص",
      category: servicesCatalog[0]?.category || "room",
      quantity: 1,
      unitPrice: servicesCatalog[0]?.price || 3500,
      totalPrice: servicesCatalog[0]?.price || 3500,
    },
  ];

  let selectedPatient = patientsList[0] || null;
  let insuranceRate = selectedPatient?.insuranceProvider ? 80 : 0; // % تغطية

  const form = {
    patientId: selectedPatient?.id || "",
    issueDate: new Date().toISOString().split("T")[0],
    discount: 0,
    paidAmount: 0,
    notes: "",
  };

  function recalculate() {
    const subtotal = lines.reduce((sum, line) => sum + (line.totalPrice || 0), 0);
    const insuranceAmount = (subtotal * insuranceRate) / 100;
    const patientShare = Math.max(0, subtotal - insuranceAmount - form.discount);
    const remaining = Math.max(0, patientShare - form.paidAmount);
    return { subtotal, insuranceAmount, patientShare, remaining };
  }

  formModal({
    title: "إصدار فاتورة خدمات مريض جديدة",
    size: "lg",
    submitLabel: "حفظ الفاتورة وترحيلها",
    success: "تم إصدار الفاتورة وترحيل القيود بنجاح.",
    fieldLabels: { patientId: "المريض" },
    validate: () => {
      const errors = {};
      if (!form.patientId) errors.patientId = "يجب اختيار المريض.";
      return errors;
    },

    body: () => {
      const modalWrapper = el("div", { class: "flex flex-col gap-4 text-xs" });

      // Patient selector
      const patientSelect = selectField({
        label: "المريض",
        value: String(form.patientId),
        options: patientsList.map((p) => ({
          value: String(p.id),
          label: `${p.name} (${p.code}) — ${p.insuranceProvider ? `تأمين: ${p.insuranceProvider}` : "نقدي"}`,
        })),
        onChange: value((v) => {
          form.patientId = Number(v);
          selectedPatient = patientsList.find((p) => p.id === Number(v));
          insuranceRate = selectedPatient?.insuranceProvider ? (100 - (selectedPatient.copayRate || 10)) : 0;
          updateSummary();
        }),
      });

      // Quick add service lines container
      const linesTableContainer = el("div", { class: "border border-subtle rounded-lg p-3 bg-subtle" });
      const linesHeading = el(
        "div",
        { class: "flex items-center justify-between mb-2 font-bold text-sm" },
        el("span", {}, "بنود الخدمات والعمليات"),
        button({
          label: "+ إضافة بند خدمة",
          variant: "ghost",
          size: "sm",
          icon: "plus",
          onClick: () => {
            lines.push({
              serviceId: servicesCatalog[0]?.id || "",
              serviceName: servicesCatalog[0]?.name || "خدمة طبية",
              category: servicesCatalog[0]?.category || "general",
              quantity: 1,
              unitPrice: servicesCatalog[0]?.price || 500,
              totalPrice: servicesCatalog[0]?.price || 500,
            });
            renderLines();
          },
        }),
      );

      const linesListEl = el("div", { class: "flex flex-col gap-2" });

      function renderLines() {
        linesListEl.replaceChildren();
        lines.forEach((line, idx) => {
          const rowEl = el(
            "div",
            { class: "flex items-center gap-2 bg-surface p-2 rounded border border-subtle" },
            selectField({
              label: idx === 0 ? "الخدمة" : null,
              value: String(line.serviceId),
              options: servicesCatalog.map((s) => ({
                value: String(s.id),
                label: `[${s.code}] ${s.name} (${amount(s.price)})`,
              })),
              onChange: value((v) => {
                const s = servicesCatalog.find((x) => String(x.id) === v);
                if (s) {
                  line.serviceId = s.id;
                  line.serviceName = s.name;
                  line.category = s.category;
                  line.unitPrice = s.price;
                  line.totalPrice = line.quantity * line.unitPrice;
                  updateSummary();
                }
              }),
            }),
            textField({
              label: idx === 0 ? "الكمية/الأيام" : null,
              type: "number",
              value: String(line.quantity),
              onInput: value((v) => {
                line.quantity = Math.max(1, Number(v) || 1);
                line.totalPrice = line.quantity * line.unitPrice;
                updateSummary();
              }),
            }),
            el(
              "div",
              { class: "flex flex-col min-w-[90px] text-left tabular font-semibold" },
              idx === 0 ? el("span", { class: "text-muted text-[10px] block" }, "الإجمالي") : null,
              el("span", { class: "py-1.5" }, amount(line.totalPrice)),
            ),
          );
          linesListEl.appendChild(rowEl);
        });
        updateSummary();
      }

      linesTableContainer.append(linesHeading, linesListEl);

      // Financial Summary Box
      const summaryBox = el(
        "div",
        { class: "grid grid-cols-2 md:grid-cols-4 gap-3 bg-surface p-3 rounded-lg border border-subtle" },
      );

      function updateSummary() {
        const { subtotal, insuranceAmount, patientShare, remaining } = recalculate();
        summaryBox.replaceChildren(
          el(
            "div",
            { class: "flex flex-col" },
            el("span", { class: "text-muted" }, "إجمالي الخدمات"),
            el("span", { class: "text-sm font-bold tabular" }, amount(subtotal)),
          ),
          el(
            "div",
            { class: "flex flex-col text-brand" },
            el("span", { class: "text-muted" }, `تحمل التأمين (${insuranceRate}%)`),
            el("span", { class: "text-sm font-bold tabular" }, amount(insuranceAmount)),
          ),
          el(
            "div",
            { class: "flex flex-col text-purple" },
            el("span", { class: "text-muted" }, "صافي المريض"),
            el("span", { class: "text-sm font-bold tabular" }, amount(patientShare)),
          ),
          el(
            "div",
            { class: "flex flex-col text-danger" },
            el("span", { class: "text-muted" }, "المتبقي على المريض"),
            el("span", { class: "text-sm font-bold tabular" }, amount(remaining)),
          ),
        );
      }

      renderLines();

      modalWrapper.append(
        patientSelect,
        textField({
          label: "تاريخ الفاتورة",
          type: "date",
          value: form.issueDate,
          onInput: value((v) => (form.issueDate = v)),
        }),
        linesTableContainer,
        summaryBox,
        textField({
          label: "ملاحظات إضافية",
          placeholder: "أي تعليمات أو تقرير مرافق…",
          onInput: value((v) => (form.notes = v)),
        }),
      );

      return modalWrapper;
    },

    onSubmit: () => {
      const { subtotal, insuranceAmount, patientShare, remaining } = recalculate();
      return createPatientInvoice({
        patientId: Number(form.patientId),
        patientName: selectedPatient?.name || "مريض",
        insuranceProvider: selectedPatient?.insuranceProvider || null,
        insuranceCoverageRate: insuranceRate,
        issueDate: form.issueDate,
        subtotal,
        discount: Number(form.discount),
        insuranceAmount,
        patientAmount: patientShare,
        paidAmount: Number(form.paidAmount),
        remainingAmount: remaining,
        status: remaining === 0 ? "paid" : form.paidAmount > 0 ? "partially_paid" : "unpaid",
        notes: form.notes,
        items: lines,
      });
    },

    onDone: async () => {
      await context.reload();
    },
  });
}

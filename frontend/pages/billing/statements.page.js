/**
 * كشف حساب مريض تفاعلي (Patient Statement)
 */

import { el, clear } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statTile } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { select } from "../../components/forms/fields.js";
import { listPatients, getPatientAccount } from "../../js/api/patients.api.js";
import { currency, date } from "../../js/core/format.js";
import { ref } from "../../components/common/value.js";
import { toast } from "../../components/feedback/toast.js";

export default async function statementsPage({ query = {} } = {}) {
  const container = el("div", { class: "space-y-4" });

  let patients = [];
  try {
    const res = await listPatients({ perPage: 100 });
    patients = res.data || [];
  } catch (e) {}

  const header = pageHeader({
    title: "كشف حساب مريض تفصيلي",
    description: "تقرير مالي شامل يوضح كافة الفواتير الصادرة والمدفوعات والمرتجعات وإشعارات الدائن.",
    actions: [
      button({
        label: "طباعة كشف الحساب",
        variant: "primary",
        icon: "download",
        onClick: () => window.print(),
      }),
    ],
  });
  container.appendChild(header);

  let selectedPatientId = query.patientId || (patients[0]?.id ? String(patients[0].id) : "");

  const statementView = el("div", { class: "space-y-4" });

  async function loadStatement(patientId) {
    clear(statementView);
    if (!patientId) return;

    try {
      const data = await getPatientAccount(patientId);
      const { patient, invoices = [], payments = [], refunds = [], creditNotes = [], summary = {} } = data;

      // بطاقات الملخص المالي
      const kpis = el(
        "div",
        { class: "grid grid-cols-2 md:grid-cols-4 gap-3" },
        statTile({ label: "إجمالي المفوتر", value: currency(summary.invoiced || 0), tone: "brand" }),
        statTile({ label: "إجمالي المحصَّل", value: currency(summary.collected || 0), tone: "success" }),
        statTile({ label: "إشعارات دائن وخصم", value: currency(summary.credited || 0), tone: "warning" }),
        statTile({ label: "صافي الرصيد المستحق", value: currency(summary.balance || 0), tone: summary.balance > 0 ? "danger" : "neutral" }),
      );
      statementView.appendChild(kpis);

      // جدول الفواتير
      const invTable = card({
        title: "الفواتير الصادرة للمريض",
        flush: true,
        body: el(
          "table",
          { class: "w-full text-right text-xs border-collapse" },
          el(
            "thead",
            { class: "bg-subtle text-muted border-b border-line" },
            el(
              "tr",
              {},
              el("th", { class: "p-2.5" }, "رقم الفاتورة"),
              el("th", { class: "p-2.5" }, "التاريخ"),
              el("th", { class: "p-2.5 text-end" }, "الإجمالي"),
              el("th", { class: "p-2.5 text-end" }, "المسدد"),
              el("th", { class: "p-2.5 text-end" }, "المتبقي"),
            ),
          ),
          el(
            "tbody",
            {},
            ...invoices.map((inv) =>
              el(
                "tr",
                { class: "border-b border-line hover:bg-subtle" },
                el("td", { class: "p-2.5 font-mono" }, ref(inv.invoiceNumber)),
                el("td", { class: "p-2.5" }, date(inv.date)),
                el("td", { class: "p-2.5 font-mono text-end tabular" }, currency(inv.total)),
                el("td", { class: "p-2.5 font-mono text-end text-emerald-600 tabular" }, currency(inv.paid)),
                el("td", { class: "p-2.5 font-mono text-end font-bold text-rose-600 tabular" }, currency(inv.outstanding)),
              ),
            ),
          ),
        ),
      });
      statementView.appendChild(invTable);

      // جدول المدفوعات
      const payTable = card({
        title: "حركات السداد والتحصيل",
        flush: true,
        body: el(
          "table",
          { class: "w-full text-right text-xs border-collapse" },
          el(
            "thead",
            { class: "bg-subtle text-muted border-b border-line" },
            el(
              "tr",
              {},
              el("th", { class: "p-2.5" }, "رقم الإيصال"),
              el("th", { class: "p-2.5" }, "التاريخ"),
              el("th", { class: "p-2.5" }, "طريقة الدفع"),
              el("th", { class: "p-2.5 text-end" }, "المبلغ"),
            ),
          ),
          el(
            "tbody",
            {},
            ...payments.map((p) =>
              el(
                "tr",
                { class: "border-b border-line hover:bg-subtle" },
                el("td", { class: "p-2.5 font-mono" }, ref(p.reference)),
                el("td", { class: "p-2.5" }, date(p.date)),
                el("td", { class: "p-2.5 text-muted" }, p.method),
                el("td", { class: "p-2.5 font-mono text-end font-bold text-emerald-600 tabular" }, currency(p.amount)),
              ),
            ),
          ),
        ),
      });
      statementView.appendChild(payTable);
    } catch (err) {
      toast.error("تعذر تحميل كشف حساب المريض");
    }
  }

  // محدد المريض
  const selector = el(
    "div",
    { class: "max-w-md bg-surface p-3 rounded-2xl border border-line" },
    select({
      label: "اختر المريض لعرض كشف الحساب",
      value: selectedPatientId,
      options: patients.map((p) => ({ value: String(p.id), label: `${p.name} (${p.patientCode})` })),
      onChange: (val) => {
        selectedPatientId = val;
        loadStatement(val);
      },
    }),
  );
  container.appendChild(selector);
  container.appendChild(statementView);

  if (selectedPatientId) loadStatement(selectedPatientId);

  return container;
}

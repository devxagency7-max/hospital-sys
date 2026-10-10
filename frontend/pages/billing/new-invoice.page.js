/**
 * إنشاء فاتورة جديدة (New Invoice Builder)
 */

import { el, clear } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { select, textField } from "../../components/forms/fields.js";
import { listPatients } from "../../js/api/patients.api.js";
import { createInvoice } from "../../js/api/billing.api.js";
import { currency } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { toast } from "../../components/feedback/toast.js";
import { getServices, getDoctors } from "../../js/api/lookups.api.js";

export default async function newInvoicePage() {
  const container = el("div", { class: "space-y-4 max-w-4xl" });

  let [patients, services, doctors] = await Promise.all([
    listPatients({ perPage: 50 }).then((r) => r.data || []).catch(() => []),
    getServices().catch(() => []),
    getDoctors().catch(() => []),
  ]);

  const header = pageHeader({
    title: "إصدار فاتورة طبية جديدة",
    description: "إضافة خدمات وأدوية وفحوصات وإصدار الفاتورة للتحصيل.",
    actions: [
      button({
        label: "العودة للفواتير",
        variant: "subtle",
        onClick: () => navigate("/billing/invoices"),
      }),
    ],
  });
  container.appendChild(header);

  let selectedPatientId = patients[0]?.id ? String(patients[0].id) : "";
  let selectedDoctorId = String(doctors[0]?.id || 1);
  let defaultSrv = services[0] || { id: 1, name: "استشارة عيادة خارجية", price: 250 };
  let invoiceLines = [{ serviceId: defaultSrv.id, name: defaultSrv.name, price: defaultSrv.price, qty: 1 }];

  const linesContainer = el("div", { class: "space-y-2" });
  const totalDisplay = el("span", { class: "font-mono font-bold text-lg text-brand-700" }, "0.00 ج.م");

  function recalculateTotal() {
    const total = invoiceLines.reduce((s, line) => s + line.price * line.qty, 0);
    totalDisplay.textContent = currency(total);
  }

  function renderLines() {
    clear(linesContainer);
    invoiceLines.forEach((line, index) => {
      const lineRow = el(
        "div",
        { class: "flex items-center gap-3 p-2 rounded-xl bg-subtle border border-line text-xs" },
        el(
          "div",
          { class: "flex-1" },
          select({
            label: "الخدمة / البند",
            value: String(line.serviceId),
            options: services.map((s) => ({ value: String(s.id), label: `${s.name} (${s.price} ج.م)` })),
            onChange: (val) => {
              const found = services.find((s) => String(s.id) === String(val));
              if (found) {
                line.serviceId = found.id;
                line.name = found.name;
                line.price = found.price;
                recalculateTotal();
                renderLines();
              }
            },
          }),
        ),
        el(
          "div",
          { class: "w-24" },
          textField({
            label: "الكمية",
            type: "number",
            value: String(line.qty),
            onInput: (val) => {
              line.qty = Math.max(1, Number(val) || 1);
              recalculateTotal();
            },
          }),
        ),
        el(
          "div",
          { class: "w-32 text-end pt-5 font-mono font-semibold text-ink" },
          currency(line.price * line.qty),
        ),
        el(
          "div",
          { class: "pt-5" },
          button({
            label: "حذف",
            variant: "danger",
            size: "sm",
            onClick: () => {
              if (invoiceLines.length > 1) {
                invoiceLines.splice(index, 1);
                recalculateTotal();
                renderLines();
              } else {
                toast.warning("يجب أن تحتوي الفاتورة على بند واحد على الأقل");
              }
            },
          }),
        ),
      );
      linesContainer.appendChild(lineRow);
    });
    recalculateTotal();
  }

  const invoiceCard = card({
    title: "بيانات الفاتورة والبنود",
    body: el(
      "div",
      { class: "space-y-4" },
      el(
        "div",
        { class: "grid grid-cols-1 md:grid-cols-2 gap-4" },
        select({
          label: "المريض",
          value: selectedPatientId,
          options: patients.map((p) => ({ value: String(p.id), label: `${p.name} (${p.patientCode})` })),
          onChange: (v) => (selectedPatientId = v),
        }),
        select({
          label: "الطبيب المعالج",
          value: selectedDoctorId,
          options: doctors.map((d) => ({ value: String(d.id), label: `${d.name} (${d.title})` })),
          onChange: (v) => (selectedDoctorId = v),
        }),
      ),
      el(
        "div",
        { class: "flex justify-between items-center pt-2 border-t border-line" },
        el("h3", { class: "font-semibold text-sm text-ink" }, "بنود الفاتورة والخدمات"),
        button({
          label: "+ إضافة بند آخر",
          variant: "subtle",
          size: "sm",
          onClick: () => {
            invoiceLines.push({ serviceId: defaultSrv.id, name: defaultSrv.name, price: defaultSrv.price, qty: 1 });
            renderLines();
          },
        }),
      ),
      linesContainer,
      el(
        "div",
        { class: "flex justify-between items-center p-3 bg-brand-50/50 border border-brand-200 rounded-2xl" },
        el("span", { class: "font-semibold text-ink" }, "إجمالي الفاتورة المستحق:"),
        totalDisplay,
      ),
    ),
    footer: el(
      "div",
      { class: "flex justify-end gap-2" },
      button({
        label: "إلغاء",
        variant: "subtle",
        onClick: () => navigate("/billing/invoices"),
      }),
      button({
        label: "إصدار الفاتورة",
        variant: "primary",
        icon: "check",
        onClick: async () => {
          const patient = patients.find((p) => String(p.id) === String(selectedPatientId));
          const doctor = doctors.find((d) => String(d.id) === String(selectedDoctorId));
          if (!patient) {
            toast.warning("يرجى اختيار المريض");
            return;
          }
          const total = invoiceLines.reduce((s, line) => s + line.price * line.qty, 0);
          try {
            await createInvoice({
              patientId: patient.id,
              patientName: patient.name,
              patientCode: patient.patientCode,
              doctorId: doctor?.id,
              doctorName: doctor?.name,
              total,
              paid: 0,
              outstanding: total,
              status: "unpaid",
              date: new Date().toISOString().slice(0, 10),
            });
            toast.success("تم إصدار الفاتورة بنجاح");
            navigate("/billing/invoices");
          } catch (e) {
            toast.error("فشل إصدار الفاتورة");
          }
        },
      }),
    ),
  });

  renderLines();
  container.appendChild(invoiceCard);
  return container;
}

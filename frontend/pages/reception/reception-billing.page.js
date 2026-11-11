/**
 * موديول الاستقبال وخدمة المرضى — استعلام وسداد حسابات المرضى
 * (Reception Desk Patient Billing & Inquiries)
 *
 * مخصص لموظفي الاستقبال والمكاتب الأمامية:
 * 1. بحث فوري عن المرضى، معرفة حالة الحجز والإقامة، الغرفة، والطبيب المعالج.
 * 2. استعراض الحساب الإجمالي للعمليات والإقامة والخدمات الطبية.
 * 3. إمكانية الاطلاع على تفاصيل ومصروفات العملية الداخلية على الشاشة فقط (View Only).
 * 4. حظر طباعة التفاصيل الداخلية الدقيقة من شاشة الاستقبال وتوجيه المريض للإدارة المالية.
 * 5. طباعة كشف حساب الاستقبال الملخص المعتمد (بدون تفاصيل المصروفات الداخلية).
 * 6. سداد نقدية سريع وإصدار إيصال قبض رسمي للمريض.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { icon } from "../../components/common/icon.js";
import { statTile } from "../../components/common/card.js";
import { amount, date, dateTime, phone as formatPhone, integer } from "../../js/core/format.js";
import { openModal } from "../../components/modals/overlay.js";
import { printReport, exportStyledExcel } from "../_shared/print.js";
import { formModal, selectField, value } from "../_shared/forms.js";
import { textField } from "../../components/forms/fields.js";
import { toast } from "../../components/feedback/toast.js";
import {
  listReceptionPatients,
  getReceptionPatientSummary,
  createReceptionReceipt,
} from "../../js/api/reception.api.js";
import { getPatientStats } from "../../js/api/patients.api.js";

export default async function receptionBillingPage(context) {
  const container = el("div", { class: "flex flex-col gap-6 p-4 md:p-6" });

  // جلب البيانات الأولية
  const [patientsData, statsData] = await Promise.all([
    listReceptionPatients({ perPage: 50 }),
    getPatientStats(),
  ]);

  const allPatients = patientsData.data || [];
  let selectedPatientId = context.params?.id || allPatients[0]?.id || 1;
  let summaryData = await getReceptionPatientSummary(selectedPatientId);

  // 1. ترويسة الشاشة والبطاقات الإحصائية (KPIs)
  const headerSection = el(
    "header",
    { class: "flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-subtle pb-4" },
    el(
      "div",
      { class: "flex flex-col" },
      el(
        "div",
        { class: "flex items-center gap-2.5" },
        el("div", { class: "p-2 rounded-lg bg-brand-subtle text-brand" }, icon("users", { size: 22 })),
        el("h1", { class: "text-xl font-bold text-ink" }, "مكتب الاستقبال — استعلام وسداد حسابات المرضى"),
        badge("المكاتب الأمامية والخزينة", { tone: "brand" }),
      ),
      el(
        "p",
        { class: "text-xs text-muted mt-1" },
        "استعلام فوري عن حسابات المرضى، عرض العمليات والإقامة، وطباعة كشف الحساب الملخص المعتمد للاستقبال.",
      ),
    ),
    el(
      "div",
      { class: "flex items-center gap-2 flex-wrap" },
      button({
        id: "btn-quick-receipt-header",
        label: "+ تحصيل دفعة / سند قبض سريع",
        variant: "primary",
        icon: "check",
        onClick: () => openFastReceiptModal(summaryData.patient, summaryData, refreshCurrentPatient),
      }),
    ),
  );

  // 2. بطاقات إحصائيات الاستقبال السريعة
  const kpiRow = el(
    "section",
    { class: "grid grid-cols-2 md:grid-cols-4 gap-4" },
    statTile({
      title: "المرضى المقيمون حالياً",
      value: integer(statsData.activeInpatients || 0),
      hint: "أجنحة وعناية وغرف",
      icon: "hospital",
      tone: "brand",
    }),
    statTile({
      title: "العناية المركزة (ICU)",
      value: integer(statsData.activeIcu || 0),
      hint: "حالات نشطة حالياً",
      icon: "activity",
      tone: "danger",
    }),
    statTile({
      title: "إجمالي التحصيلات بالاستقبال",
      value: amount(statsData.totalCollected || 0),
      hint: "سندات قبض مسجلة",
      icon: "checkCircle",
      tone: "success",
    }),
    statTile({
      title: "مستحقات مطلوب تحصيلها",
      value: amount(statsData.totalReceivables || 0),
      hint: "رصيد المرضى المتبقي",
      icon: "creditCard",
      tone: "warning",
    }),
  );

  // 3. منطقة العمل الرئيسية: قائمة المرضى في الجانب + ملف المريض المحدد
  const workspaceGrid = el("div", { class: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" });

  // --- العمود الأيمن: قائمة المرضى ومربع البحث السريع (4 أعمدة) ---
  const searchInput = el("input", {
    id: "reception-patient-search-input",
    type: "text",
    placeholder: "ابحث بالاسم، الكود، الغرفة، أو الهاتف...",
    class:
      "w-full px-3 py-2 text-xs rounded-lg border border-subtle bg-surface focus:outline-none focus:ring-2 focus:ring-brand",
  });

  const filterSelect = el(
    "select",
    {
      id: "reception-filter-status",
      class: "px-2 py-1.5 text-xs rounded-lg border border-subtle bg-surface text-muted",
    },
    el("option", { value: "all" }, "كل الحالات"),
    el("option", { value: "inpatient" }, "المقيمون فقط"),
    el("option", { value: "outpatient" }, "عيادات / طوارئ"),
    el("option", { value: "balance" }, "عليهم متبقي مالي"),
  );

  const patientsListContainer = el("div", {
    id: "reception-patients-list-scroll",
    class: "flex flex-col gap-2 max-h-[560px] overflow-y-auto pr-1",
  });

  function renderPatientsList(filtered) {
    patientsListContainer.replaceChildren();
    if (filtered.length === 0) {
      patientsListContainer.appendChild(
        el("div", { class: "p-4 text-center text-xs text-muted" }, "لا يوجد مرضى مطابقون لمعايير البحث."),
      );
      return;
    }

    filtered.forEach((p) => {
      const isSelected = Number(p.id) === Number(selectedPatientId);
      const isDue = (p.balance || 0) > 0;
      const card = el(
        "div",
        {
          id: `reception-patient-card-${p.id}`,
          class: `p-3 rounded-xl border transition-all cursor-pointer ${
            isSelected
              ? "bg-brand/5 border-brand ring-1 ring-brand shadow-sm"
              : "bg-surface border-subtle hover:border-brand/40 hover:bg-subtle/50"
          }`,
          onClick: () => selectPatient(p.id),
        },
        el(
          "div",
          { class: "flex items-start justify-between gap-2" },
          el(
            "div",
            { class: "flex flex-col" },
            el("span", { class: "font-semibold text-xs text-ink line-clamp-1" }, p.name),
            el(
              "div",
              { class: "flex items-center gap-1.5 text-[11px] text-muted mt-0.5" },
              el("span", { class: "font-mono font-medium text-brand" }, p.code),
              el("span", {}, "•"),
              el("span", {}, p.currentRoom || "عيادات خارجية"),
            ),
          ),
          el(
            "div",
            { class: "flex flex-col items-end" },
            el(
              "span",
              {
                class: `text-xs font-bold tabular ${isDue ? "text-danger" : "text-success"}`,
              },
              amount(p.balance || 0),
            ),
            el(
              "span",
              { class: "text-[10px] text-muted mt-0.5" },
              isDue ? "متبقي" : "مسدد بالكامل",
            ),
          ),
        ),
      );
      patientsListContainer.appendChild(card);
    });
  }

  function applyFilter() {
    const q = searchInput.value.trim().toLowerCase();
    const filter = filterSelect.value;
    const filtered = allPatients.filter((p) => {
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.phone && p.phone.includes(q)) ||
        (p.currentRoom && p.currentRoom.toLowerCase().includes(q)) ||
        (p.nationalId && p.nationalId.includes(q));

      if (!matchSearch) return false;

      if (filter === "inpatient") return p.status === "inpatient";
      if (filter === "outpatient") return p.status !== "inpatient";
      if (filter === "balance") return (p.balance || 0) > 0;
      return true;
    });
    renderPatientsList(filtered);
  }

  searchInput.addEventListener("input", applyFilter);
  filterSelect.addEventListener("change", applyFilter);
  renderPatientsList(allPatients);

  const sidebarPanel = el(
    "aside",
    { class: "lg:col-span-4 bg-surface border border-subtle rounded-xl p-4 shadow-sm flex flex-col gap-3" },
    el(
      "div",
      { class: "flex items-center justify-between gap-2" },
      el("h2", { class: "text-xs font-bold text-ink uppercase tracking-wider" }, "سجل مرضى الاستقبال"),
      badge(`${allPatients.length} مريض`, { tone: "neutral", size: "sm" }),
    ),
    searchInput,
    filterSelect,
    patientsListContainer,
  );

  // --- العمود الأيسر: ملف وكشف حساب المريض المحدد (8 أعمدة) ---
  const patientDetailContainer = el("main", {
    id: "reception-patient-main-view",
    class: "lg:col-span-8 flex flex-col gap-5",
  });

  function renderPatientDetail() {
    patientDetailContainer.replaceChildren();

    const patient = summaryData.patient;
    const kpis = summaryData.kpis || {};
    const hasRemaining = (kpis.remainingDue || 0) > 0;

    // 1) بطاقة هوية المريض والبيانات الطبية والتأمينية
    const heroCard = el(
      "section",
      {
        class:
          "bg-surface border border-subtle rounded-xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4",
      },
      el(
        "div",
        { class: "flex items-center gap-3.5" },
        el(
          "div",
          {
            class: "w-13 h-13 rounded-full flex items-center justify-center font-bold text-base text-white shadow-sm shrink-0",
            style: "background: linear-gradient(135deg, #1e40af, #0284c7);",
          },
          patient.name.charAt(0),
        ),
        el(
          "div",
          { class: "flex flex-col" },
          el(
            "div",
            { class: "flex items-center gap-2 flex-wrap" },
            el("h2", { class: "text-lg font-bold text-ink" }, patient.name),
            badge(patient.code, { tone: "brand" }),
            badge(patient.status === "inpatient" ? "محجوز حالياً" : "عيادات خارجية", {
              tone: patient.status === "inpatient" ? "danger" : "info",
            }),
          ),
          el(
            "div",
            { class: "flex items-center gap-3 text-xs text-muted mt-1 flex-wrap" },
            el("span", {}, `الغرفة/السرير: ${patient.currentRoom || "غير مقيم"}`),
            el("span", {}, "•"),
            el("span", {}, `الطبيب: ${patient.attendingDoctor ? patient.attendingDoctor.split("—")[0].trim() : "—"}`),
            el("span", {}, "•"),
            el("span", {}, `التأمين: ${patient.insuranceProvider || "نقدي"}`),
            patient.coverageRate ? el("span", { class: "text-brand font-medium" }, `(تحمل: ${Math.round((1 - patient.coverageRate) * 100)}%)`) : null,
          ),
        ),
      ),
      el(
        "div",
        {
          class: `flex flex-col items-end justify-center p-3.5 rounded-xl border min-w-[190px] ${
            hasRemaining
              ? "bg-red-500/10 border-red-500/20 text-red-900 dark:text-red-200"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200"
          }`,
        },
        el("span", { class: "text-[11px] font-medium opacity-80" }, "المبلغ المطلوب سداده بالاستقبال"),
        el(
          "span",
          {
            class: `text-2xl font-black tabular tracking-tight mt-0.5 ${
              hasRemaining ? "text-danger" : "text-success"
            }`,
          },
          amount(kpis.remainingDue || 0),
        ),
        el(
          "span",
          { class: "text-[11px] font-semibold mt-0.5" },
          hasRemaining ? "مستحق فوري على المريض" : "الحساب مسدد بالكامل ✓",
        ),
      ),
    );

    // 2) شريط أدوات طباعة وتصدير كشف حساب الاستقبال وسداد النقدية
    const actionsToolbar = el(
      "div",
      { class: "flex items-center justify-between flex-wrap gap-2.5 bg-subtle/60 p-3 rounded-xl border border-subtle" },
      el(
        "div",
        { class: "flex items-center gap-2" },
        badge("كشف حساب الاستقبال الملخص", { tone: "purple" }),
        el(
          "span",
          { class: "text-xs text-muted hidden md:inline" },
          "يُظهر البنود الإجمالية المعتمدة دون تفاصيل المصروفات الداخلية",
        ),
      ),
      el(
        "div",
        { class: "flex items-center gap-2 flex-wrap" },
        button({
          id: "btn-reception-print-summary",
          label: "طباعة كشف حساب الاستقبال (ملخص)",
          variant: "primary",
          icon: "print",
          onClick: () => printReceptionSummary(patient, summaryData),
        }),
        button({
          id: "btn-reception-export-excel",
          label: "تصدير ملخص Excel",
          variant: "secondary",
          icon: "download",
          onClick: () => exportReceptionSummaryExcel(patient, summaryData),
        }),
        button({
          id: "btn-reception-add-payment",
          label: "+ سداد دفعة / تحصيل",
          variant: "brand",
          icon: "check",
          onClick: () => openFastReceiptModal(patient, summaryData, refreshCurrentPatient),
        }),
      ),
    );

    // 3) جدول العمليات والخدمات الطبية المجمعة (ملخص الاستقبال)
    const servicesSection = buildReceptionServicesSection(patient, summaryData);

    // 4) جدول سندات القبض والدفعات المسجلة بالاستقبال
    const receiptsSection = buildReceptionReceiptsSection(patient, summaryData, refreshCurrentPatient);

    patientDetailContainer.append(heroCard, actionsToolbar, servicesSection, receiptsSection);
  }

  async function selectPatient(patientId) {
    selectedPatientId = patientId;
    renderPatientsList(allPatients);
    summaryData = await getReceptionPatientSummary(patientId);
    renderPatientDetail();
  }

  async function refreshCurrentPatient() {
    summaryData = await getReceptionPatientSummary(selectedPatientId);
    const updatedPatients = await listReceptionPatients({ perPage: 50 });
    allPatients.length = 0;
    allPatients.push(...(updatedPatients.data || []));
    renderPatientsList(allPatients);
    renderPatientDetail();
  }

  renderPatientDetail();
  workspaceGrid.append(sidebarPanel, patientDetailContainer);
  container.append(headerSection, kpiRow, workspaceGrid);
  return container;
}

/**
 * بناء جدول العمليات والخدمات الطبية الملخص للاستقبال
 * ويشمل زر «عرض تفاصيل البنود الداخلية» على الشاشة فقط للاستقبال
 */
function buildReceptionServicesSection(patient, summaryData) {
  const items = summaryData.summaryItems || [];

  const card = el(
    "section",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm flex flex-col gap-4" },
    el(
      "div",
      { class: "flex items-center justify-between flex-wrap gap-2 border-b border-subtle pb-3" },
      el(
        "div",
        {},
        el("h3", { class: "text-sm font-bold text-ink" }, "قائمة العمليات والخدمات الطبية (ملخص الاستقبال)"),
        el(
          "p",
          { class: "text-xs text-muted mt-0.5" },
          "تُعرض العمليات كبنود إجمالية شاملة — انقر على أي عملية للاطلاع على تفاصيلها الداخلية على الشاشة فقط.",
        ),
      ),
      el("div", { class: "flex items-center gap-2" }, badge(`${items.length} إجراء / خدمة`, { tone: "brand" })),
    ),
  );

  if (items.length === 0) {
    card.appendChild(
      el("div", { class: "p-8 text-center text-xs text-muted" }, "لا توجد خدمات أو فواتير مسجلة لهذا المريض بعد."),
    );
    return card;
  }

  const table = el("table", { class: "w-full border-collapse text-right text-xs" });
  const thead = el(
    "thead",
    {},
    el(
      "tr",
      { class: "border-b border-subtle bg-subtle text-muted font-medium" },
      el("th", { class: "p-3" }, "التاريخ"),
      el("th", { class: "p-3" }, "رقم الفاتورة"),
      el("th", { class: "p-3" }, "الخدمة / الإجراء الرئيسي"),
      el("th", { class: "p-3" }, "القسم"),
      el("th", { class: "p-3 text-left tabular" }, "التكلفة الإجمالية"),
      el("th", { class: "p-3 text-left tabular" }, "تغطية التأمين"),
      el("th", { class: "p-3 text-left tabular" }, "نصيب المريض"),
      el("th", { class: "p-3 text-center" }, "تفاصيل الإجراء"),
    ),
  );

  const tbody = el("tbody", {});

  items.forEach((item) => {
    const isProcedure = item.hasDetails;
    const tr = el(
      "tr",
      { class: "border-b border-subtle hover:bg-subtle/60 transition-colors" },
      el("td", { class: "p-3 text-muted tabular" }, date(item.date)),
      el(
        "td",
        { class: "p-3 font-semibold text-brand font-mono" },
        item.invoiceNumber ? badge(item.invoiceNumber, { tone: "brand", size: "sm" }) : "—",
      ),
      el(
        "td",
        { class: "p-3 font-medium text-ink" },
        el("div", { class: "flex items-center gap-2" }, el("span", {}, item.summaryTitle)),
      ),
      el("td", { class: "p-3 text-muted" }, item.department),
      el("td", { class: "p-3 text-left tabular font-semibold text-ink" }, amount(item.totalCost)),
      el(
        "td",
        { class: "p-3 text-left tabular text-brand" },
        item.insuranceCoverage > 0 ? amount(item.insuranceCoverage) : "—",
      ),
      el(
        "td",
        { class: "p-3 text-left tabular font-bold text-amber-700 dark:text-amber-400" },
        amount(item.patientShare),
      ),
      el(
        "td",
        { class: "p-3 text-center" },
        isProcedure
          ? button({
              label: "🔍 عرض تفاصيل العملية",
              variant: "secondary",
              size: "sm",
              icon: "eye",
              onClick: () => openInternalDetailsModal(patient, item),
            })
          : el("span", { class: "text-muted text-[11px]" }, "بند مباشر"),
      ),
    );
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  card.appendChild(el("div", { class: "overflow-x-auto" }, table));
  return card;
}

/**
 * نافذة عرض تفاصيل ومصروفات العملية الداخلية على الشاشة فقط لموظف الاستقبال (View Only Modal)
 * وتمنع الطباعة مع تنبيه رقابي صريح.
 */
function openInternalDetailsModal(patient, item) {
  const breakdown = item.internalBreakdown || [];

  openModal({
    title: `تفاصيل العملية: ${item.summaryTitle}`,
    subtitle: `المريض: ${patient.name} (${patient.code}) · فاتورة: ${item.invoiceNumber || "—"} · [عرض داخلي للاستقبال فقط]`,
    size: "lg",
    body: (close) =>
      el(
        "div",
        { class: "flex flex-col gap-4 text-xs" },
        // تنبيه رقابي صريح يوضح لموظف الاستقبال منع الطباعة
        el(
          "div",
          {
            class:
              "p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-3",
          },
          el(
            "div",
            { class: "p-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" },
            icon("lock", { size: 18 }),
          ),
          el(
            "div",
            { class: "flex flex-col gap-1 leading-relaxed" },
            el("strong", { class: "font-bold text-sm text-ink" }, "🔒 تنبيه رقابي خاص بموظفي الاستقبال:"),
            el(
              "p",
              {},
              "هذه البنود والمصروفات الداخلية معروضة للاطلاع المباشر على الشاشة فقط لموظف الاستقبال لغرض الإجابة على استفسارات المريض شفهياً.",
            ),
            el(
              "p",
              { class: "font-semibold text-danger" },
              "❌ غير مصرح بطباعة هذه التفاصيل الدقيقة من شاشة الاستقبال. إذا رغب المريض في كشف حساب تفصيلي كامل لكافة المستهلكات، يُوجّه رسمياً إلى إدارة الحسابات المالية العامة بالدور الأرضي.",
            ),
          ),
        ),

        // جدول تفاصيل ما صُرف داخل العملية
        el(
          "div",
          { class: "border border-subtle rounded-xl overflow-hidden mt-1" },
          el(
            "table",
            { class: "w-full border-collapse text-right text-xs" },
            el(
              "thead",
              { class: "bg-subtle border-b border-subtle font-medium text-muted" },
              el(
                "tr",
                {},
                el("th", { class: "p-3" }, "كود الخدمة"),
                el("th", { class: "p-3" }, "بيان البند المصروف بالعملية"),
                el("th", { class: "p-3 text-center" }, "الكمية"),
                el("th", { class: "p-3 text-left tabular" }, "سعر الوحدة"),
                el("th", { class: "p-3 text-left tabular" }, "إجمالي البند"),
              ),
            ),
            el(
              "tbody",
              {},
              ...breakdown.map((b) =>
                el(
                  "tr",
                  { class: "border-b border-subtle hover:bg-subtle/50" },
                  el("td", { class: "p-3 font-mono text-muted" }, b.serviceCode || "—"),
                  el("td", { class: "p-3 font-semibold text-ink" }, b.description),
                  el("td", { class: "p-3 text-center tabular text-muted" }, integer(b.quantity || 1)),
                  el("td", { class: "p-3 text-left tabular text-muted" }, amount(b.unitPrice || b.total)),
                  el("td", { class: "p-3 text-left tabular font-bold text-ink" }, amount(b.total)),
                ),
              ),
              el(
                "tr",
                { class: "bg-subtle/80 font-bold" },
                el("td", { class: "p-3", colspan: 4 }, "إجمالي بنود ومصروفات العملية:"),
                el("td", { class: "p-3 text-left tabular text-brand font-extrabold text-sm" }, amount(item.totalCost)),
              ),
            ),
          ),
        ),

        // ملاحظة موجهة للمريض
        el(
          "div",
          { class: "p-3 rounded-lg bg-surface border border-subtle text-muted text-[11px]" },
          el(
            "span",
            { class: "font-semibold text-ink ml-1" },
            "توجيه المريض:",
          ),
          "«في حال طلب المريض أو المرافق الحصول على مستند رسمي مطبوع بهذه التفاصيل، يُرجى طباعة كشف حساب الاستقبال الملخص أولاً، وتوجيهه للإدارة المالية لطباعة الكشف التحليلي الطبي الشامل.»",
        ),
      ),
    footer: (close) => [
      // زر الطباعة هنا معطّل بصورة صريحة لحماية الصلاحيات الرقابية
      button({
        label: "🔒 طباعة التفاصيل (غير متاح — خاص بالحسابات المالية)",
        variant: "secondary",
        disabled: true,
        icon: "lock",
      }),
      button({
        label: "إغلاق النافذة",
        variant: "primary",
        onClick: () => close(),
      }),
    ],
  });
}

/**
 * طباعة كشف حساب الاستقبال الملخص (PDF Preview)
 * يحتوي فقط على البنود الإجمالية المعتمدة مع ملاحظة توجيه المريض للحسابات.
 */
function printReceptionSummary(patient, summaryData) {
  const items = summaryData.summaryItems || [];
  const kpis = summaryData.kpis || {};

  const headers = [
    { label: "التاريخ", align: "right" },
    { label: "رقم الفاتورة", align: "center" },
    { label: "بيان الخدمة / الإجراء الرئيسي", align: "right" },
    { label: "القسم", align: "center" },
    { label: "إجمالي التكلفة", align: "left" },
    { label: "تغطية التأمين", align: "left" },
    { label: "المطلوب من المريض", align: "left" },
  ];

  const rows = items.map((item) => [
    date(item.date),
    item.invoiceNumber || "—",
    item.summaryTitle, // e.g. "عملية جراحية: استئصال مرارة بالمنظار"
    item.department,
    amount(item.totalCost),
    item.insuranceCoverage > 0 ? amount(item.insuranceCoverage) : "—",
    amount(item.patientShare),
  ]);

  const totals = [
    "الإجمالي العام",
    "—",
    `عدد المعاملات: ${items.length}`,
    "—",
    amount(kpis.totalBilled || 0),
    amount(kpis.totalInsurance || 0),
    amount(kpis.totalPatientRequired || 0),
  ];

  printReport({
    title: `كشف حساب مريض (ملخص مكتب الاستقبال)`,
    subtitle: `اسم المريض: ${patient.name} · كود الملف: ${patient.code} · الغرفة/السرير: ${
      patient.currentRoom || "عيادات خارجية"
    } · الطبيب: ${patient.attendingDoctor || "—"} · جهة التأمين: ${patient.insuranceProvider || "نقدي"} (تحمل: ${
      Math.round((1 - (patient.coverageRate || 0)) * 100)
    }%)`,
    headers,
    rows,
    totals,
    kpis: [
      { label: "إجمالي قيمة الخدمات", value: amount(kpis.totalBilled || 0) },
      { label: "تغطية شركة التأمين", value: amount(kpis.totalInsurance || 0) },
      { label: "نصيب المريض المطلوب", value: amount(kpis.totalPatientRequired || 0) },
      { label: "إجمالي المسدد بالاستقبال", value: amount(kpis.totalPaid || 0) },
      { label: "الرصيد المتبقي المطلوب دفعه", value: amount(kpis.remainingDue || 0) },
    ],
    notes:
      "ملاحظة رسمية هامة: هذا كشف حساب ملخص صادر من مكتب الاستقبال لأغراض السداد والاستعلام المالي السريع. للحصول على الكشف التحليلي المفصل لبنود المستهلكات والمصروفات الطبية الدقيقة للعمليات والإقامة، يرجى التوجه لإدارة الحسابات المالية العامة بالدور الأرضي.",
    signatures: ["موظف الاستقبال والمحصل", "المراجعة والتدقيق", "الاعتماد المالي"],
  });
}

/**
 * تصدير كشف حساب الاستقبال إلى Excel منسق بالهيدر الأزرق وشعار المستشفى
 */
function exportReceptionSummaryExcel(patient, summaryData) {
  const items = summaryData.summaryItems || [];
  const kpis = summaryData.kpis || {};

  const headers = [
    { label: "التاريخ", align: "center" },
    { label: "رقم الفاتورة", align: "center" },
    { label: "بيان الخدمة / الإجراء الرئيسي", align: "right" },
    { label: "القسم", align: "center" },
    { label: "إجمالي التكلفة", align: "left" },
    { label: "تغطية التأمين", align: "left" },
    { label: "نصيب المريض المطلوب", align: "left" },
  ];

  const rows = items.map((item) => [
    date(item.date),
    item.invoiceNumber || "—",
    item.summaryTitle,
    item.department,
    item.totalCost,
    item.insuranceCoverage,
    item.patientShare,
  ]);

  const totals = [
    "الإجمالي العام",
    "—",
    `عدد المعاملات: ${items.length}`,
    "—",
    kpis.totalBilled || 0,
    kpis.totalInsurance || 0,
    kpis.totalPatientRequired || 0,
  ];

  exportStyledExcel({
    title: `كشف حساب ملخص للاستقبال — ${patient.name}`,
    period: `ملف: ${patient.code}`,
    headers,
    rows,
    totals,
  });
}

/**
 * بناء قسم سجل سندات القبض والدفعات المسددة بالاستقبال
 */
function buildReceptionReceiptsSection(patient, summaryData, onReceiptCreated) {
  const receipts = summaryData.receipts || [];

  const card = el(
    "section",
    { class: "bg-surface border border-subtle rounded-xl p-5 shadow-sm flex flex-col gap-4" },
    el(
      "div",
      { class: "flex items-center justify-between flex-wrap gap-2 border-b border-subtle pb-3" },
      el(
        "div",
        {},
        el("h3", { class: "text-sm font-bold text-ink" }, "سجل سندات القبض والدفعات المسددة"),
        el(
          "p",
          { class: "text-xs text-muted mt-0.5" },
          "المبالغ المسددة فعلياً بالخزينة ومكاتب الاستقبال مع أرقام السندات المعتمدة.",
        ),
      ),
      el(
        "div",
        { class: "flex items-center gap-2" },
        badge(`إجمالي المسدد: ${amount(summaryData.kpis.totalPaid || 0)}`, { tone: "success" }),
      ),
    ),
  );

  if (receipts.length === 0) {
    card.appendChild(
      el("div", { class: "p-6 text-center text-xs text-muted" }, "لم يتم تسجيل أي سندات قبض لهذا المريض حتى الآن."),
    );
    return card;
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
      el("th", { class: "p-3" }, "نوع الدفعة"),
      el("th", { class: "p-3" }, "طريقة السداد"),
      el("th", { class: "p-3" }, "الخزينة / الحساب"),
      el("th", { class: "p-3 text-left tabular" }, "المبلغ المسدد"),
      el("th", { class: "p-3 text-center" }, "إيصال السداد"),
    ),
  );

  const tbody = el("tbody", {});

  receipts.forEach((r) => {
    const tr = el(
      "tr",
      { class: "border-b border-subtle hover:bg-subtle/50 transition-colors" },
      el("td", { class: "p-3 text-muted tabular" }, date(r.date)),
      el("td", { class: "p-3 font-mono font-bold text-success" }, r.receiptNumber),
      el("td", { class: "p-3" }, r.typeLabel || "سداد دفعة"),
      el("td", { class: "p-3 text-muted" }, r.paymentMethodLabel || "نقدي"),
      el("td", { class: "p-3 text-muted" }, r.targetAccount || "الخزينة الرئيسية"),
      el("td", { class: "p-3 text-left tabular font-bold text-success" }, amount(r.amount)),
      el(
        "td",
        { class: "p-3 text-center" },
        button({
          label: "طباعة الإيصال",
          variant: "ghost",
          size: "sm",
          icon: "print",
          onClick: () => printSingleReceiptVoucher(patient, r),
        }),
      ),
    );
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  card.appendChild(el("div", { class: "overflow-x-auto" }, table));
  return card;
}

/**
 * فتح نموذج تحصيل وسداد دفعة سريعة للمريض بالاستقبال
 */
function openFastReceiptModal(patient, summaryData, onSuccess) {
  const remaining = summaryData.kpis?.remainingDue || 0;
  const form = {
    amount: remaining > 0 ? remaining : 500,
    paymentMethod: "cash",
    targetAccount: "خزينة مكتب الاستقبال الرئيسي (1111)",
    notes: `تحصيل من المريض ${patient.name} بالاستقبال`,
  };

  formModal({
    title: `تحصيل نقدية وسداد دفعة — المريض: ${patient.name}`,
    submitLabel: "تأكيد التحصيل وإصدار سند القبض",
    success: "تم تسجيل سند القبض وتحصيل المبلغ بنجاح.",
    fieldLabels: { amount: "المبلغ المحصل" },
    validate: () => {
      const errors = {};
      if (!form.amount || Number(form.amount) <= 0) errors.amount = "المبلغ يجب أن يكون أكبر من صفر.";
      return errors;
    },
    body: () =>
      el(
        "div",
        { class: "flex flex-col gap-3.5 text-xs" },
        el(
          "div",
          { class: "p-3 rounded-lg bg-subtle border border-subtle flex justify-between items-center" },
          el("span", { class: "text-muted" }, "صافي المتبقي على المريض:"),
          el("span", { class: "text-sm font-bold text-danger tabular" }, amount(remaining)),
        ),
        textField({
          label: "المبلغ المراد تحصيله الآن (ج.م)",
          type: "number",
          value: String(form.amount),
          required: true,
          onInput: value((v) => (form.amount = Number(v) || 0)),
        }),
        selectField({
          label: "طريقة التحصيل / الدفع",
          value: form.paymentMethod,
          options: [
            { value: "cash", label: "نقداً بالخزينة (Cash)" },
            { value: "card", label: "بطاقة دفع فيزا / ماستركارد (POS)" },
            { value: "bank_transfer", label: "تحويل بنكي / إنستاباي" },
          ],
          onChange: value((v) => (form.paymentMethod = v)),
        }),
        selectField({
          label: "حساب الخزينة المودع به",
          value: form.targetAccount,
          options: [
            { value: "خزينة مكتب الاستقبال الرئيسي (1111)", label: "خزينة مكتب الاستقبال الرئيسي (1111)" },
            { value: "الخزينة العامة للمستشفى (1112)", label: "الخزينة العامة للمستشفى (1112)" },
            { value: "حساب العمليات - بنك مصر (1121)", label: "حساب العمليات - بنك مصر (1121)" },
          ],
          onChange: value((v) => (form.targetAccount = v)),
        }),
        textField({
          label: "ملاحظات السداد / رقم مرجع الفيزا",
          value: form.notes,
          onInput: value((v) => (form.notes = v)),
        }),
      ),
    onSubmit: async () => {
      await createReceptionReceipt({
        patientId: patient.id,
        patientName: patient.name,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        targetAccount: form.targetAccount,
        notes: form.notes,
        type: "invoice_payment",
      });
    },
    onDone: () => {
      if (onSuccess) onSuccess();
    },
  });
}

/**
 * طباعة إيصال سداد مفرد للمريض (Receipt Voucher)
 */
function printSingleReceiptVoucher(patient, receipt) {
  printReport({
    title: "إيصال استلام نقدية — مكتب الاستقبال",
    subtitle: `رقم السند: ${receipt.receiptNumber} · المريض: ${patient.name} (${patient.code}) · التاريخ: ${date(
      receipt.date,
    )}`,
    headers: [
      { label: "رقم السند", align: "center" },
      { label: "المستلم منه (المريض)", align: "right" },
      { label: "البيان / سبب التحصيل", align: "right" },
      { label: "طريقة السداد", align: "center" },
      { label: "المبلغ المحصل", align: "left" },
    ],
    rows: [
      [
        receipt.receiptNumber,
        patient.name,
        receipt.notes || "سداد دفعة من تكاليف العلاج والإقامة",
        receipt.paymentMethodLabel || "نقدي بالخزينة",
        amount(receipt.amount),
      ],
    ],
    totals: ["المجموع", "—", "—", "—", amount(receipt.amount)],
    notes:
      "تم تحصيل هذا المبلغ لحساب مستشفى أمان الحياة بمكتب الاستقبال والخزينة الرئيسية. هذا الإيصال معتمد وموثق بالنظام المالي.",
    signatures: ["موظف الاستقبال والمحصل", "الختم الرسمي للمستشفى", "توقيع المسدد"],
  });
}

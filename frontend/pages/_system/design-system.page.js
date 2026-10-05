/**
 * نظام التصميم — توثيق حيّ.
 *
 * هذه الصفحة ليست عرضًا تجميليًا، بل أداة التحقق من مخرجات المرحلة 0: كل مكوّن
 * معروض هنا بحالاته، في RTL، وبمقاسات حقيقية. لو انكسر مكوّن فسيظهر هنا قبل
 * أن ينكسر في شاشة مريض أو فاتورة.
 *
 * تُحدَّث مع كل مكوّن جديد. المكوّن الذي لا يظهر في هذه الصفحة غير موثَّق.
 */

import { el, cx } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statCard, statGrid, dataRow, dataList } from "../../components/common/card.js";
import { button, buttonGroup, iconButton } from "../../components/common/button.js";
import { badge, statusBadge, countBadge } from "../../components/common/badge.js";
import { icon, iconNames } from "../../components/common/icon.js";
import { tabs, segmentedControl } from "../../components/common/tabs.js";
import {
  field,
  input,
  moneyInput,
  quantityInput,
  textarea,
  select,
  checkbox,
  radioGroup,
  dateField,
  dateRangeField,
  searchInput,
  formGrid,
  formSection,
  formActions,
} from "../../components/forms/fields.js";
import { alert, formErrorSummary, reportIncompleteAlert } from "../../components/feedback/alert.js";
import { toast } from "../../components/feedback/toast.js";
import {
  loadingState,
  tableSkeleton,
  cardsSkeleton,
  formSkeleton,
  emptyState,
  errorState,
} from "../../components/feedback/states.js";
import { openModal, openDrawer, confirmAction } from "../../components/modals/overlay.js";
import { dataTable, twoLineCell, summaryCells } from "../../components/tables/data-table.js";
import { STATUSES } from "../../js/core/statuses.js";
import { PERMISSIONS, currentRole, effectivePermissions } from "../../js/core/permissions.js";
import { registeredEndpoints } from "../../js/api/mock-adapter.js";
import { listPatients } from "../../js/api/patients.api.js";
import { listInvoices } from "../../js/api/billing.api.js";
import { getGovernorates, toOptions } from "../../js/api/lookups.api.js";
import { ApiError, ErrorCode } from "../../js/core/errors.js";
import * as fmt from "../../js/core/format.js";

/* -------------------------------------------------------------------------- */

function sectionTitle(title, description) {
  return el(
    "div",
    { class: "mb-3" },
    el("h2", { class: "text-sm font-semibold text-ink" }, title),
    description ? el("p", { class: "text-xs text-muted mt-0.5" }, description) : null,
  );
}

/** لوح عرض بخلفية منقّطة — يُبرز حدود المكوّن الحقيقية. */
function canvas(...children) {
  return el(
    "div",
    {
      class:
        "flex flex-wrap items-start gap-3 p-4 bg-subtle border border-line " +
        "rounded-[var(--radius-control)]",
    },
    ...children.flat().filter(Boolean),
  );
}

function stack(...children) {
  return el("div", { class: "space-y-6" }, ...children.flat().filter(Boolean));
}

/* ========================================================================== */
/*  الألوان والخطوط                                                            */
/* ========================================================================== */

function tokensTab() {
  const scale = (name, shades) =>
    el(
      "div",
      { class: "min-w-0" },
      el("p", { class: "text-xs font-medium text-ink mb-1.5" }, name),
      el(
        "div",
        { class: "flex rounded-[var(--radius-control)] overflow-hidden border border-line" },
        ...shades.map((shade) =>
          el(
            "div",
            {
              class: "flex-1 h-12 grid place-items-end pb-1",
              style: { backgroundColor: `var(--color-${shade.token})` },
              title: shade.token,
            },
            el(
              "span",
              {
                class: cx(
                  "text-[9px] font-mono",
                  shade.dark ? "text-white/70" : "text-ink/50",
                ),
              },
              shade.label,
            ),
          ),
        ),
      ),
    );

  const brandShades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => ({
    token: `brand-${step}`,
    label: String(step),
    dark: step >= 500,
  }));

  return stack(
    card({
      title: "اللون الأساسي",
      subtitle: "تغيير هوية المستشفى يبدأ وينتهي في @theme داخل css/tailwind.src.css",
      body: el("div", { class: "space-y-4" }, scale("brand", brandShades)),
    }),

    card({
      title: "الأسطح والنصوص",
      body: el(
        "div",
        { class: "grid gap-4 sm:grid-cols-2" },
        scale("الأسطح", [
          { token: "canvas", label: "canvas" },
          { token: "surface", label: "surface" },
          { token: "subtle", label: "subtle" },
          { token: "line", label: "line" },
          { token: "line-strong", label: "strong" },
        ]),
        scale("الشريط الجانبي", [
          { token: "rail", label: "rail", dark: true },
          { token: "rail-hover", label: "hover", dark: true },
          { token: "rail-active", label: "active", dark: true },
        ]),
      ),
    }),

    card({
      title: "الألوان الدلالية",
      body: el(
        "div",
        { class: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4" },
        ...["success", "warning", "danger", "info"].map((tone) =>
          scale(tone, [
            { token: `${tone}-50`, label: "50" },
            { token: `${tone}-200`, label: "200" },
            { token: `${tone}-600`, label: "600", dark: true },
            { token: `${tone}-700`, label: "700", dark: true },
          ]),
        ),
      ),
    }),

    card({
      title: "الخطوط",
      subtitle: "IBM Plex Sans Arabic — مصمَّم للواجهات، وأرقامه بعرض ثابت",
      body: el(
        "div",
        { class: "space-y-3" },
        el("p", { class: "text-2xl font-semibold" }, "لوحة تحكم المستشفى — 2.4 مليون ج.م"),
        el("p", { class: "text-lg font-medium" }, "كشف حساب المريض أحمد محمود خليل"),
        el("p", { class: "text-sm" }, "النص الأساسي بمقاس 14px — هذا هو المقاس الافتراضي للواجهة."),
        el("p", { class: "text-xs text-muted" }, "نص ثانوي بمقاس 12px للتلميحات وأسطر المساعدة."),
        el(
          "div",
          { class: "pt-3 border-t border-line" },
          el("p", { class: "text-xs text-muted mb-1.5" }, "الأرقام بعرض ثابت — لمحاذاة الأعمدة المالية:"),
          el(
            "div",
            { class: "tabular text-sm space-y-0.5 font-medium" },
            el("div", {}, "1,111.11"),
            el("div", {}, "8,888.88"),
            el("div", {}, "12,450.00"),
          ),
        ),
      ),
    }),

    card({
      title: "التنسيق",
      subtitle: "كل رقم وتاريخ في النظام يمر من js/core/format.js",
      body: dataList(
        dataRow("مبلغ مالي", fmt.currency(12450.5)),
        dataRow("مبلغ بدون رمز", fmt.amount(12450.5)),
        dataRow("رقم مختصر", fmt.compact(2_430_000)),
        dataRow("نسبة", fmt.percent(0.125)),
        dataRow("تاريخ", fmt.date("2026-10-05")),
        dataRow("تاريخ مطوَّل", fmt.dateLong("2026-10-05")),
        dataRow("تاريخ ووقت", fmt.dateTime("2026-10-05T14:30:00Z")),
        dataRow("وقت نسبي", fmt.relativeTime("2026-10-02T09:00:00Z")),
        dataRow("العمر", fmt.age("1998-05-10")),
        dataRow("هاتف", fmt.phone("01012345678")),
        dataRow("حجم ملف", fmt.fileSize(2_458_112)),
        dataRow("قيمة فارغة", fmt.currency(null)),
      ),
    }),

    card({
      title: "الأيقونات",
      subtitle: `${iconNames.length} أيقونة — SVG inline بدون مكتبات خارجية`,
      body: el(
        "div",
        { class: "grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-2" },
        ...iconNames.map((name) =>
          el(
            "div",
            {
              class:
                "flex flex-col items-center gap-1.5 p-2 rounded-[var(--radius-control)] " +
                "border border-line hover:border-brand-300 transition-colors",
              title: name,
            },
            el("span", { class: "text-muted" }, icon(name, { size: 19 })),
            el("span", { class: "text-[9px] text-faint font-mono truncate-1 w-full text-center" }, name),
          ),
        ),
      ),
    }),
  );
}

/* ========================================================================== */
/*  الأزرار والشرائح                                                           */
/* ========================================================================== */

function controlsTab() {
  return stack(
    card({
      title: "الأزرار",
      body: el(
        "div",
        { class: "space-y-5" },
        el(
          "div",
          {},
          sectionTitle("الأنواع"),
          canvas(
            button({ label: "أساسي", variant: "primary" }),
            button({ label: "ثانوي", variant: "secondary" }),
            button({ label: "شفاف", variant: "ghost" }),
            button({ label: "حذف", variant: "danger" }),
            button({ label: "حذف شفاف", variant: "danger-ghost" }),
            button({ label: "نجاح", variant: "success" }),
            button({ label: "رابط", variant: "link" }),
          ),
        ),
        el(
          "div",
          {},
          sectionTitle("المقاسات"),
          canvas(
            button({ label: "صغير", variant: "primary", size: "sm" }),
            button({ label: "متوسط", variant: "primary", size: "md" }),
            button({ label: "كبير", variant: "primary", size: "lg" }),
            iconButton("more", { label: "خيارات" }),
            iconButton("edit", { label: "تعديل", size: "icon-sm" }),
          ),
        ),
        el(
          "div",
          {},
          sectionTitle("مع أيقونات وحالات"),
          canvas(
            button({ label: "إضافة مريض", icon: "plus", variant: "primary" }),
            button({ label: "تصدير", icon: "download", variant: "secondary" }),
            button({ label: "طباعة", icon: "print", variant: "secondary" }),
            button({ label: "جاري الحفظ", variant: "primary", loading: true }),
            button({ label: "معطّل", variant: "primary", disabled: true }),
            button({ label: "التالي", iconAfter: "chevronEnd", variant: "secondary" }),
          ),
        ),
        el(
          "div",
          {},
          sectionTitle(
            "الأزرار المدركة للصلاحيات",
            `دورك الحالي: ${currentRole().label} — الزر الممنوع لا يُعرض معطّلاً، بل لا يُعرض أصلاً`,
          ),
          canvas(
            button({ label: "اعتماد خصم", variant: "primary", permission: "billing.discount.approve" }) ??
              badge("مخفي: billing.discount.approve", { tone: "muted" }),
            button({ label: "إغلاق فترة محاسبية", variant: "danger", permission: "accounting.period.close" }) ??
              badge("مخفي: accounting.period.close", { tone: "muted" }),
            button({ label: "إدارة الأدوار", variant: "secondary", permission: "roles.manage" }) ??
              badge("مخفي: roles.manage", { tone: "muted" }),
          ),
        ),
      ),
    }),

    card({
      title: "شرائح الحالة",
      subtitle: "كلها مسجَّلة في js/core/statuses.js — مصدر الحقيقة الوحيد للنص واللون",
      body: el(
        "div",
        { class: "flex flex-wrap gap-2" },
        ...Object.keys(STATUSES).map((key) => statusBadge(key)),
      ),
    }),

    card({
      title: "شرائح عامة وعدّادات",
      body: canvas(
        badge("محايد"),
        badge("معلومة", { tone: "info" }),
        badge("نجاح", { tone: "success" }),
        badge("تحذير", { tone: "warning" }),
        badge("خطر", { tone: "danger" }),
        badge("الهوية", { tone: "brand" }),
        badge("مع نقطة", { tone: "success", dot: true }),
        badge("صغير", { tone: "info", size: "sm" }),
        countBadge(12),
        countBadge(3, { tone: "danger" }),
      ),
    }),

    card({
      title: "التبويبات والشرائح المقسَّمة",
      body: el(
        "div",
        { class: "space-y-4" },
        segmentedControl({
          options: [
            { value: "all", label: "الكل", count: 236 },
            { value: "unpaid", label: "غير مدفوعة", count: 47 },
            { value: "partial", label: "مدفوعة جزئيًا", count: 52 },
            { value: "paid", label: "مدفوعة", count: 123 },
          ],
          onChange: (value) => toast.info(`الفلتر: ${value}`),
        }),
        el(
          "p",
          { class: "text-xs text-faint" },
          "التبويبات الرئيسية مستخدمة في هذه الصفحة نفسها — التبويب النشط يُكتب في معامل tab بالرابط.",
        ),
      ),
    }),

    card({
      title: "بطاقات المؤشرات",
      body: el(
        "div",
        { class: "space-y-3" },
        statGrid(
          statCard({
            label: "إجمالي المرضى",
            value: fmt.integer(148),
            icon: "patients",
            tone: "brand",
            trend: { direction: "up", label: "+8 هذا الشهر" },
          }),
          statCard({
            label: "تحصيلات الشهر",
            value: fmt.currency(486_250),
            icon: "money",
            tone: "success",
            hint: "مقابل 512,000 ج.م الشهر الماضي",
          }),
          statCard({
            label: "أرصدة مستحقة",
            value: fmt.currency(238_400),
            icon: "wallet",
            tone: "warning",
            hint: "47 فاتورة غير مسدَّدة",
          }),
          statCard({
            label: "أصناف نفدت",
            value: fmt.integer(9),
            icon: "inventory",
            tone: "danger",
            href: "#/inventory/items",
            hint: "اضغط للمراجعة",
          }),
        ),
        el("p", { class: "text-xs text-faint" }, "حالة التحميل:"),
        cardsSkeleton({ count: 4 }),
      ),
    }),
  );
}

/* ========================================================================== */
/*  النماذج                                                                    */
/* ========================================================================== */

function formsTab() {
  let governorateOptions = [];

  const governorateSelect = select({
    placeholder: "اختر المحافظة",
    options: [],
  });

  // القائمة المرجعية تُجلب من طبقة البيانات فعلًا — لا قيم مكتوبة في الشاشة.
  getGovernorates()
    .then((rows) => {
      governorateOptions = toOptions(rows);
      const control = governorateSelect.querySelector("select");
      for (const option of governorateOptions) {
        control.appendChild(el("option", { value: String(option.value) }, option.label));
      }
    })
    .catch(() => {
      governorateSelect.querySelector("select").appendChild(
        el("option", { value: "", disabled: true }, "تعذّر تحميل المحافظات"),
      );
    });

  return stack(
    card({
      title: "الحقول",
      subtitle: "كل حقل مُغلَّف بـ field() التي تربط التسمية ورسالة الخطأ بسمات aria",
      body: el(
        "div",
        {},
        formGrid(
          field({
            label: "اسم المريض",
            required: true,
            control: input({ placeholder: "الاسم الثلاثي" }),
          }),
          field({
            label: "رقم الموبايل",
            required: true,
            control: input({ type: "tel", placeholder: "01xxxxxxxxx", prefix: "user" }),
            hint: "11 رقمًا يبدأ بـ 010 أو 011 أو 012 أو 015",
          }),
          field({
            label: "الرقم القومي",
            control: input({ value: "29805100101234", invalid: true }),
            error: "الرقم القومي يجب أن يكون 14 رقمًا.",
          }),
          field({
            label: "المحافظة",
            control: governorateSelect,
          }),
          field({
            label: "تاريخ الميلاد",
            control: dateField({ value: "1998-05-10", max: "2026-10-05" }),
          }),
          field({
            label: "فصيلة الدم",
            control: select({
              placeholder: "غير محددة",
              options: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
            }),
          }),
          field({
            label: "قيمة الخدمة",
            control: moneyInput({ value: "1850" }),
            hint: "يُضاف رمز العملة تلقائيًا",
          }),
          field({
            label: "الكمية",
            control: quantityInput({ value: "12" }),
          }),
          field({
            label: "حقل معطّل",
            control: input({ value: "P-1001", disabled: true }),
          }),
          field({
            label: "حقل للقراءة فقط",
            control: input({ value: "INV-2026-0042", readOnly: true }),
          }),
        ),

        el(
          "div",
          { class: "mt-4" },
          field({
            label: "نطاق التاريخ",
            control: dateRangeField({ from: "2026-09-01", to: "2026-10-05" }),
            hint: "«إلى» لا يقبل تاريخًا أسبق من «من» — قيد في الواجهة لا رسالة خطأ",
          }),
        ),

        el(
          "div",
          { class: "mt-4" },
          field({
            label: "ملاحظات",
            control: textarea({ placeholder: "ملاحظات إضافية…", rows: 3 }),
          }),
        ),

        formSection({
          title: "خيارات",
          children: el(
            "div",
            { class: "grid gap-4 sm:grid-cols-2" },
            el(
              "div",
              { class: "space-y-2.5" },
              checkbox({ label: "مريض تأمين", checked: true, hint: "يُفعِّل حقول بيانات الشركة" }),
              checkbox({ label: "إرسال تأكيد بالرسائل النصية" }),
              checkbox({ label: "خيار معطّل", disabled: true }),
            ),
            el(
              "div",
              {},
              el("p", { class: "text-xs font-medium text-ink mb-2" }, "النوع"),
              radioGroup({
                name: "visit-type",
                value: "outpatient",
                options: [
                  { value: "outpatient", label: "عيادة خارجية" },
                  { value: "emergency", label: "طوارئ" },
                  { value: "inpatient", label: "إقامة داخلية" },
                ],
              }),
            ),
          ),
        }),

        el("div", { class: "mt-4 max-w-sm" }, searchInput({ placeholder: "بحث عن مريض بالاسم أو الكود…" })),

        formActions(
          button({
            label: "حفظ",
            variant: "primary",
            icon: "check",
            onClick: () =>
              toast.warning(
                "هذا نموذج عرض ولا يحفظ شيئًا — ولهذا لا تظهر رسالة «تم الحفظ بنجاح».",
              ),
          }),
          button({ label: "إلغاء", variant: "secondary" }),
        ),
      ),
    }),

    card({
      title: "ملخص أخطاء النموذج",
      subtitle: "يُعرض أعلى النماذج الطويلة لأن الحقل الخاطئ قد يكون خارج الشاشة",
      body: formErrorSummary(
        {
          name: "اسم المريض مطلوب.",
          phone: "رقم موبايل مصري غير صحيح (مثال: 01012345678).",
          dateOfBirth: "لا يمكن أن يكون التاريخ في المستقبل.",
        },
        { name: "اسم المريض", phone: "رقم الموبايل", dateOfBirth: "تاريخ الميلاد" },
      ),
    }),

    card({ title: "هيكل تحميل نموذج", body: formSkeleton({ fields: 4 }) }),
  );
}

/* ========================================================================== */
/*  التغذية الراجعة                                                            */
/* ========================================================================== */

function feedbackTab() {
  return stack(
    card({
      title: "الإشعارات المنبثقة",
      subtitle:
        "toast.success تُستدعى بعد نجاح العملية فعلًا — لا قبلها. الأخطاء لا تختفي تلقائيًا.",
      body: canvas(
        button({
          label: "نجاح",
          variant: "success",
          onClick: () => toast.success("تم حفظ بيانات المريض"),
        }),
        button({
          label: "خطأ",
          variant: "danger",
          onClick: () =>
            toast.error(
              new ApiError({
                code: ErrorCode.CONFLICT,
                status: 409,
                message: "رقم الفاتورة مستخدم بالفعل. حدّث الصفحة ثم أعد المحاولة.",
              }),
            ),
        }),
        button({ label: "تحذير", variant: "secondary", onClick: () => toast.warning("الفترة المحاسبية على وشك الإغلاق") }),
        button({ label: "معلومة", variant: "secondary", onClick: () => toast.info("تم تحديث القائمة") }),
        button({
          label: "مع إجراء",
          variant: "secondary",
          onClick: () =>
            toast.success("تم أرشفة المريض", {
              action: { label: "تراجع", onClick: () => toast.info("تم التراجع") },
            }),
        }),
      ),
    }),

    card({
      title: "التنبيهات داخل الصفحة",
      body: el(
        "div",
        { class: "space-y-3" },
        alert({ tone: "info", title: "معلومة", message: "آخر تحديث للأرصدة كان اليوم 09:00 صباحًا." }),
        alert({
          tone: "warning",
          title: "الفترة المحاسبية مغلقة",
          message: "لا يمكن ترحيل قيود بتاريخ سبتمبر 2026. اطلب من المحاسب إعادة فتح الفترة.",
        }),
        alert({
          tone: "danger",
          title: "تعذّر تسجيل الدفعة",
          message: "المبلغ المُدخل أكبر من الرصيد المتبقي على الفاتورة.",
        }),
        alert({ tone: "success", message: "تم ترحيل 14 قيدًا بنجاح." }),
        alert({
          tone: "neutral",
          message: "يمكنك إخفاء هذا التنبيه.",
          onDismiss: () => toast.info("تم إخفاء التنبيه"),
        }),
      ),
    }),

    card({
      title: "القاعدة الحرجة: التقارير غير المكتملة",
      subtitle: "docs/05-REPORTING-SPECIFICATION.md — ممنوع تصدير تقرير ناقص بصمت",
      body: el(
        "div",
        { class: "space-y-3" },
        reportIncompleteAlert(
          {
            failures: [
              { label: "المدفوعات", error: "تعذّر الاتصال بالخادم." },
              { label: "المرتجعات", error: "استغرق الطلب وقتًا أطول من المسموح." },
            ],
          },
          () => toast.info("إعادة تحميل الأقسام الفاشلة…"),
        ),
        el(
          "div",
          { class: "flex items-center gap-2" },
          button({ label: "تصدير PDF", icon: "download", variant: "primary", disabled: true }),
          button({ label: "تصدير Excel", icon: "download", variant: "secondary", disabled: true }),
          button({ label: "طباعة", icon: "print", variant: "secondary", disabled: true }),
          el(
            "span",
            { class: "text-xs text-danger-700" },
            "أزرار التصدير معطّلة لأن report.exportable = false",
          ),
        ),
      ),
    }),

    card({
      title: "النوافذ والأدراج ونوافذ التأكيد",
      body: canvas(
        button({
          label: "نافذة",
          variant: "secondary",
          onClick: () =>
            openModal({
              title: "تفاصيل الفاتورة INV-2026-0042",
              subtitle: "أحمد محمود خليل — P-1042",
              body: dataList(
                dataRow("التاريخ", fmt.date("2026-09-28")),
                dataRow("الإجمالي قبل الخصم", fmt.currency(4200)),
                dataRow("الخصم", fmt.currency(420)),
                dataRow("الإجمالي", fmt.currency(3780)),
                dataRow("المدفوع", fmt.currency(1890)),
                dataRow("المتبقي", fmt.currency(1890), { tone: "danger" }),
                dataRow("الحالة", statusBadge("partially_paid")),
              ),
              footer: (close) => [
                button({ label: "طباعة", icon: "print", variant: "primary" }),
                button({ label: "إغلاق", variant: "secondary", onClick: () => close() }),
              ],
            }),
        }),

        button({
          label: "درج جانبي",
          variant: "secondary",
          onClick: () =>
            openDrawer({
              title: "إضافة مريض",
              subtitle: "الدرج أنسب للنماذج الطويلة — يُبقي الجدول خلفه مرئيًا",
              body: formGrid(
                field({ label: "اسم المريض", required: true, control: input({ placeholder: "الاسم الثلاثي" }) }),
                field({ label: "رقم الموبايل", required: true, control: input({ type: "tel" }) }),
                field({ label: "تاريخ الميلاد", control: dateField() }),
                field({
                  label: "النوع",
                  control: select({ options: [{ value: "male", label: "ذكر" }, { value: "female", label: "أنثى" }] }),
                }),
              ),
              footer: (close) => [
                button({ label: "حفظ", variant: "primary", icon: "check" }),
                button({ label: "إلغاء", variant: "secondary", onClick: () => close() }),
              ],
            }),
        }),

        button({
          label: "تأكيد إجراء مُدمِّر",
          variant: "danger",
          onClick: async () => {
            const confirmed = await confirmAction({
              title: "أرشفة المريض؟",
              message: "لن يظهر المريض في القوائم الافتراضية، وتبقى فواتيره وسجله المالي كما هي.",
              detail: "السجلات المالية لا تُحذف من الواجهة أبدًا — أرشفة فقط.",
              confirmLabel: "أرشفة",
            });

            // الرسالة تُعرض بناءً على النتيجة الفعلية، لا بشكل تلقائي.
            if (confirmed) toast.success("تم أرشفة المريض");
            else toast.info("أُلغي الإجراء");
          },
        }),

        button({
          label: "تأكيد بكتابة نص",
          variant: "danger",
          onClick: async () => {
            const confirmed = await confirmAction({
              title: "إغلاق الفترة المحاسبية؟",
              message: "لا يمكن ترحيل أو تعديل أي قيد في هذه الفترة بعد إغلاقها.",
              confirmLabel: "إغلاق الفترة",
              confirmText: "إغلاق",
            });

            if (confirmed) toast.success("تم إغلاق الفترة المحاسبية");
          },
        }),
      ),
    }),

    card({
      title: "حالات التحميل والفراغ والخطأ",
      subtitle: "docs/09-DEFINITION-OF-DONE.md يشترط وجود الثلاثة في كل شاشة",
      body: el(
        "div",
        { class: "grid gap-4 lg:grid-cols-2" },
        el(
          "div",
          { class: "border border-line rounded-[var(--radius-control)] overflow-hidden" },
          el("p", { class: "px-3 py-2 text-xs font-medium text-muted bg-subtle border-b border-line" }, "تحميل — دوّارة"),
          loadingState({ compact: true }),
        ),
        el(
          "div",
          { class: "border border-line rounded-[var(--radius-control)] overflow-hidden" },
          el("p", { class: "px-3 py-2 text-xs font-medium text-muted bg-subtle border-b border-line" }, "تحميل — هيكل جدول"),
          tableSkeleton({ rows: 4, columns: 4 }),
        ),
        el(
          "div",
          { class: "border border-line rounded-[var(--radius-control)] overflow-hidden" },
          el("p", { class: "px-3 py-2 text-xs font-medium text-muted bg-subtle border-b border-line" }, "فراغ — لا بيانات بعد"),
          emptyState({
            compact: true,
            actions: button({ label: "إضافة مريض", icon: "plus", variant: "primary", size: "sm" }),
          }),
        ),
        el(
          "div",
          { class: "border border-line rounded-[var(--radius-control)] overflow-hidden" },
          el("p", { class: "px-3 py-2 text-xs font-medium text-muted bg-subtle border-b border-line" }, "فراغ — لا نتائج للفلتر"),
          emptyState({ compact: true, filtered: true, onClearFilters: () => toast.info("تم مسح الفلاتر") }),
        ),
        el(
          "div",
          { class: "border border-line rounded-[var(--radius-control)] overflow-hidden" },
          el("p", { class: "px-3 py-2 text-xs font-medium text-muted bg-subtle border-b border-line" }, "خطأ — قابل لإعادة المحاولة"),
          errorState({
            compact: true,
            error: new ApiError({ code: ErrorCode.NETWORK, message: "تعذّر الاتصال بالخادم." }),
            onRetry: () => toast.info("إعادة المحاولة…"),
          }),
        ),
        el(
          "div",
          { class: "border border-line rounded-[var(--radius-control)] overflow-hidden" },
          el("p", { class: "px-3 py-2 text-xs font-medium text-muted bg-subtle border-b border-line" }, "خطأ — غير منفَّذ"),
          errorState({
            compact: true,
            error: new ApiError({
              code: ErrorCode.NOT_IMPLEMENTED,
              status: 501,
              message: "هذه العملية غير منفّذة بعد في طبقة البيانات التجريبية (POST /invoices).",
            }),
          }),
        ),
      ),
    }),
  );
}

/* ========================================================================== */
/*  الجداول — على بيانات حقيقية من طبقة البيانات                                */
/* ========================================================================== */

function patientsTableTab() {
  const table = dataTable({
    id: "design-system-patients",
    searchPlaceholder: "بحث بالاسم أو الكود أو الهاتف…",
    // البحث والفلترة والترتيب والترقيم كلها تمر من الـ API لا من الذاكرة.
    fetch: listPatients,
    syncUrl: false,
    selectable: true,
    columns: [
      {
        key: "name",
        label: "المريض",
        sortable: true,
        alwaysVisible: true,
        render: (row) => twoLineCell(row.name, row.patientCode),
      },
      { key: "phone", label: "الهاتف", render: (row) => fmt.phone(row.phone) },
      {
        key: "gender",
        label: "النوع",
        width: "5rem",
        render: (row) => (row.gender === "female" ? "أنثى" : "ذكر"),
      },
      {
        key: "dateOfBirth",
        label: "العمر",
        width: "6rem",
        sortable: true,
        render: (row) => fmt.age(row.dateOfBirth),
      },
      { key: "governorate", label: "المحافظة", hidden: true },
      {
        key: "lastVisitAt",
        label: "آخر زيارة",
        sortable: true,
        render: (row) => fmt.date(row.lastVisitAt),
      },
      { key: "visitsCount", label: "الزيارات", numeric: true, sortable: true, width: "5.5rem" },
      {
        key: "outstandingBalance",
        label: "الرصيد المستحق",
        numeric: true,
        sortable: true,
        render: (row) =>
          row.outstandingBalance > 0
            ? el("span", { class: "text-danger-700 font-medium" }, fmt.amount(row.outstandingBalance))
            : el("span", { class: "text-faint" }, "—"),
      },
      {
        key: "status",
        label: "الحالة",
        width: "7rem",
        render: (row) => statusBadge(row.status),
      },
    ],
    filters: [
      {
        key: "status",
        label: "الحالة",
        options: [
          { value: "active", label: "نشط" },
          { value: "inactive", label: "غير نشط" },
          { value: "archived", label: "مؤرشف" },
        ],
      },
      {
        key: "gender",
        label: "النوع",
        options: [
          { value: "male", label: "ذكر" },
          { value: "female", label: "أنثى" },
        ],
      },
    ],
    toolbarActions: button({ label: "إضافة مريض", icon: "plus", variant: "primary", permission: "patients.create" }),
    rowActions: (row) =>
      el(
        "div",
        { class: "flex items-center gap-0.5" },
        iconButton("eye", { label: "عرض الملف", size: "icon-sm", onClick: () => toast.info(`عرض ملف ${row.name}`) }),
        iconButton("edit", { label: "تعديل", size: "icon-sm", permission: "patients.edit" }),
        iconButton("trash", {
          label: "أرشفة",
          size: "icon-sm",
          variant: "danger-ghost",
          permission: "patients.delete",
          onClick: async () => {
            const confirmed = await confirmAction({
              title: "أرشفة المريض؟",
              message: `سيُؤرشف «${row.name}». تبقى فواتيره وسجله المالي كما هي.`,
              confirmLabel: "أرشفة",
            });
            if (confirmed) toast.warning("الأرشفة غير مُنفَّذة في هذا العرض — ولهذا لا تظهر رسالة نجاح.");
          },
        }),
      ),
    bulkActions: (selected) =>
      buttonGroup(
        button({
          label: `تصدير ${selected.length}`,
          icon: "download",
          variant: "secondary",
          size: "sm",
          onClick: () => toast.info(`تصدير ${selected.length} سجل`),
        }),
      ),
    onRowClick: (row) => toast.info(`فتح ملف ${row.name} (${row.patientCode})`),
  });

  return stack(
    alert({
      tone: "info",
      title: "هذا جدول حقيقي لا صورة",
      message:
        "البيانات تُجلب من js/api/patients.api.js ← http.js ← mock-adapter.js. البحث والفلترة " +
        "والترتيب والترقيم كلها تُنفَّذ في طبقة البيانات، تمامًا كما ستفعل مع API حقيقي. " +
        "جرّب البحث بـ «احمد» — يطابق «أحمد» لأن البحث العربي مُطبَّع.",
    }),
    table.element,
  );
}

function invoicesTableTab() {
  const table = dataTable({
    id: "design-system-invoices",
    searchPlaceholder: "بحث برقم الفاتورة أو اسم المريض…",
    fetch: listInvoices,
    syncUrl: false,
    initialParams: { sort: "date", order: "desc" },
    columns: [
      { key: "invoiceNumber", label: "رقم الفاتورة", sortable: true, alwaysVisible: true },
      {
        key: "patientName",
        label: "المريض",
        render: (row) => twoLineCell(row.patientName, row.patientCode),
      },
      { key: "date", label: "التاريخ", sortable: true, render: (row) => fmt.date(row.date) },
      { key: "doctorName", label: "الطبيب", hidden: true },
      { key: "subtotal", label: "قبل الخصم", numeric: true, hidden: true, render: (row) => fmt.amount(row.subtotal) },
      { key: "discount", label: "الخصم", numeric: true, render: (row) => fmt.amount(row.discount) },
      { key: "total", label: "الإجمالي", numeric: true, sortable: true, render: (row) => fmt.amount(row.total) },
      { key: "paid", label: "المدفوع", numeric: true, render: (row) => fmt.amount(row.paid) },
      {
        key: "remaining",
        label: "المتبقي",
        numeric: true,
        sortable: true,
        render: (row) =>
          row.remaining > 0
            ? el("span", { class: "text-danger-700 font-medium" }, fmt.amount(row.remaining))
            : el("span", { class: "text-faint" }, "—"),
      },
      { key: "status", label: "الحالة", width: "8rem", render: (row) => statusBadge(row.status) },
      {
        key: "etaStatus",
        label: "الفاتورة الإلكترونية",
        width: "9rem",
        hidden: true,
        render: (row) => statusBadge(row.etaStatus, { size: "sm" }),
      },
    ],
    filters: [
      {
        key: "status",
        label: "حالة السداد",
        options: [
          { value: "paid", label: "مدفوعة" },
          { value: "partially_paid", label: "مدفوعة جزئيًا" },
          { value: "unpaid", label: "غير مدفوعة" },
          { value: "cancelled", label: "ملغاة" },
        ],
      },
    ],
    // المجاميع للصفحة المعروضة فقط — المجموع الكلي يحتاج طلبًا مخصصًا من الخادم.
    summaryRow: (rows) =>
      summaryCells([
        { value: `مجموع الصفحة (${rows.length})`, colspan: 3 },
        { value: fmt.amount(rows.reduce((total, row) => total + row.discount, 0)), numeric: true },
        { value: fmt.amount(rows.reduce((total, row) => total + row.total, 0)), numeric: true },
        { value: fmt.amount(rows.reduce((total, row) => total + row.paid, 0)), numeric: true },
        { value: fmt.amount(rows.reduce((total, row) => total + row.remaining, 0)), numeric: true },
        { value: "" },
      ]),
    rowActions: (row) =>
      iconButton("eye", {
        label: "عرض",
        size: "icon-sm",
        onClick: () => toast.info(`عرض الفاتورة ${row.invoiceNumber}`),
      }),
  });

  return stack(
    alert({
      tone: "info",
      title: "أعمدة مالية",
      message:
        "الأرقام بعرض ثابت ومحاذاة نهاية حتى تُقرأ الأعمدة عموديًا. صف المجاميع يُحسب للصفحة " +
        "المعروضة — المجموع الكلي يحتاج طلبًا مخصصًا من الخادم، وهو ما سيوفّره الباك-إند. " +
        "جرّب قائمة الأعمدة لإظهار «الطبيب» و«الفاتورة الإلكترونية».",
    }),
    table.element,
  );
}

/* ========================================================================== */
/*  طبقة البيانات والصلاحيات                                                   */
/* ========================================================================== */

function dataLayerTab() {
  const endpoints = registeredEndpoints();
  const role = currentRole();
  const grantedPermissions = effectivePermissions();

  return stack(
    card({
      title: "نقطة التبديل إلى باك-إند حقيقي",
      body: el(
        "div",
        { class: "space-y-3" },
        el(
          "p",
          { class: "text-sm text-muted leading-relaxed" },
          "كل طلب في التطبيق يمر من js/api/http.js. تحويل الواجهة إلى API حقيقي يحتاج " +
            "تعديل حقلين في js/core/config.js — ولا تعديل في أي شاشة أو مكوّن.",
        ),
        el(
          "pre",
          {
            class:
              "text-xs font-mono bg-rail text-rail-text p-3.5 rounded-[var(--radius-control)] " +
              "overflow-x-auto [direction:ltr] text-start leading-relaxed",
          },
          `export const API = {\n  mode: "live",        // كان "mock"\n  baseUrl: "/api/v1",\n  timeoutMs: 20000,\n};`,
        ),
      ),
    }),

    card({
      title: `الـ endpoints المتوقَّعة (${endpoints.length})`,
      subtitle:
        "هذه هي قائمة المسارات التي تتوقعها الواجهة فعلًا. أي مسار غير مسجَّل يرمي NOT_IMPLEMENTED بدل نجاح وهمي.",
      body: el(
        "div",
        { class: "grid gap-1 sm:grid-cols-2" },
        ...endpoints.map((endpoint) => {
          const [method, ...rest] = endpoint.split(" ");
          const methodTone = { GET: "info", POST: "success", PUT: "warning", DELETE: "danger" }[method] ?? "neutral";

          return el(
            "div",
            { class: "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-subtle" },
            badge(method, { tone: methodTone, size: "sm" }),
            el(
              "code",
              { class: "text-xs font-mono text-muted [direction:ltr] text-start truncate-1" },
              rest.join(" "),
            ),
          );
        }),
      ),
    }),

    card({
      title: "عقد الاستجابة",
      body: el(
        "div",
        { class: "grid gap-4 lg:grid-cols-2" },
        el(
          "div",
          {},
          el("p", { class: "text-xs font-medium text-ink mb-1.5" }, "قائمة مُرقَّمة"),
          el(
            "pre",
            {
              class:
                "text-[11px] font-mono bg-subtle border border-line p-3 rounded-[var(--radius-control)] " +
                "overflow-x-auto [direction:ltr] text-start leading-relaxed",
            },
            `{\n  "data": [ … ],\n  "meta": {\n    "page": 1,\n    "perPage": 25,\n    "total": 148,\n    "totalPages": 6\n  }\n}`,
          ),
        ),
        el(
          "div",
          {},
          el("p", { class: "text-xs font-medium text-ink mb-1.5" }, "خطأ"),
          el(
            "pre",
            {
              class:
                "text-[11px] font-mono bg-subtle border border-line p-3 rounded-[var(--radius-control)] " +
                "overflow-x-auto [direction:ltr] text-start leading-relaxed",
            },
            `{\n  "error": {\n    "code": "VALIDATION_ERROR",\n    "message": "راجع الحقول المظلَّلة.",\n    "fields": {\n      "phone": "رقم غير صحيح."\n    }\n  }\n}`,
          ),
        ),
      ),
    }),

    card({
      title: `الصلاحيات — دورك: ${role.label}`,
      subtitle: `${grantedPermissions.length} من ${Object.keys(PERMISSIONS).length} صلاحية. بدّل الدور من الهيدر لترى أثر ذلك على الواجهة.`,
      body: el(
        "div",
        { class: "grid gap-1 sm:grid-cols-2 lg:grid-cols-3 max-h-96 overflow-y-auto" },
        ...Object.entries(PERMISSIONS).map(([key, label]) => {
          const isGranted = grantedPermissions.includes(key);

          return el(
            "div",
            {
              class: cx(
                "flex items-center gap-2 px-2 py-1.5 rounded text-xs",
                isGranted ? "text-ink" : "text-faint",
              ),
            },
            el(
              "span",
              { class: isGranted ? "text-success-600" : "text-line-strong" },
              icon(isGranted ? "check" : "close", { size: 13 }),
            ),
            el("span", { class: "truncate-1 flex-1" }, label),
            el("code", { class: "text-[10px] font-mono text-faint [direction:ltr] hidden lg:inline" }, key),
          );
        }),
      ),
    }),
  );
}

/* ========================================================================== */

export default function designSystemPage({ query }) {
  const { element: tabsElement } = tabs({
    active: query?.tab,
    tabs: [
      { key: "tokens", label: "الألوان والخطوط", icon: "palette", render: tokensTab },
      { key: "controls", label: "الأزرار والشرائح", icon: "dashboard", render: controlsTab },
      { key: "forms", label: "النماذج", icon: "edit", render: formsTab },
      { key: "feedback", label: "التغذية الراجعة", icon: "bell", render: feedbackTab },
      { key: "patients", label: "جدول المرضى", icon: "patients", render: patientsTableTab },
      { key: "invoices", label: "جدول الفواتير", icon: "billing", render: invoicesTableTab },
      { key: "data", label: "طبقة البيانات", icon: "code", render: dataLayerTab },
    ],
  });

  return el(
    "div",
    {},
    pageHeader({
      title: "نظام التصميم",
      description:
        "توثيق حيّ لمخرجات المرحلة 0 — كل مكوّن بحالاته، في RTL، وبمقاسات حقيقية.",
      meta: [badge("المرحلة 0 — الأساس", { tone: "success", dot: true })],
    }),
    tabsElement,
  );
}

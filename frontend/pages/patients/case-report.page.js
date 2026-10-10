/**
/**
 * تقرير ملف وبحث الحالة الشامل (Case Dossier & Investigation Report)
 * مطابقة تامة 100% لملف PDF المستخرج من المنظومة (CASE-43356)
 */

import { el, cx } from "../../js/core/dom.js";
import { icon } from "../../components/common/icon.js";
import { button } from "../../components/common/button.js";
import { toast } from "../../components/feedback/toast.js";

export default function caseReportPage() {
  const container = el("div", { class: "space-y-6" });

  /* --------------------------------------------------------------------------
     شريط الأدوات العلوي (للمعاينة والطباعة — يُخفى عند الطباعة)
     -------------------------------------------------------------------------- */
  const toolbar = el(
    "div",
    {
      class:
        "no-print glass-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-card",
    },
    el(
      "div",
      { class: "flex items-center gap-3" },
      button({
        label: "رجوع",
        icon: "chevronStart",
        variant: "secondary",
        size: "sm",
        onClick: () => window.history.back(),
      }),
      el(
        "div",
        {},
        el(
          "h1",
          { class: "text-base font-extrabold text-slate-900 dark:text-white" },
          "تقرير وملف الحالة: CASE-43356 — جمال عثمان ابراهيم شعبان",
        ),
        el(
          "p",
          { class: "text-xs text-slate-500 dark:text-slate-400" },
          "وثيقة رسمية متعددة الصفحات (3 صفحات A4) مجهزة للطباعة والحفظ كملف PDF",
        ),
      ),
    ),
    el(
      "div",
      { class: "flex items-center gap-2" },
      button({
        label: "طباعة التقرير (Print / PDF)",
        icon: "print",
        variant: "primary",
        size: "sm",
        onClick: () => window.print(),
      }),
      button({
        label: "تحميل التقرير",
        icon: "download",
        variant: "secondary",
        size: "sm",
        onClick: () => {
          toast.info("جاري تجهيز نسخة PDF للتحميل...");
          window.print();
        },
      }),
    ),
  );
  container.appendChild(toolbar);

  /* --------------------------------------------------------------------------
     الحاوية الرئيسية للصفحات الثلاث (A4 Sheets Container)
     -------------------------------------------------------------------------- */
  const pagesContainer = el("div", { class: "space-y-8" });

  pagesContainer.appendChild(renderPage1());
  pagesContainer.appendChild(renderPage2());
  pagesContainer.appendChild(renderPage3());

  container.appendChild(pagesContainer);
  return container;
}

/* ============================================================================
   الهيدر والتذييل الموحد لكل صفحة
   ============================================================================ */

function renderHeader() {
  return el(
    "header",
    { class: "border-b border-slate-300 pb-2.5 mb-3" },
    el(
      "div",
      { class: "flex items-start justify-between gap-4" },
      // جهة اليمين: عنوان المؤسسة والترخيص
      el(
        "div",
        { class: "text-right" },
        el("h1", { class: "text-xl font-black text-slate-900 tracking-tight leading-snug" }, "مؤسسة نهضة بني سويف"),
        el("p", { class: "text-[11px] font-bold text-slate-600 mt-0.5" }, "المشهرة برقم 1079 لسنة 2009"),
      ),
      // جهة اليسار: الشعار والشعار اللفظي
      el(
        "div",
        { class: "flex flex-col items-center shrink-0" },
        el(
          "span",
          {
            class:
              "relative grid place-items-center size-12 rounded-xl bg-slate-50 border border-slate-200/80 p-1 shadow-2xs",
          },
          el("img", {
            src: "assets/logo.png",
            alt: "Logo",
            class: "size-full object-contain",
            onError: (e) => {
              e.target.style.display = "none";
            },
          }),
        ),
        el("span", { class: "text-[10px] font-black text-emerald-700 mt-1" }, "لست وحدك نحن معك"),
      ),
    ),
    // الشريط الأفقي العلوي (رقم الملف / تاريخ الإنشاء / تاريخ التصدير)
    el(
      "div",
      {
        class:
          "grid grid-cols-3 gap-2 mt-2 py-1.5 px-3 rounded-lg border border-slate-300 bg-slate-50/80 text-[11px] font-bold text-slate-700",
      },
      el("div", { class: "text-right" }, "رقم الملف / الحالة: ", el("span", { class: "font-mono font-black text-slate-900" }, "CASE-43356")),
      el("div", { class: "text-center" }, "تاريخ إنشاء الملف: ", el("span", { class: "tabular font-black text-slate-900" }, "21/05/2026")),
      el("div", { class: "text-left" }, "تاريخ تصدير التقرير: ", el("span", { class: "tabular font-black text-slate-900" }, "06/10/2026 — 10:24 م")),
    ),
  );
}

function renderFooter(pageNumber, totalPages = 3) {
  return el(
    "footer",
    {
      class:
        "pt-2.5 mt-auto border-t border-slate-300 flex items-center justify-between text-[11px] font-bold text-slate-600",
    },
    // اسم المؤسسة
    el("div", {}, "مؤسسة نهضة بني سويف"),
    // رقم الصفحة والتاريخ
    el("div", { class: "tabular font-semibold" }, `صفحة ${pageNumber} من ${totalPages} — 06/10/2026 — 10:24 م`),
    // الشعار التقني (DevX فقط، بدون Delmon إطلاقاً!)
    el(
      "div",
      { class: "flex items-center gap-1.5" },
      el("img", {
        src: "assets/devx_logo.jpg",
        alt: "DevX",
        class: "h-4 rounded object-contain border border-slate-200",
        onError: (e) => {
          e.target.style.display = "none";
        },
      }),
    ),
  );
}

/* ============================================================================
   الصفحة 1 (Page 1)
   ============================================================================ */

function renderPage1() {
  const page = el(
    "section",
    {
      class:
        "case-sheet max-w-[840px] mx-auto p-8 border border-slate-200/90 flex flex-col justify-between text-xs space-y-4",
    },
    renderHeader(),

    el(
      "div",
      { class: "space-y-3.5 flex-1" },

      // كرت: بيانات الحالة
      el(
        "div",
        { class: "rounded-xl border border-slate-300 bg-slate-50/50 p-3.5 space-y-2.5" },
        el(
          "div",
          { class: "flex items-center justify-between border-b border-slate-200 pb-2" },
          el(
            "div",
            { class: "flex items-center gap-2 font-bold text-slate-900" },
            icon("fileText", { size: 16, class: "text-blue-600" }),
            el("span", {}, "بيانات الحالة"),
          ),
          el(
            "span",
            {
              class:
                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100/80 text-blue-700 border border-blue-200",
            },
            el("span", { class: "size-1.5 rounded-full bg-blue-600 inline-block" }),
            "قيد المراجعة",
          ),
        ),
        // شبكة البيانات
        el(
          "div",
          { class: "grid grid-cols-1 sm:grid-cols-3 gap-y-2.5 gap-x-4 text-[11.5px]" },
          el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "اسم المستفيد: "), el("span", { class: "font-black text-slate-900" }, "جمال عثمان ابراهيم شعبان")),
          el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "الرقم القومي: "), el("span", { class: "font-mono font-black text-slate-900 tabular" }, "27512272200419")),
          el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "الديانة: "), el("span", { class: "font-bold text-slate-900" }, "مسلم")),
          el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "المحافظة / المركز: "), el("span", { class: "font-bold text-slate-900" }, "سمسطا")),
          el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "القرية / المنطقة: "), el("span", { class: "font-bold text-slate-900" }, "منشاه ابو مليح")),
          el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "الجمعية الشريكة: "), el("span", { class: "font-bold text-slate-900" }, "إبداء بنفسك - منشاه ابو مليح")),
        ),
      ),

      // شريط: الباحث الأصلي
      el(
        "div",
        {
          class:
            "flex items-center justify-center gap-2 p-2 rounded-lg border border-blue-200 bg-blue-50/60 text-blue-900 font-extrabold text-xs",
        },
        icon("user", { size: 15, class: "text-blue-600" }),
        el("span", {}, "الباحث الأصلي لهذه الحالة: احمد جمعه"),
      ),

      // القسم الأول — البيانات الشخصية للمستفيد
      el(
        "div",
        { class: "rounded-xl border border-slate-300 p-3.5 space-y-2.5" },
        el(
          "div",
          { class: "flex items-center gap-2 font-black text-slate-900 border-b border-slate-200 pb-2 text-xs" },
          icon("user", { size: 15, class: "text-blue-600" }),
          el("span", {}, "القسم الأول — البيانات الشخصية للمستفيد"),
        ),
        el(
          "div",
          { class: "grid grid-cols-1 sm:grid-cols-3 gap-y-2.5 gap-x-4 text-[11.5px]" },
          el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "السن / العمر: "), el("span", { class: "font-bold text-slate-900" }, "50 سنة")),
          el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "النوع: "), el("span", { class: "font-bold text-slate-900" }, "ذكر")),
          el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "الحالة الاجتماعية: "), el("span", { class: "font-bold text-slate-900" }, "—")),

          el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "المؤهل الدراسي: "), el("span", { class: "font-bold text-slate-900" }, "—")),
          el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "المهنة / العمل: "), el("span", { class: "font-bold text-slate-900" }, "عامل باليومية في الفلاحه")),
          el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "الهاتف الأساسي: "), el("span", { class: "font-mono font-bold text-slate-900 tabular" }, "01201113447")),

          el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "الهاتف البديل: "), el("span", { class: "font-bold text-slate-900" }, "—")),
          el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "تكافل وكرامة: "), el("span", { class: "font-bold text-slate-900" }, "نعم (700 ج.م)")),
          el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "الحالة الصحية: "), el("span", { class: "font-bold text-slate-900" }, "—")),

          el(
            "div",
            { class: "sm:col-span-3 pt-1 border-t border-slate-100" },
            el("span", { class: "text-slate-500 font-semibold" }, "العنوان بالتفصيل: "),
            el("span", { class: "font-bold text-slate-900" }, "بجوار ماكينه الطحين"),
          ),
        ),
      ),

      // القسم الثاني — بيانات أفراد الأسرة التابعين
      el(
        "div",
        { class: "rounded-xl border border-slate-300 p-3.5 space-y-2.5" },
        el(
          "div",
          { class: "flex items-center justify-between border-b border-slate-200 pb-2" },
          el(
            "div",
            { class: "flex items-center gap-2 font-black text-slate-900 text-xs" },
            icon("users", { size: 15, class: "text-blue-600" }),
            el("span", {}, "القسم الثاني — بيانات أفراد الأسرة التابعين"),
          ),
          el(
            "span",
            {
              class:
                "px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100/80 text-blue-700 border border-blue-200 tabular",
            },
            "5 فرد",
          ),
        ),
        // جدول أفراد الأسرة
        el(
          "div",
          { class: "overflow-x-auto" },
          el(
            "table",
            { class: "w-full border-collapse text-[10.5px] text-center border border-slate-300" },
            el(
              "thead",
              { class: "bg-slate-100 font-bold text-slate-800" },
              el(
                "tr",
                {},
                el("th", { class: "border border-slate-300 p-1.5" }, "الاسم"),
                el("th", { class: "border border-slate-300 p-1.5" }, "صلة القرابة"),
                el("th", { class: "border border-slate-300 p-1.5" }, "الرقم القومي"),
                el("th", { class: "border border-slate-300 p-1.5" }, "السن"),
                el("th", { class: "border border-slate-300 p-1.5" }, "النوع"),
                el("th", { class: "border border-slate-300 p-1.5" }, "التعليم / المرحلة"),
                el("th", { class: "border border-slate-300 p-1.5" }, "العمل / الدخل"),
                el("th", { class: "border border-slate-300 p-1.5" }, "تكافل وكرامة"),
                el("th", { class: "border border-slate-300 p-1.5" }, "الأمراض"),
                el("th", { class: "border border-slate-300 p-1.5" }, "ملاحظات"),
              ),
            ),
            el(
              "tbody",
              { class: "divide-y divide-slate-200 text-slate-900 font-medium" },
              renderFamilyRow("فاطمه على مبروك محمد", "زوجة", "27903072200201", "47 سنة", "أنثى", "—", "—", "لا", "—", "—"),
              renderFamilyRow("اميره جمال عثمان", "ابنة", "30804122201186", "18 سنة", "أنثى", "طالب — ثانوية — الصف الثالث", "—", "لا", "—", "—"),
              renderFamilyRow("اماني جمال عثمان", "ابنة", "31001232200523", "16 سنة", "أنثى", "طالب — ثانوية — الصف الأول", "—", "لا", "—", "—"),
              renderFamilyRow("اسراء جمال عثمان", "ابنة", "31211082201881", "13 سنة", "أنثى", "طالب — إعدادية — الصف الثاني", "—", "لا", "—", "—"),
              renderFamilyRow("عثمان جمال عثمان", "ابن", "30407121220117", "22 سنة", "ذكر", "حاصل على دبلوم", "— (2,000 ج.م)", "لا", "—", "—"),
            ),
          ),
        ),
      ),
    ),

    renderFooter(1, 3),
  );
  return page;
}

function renderFamilyRow(name, relation, nid, age, gender, edu, job, tk, disease, notes) {
  return el(
    "tr",
    { class: "hover:bg-slate-50 transition-colors" },
    el("td", { class: "border border-slate-300 p-1 text-right font-bold" }, name),
    el("td", { class: "border border-slate-300 p-1" }, relation),
    el("td", { class: "border border-slate-300 p-1 font-mono tabular" }, nid),
    el("td", { class: "border border-slate-300 p-1 tabular" }, age),
    el("td", { class: "border border-slate-300 p-1" }, gender),
    el("td", { class: "border border-slate-300 p-1" }, edu),
    el("td", { class: "border border-slate-300 p-1" }, job),
    el("td", { class: "border border-slate-300 p-1" }, tk),
    el("td", { class: "border border-slate-300 p-1" }, disease),
    el("td", { class: "border border-slate-300 p-1" }, notes),
  );
}

/* ============================================================================
   الصفحة 2 (Page 2)
   ============================================================================ */

function renderPage2() {
  const page = el(
    "section",
    {
      class:
        "case-sheet max-w-[840px] mx-auto p-8 border border-slate-200/90 flex flex-col justify-between text-xs space-y-4",
    },
    renderHeader(),

    el(
      "div",
      { class: "space-y-4 flex-1" },

      // القسم الثالث — بيانات السكن والمرافق والتجهيزات والأصول
      el(
        "div",
        { class: "rounded-xl border border-slate-300 p-3.5 space-y-3" },
        el(
          "div",
          { class: "flex items-center gap-2 font-black text-slate-900 border-b border-slate-200 pb-2 text-xs" },
          icon("building", { size: 15, class: "text-blue-600" }),
          el("span", {}, "القسم الثالث — بيانات السكن والمرافق والتجهيزات والأصول"),
        ),

        // بيانات المسكن
        el(
          "div",
          { class: "space-y-1.5" },
          el("h3", { class: "text-[11px] font-bold text-slate-700 underline" }, "بيانات المسكن"),
          el(
            "div",
            { class: "grid grid-cols-1 sm:grid-cols-3 gap-y-2 gap-x-4 text-[11px]" },
            el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "طبيعة السكن: "), el("span", { class: "font-bold text-slate-900" }, "خاص")),
            el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "نوع المبنى: "), el("span", { class: "font-bold text-slate-900" }, "—")),
            el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "نوع الحوائط: "), el("span", { class: "font-bold text-slate-900" }, "محارة")),

            el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "السقف: "), el("span", { class: "font-bold text-slate-900" }, "مسلح")),
            el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "الأرضية: "), el("span", { class: "font-bold text-slate-900" }, "أسمنت")),
            el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "عدد الغرف: "), el("span", { class: "font-bold text-slate-900" }, "—")),

            el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "دورات المياه: "), el("span", { class: "font-bold text-slate-900" }, "ادمي")),
            el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "الصرف الصحي: "), el("span", { class: "font-bold text-slate-900" }, "—")),
            el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "المياه: "), el("span", { class: "font-bold text-slate-900" }, "عداد")),

            el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "الكهرباء: "), el("span", { class: "font-bold text-slate-900" }, "عداد")),
            el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "موتور مياه: "), el("span", { class: "font-bold text-slate-900" }, "لا")),
            el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "الإنترنت: "), el("span", { class: "font-bold text-slate-900" }, "لا")),

            el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "المدخل: "), el("span", { class: "font-bold text-slate-900" }, "أسمنت")),
            el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "وسيلة المواصلات: "), el("span", { class: "font-bold text-slate-900" }, "—")),
          ),
        ),

        // وصف السكن
        el(
          "div",
          { class: "space-y-1 pt-2 border-t border-slate-200" },
          el("h3", { class: "text-[11px] font-bold text-slate-700 underline" }, "وصف السكن"),
          el(
            "p",
            { class: "text-[11.5px] leading-relaxed text-slate-800 p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-medium" },
            "منزل خاص دورين الدور الأول غرفه بها اتنين كنبه وتلفزيون وثلاجة. مرحاض قاعده عاديه. غرفه بها سرير ودولاب. غرفه بها اتنين سرير ودولاب. مطبخ به بوتاجاز خمسه شعله ومطبخ خشب..غرفه بها مسطبه الدور الثاني بدون تشطيب",
          ),
        ),

        // الأجهزة والممتلكات المنزلية
        el(
          "div",
          { class: "space-y-1.5 pt-2 border-t border-slate-200" },
          el("h3", { class: "text-[11px] font-bold text-slate-700 underline" }, "الأجهزة والممتلكات المنزلية"),
          el(
            "div",
            { class: "flex items-center gap-2 flex-wrap" },
            el("span", { class: "px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[11px]" }, "✓ التلفاز"),
            el("span", { class: "px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[11px]" }, "✓ أجهزة الطبخ"),
            el("span", { class: "px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[11px]" }, "✓ الغسالة"),
          ),
        ),

        // الحيازة الزراعية والأصول
        el(
          "div",
          { class: "space-y-1.5 pt-2 border-t border-slate-200" },
          el("h3", { class: "text-[11px] font-bold text-slate-700 underline" }, "الحيازة الزراعية والأصول"),
          el(
            "div",
            { class: "flex items-center gap-6 text-[11px]" },
            el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "حيازة أرض زراعية: "), el("span", { class: "font-bold text-slate-900" }, "لا")),
            el("div", {}, el("span", { class: "text-slate-500 font-semibold" }, "حيازة مواشي ودواجن: "), el("span", { class: "font-bold text-slate-900" }, "لا")),
          ),
        ),
      ),

      // القسم الرابع — البيانات الاقتصادية والمالية
      el(
        "div",
        { class: "rounded-xl border border-slate-300 p-3.5 space-y-3" },
        el(
          "div",
          { class: "flex items-center gap-2 font-black text-slate-900 border-b border-slate-200 pb-2 text-xs" },
          icon("money", { size: 15, class: "text-blue-600" }),
          el("span", {}, "القسم الرابع — البيانات الاقتصادية والمالية"),
        ),

        // جدولين متجاورين (الدخل والمصروفات)
        el(
          "div",
          { class: "grid grid-cols-1 sm:grid-cols-2 gap-4" },

          // مصادر الدخل الشهري
          el(
            "div",
            { class: "space-y-1.5" },
            el("h4", { class: "text-[11px] font-bold text-slate-700 underline" }, "مصادر الدخل الشهري"),
            el(
              "table",
              { class: "w-full border-collapse text-[10.5px] border border-slate-300 text-center" },
              el(
                "thead",
                { class: "bg-slate-100 font-bold text-slate-800" },
                el(
                  "tr",
                  {},
                  el("th", { class: "border border-slate-300 p-1 text-right" }, "البند / المصدر"),
                  el("th", { class: "border border-slate-300 p-1" }, "المبلغ"),
                  el("th", { class: "border border-slate-300 p-1" }, "الدورية"),
                ),
              ),
              el(
                "tbody",
                { class: "divide-y divide-slate-200 font-medium" },
                renderFinanceRow("دخل رب الأسرة (من بيانات رب الأسرة)", "6,000 ج.م", "شهري", "text-emerald-700"),
                renderFinanceRow("تكافل وكرامة (من بيانات الأسرة)", "700 ج.م", "شهري", "text-emerald-700"),
                renderFinanceRow("دخل أفراد الأسرة", "2,000 ج.م", "شهري", "text-emerald-700"),
              ),
            ),
          ),

          // بنود المصروفات الشهرية
          el(
            "div",
            { class: "space-y-1.5" },
            el("h4", { class: "text-[11px] font-bold text-slate-700 underline" }, "بنود المصروفات الشهرية"),
            el(
              "table",
              { class: "w-full border-collapse text-[10.5px] border border-slate-300 text-center" },
              el(
                "thead",
                { class: "bg-slate-100 font-bold text-slate-800" },
                el(
                  "tr",
                  {},
                  el("th", { class: "border border-slate-300 p-1 text-right" }, "نوع المصروف"),
                  el("th", { class: "border border-slate-300 p-1" }, "المبلغ"),
                  el("th", { class: "border border-slate-300 p-1" }, "الدورية"),
                ),
              ),
              el(
                "tbody",
                { class: "divide-y divide-slate-200 font-medium" },
                renderFinanceRow("الأكل والشرب", "6,000 ج.م", "شهري", "text-rose-700"),
                renderFinanceRow("العلاج الشهري", "250 ج.م", "شهري", "text-rose-700"),
                renderFinanceRow("الكهرباء، المياه، الغاز", "720 ج.م", "شهري", "text-rose-700"),
                renderFinanceRow("المصروفات الدراسية", "2,000 ج.م", "شهري", "text-rose-700"),
              ),
            ),
          ),
        ),

        // بطاقات الإجماليات الثلاث
        el(
          "div",
          { class: "grid grid-cols-3 gap-3 pt-2 text-center" },
          el(
            "div",
            { class: "p-2.5 rounded-xl border border-emerald-300 bg-emerald-50/50" },
            el("p", { class: "text-[10px] font-bold text-slate-600" }, "إجمالي الدخل الشهري"),
            el("p", { class: "text-sm sm:text-base font-black text-emerald-700 mt-0.5 tabular" }, "8,700 ج.م"),
          ),
          el(
            "div",
            { class: "p-2.5 rounded-xl border border-rose-300 bg-rose-50/50" },
            el("p", { class: "text-[10px] font-bold text-slate-600" }, "إجمالي المصروفات الشهرية"),
            el("p", { class: "text-sm sm:text-base font-black text-rose-700 mt-0.5 tabular" }, "8,970 ج.م"),
          ),
          el(
            "div",
            { class: "p-2.5 rounded-xl border border-red-400 bg-red-50/60" },
            el("p", { class: "text-[10px] font-bold text-slate-600" }, "العجز الشهري"),
            el("p", { class: "text-sm sm:text-base font-black text-red-600 mt-0.5 tabular" }, "-270 ج.م"),
          ),
        ),
      ),
    ),

    renderFooter(2, 3),
  );
  return page;
}

function renderFinanceRow(name, amount, period, amountClass) {
  return el(
    "tr",
    {},
    el("td", { class: "border border-slate-300 p-1 text-right font-medium" }, name),
    el("td", { class: cx("border border-slate-300 p-1 font-bold tabular", amountClass) }, amount),
    el("td", { class: "border border-slate-300 p-1 text-slate-600" }, period),
  );
}

/* ============================================================================
   الصفحة 3 (Page 3)
   ============================================================================ */

function renderPage3() {
  const page = el(
    "section",
    {
      class:
        "case-sheet case-sheet-last max-w-[840px] mx-auto p-8 border border-slate-200/90 flex flex-col justify-between text-xs space-y-4",
    },
    renderHeader(),

    el(
      "div",
      { class: "space-y-4 flex-1" },

      // القسم السادس — التقييم والبحث الاجتماعي والتوصيات
      el(
        "div",
        { class: "rounded-xl border border-slate-300 p-3.5 space-y-3" },
        el(
          "div",
          { class: "flex items-center gap-2 font-black text-slate-900 border-b border-slate-200 pb-2 text-xs" },
          icon("fileText", { size: 15, class: "text-blue-600" }),
          el("span", {}, "القسم السادس — التقييم والبحث الاجتماعي والتوصيات"),
        ),

        // رأي وتقرير الأخصائي
        el(
          "div",
          { class: "space-y-1.5" },
          el(
            "div",
            { class: "flex items-center justify-between" },
            el("h4", { class: "text-[11px] font-bold text-slate-700" }, "رأي وتقرير الأخصائي الاجتماعي الميداني:"),
            el(
              "span",
              { class: "px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300" },
              "مقبول",
            ),
          ),
          el(
            "p",
            {
              class:
                "text-[11.5px] leading-relaxed text-slate-800 p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-medium italic",
            },
            `"تمت المقابله مع الحاله يعمل باليوميه في الفلاحه، الزوجه تتقاضي تكافل تعاني من اجراء عمليه استئصال كليه، الاولاد بمراحل التعليم الثانوي علمي والاعدادي، الابن عثمان حاصل على دبلوم يعمل عامل في مصنع، الحاله تستحق الدعم لعدم كفايه الدخل ووجود اولاد بالتعليم ووجود مرض"`,
          ),
        ),

        // أنواع الدعم المقترحة من الأخصائي
        el(
          "div",
          { class: "space-y-1.5 pt-2 border-t border-slate-200" },
          el("h4", { class: "text-[11px] font-bold text-slate-700" }, "أنواع الدعم المقترحة من الأخصائي:"),
          el(
            "table",
            { class: "w-full border-collapse text-[10.5px] border border-slate-300 text-center" },
            el(
              "thead",
              { class: "bg-slate-100 font-bold text-slate-800" },
              el(
                "tr",
                {},
                el("th", { class: "border border-slate-300 p-1 text-right" }, "نوع الدعم المقترح"),
                el("th", { class: "border border-slate-300 p-1" }, "الفئة / التصنيف"),
                el("th", { class: "border border-slate-300 p-1" }, "المبلغ المقترح"),
                el("th", { class: "border border-slate-300 p-1" }, "درجة الأولوية"),
              ),
            ),
            el(
              "tbody",
              { class: "divide-y divide-slate-200 font-medium" },
              renderSupportRow("مصروفات دراسية", "—", "0", "غير محدد"),
              renderSupportRow("كرتونة", "—", "0", "غير محدد"),
              renderSupportRow("لحوم", "—", "0", "غير محدد"),
              renderSupportRow("زي مدرسي", "—", "0", "غير محدد"),
            ),
          ),
        ),

        // قرار المراجع والاعتماد النهائي
        el(
          "div",
          { class: "grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-[11px]" },
          el(
            "div",
            { class: "p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600" },
            el("span", { class: "font-bold text-slate-800 block mb-0.5" }, "قرار وتوصية المراجع:"),
            "لا يوجد رأي مسجل من المراجع بعد",
          ),
          el(
            "div",
            { class: "p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600" },
            el("span", { class: "font-bold text-slate-800 block mb-0.5" }, "الاعتماد النهائي للمدير:"),
            "لا يوجد اعتماد مسجل من المدير بعد",
          ),
        ),
      ),

      // القسم التاسع — الدعم المصروف فعليًا
      el(
        "div",
        { class: "rounded-xl border border-slate-300 p-3.5 space-y-2.5" },
        el(
          "div",
          { class: "flex items-center justify-between border-b border-slate-200 pb-2" },
          el(
            "div",
            { class: "flex items-center gap-2 font-black text-slate-900 text-xs" },
            icon("wallet", { size: 15, class: "text-blue-600" }),
            el("span", {}, "القسم التاسع — الدعم المصروف فعليًا"),
          ),
          el(
            "span",
            {
              class:
                "px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 border border-blue-200 tabular",
            },
            "4 عملية صرف",
          ),
        ),
        el(
          "table",
          { class: "w-full border-collapse text-[10.5px] border border-slate-300 text-center" },
          el(
            "thead",
            { class: "bg-slate-100 font-bold text-slate-800" },
            el(
              "tr",
              {},
              el("th", { class: "border border-slate-300 p-1 text-right" }, "نوع الدعم"),
              el("th", { class: "border border-slate-300 p-1" }, "الكمية"),
              el("th", { class: "border border-slate-300 p-1" }, "المستلم"),
              el("th", { class: "border border-slate-300 p-1" }, "التاريخ"),
            ),
          ),
          el(
            "tbody",
            { class: "divide-y divide-slate-200 font-medium" },
            renderDisbursedRow("زي مدرسي", "1", "جمال عثمان ابراهيم شعبان", "—"),
            renderDisbursedRow("كرتونة", "1", "جمال عثمان ابراهيم شعبان", "—"),
            renderDisbursedRow("لحوم", "1", "جمال عثمان ابراهيم شعبان", "—"),
            renderDisbursedRow("مصروفات دراسية", "1", "جمال عثمان ابراهيم شعبان", "—"),
          ),
        ),
      ),

      // الاعتماد والتوقيعات
      el(
        "div",
        { class: "rounded-xl border border-slate-300 p-3.5 space-y-4" },
        el(
          "div",
          { class: "flex items-center gap-2 font-black text-slate-900 border-b border-slate-200 pb-2 text-xs" },
          icon("edit", { size: 15, class: "text-blue-600" }),
          el("span", {}, "الاعتماد والتوقيعات"),
        ),
        el(
          "div",
          { class: "grid grid-cols-3 gap-4 text-center text-xs" },
          el(
            "div",
            { class: "space-y-8" },
            el("p", { class: "font-bold text-slate-800" }, "أخصائي التنمية"),
            el("p", { class: "text-[11px] text-slate-500 border-t border-dotted border-slate-400 pt-1" }, "التوقيع"),
          ),
          el(
            "div",
            { class: "space-y-8" },
            el("p", { class: "font-bold text-slate-800" }, "المراجع"),
            el("p", { class: "text-[11px] text-slate-500 border-t border-dotted border-slate-400 pt-1" }, "التوقيع"),
          ),
          el(
            "div",
            { class: "space-y-8" },
            el("p", { class: "font-bold text-slate-800" }, "مدير التنمية"),
            el("p", { class: "text-[11px] text-slate-500 border-t border-dotted border-slate-400 pt-1" }, "التوقيع"),
          ),
        ),
      ),
    ),

    renderFooter(3, 3),
  );
  return page;
}

function renderSupportRow(type, category, amount, priority) {
  return el(
    "tr",
    {},
    el("td", { class: "border border-slate-300 p-1 text-right font-medium" }, type),
    el("td", { class: "border border-slate-300 p-1 text-slate-600" }, category),
    el("td", { class: "border border-slate-300 p-1 font-mono tabular" }, amount),
    el("td", { class: "border border-slate-300 p-1 text-amber-700 font-bold" }, priority),
  );
}

function renderDisbursedRow(type, qty, recipient, date) {
  return el(
    "tr",
    {},
    el("td", { class: "border border-slate-300 p-1 text-right font-medium" }, type),
    el("td", { class: "border border-slate-300 p-1 font-mono tabular" }, qty),
    el("td", { class: "border border-slate-300 p-1 font-bold" }, recipient),
    el("td", { class: "border border-slate-300 p-1 text-slate-600" }, date),
  );
}

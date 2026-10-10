/**
 * استوديو تخصيص الخلفية والمؤثرات البصرية.
 * نمط بصري متقدم ومؤثرات زجاجية راقية لمستشفى أمان الحياة.
 */

import { el, cx, render } from "../../js/core/dom.js";
import { icon } from "../../components/common/icon.js";
import {
  PRESET_SWATCHES,
  currentBackgroundSettings,
  setBackgroundStudio,
  resetBackgroundStudio,
} from "../../js/core/background-studio.js";
import { toast } from "../../components/feedback/toast.js";

export default function appearancePage() {
  const masterCard = el(
    "div",
    {
      class:
        "glass-card rounded-[28px] p-6 sm:p-8 space-y-7 border border-white/80 dark:border-white/10 shadow-card",
    },
    headerRow(),
    uploadSection(),
    swatchesSection(),
    slidersSection(),
  );

  return el("div", { class: "space-y-4" }, masterCard);
}

/* ============================================================================
   الترويسة العلوية للبطاقة
   ============================================================================ */

function headerRow() {
  return el(
    "div",
    { class: "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-1" },
    el(
      "div",
      { class: "flex items-center gap-3.5 min-w-0" },
      el(
        "span",
        {
          class:
            "size-12 rounded-2xl bg-blue-100/70 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 " +
            "border border-blue-200/60 dark:border-blue-900/40 flex items-center justify-center shrink-0 shadow-xs",
        },
        icon("image", { size: 24 }),
      ),
      el(
        "div",
        { class: "space-y-0.5 min-w-0" },
        el(
          "h1",
          {
            "data-page-title": "true",
            class: "text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate-1 outline-none",
          },
          "استوديو تخصيص الخلفية والمؤثرات البصرية",
        ),
        el(
          "p",
          { class: "text-xs font-semibold text-slate-500 dark:text-slate-400 truncate-1" },
          "تحكم كامل ومباشر في مظهر الخلفية، الضبابية، السطوع، التباين والتشبع بالوقت الفعلي",
        ),
      ),
    ),
    el(
      "a",
      {
        href: "#/settings/hospital",
        class:
          "hx-press flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/90 dark:bg-slate-800 " +
          "text-slate-800 dark:text-slate-100 text-xs font-black border border-slate-200/80 dark:border-white/15 " +
          "shadow-xs hover:bg-white hover:shadow-sm transition-all shrink-0",
      },
      icon("chevronEnd", { size: 14 }),
      el("span", {}, "العودة للبيانات الشخصية"),
    ),
  );
}

/* ============================================================================
   قسم رفع صورة جديدة
   ============================================================================ */

function uploadSection() {
  const input = el("input", {
    type: "file",
    accept: "image/*",
    class: "sr-only",
    onChange: (evt) => {
      const file = evt.target.files?.[0];
      if (!file) return;

      if (file.size > 3 * 1024 * 1024) {
        toast.warning("الصورة كبيرة جدًا (الحد الأقصى 3 ميجابايت تقريبًا) — اختر صورة أصغر.");
        input.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setBackgroundStudio({ type: "image", val: reader.result });
        toast.success("تم تطبيق صورة الخلفية فورًا.");
      };
      reader.onerror = () => toast.error("تعذّرت قراءة الصورة.");
      reader.readAsDataURL(file);
    },
  });

  return el(
    "div",
    { class: "space-y-3" },
    el(
      "h3",
      { class: "text-[14px] sm:text-[15px] font-black text-slate-900 dark:text-white" },
      "اختيار صورة الخلفية (رفع صورة جديدة)",
    ),
    el(
      "label",
      {
        class:
          "flex flex-col items-center justify-center border-2 border-dashed border-slate-300/80 dark:border-white/20 " +
          "hover:border-blue-400 dark:hover:border-blue-500 bg-white/25 dark:bg-white/5 hover:bg-white/40 " +
          "rounded-[24px] py-10 px-6 transition-all cursor-pointer text-center group",
      },
      input,
      el(
        "span",
        {
          class:
            "size-12 rounded-full bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md " +
            "border border-slate-100 dark:border-white/10 flex items-center justify-center mb-3 " +
            "group-hover:scale-105 transition-transform",
        },
        icon("upload", { size: 22 }),
      ),
      el(
        "p",
        { class: "text-sm sm:text-[15px] font-black text-slate-900 dark:text-white" },
        "اضغط هنا لاختيار صورة من جهازك لتطبيقها خلفيةً فورية للمنظومة",
      ),
      el(
        "p",
        { class: "text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1" },
        "تتحدث الخلفية فوراً بالوقت الفعلي فوق جميع الكروت المنزلقة",
      ),
    ),
  );
}

/* ============================================================================
   قسم الألوان والتدرجات الجاهزة
   ============================================================================ */

function swatchesSection() {
  const gridHost = el("div", {
    class: "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2 sm:gap-2.5",
  });

  function isActive(swatch) {
    const current = currentBackgroundSettings();
    return current.type === swatch.type && current.val === swatch.val;
  }

  function paint() {
    render(
      gridHost,
      ...PRESET_SWATCHES.map((swatch) => {
        const previewStyle = {};
        if (swatch.type === "image") {
          previewStyle.backgroundImage = `url("${swatch.val}")`;
          previewStyle.backgroundSize = "cover";
          previewStyle.backgroundPosition = "center";
        } else if (swatch.type === "gradient") {
          previewStyle.backgroundImage = swatch.val;
        } else {
          previewStyle.backgroundColor = swatch.val;
        }

        const active = isActive(swatch);

        return el(
          "button",
          {
            type: "button",
            class: cx(
              "hx-press flex flex-col items-center justify-center gap-2 px-1.5 py-3 rounded-2xl transition-all cursor-pointer",
              active
                ? "border-2 border-blue-600 bg-white dark:bg-slate-800 shadow-md ring-2 ring-blue-500/20 text-blue-600 dark:text-blue-400 font-black"
                : "bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 shadow-xs hover:bg-white/95 dark:hover:bg-white/15 hover:shadow-sm text-slate-800 dark:text-slate-200 font-bold",
            ),
            onClick: () => {
              setBackgroundStudio({ type: swatch.type, val: swatch.val });
              paint();
              toast.success(`تم تطبيق "${swatch.label}".`);
            },
          },
          el("span", {
            class: "size-10 rounded-full border border-black/10 dark:border-white/15 shadow-xs shrink-0",
            style: previewStyle,
          }),
          el("span", { class: "text-[11px] font-bold text-center whitespace-nowrap leading-tight" }, swatch.label),
        );
      }),
      customColorSwatch(paint),
    );
  }

  paint();

  return el(
    "div",
    { class: "space-y-3.5" },
    el(
      "div",
      { class: "flex items-center justify-between" },
      el(
        "h3",
        { class: "text-[14px] sm:text-[15px] font-black text-slate-900 dark:text-white" },
        "ألوان خلفية جاهزة وثابتة (فواتح، غوامق، وتدرجات)",
      ),
      el("span", { class: "text-xs font-bold text-slate-400 dark:text-slate-500" }, "تخصيص سريع"),
    ),
    gridHost,
  );
}

function customColorSwatch(onPick) {
  const preview = el("span", {
    class: "size-10 rounded-full border border-black/10 dark:border-white/15 shadow-xs shrink-0",
    style: { background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" },
  });

  const input = el("input", {
    type: "color",
    class: "sr-only",
    value: "#0d8f82",
    onInput: (evt) => {
      preview.style.background = evt.target.value;
      setBackgroundStudio({ type: "color", val: evt.target.value });
      onPick();
    },
  });

  return el(
    "label",
    {
      class:
        "hx-press flex flex-col items-center justify-center gap-2 px-1.5 py-3 rounded-2xl " +
        "bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 shadow-xs " +
        "hover:bg-white/95 dark:hover:bg-white/15 hover:shadow-sm text-slate-800 dark:text-slate-200 " +
        "font-bold transition-all cursor-pointer",
    },
    input,
    preview,
    el("span", { class: "text-[11px] font-bold text-center whitespace-nowrap leading-tight" }, "لون مخصص"),
  );
}

/* ============================================================================
   قسم المؤثرات الحية (الضبابية، السطوع، التباين، التشبّع)
   ============================================================================ */

// تسميات مطابقة حرفيًا لـ bg-studio.html في مؤسسة النهضة.
const SLIDERS = [
  { key: "blur", label: "درجة الضبابية (Blur)", min: 0, max: 30, unit: "px" },
  { key: "brightness", label: "الإضاءة والسطوع (Brightness)", min: 40, max: 160, unit: "%" },
  { key: "contrast", label: "درجة التباين (Contrast)", min: 50, max: 160, unit: "%" },
  { key: "saturate", label: "درجة تشبع الألوان (Saturation)", min: 0, max: 220, unit: "%" },
  { key: "overlay", label: "شفافية غطاء الصفحة (Overlay Opacity)", min: 0, max: 80, unit: "%" },
];

function slidersSection() {
  const rows = SLIDERS.map((def) => sliderRow(def));

  return el(
    "div",
    { class: "space-y-4 pt-5 border-t border-black/[0.05] dark:border-white/[0.08]" },
    el(
      "div",
      { class: "flex items-center justify-between" },
      el(
        "div",
        { class: "space-y-0.5" },
        el("h3", { class: "text-[14px] sm:text-[15px] font-black text-slate-900 dark:text-white" }, "مؤثرات بصرية حيّة"),
        el("p", { class: "text-xs font-semibold text-slate-500 dark:text-slate-400" }, "تحكم في الضبابية والسطوع والتباين وتشبّع الألوان وغطاء الصفحة بالوقت الفعلي"),
      ),
      el(
        "button",
        {
          type: "button",
          class:
            "hx-press flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/90 dark:bg-slate-800 " +
            "text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200/80 dark:border-white/10 shadow-xs hover:bg-white cursor-pointer",
          onClick: () => {
            resetBackgroundStudio();
            render(document.getElementById("page"), appearancePage());
            toast.info("أُعيدت إعدادات الخلفية للقيم الافتراضية.");
          },
        },
        icon("refresh", { size: 13 }),
        el("span", {}, "إعادة ضبط المصنع"),
      ),
    ),
    el("div", { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" }, ...rows),
  );
}

function sliderRow({ key, label, min, max, unit }) {
  const current = currentBackgroundSettings();
  const valueLabel = el(
    "span",
    { class: "text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-lg num" },
    `${current[key]}${unit}`,
  );

  const slider = el("input", {
    type: "range",
    min: String(min),
    max: String(max),
    value: String(current[key]),
    class: "w-full accent-blue-600 cursor-pointer",
    onInput: (evt) => {
      const value = Number(evt.target.value);
      valueLabel.textContent = `${value}${unit}`;
      setBackgroundStudio({ [key]: value });
    },
  });

  return el(
    "div",
    { class: "flex flex-col gap-2 p-3 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10" },
    el(
      "div",
      { class: "flex items-center justify-between" },
      el("label", { class: "text-xs font-bold text-slate-800 dark:text-slate-200" }, label),
      valueLabel,
    ),
    slider,
  );
}

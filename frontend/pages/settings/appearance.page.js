/**
 * تخصيص المظهر — استوديو الخلفية.
 *
 * شاشة حقيقية فعليًا، لا عرض توضيحي: كل تحكّم هنا يكتب مباشرة إلى
 * js/core/background-studio.js، والذي يُطبِّق التغيير حيًّا على #bg-layer
 * ويحفظه في localStorage. لا تمرير وهمي، لا "سيُفعَّل لاحقًا".
 */

import { el, cx, render } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { icon } from "../../components/common/icon.js";
import {
  DEFAULTS,
  PRESET_SWATCHES,
  currentBackgroundSettings,
  setBackgroundStudio,
  resetBackgroundStudio,
} from "../../js/core/background-studio.js";
import { toast } from "../../components/feedback/toast.js";

export default function appearancePage() {
  return el(
    "div",
    { class: "space-y-4" },
    pageHeader({
      title: "تخصيص المظهر",
      description: "تحكّم مباشر وفوري في خلفية الواجهة، الضبابية، السطوع، التباين، والتشبّع.",
    }),
    uploadCard(),
    swatchesCard(),
    slidersCard(),
  );
}

/* ============================================================================
   رفع صورة مخصَّصة
   ============================================================================ */

function uploadCard() {
  const input = el("input", {
    type: "file",
    accept: "image/*",
    class: "sr-only-focusable",
    onChange: (evt) => {
      const file = evt.target.files?.[0];
      if (!file) return;

      // حدّ عملي: localStorage كله عادة ~5 ميجابايت؛ صورة أكبر من هذا تفشل
      // حفظها بصمت دون هذا الفحص المبكر — رسالة واضحة أفضل من فشل غامض لاحقًا.
      if (file.size > 3 * 1024 * 1024) {
        toast.warning("الصورة كبيرة جدًا (الحد الأقصى 3 ميجابايت تقريبًا) — اختر صورة أصغر.");
        input.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setBackgroundStudio({ type: "image", val: reader.result });
        toast.success("تم تطبيق صورة الخلفية.");
      };
      reader.onerror = () => toast.error("تعذّرت قراءة الصورة.");
      reader.readAsDataURL(file);
    },
  });

  return card({
    title: "صورة الخلفية",
    subtitle: "ارفع صورة من جهازك لتطبيقها خلفيةً فورية خلف كل شاشات النظام",
    body: el(
      "label",
      {
        class:
          "flex flex-col items-center justify-center gap-3 p-8 rounded-[var(--radius-card)] " +
          "border-2 border-dashed border-line-strong hover:border-brand-400 hover:bg-subtle " +
          "transition-colors cursor-pointer text-center",
      },
      input,
      el(
        "span",
        { class: "grid place-items-center size-12 rounded-full bg-brand-50 text-brand-300" },
        icon("image", { size: 22 }),
      ),
      el("p", { class: "text-sm font-medium text-ink" }, "اضغط هنا لاختيار صورة من جهازك"),
      el("p", { class: "text-xs text-faint" }, "تُطبَّق الخلفية فورًا فور الاختيار — JPG أو PNG، حتى 3 ميجابايت تقريبًا"),
    ),
  });
}

/* ============================================================================
   ألوان وتدرّجات جاهزة
   ============================================================================ */

function swatchesCard() {
  const gridHost = el("div", { class: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" });

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

        return el(
          "button",
          {
            type: "button",
            class: cx(
              "hx-press flex flex-col items-center gap-2 p-3 rounded-[var(--radius-control)] border transition-colors",
              isActive(swatch)
                ? "border-brand-400 bg-brand-50 shadow-glow-brand"
                : "border-line hover:border-line-strong hover:bg-subtle",
            ),
            onClick: () => {
              setBackgroundStudio({ type: swatch.type, val: swatch.val });
              paint();
              toast.success(`تم تطبيق خلفية "${swatch.label}".`);
            },
          },
          el("span", {
            class: "size-10 rounded-xl shadow-card border border-line shrink-0",
            style: previewStyle,
          }),
          el("span", { class: "text-xs font-medium text-ink text-center truncate-1 w-full" }, swatch.label),
        );
      }),
      customColorSwatch(paint),
    );
  }

  paint();

  return card({
    title: "خلفيات وألوان وتدرّجات جاهزة",
    subtitle: "اختيار فوري وسريع بين صور الطبيعة، الألوان الهادئة، والتدرّجات الفاخرة",
    body: gridHost,
  });
}

function customColorSwatch(onPick) {
  const preview = el("span", {
    class: "size-9 rounded-full shadow-card border border-line",
    style: { background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" },
  });

  const input = el("input", {
    type: "color",
    class: "sr-only-focusable",
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
        "hx-press flex flex-col items-center gap-2 p-3 rounded-[var(--radius-control)] border border-line " +
        "hover:border-line-strong hover:bg-subtle transition-colors cursor-pointer",
    },
    input,
    preview,
    el("span", { class: "text-xs font-medium text-ink text-center" }, "لون مخصَّص"),
  );
}

/* ============================================================================
   مؤثرات حيّة
   ============================================================================ */

const SLIDERS = [
  { key: "blur", label: "درجة الضبابية (Blur)", min: 0, max: 30, unit: "px" },
  { key: "brightness", label: "السطوع (Brightness)", min: 40, max: 160, unit: "%" },
  { key: "contrast", label: "التباين (Contrast)", min: 50, max: 160, unit: "%" },
  { key: "saturate", label: "تشبّع الألوان (Saturation)", min: 0, max: 220, unit: "%" },
  { key: "overlay", label: "شفافية غطاء الصفحة (Overlay)", min: 0, max: 80, unit: "%" },
];

function slidersCard() {
  const rows = SLIDERS.map((def) => sliderRow(def));

  return card({
    title: "مؤثرات بصرية حيّة",
    subtitle: "كل تغيير يُطبَّق فورًا على الخلفية خلف الواجهة بالكامل",
    body: el(
      "div",
      { class: "grid grid-cols-1 sm:grid-cols-2 gap-5" },
      ...rows,
    ),
    footer: button({
      label: "إعادة ضبط المصنع",
      icon: "refresh",
      variant: "secondary",
      onClick: () => {
        resetBackgroundStudio();
        // أبسط من إعادة رسم كل الشرائح يدويًا: الشاشة بأكملها حالة قراءة من
        // appState، وإعادة تحميلها هنا رخيصة (لا نموذج غير محفوظ يُفقَد).
        render(document.getElementById("page"), appearancePage());
        toast.info("أُعيدت إعدادات الخلفية للقيم الافتراضية.");
      },
    }),
  });
}

function sliderRow({ key, label, min, max, unit }) {
  const current = currentBackgroundSettings();
  const valueLabel = el(
    "span",
    { class: "text-xs font-semibold text-brand-300 bg-brand-50 px-2 py-0.5 rounded num" },
    `${current[key]}${unit}`,
  );

  const slider = el("input", {
    type: "range",
    min: String(min),
    max: String(max),
    value: String(current[key]),
    class: "w-full accent-brand-600 cursor-pointer",
    onInput: (evt) => {
      const value = Number(evt.target.value);
      valueLabel.textContent = `${value}${unit}`;
      setBackgroundStudio({ [key]: value });
    },
  });

  return el(
    "div",
    { class: "flex flex-col gap-2" },
    el(
      "div",
      { class: "flex items-center justify-between" },
      el("label", { class: "text-xs font-semibold text-ink" }, label),
      valueLabel,
    ),
    slider,
  );
}

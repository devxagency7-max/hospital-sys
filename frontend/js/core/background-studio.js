/**
 * استوديو تخصيص الخلفية.
 *
 * يتحكم في طبقة الخلفية الثابتة خلف كل الواجهة (#bg-layer في index.html):
 * صورة يرفعها المستخدم / لون ثابت / تدرّج جاهز، فوقها فلتر CSS حيّ
 * (ضبابية/سطوع/تباين/تشبّع) وغطاء شفاف يضمن بقاء النص مقروءًا. كل القيم
 * متغيرات CSS على :root — لا مكوّن آخر في الواجهة يعرف أن هذا الاستوديو
 * موجود، فتبديل الإعداد لا يحتاج إعادة رسم أي شيء غير #bg-layer نفسه.
 *
 * نفس بنية js/core/theme.js تمامًا: تفضيل محفوظ عبر readPreference/
 * writePreference، حقل على appState، ودالة apply() واحدة تُطبِّق الحالة
 * الحالية على الـ DOM. راجع theme.js للتعليل الكامل لهذا النمط.
 */

import { appState, writePreference, readPreference } from "./store.js";
import { toast } from "../../components/feedback/toast.js";

/*
 * الافتراضي تدرّج رمادي-أزرق هادئ غير مشبَّع — لا تدرّجًا صريحًا بلون العلامة.
 * المرجع البصري (nahda-webb-main) يستخدم صورة جبال مموَّهة بالضبابية والسطوع
 * فيُعطي إحساسًا محايدًا هادئًا خلف الزجاج، لا خلفية "ملوَّنة بوضوح" — تدرّج
 * داكن-إلى-ساطع بلون العلامة (كما كان هنا سابقًا) يُعطي انطباعًا أثقل
 * وأكثر إلحاحًا بصريًا من المرجع بوضوح. نفس شدّة الضبابية الافتراضية
 * المستخدمة في .glass/.glass-rail — راجع --glass-blur.
 */
export const DEFAULTS = Object.freeze({
  /** "image" | "color" | "gradient" */
  type: "image",
  val: "assets/background.jpg",
  blur: 24,
  brightness: 102,
  contrast: 98,
  saturate: 110,
  /** شفافية غطاء الصفحة — مطابقة للمرجع البصري (nahda-webb-main). */
  overlay: 86,
});

/** خلفيات وألوان وتدرّجات جاهزة — مطابقة لاستوديو nahda-webb-main. */
export const PRESET_SWATCHES = [
  { key: "default-nature", label: "طبيعة خضراء (الافتراضية)", type: "image", val: "assets/background.jpg" },
  { key: "mountain-clouds", label: "جبال وسحب", type: "image", val: "assets/mountain-highland-clouds-sky-thumbnail.jpg" },
  { key: "green-landscape", label: "مناظر طبيعية", type: "image", val: "assets/nature-landscape-natural-nature.jpg" },
  { key: "low-poly-blue", label: "فن رقمي أزرق", type: "image", val: "assets/low-poly-abstract-blue-digital-art-wallpaper-thumb.jpg" },
  { key: "dark-abstract", label: "فن تجريدي داكن", type: "image", val: "assets/abstract-3d-digital-art-dark-wallpaper-thumb.jpg" },
  { key: "navy", label: "كحلي داكن", type: "color", val: "#0f172a" },
  { key: "charcoal", label: "رمادي فاحم", type: "color", val: "#18181b" },
  { key: "teal-dark", label: "زيتي داكن", type: "color", val: "#064e3b" },
  { key: "maroon", label: "عنابي داكن", type: "color", val: "#4c0519" },
  { key: "off-white", label: "أوف وايت", type: "color", val: "#f8fafc" },
  { key: "sky", label: "سماوي ناعم", type: "color", val: "#e0f2fe" },
  { key: "mint", label: "نعناعي فاتح", type: "color", val: "#ecfdf5" },
  { key: "cream", label: "بيج دافئ", type: "color", val: "#fef3c7" },
  { key: "gradient-ocean", label: "تدرّج المحيط", type: "gradient", val: "linear-gradient(135deg, #0f172a, #1e3a8a)" },
  { key: "gradient-emerald", label: "تدرّج زمردي", type: "gradient", val: "linear-gradient(135deg, #064e3b, #0f172a)" },
  { key: "gradient-purple", label: "تدرّج أرجواني", type: "gradient", val: "linear-gradient(135deg, #311042, #701a75)" },
];

function currentSettings() {
  return { ...DEFAULTS, ...(appState.get().backgroundStudio ?? {}) };
}

function apply() {
  const s = currentSettings();
  const root = document.documentElement;
  const layer = document.getElementById("bg-layer");
  if (!layer) return;

  if (s.type === "image") {
    layer.style.backgroundImage = `url(${s.val})`;
  } else if (s.type === "gradient") {
    layer.style.backgroundImage = s.val;
  } else {
    // "color": لا صورة، اللون يأتي من background-color مباشرة.
    layer.style.backgroundImage = "none";
  }
  layer.style.backgroundColor = s.type === "color" ? s.val : "";

  root.style.setProperty("--bg-blur", `${s.blur}px`);
  root.style.setProperty("--bg-brightness", `${s.brightness}%`);
  root.style.setProperty("--bg-contrast", `${s.contrast}%`);
  root.style.setProperty("--bg-saturate", `${s.saturate}%`);
  root.style.setProperty("--glass-blur", `${s.blur}px`);
  root.style.setProperty("--glass-blur-rail", `${s.blur}px`);

  // الغطاء يأخذ لونه من توكن السمة الحالية (داكن/فاتح) بنفس درجة الشفافية
  // المُختارة — لا لونًا ثابتًا بصرف النظر عن السمة، وإلا بدا الغطاء الفاتح
  // "وسخًا" فوق خلفية داكنة أو العكس.
  const overlayBase = root.dataset.theme === "light" ? "236 241 247" : "10 14 23";
  root.style.setProperty("--bg-overlay-color", `rgb(${overlayBase} / ${s.overlay / 100})`);
}

/** تهيئة لمرة واحدة عند الإقلاع — تُسجَّل في app.js. */
export function initBackgroundStudio() {
  apply();

  appState.subscribe((next, previous) => {
    if (next.backgroundStudio !== previous.backgroundStudio) apply();
  });

  // تغيّر السمة (داكن/فاتح) يُعيد حساب لون الغطاء — راجع overlayBase أعلاه.
  appState.subscribe((next, previous) => {
    if (next.themePreference !== previous.themePreference) apply();
  });
}

/** دمج جزئي + حفظ — نمط setTheme نفسه في theme.js. */
export function setBackgroundStudio(patch) {
  const next = { ...currentSettings(), ...patch };
  writePreference("backgroundStudio", next);

  // كشف فشل الحفظ الصامت: writePreference تبتلع أخطاء الحصة (quota) بتصميم
  // (تفضيلات تحسين لا أكثر)، لكن صورة مرفوعة فشل حفظها فعليًا يستحق تنبيهًا
  // صريحًا — المستخدم رفع صورة ويتوقعها أن تبقى بعد إعادة التحميل.
  const persisted = readPreference("backgroundStudio", null);
  const actuallySaved = persisted && JSON.stringify(persisted) === JSON.stringify(next);
  if (!actuallySaved && patch.type === "image") {
    toast.warning("تعذّر حفظ الصورة — قد تكون كبيرة جدًا على مساحة التخزين المحلية المتاحة.");
  }

  appState.set({ backgroundStudio: next });
}

export function resetBackgroundStudio() {
  writePreference("backgroundStudio", null);
  appState.set({ backgroundStudio: null });
}

export function currentBackgroundSettings() {
  return currentSettings();
}

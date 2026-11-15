/**
 * بيانات حسابات المرضى والخدمات الطبية التجريبية:
 * سجل المرضى، دليل الخدمات (غرف، عناية مركزة، عمليات، فحوصات)،
 * حالات الإقامة، فواتير المرضى، وسندات القبض.
 */

import { createRandom, REFERENCE_DATE, buildName } from "./seed.js";

const random = createRandom(884_219);

/* ============================================================================
   1. دليل الخدمات الطبية للمستشفى
   ============================================================================ */

export const hospitalServices = [
  // --- إقامة وغرف ---
  { id: 1, code: "SRV-ROOM-01", category: "room", categoryName: "إقامة وغرف", name: "إقامة يومية — جناح ملكي فاخر", price: 3500, unit: "يوم", department: "القسم الداخلي" },
  { id: 2, code: "SRV-ROOM-02", category: "room", categoryName: "إقامة وغرف", name: "إقامة يومية — غرفة مفردة ممتازة", price: 1600, unit: "يوم", department: "القسم الداخلي" },
  { id: 3, code: "SRV-ROOM-03", category: "room", categoryName: "إقامة وغرف", name: "إقامة يومية — غرفة مزدوجة مشتركة", price: 900, unit: "يوم", department: "القسم الداخلي" },
  { id: 4, code: "SRV-ROOM-04", category: "room", categoryName: "إقامة وغرف", name: "إشراف طبي ورعاية تمريضية فندقية", price: 400, unit: "يوم", department: "القسم الداخلي" },

  // --- عناية مركزة ICU ---
  { id: 5, code: "SRV-ICU-01", category: "icu", categoryName: "عناية مركزة", name: "إقامة يومية — عناية مركزة عامة ICU", price: 5200, unit: "يوم", department: "العناية المركزة" },
  { id: 6, code: "SRV-ICU-02", category: "icu", categoryName: "عناية مركزة", name: "إقامة يومية — عناية مركزة للقلب CCU", price: 6000, unit: "يوم", department: "العناية المركزة" },
  { id: 7, code: "SRV-ICU-03", category: "icu", categoryName: "عناية مركزة", name: "إقامة يومية — مبتسرين وحضّانات NICU", price: 4200, unit: "يوم", department: "المبتسرين" },
  { id: 8, code: "SRV-ICU-04", category: "icu", categoryName: "عناية مركزة", name: "تنفس صناعي ومراقبة حيوية متقدمة", price: 1800, unit: "يوم", department: "العناية المركزة" },

  // --- عمليات جراحية ---
  { id: 9, code: "SRV-SURG-01", category: "surgery", categoryName: "عمليات جراحية", name: "جراحة استئصال مرارة بالمنظار", price: 16500, unit: "عملية", department: "العمليات" },
  { id: 10, code: "SRV-SURG-02", category: "surgery", categoryName: "عمليات جراحية", name: "جراحة قلب مفتوح وتبديل شرايين", price: 65000, unit: "عملية", department: "جراحة القلب" },
  { id: 11, code: "SRV-SURG-03", category: "surgery", categoryName: "عمليات جراحية", name: "قسطرة قلبية علاجية وتركيب دعامات", price: 32000, unit: "إجراء", department: "القسطرة" },
  { id: 12, code: "SRV-SURG-04", category: "surgery", categoryName: "عمليات جراحية", name: "استبدال مفصل ركبة جراحي كامل", price: 42000, unit: "عملية", department: "جراحة العظام" },
  { id: 13, code: "SRV-SURG-05", category: "surgery", categoryName: "عمليات جراحية", name: "ولادة قيصرية ورعاية متكاملة", price: 12500, unit: "عملية", department: "النساء والولادة" },
  { id: 14, code: "SRV-SURG-06", category: "surgery", categoryName: "عمليات جراحية", name: "تخدير جراحي كلي وإشراف إفاقة", price: 3200, unit: "حالة", department: "التخدير" },
  { id: 15, code: "SRV-SURG-07", category: "surgery", categoryName: "عمليات جراحية", name: "كشك عمليات جراحية ومستهلكات معقمة", price: 4500, unit: "حالة", department: "العمليات" },

  // --- استشارات وفحوصات وتحاليل ---
  { id: 16, code: "SRV-CONS-01", category: "consultation", categoryName: "كشوفات واستشارات", name: "كشف استشاري تخصصي", price: 450, unit: "كشف", department: "العيادات الخارجية" },
  { id: 17, code: "SRV-CONS-02", category: "consultation", categoryName: "كشوفات واستشارات", name: "كشف طوارئ وتقييم فوري", price: 250, unit: "زيارة", department: "الطوارئ" },
  { id: 18, code: "SRV-RAD-01", category: "radiology", categoryName: "أشعة وتصوير", name: "أشعة رنين مغناطيسي MRI", price: 2600, unit: "فحص", department: "الأشعة" },
  { id: 19, code: "SRV-RAD-02", category: "radiology", categoryName: "أشعة وتصوير", name: "أشعة مقطعية متعددة المقاطع CT", price: 1750, unit: "فحص", department: "الأشعة" },
  { id: 20, code: "SRV-LAB-01", category: "lab", categoryName: "تحاليل طبية", name: "باقة تحاليل شاملة (كبد، كلى، سكر، دهون)", price: 680, unit: "تحليل", department: "المعامل" },
  { id: 21, code: "SRV-PHARM-01", category: "medication", categoryName: "أدوية ومستلزمات", name: "بروتوكول أدوية ومحاليل وريدية للقسم الداخلي", price: 1450, unit: "حزمة", department: "الصيدلية" },
];

/* ============================================================================
   2. شركات التأمين الطبي والجهات المتعاقدة
   ============================================================================ */

export const insuranceProviders = [
  { id: 1, name: "مصر للتأمين", defaultCoverage: 0.85, phone: "19234" },
  { id: 2, name: "بوبا مصر (Bupa)", defaultCoverage: 0.9, phone: "16892" },
  { id: 3, name: "أكسا للتأمين (AXA)", defaultCoverage: 0.8, phone: "19782" },
  { id: 4, name: "نقابة المهندسين المصرية", defaultCoverage: 0.75, phone: "16723" },
  { id: 5, name: "نقابة الأطباء — مشروع العلاج", defaultCoverage: 0.8, phone: "16345" },
  { id: 6, name: "الهيئة العامة للتأمين الصحي", defaultCoverage: 0.95, phone: "19800" },
];

/* ============================================================================
   1.ب شرائح التعريفة والعملات

   ═══════════════════════════════════════════════════════════════════════════
    الخدمة الواحدة لها أكثر من سعر — والسعر ليس صفةً للخدمة وحدها.

    كان لكل خدمة سعر واحد (`price`)، والتأمين مجرد «نسبة تغطية» على المريض.
    هذا يَعجز عن ثلاث حقائق تشغيلية في أي مستشفى:
      1. سعر المريض النقدي ≠ السعر المتعاقد عليه مع شركة التأمين.
      2. المريض الوافد (غير المقيم بالدولة) له تعريفة مستقلة أعلى، وكثيرًا
         ما تكون بعملة أجنبية.
      3. المريض الخارجي (عيادات) والداخلي (مُنوَّم) قد يختلفان في تعريفة
         نفس الإجراء.

    فالتعريفة = (شريحة × خدمة) → سعر. والشريحة تُشتق من نوع المريض، ثم
    تُترجم لسعر واحد محسوم عند إصدار الفاتورة.
   ═══════════════════════════════════════════════════════════════════════════
   ============================================================================ */

/**
 * شرائح التعريفة.
 *
 * `multiplier` معامل على السعر الأساسي في دليل الخدمات — يُستخدم حين لا
 * يوجد سعر مُعلَن صريح للشريحة. وجوده يعني أن إضافة خدمة جديدة لا تُجبر
 * أحدًا على إدخال أربعة أسعار لها قبل أن تعمل.
 *
 * `currency` عملة التعريفة: الشرائح المحلية بالجنيه، وشريحة الوافد بالدولار
 * — فيرى المريض سعره بعملته ويُرحَّل القيد بالجنيه بسعر يوم الفاتورة.
 */
export const tariffTiers = [
  {
    id: 1,
    code: "TIER-CASH",
    name: "نقدي / خاص",
    nameEn: "Self-Pay",
    patientTypes: ["cash"],
    multiplier: 1,
    currency: "EGP",
    isDefault: true,
    notes: "السعر المُعلَن في دليل الخدمات — الأساس الذي تُقاس عليه الشرائح.",
  },
  {
    id: 2,
    code: "TIER-INS",
    name: "تأمين وجهات متعاقدة",
    nameEn: "Insurance & Contracted",
    patientTypes: ["insurance"],
    multiplier: 1.1,
    currency: "EGP",
    isDefault: false,
    notes: "التعريفة المتعاقد عليها مع شركات التأمين والنقابات — أعلى من النقدي مقابل الأجل.",
  },
  {
    id: 3,
    code: "TIER-FOREIGN",
    name: "وافد / سياحة علاجية",
    nameEn: "International Patient",
    patientTypes: ["foreign"],
    multiplier: 1.6,
    currency: "USD",
    isDefault: false,
    notes: "تعريفة المرضى الوافدين بالدولار — تُحوَّل للجنيه بسعر يوم إصدار الفاتورة.",
  },
  {
    id: 4,
    code: "TIER-STAFF",
    name: "العاملون وذووهم",
    nameEn: "Staff & Dependents",
    patientTypes: ["staff"],
    multiplier: 0.6,
    currency: "EGP",
    isDefault: false,
    notes: "تعريفة مخفّضة للعاملين بالمنشأة وأسرهم.",
  },
];

/**
 * أسعار مُعلَنة صريحة لشريحة/خدمة بعينها — تغلب على المعامل.
 *
 * المعامل تقدير معقول، لكن بعض الخدمات تُتفاوض عليها بالاسم (جراحة قلب مع
 * شركة تأمين مثلًا). هذا الجدول هو مكان الاتفاق الصريح، وغيابه ليس خطأً.
 */
export const tariffPrices = [
  /* --- جراحة القلب المفتوح: متفاوض عليها صراحة --- */
  { id: 1, tierId: 2, serviceId: 10, price: 72_000, currency: "EGP", notes: "اتفاق إطاري مع شركات التأمين" },
  { id: 2, tierId: 3, serviceId: 10, price: 2_400, currency: "USD", notes: "باقة سياحة علاجية شاملة" },

  /* --- القسطرة العلاجية --- */
  { id: 3, tierId: 2, serviceId: 11, price: 35_500, currency: "EGP", notes: null },
  { id: 4, tierId: 3, serviceId: 11, price: 1_250, currency: "USD", notes: null },

  /* --- الإقامة بالجناح الملكي للوافدين --- */
  { id: 5, tierId: 3, serviceId: 1, price: 160, currency: "USD", notes: "إقامة يومية بالجناح الملكي" },

  /* --- الكشف الاستشاري --- */
  { id: 6, tierId: 3, serviceId: 16, price: 35, currency: "USD", notes: null },
  { id: 7, tierId: 4, serviceId: 16, price: 150, currency: "EGP", notes: "كشف العاملين" },
];

/**
 * أسعار الصرف المُعلَنة.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  قاعدة مُلزِمة: **الفاتورة الصادرة تحتفظ بسعر يوم إصدارها إلى الأبد.**
 *
 *  السعر الحالي يخص الحركة القادمة فقط. إعادة تقييم فاتورة قديمة بسعر
 *  اليوم تُغيّر إيرادًا اعتُرف به في فترة مُقفلة — وهو تحريف للنتيجة لا
 *  تحديثٌ لها. فرق العملة يُعترف به بندًا مستقلًا عند التحصيل، لا بتعديل
 *  الإيراد الأصلي.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const exchangeRates = [
  { id: 1, currency: "USD", code: "USD", name: "دولار أمريكي", symbol: "$", rate: 48.65, date: "2026-11-01", source: "البنك المركزي المصري" },
  { id: 2, currency: "USD", code: "USD", name: "دولار أمريكي", symbol: "$", rate: 48.9,  date: "2026-11-05", source: "البنك المركزي المصري" },
  { id: 3, currency: "USD", code: "USD", name: "دولار أمريكي", symbol: "$", rate: 49.15, date: "2026-11-07", source: "البنك المركزي المصري" },
  { id: 4, currency: "EUR", code: "EUR", name: "يورو",          symbol: "€", rate: 52.8,  date: "2026-11-01", source: "البنك المركزي المصري" },
  { id: 5, currency: "EUR", code: "EUR", name: "يورو",          symbol: "€", rate: 53.4,  date: "2026-11-07", source: "البنك المركزي المصري" },
  { id: 6, currency: "SAR", code: "SAR", name: "ريال سعودي",    symbol: "﷼", rate: 13.08, date: "2026-11-07", source: "البنك المركزي المصري" },
  { id: 7, currency: "AED", code: "AED", name: "درهم إماراتي",  symbol: "د.إ", rate: 13.38, date: "2026-11-07", source: "البنك المركزي المصري" },
  { id: 8, currency: "KWD", code: "KWD", name: "دينار كويتي",   symbol: "د.ك", rate: 159.4, date: "2026-11-07", source: "البنك المركزي المصري" },
];

/** العملة الأساسية للمنشأة — كل القيود تُرحَّل بها. */
export const BASE_CURRENCY = "EGP";

/* ============================================================================
   2.ب أنواع الغرف والأسرّة والوحدات القابلة للحجز

   ═══════════════════════════════════════════════════════════════════════════
    الغرفة كيان مستقل، لا نصّ حر داخل سجل الإقامة.

    قبل ذلك كانت الغرفة سلسلة نصية («جناح خاص 301») وسعرها رقمًا منسوخًا
    بالإيد في كل سجل إقامة. أثر ذلك ثلاثة أخطاء لا تُكتشف إلا متأخرة:
      1. لا يمكن بناء شاشة إشغال — لا يُعرف الفاضي من المشغول.
      2. لا شيء يمنع حجز الغرفة نفسها لمريضين.
      3. تعديل تعريفة الغرفة لا يَسري على الإقامات القائمة.

    ولذلك: `roomTypes` تحمل التعريفة بالإشارة إلى خدمة في دليل الخدمات
    (`serviceId`) ولا تُخزّن السعر مكرَّرًا، و`rooms` تحمل حالة الإشغال
    اللحظية لكل وحدة قابلة للحجز.
   ═══════════════════════════════════════════════════════════════════════════
   ============================================================================ */

/**
 * أنواع وحدات الإقامة.
 *
 * `serviceId` يشاور على خدمة الإقامة اليومية في `hospitalServices` — وهي
 * **المصدر الوحيد للسعر**. لا حقل `dailyRate` مخزَّن هنا: تعديل سعر الخدمة
 * يسري فورًا على كل الوحدات من نوعها بلا تحديث ثانٍ.
 *
 * `nursingServiceId` خدمة الإشراف الطبي والتمريض التي تُحمَّل مع الإقامة
 * يوميًا — بعض الأنواع تدمجها في سعرها فتكون `null`.
 */
export const roomTypes = [
  { id: 1, code: "RT-ROYAL",  name: "جناح ملكي فاخر",          category: "room", serviceId: 1, nursingServiceId: 4,    capacity: 1, department: "القسم الداخلي" },
  { id: 2, code: "RT-SINGLE", name: "غرفة مفردة ممتازة",        category: "room", serviceId: 2, nursingServiceId: 4,    capacity: 1, department: "القسم الداخلي" },
  { id: 3, code: "RT-DOUBLE", name: "غرفة مزدوجة مشتركة",       category: "room", serviceId: 3, nursingServiceId: 4,    capacity: 2, department: "القسم الداخلي" },
  { id: 4, code: "RT-ICU",    name: "سرير عناية مركزة عامة",     category: "icu",  serviceId: 5, nursingServiceId: 8,    capacity: 1, department: "العناية المركزة" },
  { id: 5, code: "RT-CCU",    name: "سرير عناية قلب (CCU)",      category: "icu",  serviceId: 6, nursingServiceId: 8,    capacity: 1, department: "العناية المركزة" },
  { id: 6, code: "RT-NICU",   name: "حضّانة مبتسرين (NICU)",     category: "icu",  serviceId: 7, nursingServiceId: null, capacity: 1, department: "المبتسرين" },
];

/**
 * الوحدات القابلة للحجز — غرفة كاملة أو سرير داخل وحدة عناية.
 *
 * `status` هو حالة الإشغال اللحظية: `vacant` فاضي · `occupied` مشغول ·
 * `cleaning` تحت التنظيف والتجهيز · `maintenance` خارج الخدمة.
 *
 * **لا تُكتب `occupied` هنا يدويًا.** الإشغال يُسقَط أدناه من الإقامات
 * القائمة وحدها، فلا توجد وحدة «مشغولة» لا يُعرف من يشغلها.
 */
export const rooms = (() => {
  const out = [];
  let id = 0;

  const push = (row) => {
    id += 1;
    out.push({
      id,
      currentAdmissionId: null,
      currentPatientId: null,
      currentPatientName: null,
      occupiedSince: null,
      notes: null,
      ...row,
    });
  };

  /* --- الدور الثالث: الأجنحة الملكية والمفردة الممتازة --- */
  push({ code: "301", name: "جناح خاص 301", roomTypeId: 1, floor: "الدور الثالث", wing: "الجناح الشرقي", status: "vacant" });
  push({ code: "302", name: "جناح خاص 302", roomTypeId: 1, floor: "الدور الثالث", wing: "الجناح الشرقي", status: "vacant" });
  push({ code: "303", name: "جناح خاص 303", roomTypeId: 1, floor: "الدور الثالث", wing: "الجناح الغربي", status: "cleaning" });
  push({ code: "304", name: "غرفة مفردة 304", roomTypeId: 2, floor: "الدور الثالث", wing: "الجناح الغربي", status: "vacant" });
  push({ code: "305", name: "غرفة مفردة 305", roomTypeId: 2, floor: "الدور الثالث", wing: "الجناح الغربي", status: "vacant" });
  push({ code: "306", name: "غرفة مفردة 306", roomTypeId: 2, floor: "الدور الثالث", wing: "الجناح الغربي", status: "maintenance", notes: "إصلاح تكييف" });

  /* --- الدور الثاني: مفردة ومزدوجة --- */
  push({ code: "201", name: "غرفة مفردة 201", roomTypeId: 2, floor: "الدور الثاني", wing: "الجناح الشرقي", status: "vacant" });
  push({ code: "202", name: "غرفة مفردة 202", roomTypeId: 2, floor: "الدور الثاني", wing: "الجناح الشرقي", status: "vacant" });
  push({ code: "203", name: "غرفة مفردة 203", roomTypeId: 2, floor: "الدور الثاني", wing: "الجناح الشرقي", status: "vacant" });
  push({ code: "204", name: "غرفة مفردة 204", roomTypeId: 2, floor: "الدور الثاني", wing: "الجناح الشرقي", status: "vacant" });
  push({ code: "205", name: "غرفة مزدوجة 205", roomTypeId: 3, floor: "الدور الثاني", wing: "الجناح الغربي", status: "vacant" });
  push({ code: "206", name: "غرفة مزدوجة 206", roomTypeId: 3, floor: "الدور الثاني", wing: "الجناح الغربي", status: "vacant" });
  push({ code: "207", name: "غرفة مزدوجة 207", roomTypeId: 3, floor: "الدور الثاني", wing: "الجناح الغربي", status: "cleaning" });
  push({ code: "208", name: "غرفة مزدوجة 208", roomTypeId: 3, floor: "الدور الثاني", wing: "الجناح الغربي", status: "vacant" });

  /* --- الدور الأول: مزدوجة اقتصادية --- */
  push({ code: "101", name: "غرفة 101", roomTypeId: 3, floor: "الدور الأول", wing: "الجناح الشرقي", status: "vacant" });
  push({ code: "102", name: "غرفة 102", roomTypeId: 3, floor: "الدور الأول", wing: "الجناح الشرقي", status: "vacant" });
  push({ code: "103", name: "غرفة 103", roomTypeId: 3, floor: "الدور الأول", wing: "الجناح الشرقي", status: "vacant" });
  push({ code: "104", name: "غرفة 104", roomTypeId: 3, floor: "الدور الأول", wing: "الجناح الغربي", status: "vacant" });
  push({ code: "105", name: "غرفة 105", roomTypeId: 3, floor: "الدور الأول", wing: "الجناح الغربي", status: "maintenance", notes: "تجديد دهانات" });
  push({ code: "106", name: "غرفة 106", roomTypeId: 3, floor: "الدور الأول", wing: "الجناح الغربي", status: "vacant" });
  push({ code: "107", name: "غرفة 107", roomTypeId: 3, floor: "الدور الأول", wing: "الجناح الغربي", status: "vacant" });
  push({ code: "108", name: "غرفة 108", roomTypeId: 3, floor: "الدور الأول", wing: "الجناح الغربي", status: "cleaning" });

  /* --- العناية المركزة العامة --- */
  for (let n = 1; n <= 6; n += 1) {
    const code = `ICU-${String(n).padStart(2, "0")}`;
    push({
      code,
      name: `سرير عناية ${code}`,
      roomTypeId: 4,
      floor: "الدور الأرضي",
      wing: "وحدة العناية المركزة",
      status: n === 5 ? "maintenance" : "vacant",
      notes: n === 5 ? "صيانة جهاز مراقبة" : null,
    });
  }

  /* --- عناية القلب --- */
  for (let n = 1; n <= 4; n += 1) {
    const code = `CCU-${String(n).padStart(2, "0")}`;
    push({
      code,
      name: `سرير عناية قلب ${code}`,
      roomTypeId: 5,
      floor: "الدور الأرضي",
      wing: "وحدة عناية القلب",
      status: "vacant",
    });
  }

  /* --- حضّانات المبتسرين --- */
  for (let n = 1; n <= 5; n += 1) {
    const code = `NICU-${String(n).padStart(2, "0")}`;
    push({
      code,
      name: `حضّانة ${code}`,
      roomTypeId: 6,
      floor: "الدور الأول",
      wing: "وحدة المبتسرين",
      status: "vacant",
    });
  }

  return out;
})();

/** فهرس سريع بالكود — يُستخدم في ربط البيانات التجريبية ببعضها. */
const roomByCode = new Map(rooms.map((room) => [room.code, room]));

/* ============================================================================
   3. سجل المرضى
   ============================================================================ */

const PATIENT_NAMES = [
  ["أحمد محمود خليل", "male"],
  ["سارة إبراهيم الدسوقي", "female"],
  ["محمود عبد الفتاح النجار", "male"],
  ["فاطمة حسن القاضي", "female"],
  ["طارق كمال الصياد", "male"],
  ["منى عز الدين رضوان", "female"],
  ["ياسر مصطفى الجندي", "male"],
  ["نوران سعيد الشناوي", "female"],
  ["عمر شريف المهدي", "male"],
  ["هناء عاطف منصور", "female"],
  ["خالد عبد الرحيم بركات", "male"],
  ["إيمان وجدي التلمساني", "female"],
  ["شريف جلال البيلي", "male"],
  ["دعاء زكريا البنا", "female"],
  ["كريم عادل مرسي", "male"],
];

export const patients = PATIENT_NAMES.map(([name, gender], index) => {
  const id = index + 1;
  /*
   * نوع المريض هو ما يُحدِّد شريحة تعريفته. ثلاثة أنواع محلية ونوع وافد:
   *   · `insurance` تأمين أو جهة متعاقدة
   *   · `cash`      نقدي خاص
   *   · `foreign`   وافد / سياحة علاجية — تعريفة بالدولار
   *   · `staff`     من العاملين بالمنشأة أو ذويهم
   *
   * النوع صفة في ملف المريض لا قرار يُتخذ عند كل فاتورة: ترك الشريحة
   * لاختيار الموظف وقت الفوترة هو ما يُنتج مريضًا واحدًا بثلاث تعريفات.
   */
  const FOREIGN_INDEXES = [3, 10];
  const STAFF_INDEXES = [7];

  const patientType = FOREIGN_INDEXES.includes(index)
    ? "foreign"
    : STAFF_INDEXES.includes(index)
      ? "staff"
      : index % 3 !== 0
        ? "insurance"
        : "cash";

  const isInsurance = patientType === "insurance";
  const isForeign = patientType === "foreign";
  const provider = isInsurance ? insuranceProviders[index % insuranceProviders.length] : null;

  const FOREIGN_PROFILES = [
    { nationality: "السعودية", currency: "SAR", passport: "S4821907" },
    { nationality: "الكويت", currency: "KWD", passport: "K1192384" },
    { nationality: "الإمارات", currency: "AED", passport: "A7730192" },
    { nationality: "ليبيا", currency: "USD", passport: "L2048813" },
  ];
  const foreignProfile = isForeign ? FOREIGN_PROFILES[index % FOREIGN_PROFILES.length] : null;
  const coverageRate = provider ? provider.defaultCoverage : 0;
  
  // حالات المرضى: محجوز، طوارئ/عيادات، تم الخروج
  const status = index < 6 ? "inpatient" : index < 11 ? "discharged" : "outpatient";
  /*
   * الغرفة الحالية تُسنَد لاحقًا من الإقامة القائمة (انظر «توحيد حالة المريض»
   * أدناه). لا تُنتقى هنا من قائمة أسماء، فيُنسب مريض لغرفة لا إقامة له فيها.
   */
  const room = null;

  return {
    id,
    code: `PAT-${String(id).padStart(4, "0")}`,
    name,
    gender,
    nationalId: `2${random.int(60, 99)}${String(random.int(1, 12)).padStart(2, "0")}${String(random.int(1, 28)).padStart(2, "0")}220194${id}`,
    phone: `01${random.pick(["0", "1", "2", "5"])}${random.int(10000000, 99999999)}`,
    birthDate: `19${random.int(60, 98)}-${String(random.int(1, 12)).padStart(2, "0")}-${String(random.int(1, 28)).padStart(2, "0")}`,
    bloodGroup: random.pick(["A+", "B+", "O+", "AB+", "O-", "A-"]),
    /** نوع المريض — يُحدِّد شريحة التعريفة عند الفوترة. */
    patientType,
    patientTypeLabel:
      patientType === "insurance"
        ? "تأمين / جهة متعاقدة"
        : patientType === "foreign"
          ? "وافد / سياحة علاجية"
          : patientType === "staff"
            ? "من العاملين وذويهم"
            : "نقدي خاص",

    /** محفوظ للتوافق مع الشاشات القائمة — مشتق من `patientType`. */
    insuranceType: isInsurance ? "insurance" : "cash",

    /* --- بيانات الوافد --- */
    isForeign,
    nationality: foreignProfile?.nationality ?? "مصر",
    passportNumber: foreignProfile?.passport ?? null,
    preferredCurrency: foreignProfile?.currency ?? "EGP",
    insuranceProvider: provider?.name ?? "نقدي / خاص",
    insuranceProviderId: provider?.id ?? null,
    policyNumber: isInsurance ? `POL-${random.int(100000, 999999)}` : "—",
    coverageRate,
    status, // inpatient | outpatient | discharged
    statusLabel: status === "inpatient" ? "مقيم / منوّم" : status === "discharged" ? "تم الخروج" : "عيادات خارجية",
    currentRoom: room,
    admissionDate: status === "inpatient" ? "2026-11-04" : status === "discharged" ? "2026-10-18" : null,
    attendingDoctor: random.pick([
      "د. حازم عبد العزيز — استشاري الجراحة العامة",
      "د. طارق الشربيني — استشاري الرعاية المركزة",
      "د. شيرين حسني — استشاري أمراض القلب",
      "د. محمد سامي — استشاري جراحة العظام",
      "د. نيفين كمال — استشاري الباطنة العامة",
    ]),
    totalBilled: 0, // محسوبة تالياً
    totalPaid: 0,
    balance: 0,
    notes: isInsurance
      ? `تغطية تأمينية معتمدة بنسبة ${Math.round(coverageRate * 100)}%`
      : isForeign
        ? `مريض وافد — ${foreignProfile.nationality} · جواز ${foreignProfile.passport}`
        : patientType === "staff"
          ? "من العاملين بالمنشأة — تعريفة مخفّضة"
          : "مريض علاج نقدي خاص",
  };
});

/* ============================================================================
   4. سجل الإقامة والعمليات والعناية المركزة (Admissions)
   ============================================================================ */

export const admissions = [
  {
    id: 1,
    code: "ADM-2026-0001",
    patientId: 1,
    patientName: "أحمد محمود خليل",
    patientCode: "PAT-0001",
    stayType: "room",
    stayTypeLabel: "إقامة غرف",
    department: "القسم الداخلي",
    roomNumber: "جناح خاص 301",
    dailyRate: 3500,
    admissionDate: "2026-11-04",
    dischargeDate: null,
    daysCount: 7,
    attendingDoctor: "د. حازم عبد العزيز — استشاري الجراحة العامة",
    status: "active",
    statusLabel: "محجوز حالياً",
    diagnosis: "استئصال مرارة بالمنظار مع متابعة ما بعد الجراحة",
    totalCost: 3500 * 7 + 16500 + 3200 + 4500, // إقامة + جراحة + تخدير + تعقيم
  },
  {
    id: 2,
    code: "ADM-2026-0002",
    patientId: 2,
    patientName: "سارة إبراهيم الدسوقي",
    patientCode: "PAT-0002",
    stayType: "icu",
    stayTypeLabel: "عناية مركزة (ICU)",
    department: "العناية المركزة",
    roomNumber: "سرير عناية ICU-02",
    dailyRate: 5200,
    admissionDate: "2026-11-06",
    dischargeDate: null,
    daysCount: 5,
    attendingDoctor: "د. طارق الشربيني — استشاري الرعاية المركزة",
    status: "active",
    statusLabel: "محجوز حالياً",
    diagnosis: "قصور تنفسي حاد ومراقبة ضغط دم شرياني",
    totalCost: 5200 * 5 + 1800 * 5 + 2600 + 680,
  },
  {
    id: 3,
    code: "ADM-2026-0003",
    patientId: 3,
    patientName: "محمود عبد الفتاح النجار",
    patientCode: "PAT-0003",
    stayType: "surgery",
    stayTypeLabel: "عمليات وقسطرة",
    department: "القسطرة وجراحة القلب",
    roomNumber: "سرير عناية CCU-01",
    dailyRate: 6000,
    admissionDate: "2026-11-07",
    dischargeDate: null,
    daysCount: 4,
    attendingDoctor: "د. شيرين حسني — استشاري أمراض القلب",
    status: "active",
    statusLabel: "محجوز حالياً",
    diagnosis: "ذبحة صدرية غير مستقرة وقسطرة علاجية ودعامات",
    totalCost: 32000 + 6000 * 4 + 1750 + 680,
  },
  {
    id: 4,
    code: "ADM-2026-0004",
    patientId: 4,
    patientName: "فاطمة حسن القاضي",
    patientCode: "PAT-0004",
    stayType: "room",
    stayTypeLabel: "إقامة غرف",
    department: "النساء والولادة",
    roomNumber: "غرفة مفردة 204",
    dailyRate: 1600,
    admissionDate: "2026-11-08",
    dischargeDate: null,
    daysCount: 3,
    attendingDoctor: "د. حازم عبد العزيز",
    status: "active",
    statusLabel: "محجوز حالياً",
    diagnosis: "ولادة قيصرية ورعاية أمومة ووليد",
    totalCost: 12500 + 1600 * 3 + 1450,
  },
  {
    id: 5,
    code: "ADM-2026-0005",
    patientId: 7,
    patientName: "ياسر مصطفى الجندي",
    patientCode: "PAT-0007",
    stayType: "room",
    stayTypeLabel: "إقامة سابقة",
    department: "جراحة العظام",
    roomNumber: "غرفة 108",
    dailyRate: 1600,
    admissionDate: "2026-10-18",
    dischargeDate: "2026-10-25",
    daysCount: 7,
    attendingDoctor: "د. محمد سامي — استشاري جراحة العظام",
    status: "discharged",
    statusLabel: "تم الخروج بعد الشفاء",
    diagnosis: "استبدال مفصل ركبة ومتابعة علاج طبيعي",
    totalCost: 42000 + 1600 * 7 + 2600 + 1450,
  },
];

/* ----------------------------------------------------------------------------
   ربط الإقامات بالوحدات القابلة للحجز وتثبيت حالة الإشغال

   سجل الإقامة كان يحمل اسم الغرفة نصًّا. نربطه الآن بـ `roomId` حقيقي،
   ونُسقط حالة الإشغال على `rooms` من الإقامات القائمة — فتصبح شاشة الإشغال
   قراءةً مباشرة للواقع لا تخمينًا من نصوص.
   ---------------------------------------------------------------------------- */

/** يستخرج كود الوحدة من الاسم النصي القديم («جناح خاص 301» → «301»). */
function roomCodeFromLabel(label) {
  const text = String(label || "");
  const unitMatch = text.match(/(ICU|CCU|NICU)-\d{2}/);
  if (unitMatch) return unitMatch[0];
  const numberMatch = text.match(/\d{3}/);
  return numberMatch ? numberMatch[0] : null;
}

/**
 * يُعيد تاريخًا بإزاحة أيام عن التاريخ المرجعي.
 * `shiftDays(-6)` = قبل ستة أيام من «اليوم» في بيانات العرض.
 */
function shiftDays(days) {
  const d = new Date(REFERENCE_DATE.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/*
 * الإقامات القائمة تُثبَّت على التاريخ المرجعي: مريض «مقيم سبعة أيام» يعني
 * أنه دخل قبل ستة أيام من اليوم، لا في تاريخ ثابت يصير مستقبليًا مع الوقت.
 * (كان ADM-2026-0004 بتاريخ دخول لاحق لليوم المرجعي — إقامة لم تبدأ بعد
 * ومع ذلك محسوب لها ثلاثة أيام وإجمالي مالي.)
 */
for (const admission of admissions) {
  if (admission.status === "active") {
    const nights = Math.max(1, Number(admission.daysCount || 1));
    admission.admissionDate = shiftDays(-(nights - 1));
    admission.dischargeDate = null;
  }

  /*
   * `daysCount` و`totalCost` يُشتقّان من التواريخ ومن دفتر الاستحقاق — لا
   * يُخزَّنان. تركهما مخزَّنين هو ما جعل الإجمالي لا يطابق سطوره أبدًا.
   */
  delete admission.daysCount;
  delete admission.totalCost;
}

for (const admission of admissions) {
  const room = roomByCode.get(roomCodeFromLabel(admission.roomNumber));
  const roomType = room ? roomTypes.find((t) => t.id === room.roomTypeId) : null;

  admission.roomId = room?.id ?? null;
  admission.roomCode = room?.code ?? null;
  admission.roomTypeId = roomType?.id ?? null;
  admission.roomTypeName = roomType?.name ?? null;

  /* الإشغال يُسقط على الوحدة من الإقامة القائمة فقط. */
  if (room && admission.status === "active") {
    room.status = "occupied";
    room.currentAdmissionId = admission.id;
    room.currentPatientId = admission.patientId;
    room.currentPatientName = admission.patientName;
    room.occupiedSince = admission.admissionDate;
  }
}

/* ----------------------------------------------------------------------------
   توحيد حالة المريض مع إقامته

   حالة المريض وغرفته الحالية ليستا بيانات مستقلة — هما انعكاس لوجود إقامة
   قائمة أو عدمه. فصلهما يُنتج «مريض مقيم في غرفة 108» بينما الغرفة فاضية
   في شاشة الإشغال، وهو تناقض لا يستطيع موظف الاستقبال تفسيره.
   ---------------------------------------------------------------------------- */

const activeAdmissionByPatient = new Map(
  admissions.filter((a) => a.status === "active").map((a) => [a.patientId, a]),
);
const anyAdmissionByPatient = new Map(admissions.map((a) => [a.patientId, a]));

for (const patient of patients) {
  const active = activeAdmissionByPatient.get(patient.id);

  if (active) {
    patient.status = "inpatient";
    patient.statusLabel = "مقيم / منوّم";
    patient.currentRoom = active.roomNumber;
    patient.currentRoomId = active.roomId;
    patient.currentAdmissionId = active.id;
    patient.admissionDate = active.admissionDate;
    patient.attendingDoctor = active.attendingDoctor ?? patient.attendingDoctor;
    continue;
  }

  patient.currentRoom = null;
  patient.currentRoomId = null;
  patient.currentAdmissionId = null;

  const past = anyAdmissionByPatient.get(patient.id);
  if (past) {
    patient.status = "discharged";
    patient.statusLabel = "تم الخروج";
    patient.admissionDate = past.admissionDate;
  } else {
    patient.status = "outpatient";
    patient.statusLabel = "عيادات خارجية";
    patient.admissionDate = null;
  }
}

/* ============================================================================
   4.أ دفتر استحقاق خدمات الإقامة (Admission Charges Ledger)

   ═══════════════════════════════════════════════════════════════════════════
    دفتر واحد لكل ما يُحمَّل على المريض خلال إقامته — لا حساب يدوي.

    قبل ذلك كان إجمالي الإقامة رقمًا مضروبًا في ملف البيانات
    (`3500 * 7 + 16500 + …`). النتيجة: يوم إقامة يُنسى فلا يُحصَّل، ودواء
    يُصرف من الصيدلية فلا يظهر على الحساب.

    الآن كل تحميل سطرٌ في هذا الدفتر، مهما كان مصدره:
      · `bed_day`    رسم الإقامة اليومي — يولّده محرك الاستحقاق آليًا
      · `nursing`    الإشراف الطبي والتمريض اليومي
      · `medication` دواء أو مستهلك صُرف للمريض من الصيدلية
      · `procedure`  عملية أو إجراء أو فحص
    وإجمالي الإقامة يُشتق جمعًا لسطوره، ولا يُخزَّن أبدًا.
   ═══════════════════════════════════════════════════════════════════════════
   ============================================================================ */

const TODAY_ISO = REFERENCE_DATE.toISOString().slice(0, 10);

/** يُعيد قائمة التواريخ من البداية حتى النهاية (شاملة الطرفين). */
function datesBetween(fromDate, toDate) {
  const out = [];
  const cursor = new Date(`${fromDate}T00:00:00.000Z`);
  const end = new Date(`${toDate}T00:00:00.000Z`);
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export const admissionCharges = (() => {
  const out = [];
  let id = 0;

  const push = (row) => {
    id += 1;
    out.push({ id, invoiceId: null, invoicedAt: null, ...row });
  };

  for (const admission of admissions) {
    const roomType = roomTypes.find((t) => t.id === admission.roomTypeId);
    const roomService = roomType ? hospitalServices.find((s) => s.id === roomType.serviceId) : null;
    const nursingService = roomType?.nursingServiceId
      ? hospitalServices.find((s) => s.id === roomType.nursingServiceId)
      : null;

    /* الليالي المحمَّلة: من تاريخ الدخول حتى الخروج أو حتى اليوم. */
    const lastDay = admission.dischargeDate ?? TODAY_ISO;
    const stayDates = datesBetween(admission.admissionDate, lastDay);

    for (const date of stayDates) {
      if (roomService) {
        push({
          admissionId: admission.id,
          admissionCode: admission.code,
          patientId: admission.patientId,
          patientName: admission.patientName,
          date,
          category: "bed_day",
          categoryLabel: "رسم إقامة يومي",
          serviceId: roomService.id,
          serviceName: `${roomService.name} — ${admission.roomNumber}`,
          quantity: 1,
          unitPrice: roomService.price,
          amount: roomService.price,
          source: "bed_day_engine",
          sourceRef: `${admission.code}/${date}/bed_day`,
          createdBy: "محرك الاستحقاق اليومي",
          createdAt: `${date}T00:05:00.000Z`,
        });
      }

      if (nursingService) {
        push({
          admissionId: admission.id,
          admissionCode: admission.code,
          patientId: admission.patientId,
          patientName: admission.patientName,
          date,
          category: "nursing",
          categoryLabel: "إشراف طبي ورعاية تمريضية",
          serviceId: nursingService.id,
          serviceName: nursingService.name,
          quantity: 1,
          unitPrice: nursingService.price,
          amount: nursingService.price,
          source: "bed_day_engine",
          sourceRef: `${admission.code}/${date}/nursing`,
          createdBy: "محرك الاستحقاق اليومي",
          createdAt: `${date}T00:05:00.000Z`,
        });
      }
    }
  }

  return out;
})();


/* ============================================================================
   5. فواتير المرضى (Patient Invoices)
   ============================================================================ */

export const patientInvoices = [
  {
    id: 1,
    invoiceNumber: "PINV-2026-0001",
    patientId: 1,
    patientName: "أحمد محمود خليل",
    patientCode: "PAT-0001",
    date: "2026-11-04",
    dueDate: "2026-11-15",
    insuranceType: "insurance",
    insuranceProvider: "مصر للتأمين",
    coverageRate: 0.85,
    status: "partially_paid",
    statusLabel: "مسددة جزئياً",
    lines: [
      { id: 1, serviceCode: "SRV-ROOM-01", description: "إقامة يومية — جناح ملكي فاخر (7 أيام)", category: "room", categoryName: "إقامة غرف", quantity: 7, unitPrice: 3500, total: 24500 },
      { id: 2, serviceCode: "SRV-SURG-01", description: "جراحة استئصال مرارة بالمنظار", category: "surgery", categoryName: "عمليات جراحية", quantity: 1, unitPrice: 16500, total: 16500 },
      { id: 3, serviceCode: "SRV-SURG-06", description: "تخدير جراحي كلي وإشراف إفاقة", category: "surgery", categoryName: "عمليات جراحية", quantity: 1, unitPrice: 3200, total: 3200 },
      { id: 4, serviceCode: "SRV-SURG-07", description: "كشك عمليات جراحية ومستهلكات معقمة", category: "surgery", categoryName: "عمليات جراحية", quantity: 1, unitPrice: 4500, total: 4500 },
      { id: 5, serviceCode: "SRV-PHARM-01", description: "بروتوكول أدوية ومحاليل وريدية للقسم الداخلي", category: "medication", categoryName: "أدوية وعلاج", quantity: 1, unitPrice: 1450, total: 1450 },
    ],
    subtotal: 50150,
    discount: 150,
    totalAfterDiscount: 50000,
    insuranceAmount: 42500, // 85%
    patientAmount: 7500,    // 15%
    paidAmount: 5000,
    remainingAmount: 2500,
  },
  {
    id: 2,
    invoiceNumber: "PINV-2026-0002",
    patientId: 2,
    patientName: "سارة إبراهيم الدسوقي",
    patientCode: "PAT-0002",
    date: "2026-11-06",
    dueDate: "2026-11-20",
    insuranceType: "insurance",
    insuranceProvider: "بوبا مصر (Bupa)",
    coverageRate: 0.9,
    status: "unpaid",
    statusLabel: "غير مسددة",
    lines: [
      { id: 1, serviceCode: "SRV-ICU-01", description: "إقامة يومية — عناية مركزة عامة ICU (5 أيام)", category: "icu", categoryName: "عناية مركزة", quantity: 5, unitPrice: 5200, total: 26000 },
      { id: 2, serviceCode: "SRV-ICU-04", description: "تنفس صناعي ومراقبة حيوية متقدمة (5 أيام)", category: "icu", categoryName: "عناية مركزة", quantity: 5, unitPrice: 1800, total: 9000 },
      { id: 3, serviceCode: "SRV-RAD-01", description: "أشعة رنين مغناطيسي MRI", category: "radiology", categoryName: "أشعة وتصوير", quantity: 1, unitPrice: 2600, total: 2600 },
      { id: 4, serviceCode: "SRV-LAB-01", description: "باقة تحاليل شاملة (وظائف كبد وكلى وسكر)", category: "lab", categoryName: "تحاليل طبية", quantity: 1, unitPrice: 680, total: 680 },
    ],
    subtotal: 38280,
    discount: 280,
    totalAfterDiscount: 38000,
    insuranceAmount: 34200, // 90%
    patientAmount: 3800,    // 10%
    paidAmount: 0,
    remainingAmount: 3800,
  },
  {
    id: 3,
    invoiceNumber: "PINV-2026-0003",
    patientId: 3,
    patientName: "محمود عبد الفتاح النجار",
    patientCode: "PAT-0003",
    date: "2026-11-07",
    dueDate: "2026-11-18",
    insuranceType: "cash",
    insuranceProvider: "نقدي / خاص",
    coverageRate: 0,
    status: "paid",
    statusLabel: "مسددة بالكامل",
    lines: [
      { id: 1, serviceCode: "SRV-SURG-03", description: "قسطرة قلبية علاجية وتركيب دعامات تداخلية", category: "surgery", categoryName: "عمليات جراحية", quantity: 1, unitPrice: 32000, total: 32000 },
      { id: 2, serviceCode: "SRV-ICU-02", description: "إقامة يومية — عناية مركزة للقلب CCU (4 أيام)", category: "icu", categoryName: "عناية مركزة", quantity: 4, unitPrice: 6000, total: 24000 },
      { id: 3, serviceCode: "SRV-RAD-02", description: "أشعة مقطعية متعددة المقاطع CT", category: "radiology", categoryName: "أشعة وتصوير", quantity: 1, unitPrice: 1750, total: 1750 },
      { id: 4, serviceCode: "SRV-LAB-01", description: "باقة تحاليل طبية شاملة", category: "lab", categoryName: "تحاليل طبية", quantity: 1, unitPrice: 680, total: 680 },
    ],
    subtotal: 58430,
    discount: 430,
    totalAfterDiscount: 58000,
    insuranceAmount: 0,
    patientAmount: 58000,
    paidAmount: 58000,
    remainingAmount: 0,
  },
  {
    id: 4,
    invoiceNumber: "PINV-2026-0004",
    patientId: 4,
    patientName: "فاطمة حسن القاضي",
    patientCode: "PAT-0004",
    date: "2026-11-08",
    dueDate: "2026-11-22",
    insuranceType: "insurance",
    insuranceProvider: "أكسا للتأمين (AXA)",
    coverageRate: 0.8,
    status: "partially_paid",
    statusLabel: "مسددة جزئياً",
    lines: [
      { id: 1, serviceCode: "SRV-SURG-05", description: "ولادة قيصرية ورعاية طبية شاملة", category: "surgery", categoryName: "عمليات جراحية", quantity: 1, unitPrice: 12500, total: 12500 },
      { id: 2, serviceCode: "SRV-ROOM-02", description: "إقامة يومية — غرفة مفردة ممتازة (3 أيام)", category: "room", categoryName: "إقامة غرف", quantity: 3, unitPrice: 1600, total: 4800 },
      { id: 3, serviceCode: "SRV-PHARM-01", description: "بروتوكول أدوية ومحاليل علاجية", category: "medication", categoryName: "أدوية وعلاج", quantity: 1, unitPrice: 1450, total: 1450 },
    ],
    subtotal: 18750,
    discount: 250,
    totalAfterDiscount: 18500,
    insuranceAmount: 14800, // 80%
    patientAmount: 3700,    // 20%
    paidAmount: 2000,
    remainingAmount: 1700,
  },
  {
    id: 5,
    invoiceNumber: "PINV-2026-0005",
    patientId: 7,
    patientName: "ياسر مصطفى الجندي",
    patientCode: "PAT-0007",
    date: "2026-10-25",
    dueDate: "2026-11-05",
    insuranceType: "insurance",
    insuranceProvider: "الهيئة العامة للتأمين الصحي",
    coverageRate: 0.95,
    status: "paid",
    statusLabel: "مسددة بالكامل",
    lines: [
      { id: 1, serviceCode: "SRV-SURG-04", description: "استبدال مفصل ركبة جراحي كامل", category: "surgery", categoryName: "عمليات جراحية", quantity: 1, unitPrice: 42000, total: 42000 },
      { id: 2, serviceCode: "SRV-ROOM-02", description: "إقامة يومية — غرفة مفردة (7 أيام)", category: "room", categoryName: "إقامة غرف", quantity: 7, unitPrice: 1600, total: 11200 },
      { id: 3, serviceCode: "SRV-RAD-01", description: "أشعة رنين مغناطيسي MRI للركبة", category: "radiology", categoryName: "أشعة وتصوير", quantity: 1, unitPrice: 2600, total: 2600 },
    ],
    subtotal: 55800,
    discount: 800,
    totalAfterDiscount: 55000,
    insuranceAmount: 52250, // 95%
    patientAmount: 2750,    // 5%
    paidAmount: 2750,
    remainingAmount: 0,
  },
];

/* ============================================================================
   6. سندات القبض والدفعات النقدية والبنكية للمرضى (Patient Receipts)
   ============================================================================ */

export const patientReceipts = [
  {
    id: 1,
    receiptNumber: "PRC-2026-0001",
    patientId: 1,
    patientName: "أحمد محمود خليل",
    patientCode: "PAT-0001",
    invoiceId: 1,
    invoiceNumber: "PINV-2026-0001",
    date: "2026-11-04",
    amount: 5000,
    type: "deposit",
    typeLabel: "تأمين دخول مقدم",
    paymentMethod: "cash",
    paymentMethodLabel: "نقدي بالخزينة",
    targetAccount: "الخزينة الرئيسية (1111)",
    notes: "دفعة تأمين دخول عند بدء الإقامة واستئصال المرارة",
  },
  {
    id: 2,
    receiptNumber: "PRC-2026-0002",
    patientId: 3,
    patientName: "محمود عبد الفتاح النجار",
    patientCode: "PAT-0003",
    invoiceId: 3,
    invoiceNumber: "PINV-2026-0003",
    date: "2026-11-07",
    amount: 25000,
    type: "deposit",
    typeLabel: "تأمين عمليات وقسطرة",
    paymentMethod: "card",
    paymentMethodLabel: "بطاقة بنكية / فيزا",
    targetAccount: "البنك الأهلي المصري (1121)",
    notes: "دفعة أولى قبل دخول كشك القسطرة وركوب الدعامات",
  },
  {
    id: 3,
    receiptNumber: "PRC-2026-0003",
    patientId: 3,
    patientName: "محمود عبد الفتاح النجار",
    patientCode: "PAT-0003",
    invoiceId: 3,
    invoiceNumber: "PINV-2026-0003",
    date: "2026-11-10",
    amount: 33000,
    type: "invoice_payment",
    typeLabel: "سداد باقي الفاتورة",
    paymentMethod: "bank_transfer",
    paymentMethodLabel: "تحويل بنكي",
    targetAccount: "بنك مصر — حساب التشغيل (1122)",
    notes: "تسوية وسداد نهائي لكامل الفاتورة عند الخروج",
  },
  {
    id: 4,
    receiptNumber: "PRC-2026-0004",
    patientId: 4,
    patientName: "فاطمة حسن القاضي",
    patientCode: "PAT-0004",
    invoiceId: 4,
    invoiceNumber: "PINV-2026-0004",
    date: "2026-11-08",
    amount: 2000,
    type: "deposit",
    typeLabel: "تأمين دخول مقدم",
    paymentMethod: "cash",
    paymentMethodLabel: "نقدي بالخزينة",
    targetAccount: "الخزينة الرئيسية (1111)",
    notes: "تأمين دخول قسم النساء والتوليد",
  },
  {
    id: 5,
    receiptNumber: "PRC-2026-0005",
    patientId: 7,
    patientName: "ياسر مصطفى الجندي",
    patientCode: "PAT-0007",
    invoiceId: 5,
    invoiceNumber: "PINV-2026-0005",
    date: "2026-10-25",
    amount: 2750,
    type: "invoice_payment",
    typeLabel: "سداد نسبة التحمل",
    paymentMethod: "cash",
    paymentMethodLabel: "نقدي بالخزينة",
    targetAccount: "الخزينة الرئيسية (1111)",
    notes: "سداد كامل نسبة التحمل الخاصة بالمريض (5%)",
  },
];

// تحديث إجماليات المرضى من الفواتير والسندات
for (const patient of patients) {
  const patientInvs = patientInvoices.filter((inv) => inv.patientId === patient.id);
  const patientRecs = patientReceipts.filter((rec) => rec.patientId === patient.id);

  patient.totalBilled = patientInvs.reduce((sum, inv) => sum + inv.patientAmount, 0);
  patient.totalPaid = patientRecs.reduce((sum, rec) => sum + rec.amount, 0);
  patient.balance = Math.max(0, patient.totalBilled - patient.totalPaid);
}

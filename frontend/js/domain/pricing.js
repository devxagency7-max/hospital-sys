/**
 * قواعد التسعير وتحويل العملات — دوال خالصة.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  لا DOM، لا شبكة، لا `js/mock`. كل ما تحتاجه الدالة يُمرَّر إليها.
 *
 *  القاعدة المحاسبية التي تحرسها هذه الوحدة:
 *
 *    **الفاتورة تحتفظ بسعر صرف يوم إصدارها إلى الأبد.**
 *
 *  سعر الصرف الحالي يخص الحركة القادمة فقط. إعادة تقييم فاتورة قديمة بسعر
 *  اليوم تُغيّر إيرادًا اعتُرف به في فترة ربما تكون مُقفلة — وهذا تحريف
 *  للنتيجة لا تحديثٌ لها. الفارق بين سعر الإصدار وسعر التحصيل يُعترف به
 *  **فرق عملة** بندًا مستقلًا، فيبقى الإيراد الطبي مقيسًا بالخدمة وحدها
 *  ولا يختلط بمكسب أو خسارة سعر الصرف.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as money from "../core/money.js";

/** العملة الأساسية للمنشأة — كل القيود تُرحَّل بها. */
export const BASE_CURRENCY = "EGP";

/* ==========================================================================
   1) اختيار الشريحة
   ========================================================================== */

/**
 * يختار شريحة التعريفة المناسبة لنوع مريض.
 *
 * الشريحة الافتراضية (`isDefault`) هي شبكة الأمان: نوع مريض غير مُعرَّف في
 * أي شريحة يُسعَّر بالشريحة الأساسية ولا يُترك بلا سعر.
 *
 * @param {string} patientType  "cash" | "insurance" | "foreign" | "staff"
 * @param {object[]} tiers      شرائح التعريفة
 * @returns {object} الشريحة
 */
export function tierForPatientType(patientType, tiers = []) {
  if (!tiers.length) {
    throw new Error("لا توجد شرائح تعريفة معرَّفة — لا يمكن تسعير أي خدمة.");
  }

  const match = tiers.find((tier) => (tier.patientTypes ?? []).includes(patientType));
  if (match) return match;

  const fallback = tiers.find((tier) => tier.isDefault);
  if (fallback) return fallback;

  /*
   * لا شريحة مطابقة ولا افتراضية = خطأ إعداد صريح. اختيار «أول شريحة» هنا
   * يُسعِّر المريض بشريحة عشوائية بصمت.
   */
  throw new Error(
    `نوع المريض «${patientType}» لا يطابق أي شريحة تعريفة، ولا توجد شريحة افتراضية. ` +
      "راجع إعداد شرائح التعريفة.",
  );
}

/* ==========================================================================
   2) سعر الخدمة في شريحة
   ========================================================================== */

/**
 * يُحسب سعر خدمة في شريحة بعينها.
 *
 * الترتيب مقصود: **السعر المُعلَن الصريح يغلب المعامل دائمًا.** الاتفاق
 * المكتوب مع جهة بعينها أقوى من تقدير حسابي، ولو خالفه.
 *
 * @returns {{price:number, currency:string, source:"explicit"|"multiplier", tierId:number}}
 */
export function priceForService(service, tier, tariffPrices = []) {
  if (!service) throw new Error("الخدمة مطلوبة لحساب السعر.");
  if (!tier) throw new Error("شريحة التعريفة مطلوبة لحساب السعر.");

  const explicit = tariffPrices.find(
    (row) =>
      String(row.tierId) === String(tier.id) && String(row.serviceId) === String(service.id),
  );

  if (explicit) {
    return {
      price: money.round(explicit.price),
      currency: explicit.currency ?? tier.currency ?? BASE_CURRENCY,
      source: "explicit",
      tierId: tier.id,
      tierName: tier.name,
      notes: explicit.notes ?? null,
    };
  }

  const basePrice = money.round(service.price ?? 0);
  const multiplier = Number(tier.multiplier ?? 1);
  const scaled = money.round(basePrice * multiplier);

  /*
   * شريحة بعملة أجنبية بلا سعر مُعلَن: المعامل يُطبَّق على سعر بالجنيه ثم
   * تُعلَن النتيجة بالجنيه — لا نُسمّي رقمًا بالجنيه «دولارًا». إعلان
   * `currency: BASE_CURRENCY` هنا هو الصدق، وتحويله لعملة الشريحة مسؤولية
   * `convertAmount` بسعر صرف معروف.
   */
  return {
    price: scaled,
    currency: BASE_CURRENCY,
    source: "multiplier",
    tierId: tier.id,
    tierName: tier.name,
    multiplier,
    notes: null,
  };
}

/* ==========================================================================
   3) أسعار الصرف
   ========================================================================== */

/**
 * يُرجع سعر صرف عملة في تاريخ محدد — أحدث سعر **لا يتجاوز** ذلك التاريخ.
 *
 * استخدام أحدث سعر مطلقًا (ولو بعد تاريخ الفاتورة) يُقيّم فاتورة الأمس
 * بسعر الغد. ولذلك: لا سعر بعد تاريخ المستند أبدًا.
 *
 * @returns {{rate:number, date:string, currency:string}}
 */
export function rateFor(currency, date, rates = []) {
  if (!currency || currency === BASE_CURRENCY) {
    return { rate: 1, date, currency: BASE_CURRENCY };
  }

  const eligible = rates
    .filter((row) => row.currency === currency)
    .filter((row) => !date || String(row.date) <= String(date))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const latest = eligible[0];

  if (!latest) {
    /*
     * الافتراض الصامت بسعر 1 هو أخطر ما يمكن فعله هنا: فاتورة بـ 2,400
     * دولار تُرحَّل 2,400 جنيه، ويظهر الخلل بعد أشهر في فرق لا يُفسَّر.
     */
    throw new Error(
      `لا يوجد سعر صرف مُعلَن للعملة «${currency}» في تاريخ ${date ?? "—"} أو قبله. ` +
        "أضف سعر الصرف قبل إصدار مستند بهذه العملة.",
    );
  }

  return { rate: Number(latest.rate), date: latest.date, currency, source: latest.source ?? null };
}

/**
 * يحوّل مبلغًا من عملة إلى العملة الأساسية بسعر تاريخ محدد.
 *
 * @returns {{amount:number, baseAmount:number, currency:string, rate:number, rateDate:string}}
 */
export function convertAmount(amount, currency, date, rates = []) {
  const value = money.round(amount);
  const { rate, date: rateDate } = rateFor(currency, date, rates);

  return {
    amount: value,
    currency: currency ?? BASE_CURRENCY,
    baseAmount: money.round(value * rate),
    baseCurrency: BASE_CURRENCY,
    rate,
    rateDate,
  };
}

/* ==========================================================================
   4) فرق العملة عند التحصيل
   ========================================================================== */

/**
 * يحسب فرق العملة بين إصدار الفاتورة وتحصيلها.
 *
 * الموجب = مكسب فرق عملة (الجنيه نزل فصار المبلغ الأجنبي يساوي أكثر).
 * السالب = خسارة فرق عملة.
 *
 * **لا يُعدَّل الإيراد الأصلي.** الخدمة قُدِّمت بقيمتها، والفارق ناتج عن
 * الزمن وسعر الصرف لا عن الخدمة — فيُعترف به بندًا ماليًا مستقلًا.
 *
 * @param {object} args
 * @param {number} args.foreignAmount  المبلغ بالعملة الأجنبية المحصَّل
 * @param {number} args.invoiceRate    سعر الصرف يوم إصدار الفاتورة
 * @param {number} args.settlementRate سعر الصرف يوم التحصيل
 */
export function exchangeDifference({ foreignAmount, invoiceRate, settlementRate }) {
  const amount = money.round(foreignAmount);
  const atInvoice = money.round(amount * Number(invoiceRate));
  const atSettlement = money.round(amount * Number(settlementRate));
  const difference = money.subtract(atSettlement, atInvoice);

  return {
    foreignAmount: amount,
    invoiceRate: Number(invoiceRate),
    settlementRate: Number(settlementRate),
    baseAtInvoice: atInvoice,
    baseAtSettlement: atSettlement,
    difference,
    isGain: difference > 0,
    isLoss: difference < 0,
    label:
      difference > 0
        ? "مكسب فرق عملة"
        : difference < 0
          ? "خسارة فرق عملة"
          : "لا فرق عملة",
  };
}

/* ==========================================================================
   5) تسعير سطر فاتورة كامل
   ========================================================================== */

/**
 * يُسعِّر سطر خدمة لمريض: الشريحة ← السعر ← العملة ← المقابل بالجنيه.
 *
 * هي الدالة التي تستدعيها الفوترة، فتبقى قواعد الشرائح والعملة في مكان
 * واحد لا تتناسخ في كل شاشة.
 */
export function priceLine({ service, patientType, quantity = 1, date, tiers, tariffPrices, rates }) {
  const tier = tierForPatientType(patientType, tiers);
  const priced = priceForService(service, tier, tariffPrices);

  const qty = Number(quantity) || 1;
  const lineTotal = money.multiply(priced.price, qty);
  const converted = convertAmount(lineTotal, priced.currency, date, rates);

  return {
    serviceId: service.id,
    serviceName: service.name,
    tierId: tier.id,
    tierCode: tier.code,
    tierName: tier.name,
    priceSource: priced.source,
    quantity: qty,
    unitPrice: priced.price,
    currency: priced.currency,
    total: lineTotal,

    /** المقابل بالعملة الأساسية — هو ما يُرحَّل في القيد. */
    baseTotal: converted.baseAmount,
    baseCurrency: BASE_CURRENCY,
    exchangeRate: converted.rate,
    exchangeRateDate: converted.rateDate,
  };
}

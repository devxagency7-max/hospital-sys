/**
 * خدمة شرائح التعريفة وأسعار الصرف.
 *
 * الخدمة تقرأ البيانات وتستدعي قواعد `js/domain/pricing.js` — لا تُعيد
 * حساب قاعدة بنفسها. كل منطق التسعير وتحويل العملة في طبقة المجال.
 */

import { notFound, validationError, ruleViolation } from "../../core/errors.js";
import * as money from "../../core/money.js";
import { all, find, insert, query } from "../db.js";
import { audit } from "./posting.service.js";
import {
  BASE_CURRENCY,
  tierForPatientType,
  priceForService,
  priceLine,
  rateFor,
  convertAmount,
  exchangeDifference,
} from "../../domain/pricing.js";
import { REFERENCE_DATE } from "../seed.js";

const TODAY = REFERENCE_DATE.toISOString().slice(0, 10);

export { BASE_CURRENCY };

/* ==========================================================================
   1) الشرائح
   ========================================================================== */

/** شرائح التعريفة، مع عدد الأسعار المُعلَنة صريحةً في كل شريحة. */
export function listTariffTiers(params = {}) {
  const prices = all("tariffPrices");

  const rows = all("tariffTiers").map((tier) => ({
    ...tier,
    explicitPricesCount: prices.filter((p) => String(p.tierId) === String(tier.id)).length,
  }));

  return { data: rows, meta: { total: rows.length, baseCurrency: BASE_CURRENCY } };
}

/**
 * جدول أسعار خدمة في كل الشرائح — شاشة «سعر الخدمة لمن؟».
 *
 * يُظهر مصدر كل سعر (مُعلَن صريح أم محسوب بمعامل) حتى لا يُظن أن رقمًا
 * تقديريًا اتفاقٌ موقَّع.
 */
export function getServicePriceMatrix(serviceId) {
  const service = find("hospitalServices", serviceId);
  if (!service) throw notFound("الخدمة غير موجودة.");

  const tiers = all("tariffTiers");
  const prices = all("tariffPrices");
  const rates = all("exchangeRates");

  const rows = tiers.map((tier) => {
    const priced = priceForService(service, tier, prices);
    const converted = convertAmount(priced.price, priced.currency, TODAY, rates);

    return {
      tierId: tier.id,
      tierCode: tier.code,
      tierName: tier.name,
      patientTypes: tier.patientTypes,
      price: priced.price,
      currency: priced.currency,
      priceSource: priced.source,
      multiplier: priced.multiplier ?? null,
      notes: priced.notes,
      baseEquivalent: converted.baseAmount,
      exchangeRate: converted.rate,
    };
  });

  return {
    serviceId: service.id,
    serviceCode: service.code,
    serviceName: service.name,
    basePrice: service.price,
    baseCurrency: BASE_CURRENCY,
    tiers: rows,
  };
}

/**
 * تسعير خدمة لمريض بعينه — الشريحة تُشتق من نوعه لا يختارها الموظف.
 */
export function priceServiceForPatient({ patientId, serviceId, quantity = 1, date } = {}) {
  const patient = find("patients", patientId);
  if (!patient) throw notFound("المريض غير موجود.");

  const service = find("hospitalServices", serviceId);
  if (!service) throw notFound("الخدمة غير موجودة.");

  return priceLine({
    service,
    patientType: patient.patientType ?? "cash",
    quantity,
    date: date ?? TODAY,
    tiers: all("tariffTiers"),
    tariffPrices: all("tariffPrices"),
    rates: all("exchangeRates"),
  });
}

/** شريحة المريض وعملته المفضّلة — تُعرض في ترويسة الفاتورة والاستقبال. */
export function getPatientTariffProfile(patientId) {
  const patient = find("patients", patientId);
  if (!patient) throw notFound("المريض غير موجود.");

  const tier = tierForPatientType(patient.patientType ?? "cash", all("tariffTiers"));

  return {
    patientId: patient.id,
    patientName: patient.name,
    patientType: patient.patientType ?? "cash",
    patientTypeLabel: patient.patientTypeLabel ?? "نقدي خاص",
    isForeign: Boolean(patient.isForeign),
    nationality: patient.nationality ?? "مصر",
    tierId: tier.id,
    tierCode: tier.code,
    tierName: tier.name,
    tierCurrency: tier.currency,
    multiplier: tier.multiplier,
    coverageRate: patient.coverageRate ?? 0,
    insuranceProvider: patient.insuranceProvider ?? null,
  };
}

/* ==========================================================================
   2) أسعار الصرف
   ========================================================================== */

/** أسعار الصرف المُعلَنة — الأحدث أولًا. */
export function listExchangeRates(params = {}) {
  const rows = all("exchangeRates")
    .filter((r) => !params.currency || r.currency === params.currency)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);

  /* السعر الساري لكل عملة اليوم — ما تحتاجه الواجهة في سطر واحد. */
  const currencies = [...new Set(all("exchangeRates").map((r) => r.currency))];
  const current = currencies.map((currency) => {
    const resolved = rateFor(currency, TODAY, all("exchangeRates"));
    const meta = all("exchangeRates").find((r) => r.currency === currency);
    return {
      currency,
      name: meta?.name ?? currency,
      symbol: meta?.symbol ?? currency,
      rate: resolved.rate,
      rateDate: resolved.date,
    };
  });

  return {
    data: rows,
    meta: { total: rows.length, baseCurrency: BASE_CURRENCY, asOf: TODAY, current },
  };
}

/** السعر الساري لعملة في تاريخ — لا سعر بعد تاريخ المستند أبدًا. */
export function getExchangeRate({ currency, date } = {}) {
  if (!currency) throw validationError({ currency: "العملة مطلوبة." });
  return rateFor(currency, date ?? TODAY, all("exchangeRates"));
}

/**
 * إعلان سعر صرف جديد.
 *
 * السعر الجديد **لا يُعدِّل مستندًا صادرًا** — يسري على الحركة القادمة فقط.
 * هذا ليس قيدًا تقنيًا بل القاعدة المحاسبية نفسها.
 */
export function declareExchangeRate(payload = {}, { user } = {}) {
  const errors = {};
  if (!payload.currency) errors.currency = "العملة مطلوبة.";
  if (!(Number(payload.rate) > 0)) errors.rate = "سعر الصرف يجب أن يكون أكبر من صفر.";
  if (Object.keys(errors).length) throw validationError(errors);

  if (payload.currency === BASE_CURRENCY) {
    throw ruleViolation(
      `${BASE_CURRENCY} هي العملة الأساسية — لا يُعلَن لها سعر صرف.`,
      { field: "currency" },
    );
  }

  const date = payload.date ?? TODAY;

  /* سعران لنفس العملة في نفس اليوم يجعلان «سعر اليوم» غامضًا. */
  const duplicate = all("exchangeRates").find(
    (r) => r.currency === payload.currency && String(r.date) === String(date),
  );
  if (duplicate) {
    throw ruleViolation(
      `يوجد سعر مُعلَن لـ ${payload.currency} بتاريخ ${date} (${duplicate.rate}). ` +
        "أعلن السعر بتاريخ آخر بدل تكراره في نفس اليوم.",
      { field: "date" },
    );
  }

  const existing = all("exchangeRates").find((r) => r.currency === payload.currency);

  const created = insert("exchangeRates", {
    currency: payload.currency,
    code: payload.currency,
    name: payload.name ?? existing?.name ?? payload.currency,
    symbol: payload.symbol ?? existing?.symbol ?? payload.currency,
    rate: Number(payload.rate),
    date,
    source: payload.source ?? "إعلان يدوي",
  });

  audit({
    action: "fx.rate_declared",
    actionLabel: "إعلان سعر صرف",
    module: "المحاسبة المالية",
    entity: "exchange_rate",
    entityId: created.id,
    details:
      `${created.currency} = ${created.rate} ${BASE_CURRENCY} بتاريخ ${date} · ` +
      "يسري على الحركات القادمة فقط ولا يُعدِّل مستندًا صادرًا",
    user,
  });

  return created;
}

/**
 * فرق العملة بين إصدار مستند وتحصيله.
 *
 * يُستخدم عند تحصيل فاتورة بعملة أجنبية: الإيراد يبقى بقيمته الأصلية،
 * والفارق يُعترف به بندًا ماليًا مستقلًا.
 */
export function computeExchangeDifference(payload = {}) {
  const errors = {};
  if (!(Number(payload.foreignAmount) > 0)) errors.foreignAmount = "المبلغ بالعملة الأجنبية مطلوب.";
  if (!payload.currency) errors.currency = "العملة مطلوبة.";
  if (Object.keys(errors).length) throw validationError(errors);

  const rates = all("exchangeRates");
  const invoiceRate = payload.invoiceRate ?? rateFor(payload.currency, payload.invoiceDate, rates).rate;
  const settlementRate =
    payload.settlementRate ?? rateFor(payload.currency, payload.settlementDate ?? TODAY, rates).rate;

  return {
    currency: payload.currency,
    invoiceDate: payload.invoiceDate ?? null,
    settlementDate: payload.settlementDate ?? TODAY,
    ...exchangeDifference({
      foreignAmount: payload.foreignAmount,
      invoiceRate,
      settlementRate,
    }),
  };
}

/* ==========================================================================
   3) تسعير سلة خدمات — ما تستدعيه الفوترة
   ========================================================================== */

/**
 * يُسعِّر عدة خدمات لمريض واحد ويُرجع الإجماليات بالعملتين.
 *
 * `baseTotal` هو ما يُرحَّل في القيد. `total` هو ما يراه المريض بعملته.
 * الفصل بينهما مقصود: المريض يدفع بعملته والدفتر يُقاس بعملة المنشأة.
 */
export function priceBasketForPatient({ patientId, lines = [], date } = {}) {
  const patient = find("patients", patientId);
  if (!patient) throw notFound("المريض غير موجود.");
  if (!lines.length) throw validationError({ lines: "أضف خدمة واحدة على الأقل." });

  const tiers = all("tariffTiers");
  const prices = all("tariffPrices");
  const rates = all("exchangeRates");
  const asOf = date ?? TODAY;

  const priced = lines.map((line) => {
    const service = find("hospitalServices", line.serviceId);
    if (!service) throw notFound(`الخدمة #${line.serviceId} غير موجودة.`);

    return priceLine({
      service,
      patientType: patient.patientType ?? "cash",
      quantity: line.quantity ?? 1,
      date: asOf,
      tiers,
      tariffPrices: prices,
      rates,
    });
  });

  /* عملة واحدة للفاتورة: خلط عملتين في مستند واحد يجعل إجماليه بلا معنى. */
  const currencies = [...new Set(priced.map((l) => l.currency))];
  if (currencies.length > 1) {
    throw ruleViolation(
      `سطور الفاتورة بعملات مختلفة (${currencies.join(", ")}) — ` +
        "افصلها في مستندين، فالإجمالي بعملتين لا معنى له.",
      { field: "lines" },
    );
  }

  const currency = currencies[0] ?? BASE_CURRENCY;
  const total = priced.reduce((sum, l) => money.add(sum, l.total), 0);
  const baseTotal = priced.reduce((sum, l) => money.add(sum, l.baseTotal), 0);

  return {
    patientId: patient.id,
    patientName: patient.name,
    patientType: patient.patientType ?? "cash",
    tierId: priced[0]?.tierId ?? null,
    tierName: priced[0]?.tierName ?? null,
    date: asOf,
    currency,
    total,
    baseCurrency: BASE_CURRENCY,
    baseTotal,
    exchangeRate: priced[0]?.exchangeRate ?? 1,
    exchangeRateDate: priced[0]?.exchangeRateDate ?? asOf,
    lines: priced,
  };
}

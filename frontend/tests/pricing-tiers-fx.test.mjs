/**
 * اختبارات شرائح التعريفة والعملات وأسعار الصرف.
 *
 *   node tests/pricing-tiers-fx.test.mjs
 *
 * الضمانات:
 *   1. الشريحة تُشتق من نوع المريض — لا يختارها الموظف.
 *   2. السعر المُعلَن الصريح يغلب المعامل دائمًا.
 *   3. لا سعر صرف بعد تاريخ المستند، ولا افتراض صامت بسعر 1.
 *   4. الفاتورة تحتفظ بسعر يوم إصدارها، وفرق العملة بند مستقل.
 */

import { assert, section, report } from "./harness.mjs";
import {
  BASE_CURRENCY,
  tierForPatientType,
  priceForService,
  priceLine,
  rateFor,
  convertAmount,
  exchangeDifference,
} from "../js/domain/pricing.js";
import {
  listTariffTiers,
  getServicePriceMatrix,
  getPatientTariffProfile,
  priceServiceForPatient,
  priceBasketForPatient,
  listExchangeRates,
  getExchangeRate,
  declareExchangeRate,
  computeExchangeDifference,
} from "../js/mock/services/pricing.service.js";
import { createPatientInvoice, createPatientReceipt } from "../js/mock/services/patients.service.js";
import { all, find } from "../js/mock/db.js";
import * as money from "../js/core/money.js";

const TIERS = all("tariffTiers");
const PRICES = all("tariffPrices");
const RATES = all("exchangeRates");

/* ==========================================================================
   1. اختيار الشريحة من نوع المريض
   ========================================================================== */

section("الشريحة تُشتق من نوع المريض لا يختارها الموظف");

assert("شرائح التعريفة معرَّفة", TIERS.length >= 4);
assert("توجد شريحة افتراضية واحدة بالضبط",
  TIERS.filter((t) => t.isDefault).length === 1);

const cases = [
  ["cash", "TIER-CASH", "EGP"],
  ["insurance", "TIER-INS", "EGP"],
  ["foreign", "TIER-FOREIGN", "USD"],
  ["staff", "TIER-STAFF", "EGP"],
];

for (const [type, code, currency] of cases) {
  const tier = tierForPatientType(type, TIERS);
  assert(`نوع «${type}» يُسعَّر بشريحة ${code}`, tier.code === code);
  assert(`شريحة ${code} بعملة ${currency}`, tier.currency === currency);
}

assert("نوع غير معروف يسقط على الشريحة الافتراضية",
  tierForPatientType("unknown_type", TIERS).isDefault === true);

let noTiers = false;
try {
  tierForPatientType("cash", []);
} catch {
  noTiers = true;
}
assert("غياب الشرائح خطأ صريح لا سعر صفري صامت", noTiers);

/* ==========================================================================
   2. السعر المُعلَن يغلب المعامل
   ========================================================================== */

section("السعر المُعلَن الصريح يغلب المعامل الحسابي");

const heartSurgery = find("hospitalServices", 10);
const insuranceTier = TIERS.find((t) => t.code === "TIER-INS");
const foreignTier = TIERS.find((t) => t.code === "TIER-FOREIGN");
const staffTier = TIERS.find((t) => t.code === "TIER-STAFF");

const insPrice = priceForService(heartSurgery, insuranceTier, PRICES);
assert("جراحة القلب للتأمين بسعر مُعلَن صريح", insPrice.source === "explicit");
assert("السعر المُعلَن مطابق للاتفاق", insPrice.price === 72_000);
assert("السعر المُعلَن لا يساوي المعامل × الأساس",
  insPrice.price !== money.round(heartSurgery.price * insuranceTier.multiplier));

const staffPrice = priceForService(heartSurgery, staffTier, PRICES);
assert("خدمة بلا سعر مُعلَن تُسعَّر بالمعامل", staffPrice.source === "multiplier");
assert("السعر بالمعامل = الأساس × المعامل",
  staffPrice.price === money.round(heartSurgery.price * staffTier.multiplier));

const forPrice = priceForService(heartSurgery, foreignTier, PRICES);
assert("سعر الوافد المُعلَن بالدولار", forPrice.currency === "USD" && forPrice.price === 2_400);

/* الشريحة الأجنبية بلا سعر مُعلَن لا تُسمّي الجنيه دولارًا. */
const lab = find("hospitalServices", 20);
const forLab = priceForService(lab, foreignTier, PRICES);
assert("شريحة أجنبية بلا سعر مُعلَن تُعلن النتيجة بالعملة الأساسية بصدق",
  forLab.source === "multiplier" && forLab.currency === BASE_CURRENCY);

/* ==========================================================================
   3. أسعار الصرف — لا سعر بعد تاريخ المستند
   ========================================================================== */

section("أسعار الصرف: لا سعر بعد تاريخ المستند ولا افتراض صامت");

assert("العملة الأساسية سعرها واحد", rateFor(BASE_CURRENCY, "2026-11-07", RATES).rate === 1);

const early = rateFor("USD", "2026-11-02", RATES);
const late = rateFor("USD", "2026-11-07", RATES);
assert("سعر 2 نوفمبر هو سعر 1 نوفمبر (أحدث سعر لا يتجاوز التاريخ)", early.date === "2026-11-01");
assert("سعر 7 نوفمبر هو سعر 7 نوفمبر", late.date === "2026-11-07");
assert("السعر اللاحق أعلى في بياناتنا", late.rate > early.rate);

let beforeAnyRate = false;
try {
  rateFor("USD", "2020-01-01", RATES);
} catch {
  beforeAnyRate = true;
}
assert("تاريخ يسبق كل الأسعار المُعلَنة يرمي خطأً", beforeAnyRate);

let unknownCurrency = false;
try {
  rateFor("JPY", "2026-11-07", RATES);
} catch {
  unknownCurrency = true;
}
assert("عملة بلا سعر مُعلَن ترمي خطأً ولا تفترض 1", unknownCurrency);

const converted = convertAmount(100, "USD", "2026-11-07", RATES);
assert("التحويل يُرجع المبلغ الأصلي وعملته", converted.amount === 100 && converted.currency === "USD");
assert("التحويل يُرجع المقابل بالعملة الأساسية",
  converted.baseAmount === money.round(100 * late.rate));

/* ==========================================================================
   4. فرق العملة بند مستقل
   ========================================================================== */

section("فرق العملة بند مستقل لا تعديل للإيراد");

const gain = exchangeDifference({ foreignAmount: 1_000, invoiceRate: 48.65, settlementRate: 49.15 });
assert("ارتفاع سعر الصرف = مكسب فرق عملة", gain.isGain && gain.difference > 0);
assert("المكسب = (سعر التحصيل − سعر الفاتورة) × المبلغ",
  gain.difference === money.subtract(gain.baseAtSettlement, gain.baseAtInvoice));

const loss = exchangeDifference({ foreignAmount: 1_000, invoiceRate: 49.15, settlementRate: 48.65 });
assert("انخفاض سعر الصرف = خسارة فرق عملة", loss.isLoss && loss.difference < 0);

const flat = exchangeDifference({ foreignAmount: 1_000, invoiceRate: 49, settlementRate: 49 });
assert("تساوي السعرين = لا فرق عملة", flat.difference === 0 && !flat.isGain && !flat.isLoss);

const svcDiff = computeExchangeDifference({
  currency: "USD",
  foreignAmount: 500,
  invoiceDate: "2026-11-01",
  settlementDate: "2026-11-07",
});
assert("الخدمة تحسب الفرق من الأسعار المُعلَنة", svcDiff.difference !== 0);
assert("الخدمة تُسمّي الفرق", Boolean(svcDiff.label));

/* ==========================================================================
   5. جدول الأسعار وملف المريض
   ========================================================================== */

section("جدول سعر الخدمة لكل شريحة وملف تعريفة المريض");

const matrix = getServicePriceMatrix(10);
assert("الجدول يغطي كل الشرائح", matrix.tiers.length === TIERS.length);
assert("الجدول يُعلن مصدر كل سعر",
  matrix.tiers.every((t) => ["explicit", "multiplier"].includes(t.priceSource)));
assert("الجدول يُعلن المقابل بالعملة الأساسية",
  matrix.tiers.every((t) => t.baseEquivalent > 0));

const foreignPatient = all("patients").find((p) => p.isForeign);
assert("يوجد مريض وافد في البيانات", Boolean(foreignPatient));

const profile = getPatientTariffProfile(foreignPatient.id);
assert("ملف المريض الوافد يحمل شريحة الوافد", profile.tierCode === "TIER-FOREIGN");
assert("ملف المريض الوافد يحمل جنسيته", profile.nationality !== "مصر");
assert("ملف المريض الوافد بعملة أجنبية", profile.tierCurrency !== BASE_CURRENCY);

const quoted = priceServiceForPatient({ patientId: foreignPatient.id, serviceId: 11, quantity: 1 });
assert("تسعير الوافد بالدولار", quoted.currency === "USD");
assert("التسعير يحمل المقابل بالجنيه", quoted.baseTotal > quoted.total);

const cashPatient = all("patients").find((p) => p.patientType === "cash");
const cashQuote = priceServiceForPatient({ patientId: cashPatient.id, serviceId: 11 });
assert("المريض النقدي يُسعَّر بالجنيه", cashQuote.currency === BASE_CURRENCY);
assert("سعر الوافد أعلى من النقدي بالمقابل الأساسي", quoted.baseTotal > cashQuote.baseTotal);

/* ==========================================================================
   6. خلط العملات في مستند واحد مرفوض
   ========================================================================== */

section("خلط العملات في مستند واحد مرفوض");

let mixed = false;
try {
  /* خدمة بسعر وافد مُعلَن بالدولار + خدمة بلا سعر مُعلَن تُسعَّر بالجنيه. */
  priceBasketForPatient({
    patientId: foreignPatient.id,
    lines: [{ serviceId: 11, quantity: 1 }, { serviceId: 20, quantity: 1 }],
  });
} catch {
  mixed = true;
}
assert("سلة بعملتين مرفوضة", mixed);

const singleCurrency = priceBasketForPatient({
  patientId: foreignPatient.id,
  lines: [{ serviceId: 11, quantity: 1 }, { serviceId: 16, quantity: 2 }],
});
assert("سلة بعملة واحدة مقبولة", singleCurrency.currency === "USD");
assert("إجمالي السلة = جمع سطورها",
  singleCurrency.total === singleCurrency.lines.reduce((s, l) => money.add(s, l.total), 0));
assert("الإجمالي الأساسي = جمع المقابلات",
  singleCurrency.baseTotal === singleCurrency.lines.reduce((s, l) => money.add(s, l.baseTotal), 0));

/* ==========================================================================
   7. الفاتورة تُثبّت سعر يومها — والتحصيل يُنتج فرق العملة
   ========================================================================== */

section("الفاتورة تُثبّت سعر يومها والتحصيل يُنتج فرق العملة");

const invoice = createPatientInvoice(
  { patientId: foreignPatient.id, date: "2026-11-01", lines: [{ serviceId: 16, quantity: 2 }] },
  { user: { name: "موظف استقبال" } },
);

assert("الفاتورة بشريحة الوافد", invoice.tierCode === "TIER-FOREIGN");
assert("الفاتورة بالدولار", invoice.currency === "USD");
assert("الفاتورة تحمل سعر صرف يوم إصدارها", invoice.exchangeRateDate === "2026-11-01");
assert("سعر الفاتورة هو سعر 1 نوفمبر لا سعر اليوم", invoice.exchangeRate === early.rate);
assert("الفاتورة تحمل المقابل بالجنيه",
  invoice.baseTotalAfterDiscount === money.round(invoice.totalAfterDiscount * invoice.exchangeRate));

const receipt = createPatientReceipt(
  {
    patientId: foreignPatient.id,
    invoiceId: invoice.id,
    amount: invoice.patientAmount,
    date: "2026-11-07",
    paymentMethod: "cash",
  },
  { user: { name: "أمين الخزينة" } },
);

assert("السند بنفس عملة الفاتورة", receipt.currency === invoice.currency);
assert("السند بسعر يوم التحصيل لا يوم الفاتورة",
  receipt.exchangeRate === late.rate && receipt.exchangeRate !== invoice.exchangeRate);
assert("السند يحمل فرق عملة محسوبًا", Boolean(receipt.fxDifference));
assert("فرق العملة = المقابل عند التحصيل − المقابل عند الفاتورة",
  receipt.fxDifference.difference ===
    money.subtract(receipt.fxDifference.baseAtSettlement, receipt.fxDifference.baseAtInvoice));
assert("الفاتورة لم يُعَد تقييمها بسعر التحصيل",
  find("patientInvoices", invoice.id).exchangeRate === early.rate);
assert("الفاتورة صارت مسددة بالكامل",
  find("patientInvoices", invoice.id).status === "paid");

let overpay = false;
try {
  createPatientReceipt({ patientId: foreignPatient.id, invoiceId: invoice.id, amount: 10 });
} catch {
  overpay = true;
}
assert("تحصيل أكثر من المستحق مرفوض", overpay);

/* ==========================================================================
   8. إعلان سعر صرف
   ========================================================================== */

section("إعلان سعر صرف جديد");

const rateList = listExchangeRates();
assert("قائمة الأسعار تُرجع السعر الساري لكل عملة", rateList.meta.current.length >= 4);
assert("القائمة تُعلن العملة الأساسية", rateList.meta.baseCurrency === BASE_CURRENCY);

const declared = declareExchangeRate(
  { currency: "USD", rate: 49.8, date: "2026-11-10", source: "اختبار" },
  { user: { name: "مدير مالي" } },
);
assert("السعر الجديد أُعلن", declared.rate === 49.8);
assert("السعر الجديد يسري على تاريخه",
  getExchangeRate({ currency: "USD", date: "2026-11-10" }).rate === 49.8);
assert("السعر الجديد لا يسري على ما قبله",
  getExchangeRate({ currency: "USD", date: "2026-11-07" }).rate === late.rate);

let duplicateRate = false;
try {
  declareExchangeRate({ currency: "USD", rate: 50, date: "2026-11-10" });
} catch {
  duplicateRate = true;
}
assert("سعران لنفس العملة في نفس اليوم مرفوضان", duplicateRate);

let baseRate = false;
try {
  declareExchangeRate({ currency: BASE_CURRENCY, rate: 1.2 });
} catch {
  baseRate = true;
}
assert("إعلان سعر صرف للعملة الأساسية مرفوض", baseRate);

let zeroRate = false;
try {
  declareExchangeRate({ currency: "EUR", rate: 0, date: "2026-11-11" });
} catch {
  zeroRate = true;
}
assert("سعر صرف صفري أو سالب مرفوض", zeroRate);

report();

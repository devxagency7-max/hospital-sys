/**
 * إهلاك الأصول الثابتة.
 *
 * دوال خالصة. تُنتج جدول إهلاك كامل لعمر الأصل، ودفعة إهلاك لفترة واحدة.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  القاعدة التي تحكم كل الطرق: **القيمة الدفترية لا تنزل تحت قيمة الخردة.**
 *
 *  كل طريقة تُقيَّد بها في قسطها الأخير، ولذلك القسط الأخير يختلف غالبًا عن
 *  سابقيه. طريقة لا تحترم هذا الحد تُنتج أصلًا بقيمة دفترية سالبة — رقم بلا
 *  معنى محاسبي، ويُفسد مجمع الإهلاك.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import * as money from "../core/money.js";
import { ruleViolation } from "../core/errors.js";

/* ==========================================================================
   1) الطرق المدعومة
   ========================================================================== */

export const DepreciationMethod = Object.freeze({
  STRAIGHT_LINE: "straight_line",
  DECLINING_BALANCE: "declining_balance",
  DOUBLE_DECLINING: "double_declining",
  UNITS_OF_PRODUCTION: "units_of_production",
});

export const METHOD_LABELS = Object.freeze({
  [DepreciationMethod.STRAIGHT_LINE]: "القسط الثابت",
  [DepreciationMethod.DECLINING_BALANCE]: "القسط المتناقص",
  [DepreciationMethod.DOUBLE_DECLINING]: "القسط المتناقص المضاعف",
  [DepreciationMethod.UNITS_OF_PRODUCTION]: "وحدات الإنتاج",
});

/* ==========================================================================
   2) القيم المشتقة
   ========================================================================== */

/** الأساس القابل للإهلاك = التكلفة − قيمة الخردة. */
export function depreciableBase(asset) {
  return money.max(
    money.subtract(asset?.acquisitionCost ?? 0, asset?.salvageValue ?? 0),
    0,
  );
}

/** القيمة الدفترية = التكلفة − مجمع الإهلاك. */
export function bookValue(asset, accumulated = asset?.accumulatedDepreciation ?? 0) {
  return money.subtract(asset?.acquisitionCost ?? 0, accumulated);
}

/** هل استُهلك الأصل بالكامل؟ */
export function isFullyDepreciated(asset, accumulated = asset?.accumulatedDepreciation ?? 0) {
  return money.compare(accumulated, depreciableBase(asset)) >= 0;
}

/** ما تبقّى قابلًا للإهلاك. */
export function remainingDepreciable(asset, accumulated = asset?.accumulatedDepreciation ?? 0) {
  return money.max(money.subtract(depreciableBase(asset), accumulated), 0);
}

/* ==========================================================================
   3) قسط فترة واحدة
   ========================================================================== */

/**
 * قسط الإهلاك لفترة واحدة بأي طريقة.
 *
 * @param {object} asset `{ acquisitionCost, salvageValue, usefulLifeYears, method, rate }`
 * @param {object} options
 * @param {number} [options.accumulated]   المجمع قبل هذه الفترة
 * @param {number} [options.periodsPerYear=12]
 * @param {number} [options.unitsThisPeriod] لطريقة وحدات الإنتاج
 * @returns {number} قسط الفترة، مُقيَّدًا بالمتبقي القابل للإهلاك
 */
export function periodDepreciation(asset, options = {}) {
  const {
    accumulated = asset?.accumulatedDepreciation ?? 0,
    periodsPerYear = 12,
    unitsThisPeriod = 0,
  } = options;

  const remaining = remainingDepreciable(asset, accumulated);
  if (!money.isPositive(remaining)) return 0;

  const method = asset?.method ?? DepreciationMethod.STRAIGHT_LINE;
  const base = depreciableBase(asset);
  const life = Number(asset?.usefulLifeYears) || 0;

  let raw = 0;

  switch (method) {
    case DepreciationMethod.STRAIGHT_LINE: {
      if (!life) {
        throw ruleViolation("القسط الثابت يحتاج عمرًا إنتاجيًا بالسنوات.", {
          field: "usefulLifeYears",
        });
      }
      raw = money.round(base / (life * periodsPerYear));
      break;
    }

    case DepreciationMethod.DECLINING_BALANCE:
    case DepreciationMethod.DOUBLE_DECLINING: {
      /*
       * المتناقص يُحسب على القيمة الدفترية لا على الأساس القابل للإهلاك:
       * هذا هو تعريف الطريقة. والمعدّل يُشتق من العمر إن لم يُحدَّد صراحةً.
       */
      const annualRate =
        asset?.rate ??
        (life
          ? (method === DepreciationMethod.DOUBLE_DECLINING ? 2 : 1.5) / life
          : 0);

      if (!annualRate) {
        throw ruleViolation("القسط المتناقص يحتاج معدلًا أو عمرًا إنتاجيًا.", { field: "rate" });
      }

      raw = money.percentOf(bookValue(asset, accumulated), annualRate / periodsPerYear);
      break;
    }

    case DepreciationMethod.UNITS_OF_PRODUCTION: {
      const totalUnits = Number(asset?.totalEstimatedUnits) || 0;
      if (!totalUnits) {
        throw ruleViolation("طريقة وحدات الإنتاج تحتاج إجمالي الوحدات المتوقعة.", {
          field: "totalEstimatedUnits",
        });
      }
      raw = money.multiply(money.round(base / totalUnits), unitsThisPeriod);
      break;
    }

    default:
      throw ruleViolation(`طريقة إهلاك غير مدعومة: «${method}».`, { field: "method" });
  }

  // الحد الحاسم: لا يتجاوز القسط ما تبقّى.
  return money.min(money.max(raw, 0), remaining);
}

/* ==========================================================================
   4) جدول الإهلاك الكامل
   ========================================================================== */

/**
 * يبني جدول إهلاك الأصل من تاريخ الشراء حتى استهلاكه بالكامل.
 *
 * يُعرض في ملف الأصل، ويُستخدم في التقارير التنبؤية. لا يُخزَّن: اشتقاقه من
 * بيانات الأصل يضمن تطابقه معها دائمًا، وتخزينه يُنشئ نسخة تتقادم عند أول
 * تعديل على العمر الإنتاجي أو قيمة الخردة.
 *
 * @param {object} asset
 * @param {{ periodsPerYear?:number, maxPeriods?:number }} [options]
 * @returns {Array<{ period:number, date:string, opening:number, depreciation:number, accumulated:number, closing:number }>}
 */
export function depreciationSchedule(asset, { periodsPerYear = 12, maxPeriods = 600 } = {}) {
  const rows = [];
  const start = new Date(`${String(asset?.purchaseDate ?? asset?.inServiceDate ?? "").slice(0, 10)}T00:00:00Z`);

  if (Number.isNaN(start.getTime())) {
    throw ruleViolation("الأصل بلا تاريخ شراء صالح — لا يمكن بناء جدول الإهلاك.", {
      field: "purchaseDate",
    });
  }

  let accumulated = 0;
  let period = 0;

  while (period < maxPeriods) {
    const remaining = remainingDepreciable(asset, accumulated);
    if (!money.isPositive(remaining)) break;

    const amount = periodDepreciation(asset, { accumulated, periodsPerYear });
    if (!money.isPositive(amount)) break;

    const date = new Date(start);
    date.setUTCMonth(date.getUTCMonth() + Math.round(((period + 1) * 12) / periodsPerYear));

    const opening = bookValue(asset, accumulated);
    accumulated = money.add(accumulated, amount);

    rows.push({
      period: period + 1,
      date: date.toISOString().slice(0, 10),
      opening,
      depreciation: amount,
      accumulated,
      closing: bookValue(asset, accumulated),
    });

    period += 1;
  }

  return rows;
}

/* ==========================================================================
   5) تشغيل الإهلاك الدوري
   ========================================================================== */

/**
 * يُشغّل الإهلاك لمجموعة أصول في فترة واحدة.
 *
 * الأصول المستبعدة أو المستهلكة بالكامل أو التي لم تدخل الخدمة بعد تُستثنى
 * ويُذكر سبب استثنائها: «لم يُهلك» بلا سبب يجعل المستخدم يظن أن النظام
 * أخطأ، فيُشغّل الإهلاك مرة أخرى.
 *
 * @param {object[]} assets
 * @param {object} options
 * @param {string} options.period  "2026-11"
 * @returns {{ period:string, rows:object[], skipped:object[], totalDepreciation:number }}
 */
export function runDepreciation(assets = [], { period, periodsPerYear = 12, unitsByAsset = {} } = {}) {
  if (!period) {
    throw ruleViolation("تشغيل الإهلاك يحتاج فترة (مثل 2026-11).", { field: "period" });
  }

  const rows = [];
  const skipped = [];
  const periodEnd = `${period}-28`;

  for (const asset of assets) {
    if (asset.status === "disposed") {
      skipped.push({ assetId: asset.id, name: asset.name, reason: "الأصل مُستبعد" });
      continue;
    }

    const inService = String(asset.inServiceDate ?? asset.purchaseDate ?? "").slice(0, 7);
    if (!inService || inService > period) {
      skipped.push({ assetId: asset.id, name: asset.name, reason: "لم يدخل الخدمة في هذه الفترة" });
      continue;
    }

    if (isFullyDepreciated(asset)) {
      skipped.push({ assetId: asset.id, name: asset.name, reason: "مُستهلك بالكامل" });
      continue;
    }

    const amount = periodDepreciation(asset, {
      periodsPerYear,
      unitsThisPeriod: unitsByAsset[asset.id] ?? 0,
    });

    if (!money.isPositive(amount)) {
      skipped.push({ assetId: asset.id, name: asset.name, reason: "قسط الفترة صفر" });
      continue;
    }

    const accumulated = money.add(asset.accumulatedDepreciation ?? 0, amount);

    rows.push({
      assetId: asset.id,
      code: asset.code,
      name: asset.name,
      categoryId: asset.categoryId ?? null,
      costCenterId: asset.costCenterId ?? null,
      method: asset.method,
      acquisitionCost: money.round(asset.acquisitionCost ?? 0),
      openingBookValue: bookValue(asset),
      depreciation: amount,
      accumulatedAfter: accumulated,
      closingBookValue: bookValue(asset, accumulated),
      isFullyDepreciatedAfter: isFullyDepreciated(asset, accumulated),
    });
  }

  return {
    period,
    periodLabel: period,
    date: periodEnd,
    rows,
    skipped,
    totalDepreciation: money.sumBy(rows, "depreciation"),
    assetsCount: rows.length,
  };
}

/* ==========================================================================
   6) الاستبعاد
   ========================================================================== */

/**
 * يحسب نتيجة استبعاد أصل: ربح أو خسارة.
 *
 * النتيجة = المتحصلات − القيمة الدفترية. موجب ربح، سالب خسارة. لا يُدخلها
 * المستخدم يدويًا — تُحسَب من الأرقام الثلاثة وحدها.
 */
export function disposalResult(asset, { proceeds = 0 } = {}) {
  const cost = money.round(asset?.acquisitionCost ?? 0);
  const accumulated = money.round(asset?.accumulatedDepreciation ?? 0);
  const netBookValue = money.subtract(cost, accumulated);
  const result = money.subtract(money.round(proceeds), netBookValue);

  return {
    acquisitionCost: cost,
    accumulatedDepreciation: accumulated,
    netBookValue,
    proceeds: money.round(proceeds),
    result,
    isGain: money.isPositive(result),
    isLoss: money.isNegative(result),
  };
}

/** يرفض استبعاد أصل مُستبعد مسبقًا. */
export function assertDisposable(asset) {
  if (asset?.status === "disposed") {
    throw ruleViolation(`الأصل «${asset?.name}» مُستبعد بالفعل بتاريخ ${asset?.disposalDate ?? ""}.`);
  }
  return asset;
}

/* ==========================================================================
   7) تقارير
   ========================================================================== */

/** سجل الأصول الثابتة مع قيمها الدفترية — يُغذّي تقرير الأصول. */
export function assetRegister(assets = [], categories = []) {
  const categoryById = new Map(categories.map((row) => [String(row.id), row]));

  const rows = assets.map((asset) => {
    const accumulated = money.round(asset.accumulatedDepreciation ?? 0);
    return {
      ...asset,
      categoryName: categoryById.get(String(asset.categoryId))?.name ?? "—",
      methodLabel: METHOD_LABELS[asset.method] ?? asset.method,
      accumulatedDepreciation: accumulated,
      netBookValue: bookValue(asset, accumulated),
      depreciationRate: money.isZero(asset.acquisitionCost)
        ? 0
        : accumulated / money.round(asset.acquisitionCost),
    };
  });

  const active = rows.filter((row) => row.status !== "disposed");

  return {
    rows,
    totals: {
      count: rows.length,
      activeCount: active.length,
      acquisitionCost: money.sumBy(active, "acquisitionCost"),
      accumulatedDepreciation: money.sumBy(active, "accumulatedDepreciation"),
      netBookValue: money.sumBy(active, "netBookValue"),
    },
  };
}

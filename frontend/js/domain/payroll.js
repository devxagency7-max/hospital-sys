/**
 * محرك الرواتب — من بيانات الموظف إلى قسيمة راتب وإلى مسيّر شهري.
 *
 * دوال خالصة. المصدر الوحيد لأي رقم في قسيمة راتب أو مسيّر: الشاشة تعرض،
 * والـ API يخزّن، وهذه الوحدة تحسب.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  ترتيب الحساب مقصود ولا يجوز تبديله:
 *
 *    1. الإجمالي        = الأساسي + البدلات + المكافآت + الإضافي
 *    2. وعاء التأمينات  = الأساسي (أو الوعاء المحدَّد)، بحدّيه الأدنى والأعلى
 *    3. حصة الموظف      = وعاء التأمينات × نسبة الموظف
 *    4. الوعاء الضريبي  = الإجمالي − حصة الموظف في التأمينات − الإعفاءات
 *    5. الضريبة         = شرائح تصاعدية على الوعاء الضريبي
 *    6. الصافي          = الإجمالي − التأمينات − الضريبة − السلف − الاستقطاعات
 *
 *  حساب الضريبة قبل خصم التأمينات يرفع العبء الضريبي خطأً، وهو أكثر أخطاء
 *  مسيّرات الرواتب شيوعًا. الترتيب أعلاه يمنعه بنيويًا.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import * as money from "../core/money.js";
import { ruleViolation } from "../core/errors.js";

/* ==========================================================================
   1) حالة المسيّر
   ========================================================================== */

/**
 * دورة حياة مسيّر الرواتب.
 *
 * الفصل بين `CALCULATED` و`APPROVED` هو ما يسمح بإعادة الحساب بلا ضرر:
 * المسيّر المحسوب يُعاد حسابه كما تشاء، والمعتمد لا يُمسّ لأنه رُحِّل
 * محاسبيًا بالفعل.
 */
export const PayrollStatus = Object.freeze({
  DRAFT: "draft",
  CALCULATED: "calculated",
  PENDING: "pending_approval",
  APPROVED: "approved",
  PAID: "paid_out",
  CANCELLED: "cancelled",
});

/** المسيّر المعتمد أو المصروف لا يُعاد حسابه. */
export function assertPayrollMutable(run) {
  if (run?.status === PayrollStatus.APPROVED) {
    throw ruleViolation(
      `المسيّر ${run?.runNumber ?? ""} معتمد ومُرحَّل محاسبيًا. لا يُعاد حسابه. ` +
        "لتصحيحه: اعكس قيده ثم ألغِ الاعتماد.",
    );
  }
  if (run?.status === PayrollStatus.PAID) {
    throw ruleViolation(`المسيّر ${run?.runNumber ?? ""} مصروف بالفعل. لا يُعدَّل.`);
  }
  if (run?.status === PayrollStatus.CANCELLED) {
    throw ruleViolation(`المسيّر ${run?.runNumber ?? ""} ملغى.`);
  }
}

/* ==========================================================================
   2) الشرائح الضريبية والتأمينات
   ========================================================================== */

/**
 * شرائح ضريبة كسب العمل الافتراضية (سنوية).
 *
 * قيم قابلة للتعديل من إعدادات الضرائب — ليست ثابتة في الكود عن قصد: الشرائح
 * تتغيّر بقرارات تشريعية، وتثبيتها يجعل كل تحديث قانوني يحتاج إصدارًا جديدًا
 * من البرنامج.
 *
 * **تنبيه:** هذه قيم مبدئية للعرض، ولا تُعدّ التزامًا بأي جدول ضريبي رسمي.
 * المنشأة تُدخل شرائحها المعتمدة من شاشة الضرائب قبل أول مسيّر حقيقي.
 */
export const DEFAULT_TAX_BRACKETS = Object.freeze([
  { upTo: 40000, rate: 0 },
  { upTo: 55000, rate: 0.1 },
  { upTo: 70000, rate: 0.15 },
  { upTo: 200000, rate: 0.2 },
  { upTo: 400000, rate: 0.225 },
  { upTo: null, rate: 0.25 },
]);

/** إعدادات التأمينات الافتراضية. نسب على وعاء الاشتراك لا على الإجمالي. */
export const DEFAULT_INSURANCE = Object.freeze({
  employeeRate: 0.11,
  employerRate: 0.1875,
  minBase: 2300,
  maxBase: 14500,
});

/** الإعفاء الشخصي السنوي الافتراضي. */
export const DEFAULT_PERSONAL_EXEMPTION = 20000;

/**
 * يحسب الضريبة على وعاء سنوي بشرائح تصاعدية.
 *
 * تصاعدية حقيقية: كل شريحة تُحسب على الجزء الواقع فيها فقط، لا على الوعاء
 * كله بنسبة الشريحة العليا. الفرق بينهما جوهري عند حدود الشرائح.
 */
export function taxOnAnnual(annualBase, brackets = DEFAULT_TAX_BRACKETS) {
  let remaining = money.max(money.round(annualBase), 0);
  let previousCeiling = 0;
  let tax = 0;

  for (const bracket of brackets) {
    if (!money.isPositive(remaining)) break;

    const ceiling = bracket.upTo ?? Infinity;
    const width = ceiling === Infinity ? remaining : money.subtract(ceiling, previousCeiling);
    const taxable = money.min(remaining, money.max(width, 0));

    tax = money.add(tax, money.percentOf(taxable, bracket.rate));
    remaining = money.subtract(remaining, taxable);
    previousCeiling = ceiling;
  }

  return tax;
}

/** وعاء اشتراك التأمينات بعد تطبيق الحدّين. */
export function insuranceBase(amount, { minBase, maxBase } = DEFAULT_INSURANCE) {
  const value = money.round(amount);
  if (minBase && money.compare(value, minBase) < 0) return money.round(minBase);
  if (maxBase && money.compare(value, maxBase) > 0) return money.round(maxBase);
  return value;
}

/* ==========================================================================
   3) مكوّنات الراتب
   ========================================================================== */

/**
 * يحسب أجر الساعة من الراتب الأساسي.
 * القاسم الافتراضي 30 يومًا × 8 ساعات = 240 ساعة شهريًا.
 */
export function hourlyRate(basicSalary, { monthlyHours = 240 } = {}) {
  if (!monthlyHours) return 0;
  return money.round(money.round(basicSalary) / monthlyHours);
}

/**
 * أجر العمل الإضافي.
 * @param {number} basicSalary
 * @param {{ weekdayHours?:number, weekendHours?:number, holidayHours?:number }} hours
 * @param {{ weekdayFactor?:number, weekendFactor?:number, holidayFactor?:number, monthlyHours?:number }} rates
 */
export function overtimePay(basicSalary, hours = {}, rates = {}) {
  const {
    weekdayFactor = 1.35,
    weekendFactor = 1.7,
    holidayFactor = 2,
    monthlyHours = 240,
  } = rates;

  const base = hourlyRate(basicSalary, { monthlyHours });

  return money.sum([
    money.multiply(base, (hours.weekdayHours ?? 0) * weekdayFactor),
    money.multiply(base, (hours.weekendHours ?? 0) * weekendFactor),
    money.multiply(base, (hours.holidayHours ?? 0) * holidayFactor),
  ]);
}

/**
 * خصم الغياب والتأخير.
 *
 * الغياب بأجر اليوم الكامل، والتأخير بأجر الساعة. الدقائق تُحوَّل إلى ساعات
 * كسرية ولا تُقرَّب لأعلى: تقريب 5 دقائق تأخير إلى ساعة كاملة خصم تعسفي.
 */
export function absenceDeduction(basicSalary, { absentDays = 0, lateMinutes = 0 } = {}, { monthDays = 30, monthlyHours = 240 } = {}) {
  const dailyRate = monthDays ? money.round(money.round(basicSalary) / monthDays) : 0;
  const perHour = hourlyRate(basicSalary, { monthlyHours });

  return money.add(
    money.multiply(dailyRate, absentDays),
    money.multiply(perHour, lateMinutes / 60),
  );
}

/* ==========================================================================
   4) قسيمة راتب موظف واحد
   ========================================================================== */

/**
 * يحسب قسيمة راتب موظف واحد لفترة.
 *
 * @param {object} employee `{ id, code, name, basicSalary, allowances[], departmentId, ... }`
 * @param {object} context
 * @param {object} [context.attendance]  `{ absentDays, lateMinutes, overtimeHours:{...} }`
 * @param {object[]} [context.adjustments] مكافآت واستقطاعات لمرة واحدة
 * @param {number} [context.advanceDue]  قسط السلفة المستحق هذا الشهر
 * @param {object} [context.settings]    الشرائح والتأمينات والإعفاءات
 * @returns {object} قسيمة كاملة بتفصيل كل بند
 */
export function calculatePayslip(employee, context = {}) {
  const {
    attendance = {},
    adjustments = [],
    advanceDue = 0,
    settings = {},
  } = context;

  const taxBrackets = settings.taxBrackets ?? DEFAULT_TAX_BRACKETS;
  const insurance = { ...DEFAULT_INSURANCE, ...(settings.insurance ?? {}) };
  const personalExemption = settings.personalExemption ?? DEFAULT_PERSONAL_EXEMPTION;

  const basic = money.round(employee?.basicSalary ?? 0);

  /* --- 1) المستحقات --- */
  const allowanceRows = (employee?.allowances ?? []).map((row) => ({
    key: row.key ?? row.name,
    label: row.label ?? row.name,
    /** البدل إما مبلغ ثابت أو نسبة من الأساسي — لا الاثنان. */
    amount: row.rate ? money.percentOf(basic, row.rate) : money.round(row.amount ?? 0),
  }));
  const allowances = money.sumBy(allowanceRows, "amount");

  const bonusRows = adjustments
    .filter((row) => row.type === "bonus" || row.type === "earning")
    .map((row) => ({ label: row.label, amount: money.round(row.amount ?? 0) }));
  const bonuses = money.sumBy(bonusRows, "amount");

  const overtime = overtimePay(basic, attendance.overtimeHours ?? {}, settings.overtime ?? {});

  const gross = money.sum([basic, allowances, bonuses, overtime]);

  /* --- 2) التأمينات --- */
  const base = insuranceBase(employee?.insuranceBase ?? basic, insurance);
  const exemptFromInsurance = employee?.insuranceExempt === true;

  const employeeInsurance = exemptFromInsurance ? 0 : money.percentOf(base, insurance.employeeRate);
  const employerInsurance = exemptFromInsurance ? 0 : money.percentOf(base, insurance.employerRate);

  /* --- 3) الضريبة --- */
  /*
   * الوعاء الضريبي شهري، والشرائح سنوية: نُسنون الوعاء، نحسب الضريبة
   * السنوية، ثم نقسمها على 12. حساب الضريبة على وعاء شهري بشرائح سنوية
   * يضع كل الموظفين في الشريحة الصفرية.
   */
  const monthlyTaxable = money.max(
    money.subtract(money.subtract(gross, employeeInsurance), money.round(personalExemption / 12)),
    0,
  );
  const incomeTax = employee?.taxExempt === true
    ? 0
    : money.round(taxOnAnnual(money.multiply(monthlyTaxable, 12), taxBrackets) / 12);

  /* --- 4) الاستقطاعات --- */
  const absence = absenceDeduction(basic, attendance, settings.absence ?? {});

  const otherRows = adjustments
    .filter((row) => row.type === "deduction")
    .map((row) => ({ label: row.label, amount: money.round(row.amount ?? 0) }));
  const otherDeductions = money.add(money.sumBy(otherRows, "amount"), absence);

  /*
   * ═══════════════════════════════════════════════════════════════════════
   *  الصافي لا يقل عن صفر — ويُحقَّق ذلك بتخفيض قسط السلفة لا بتقييد الصافي.
   * ═══════════════════════════════════════════════════════════════════════
   *
   * استقطاعات تتجاوز المستحقات تعني أن قسط السلفة أكبر مما يحتمله الراتب.
   * الحل الصحيح: نسترد هذا الشهر بقدر ما يحتمله الراتب، ونُرحّل باقي القسط
   * إلى الشهر التالي.
   *
   * الحل الخاطئ — ورفعه محرك الترحيل فعلًا — هو تقييد `netPay` عند الصفر
   * مع إبقاء القسط كاملًا في الاستقطاعات: حينها لا يساوي
   * (الإجمالي − الاستقطاعات) الصافي، فيخرج قيد الرواتب غير متوازن بمقدار
   * الفرق بالضبط. المال لا يُخلَق بالتقريب: ما لم يُستقطَع لم يُستقطَع.
   *
   * الضرائب والتأمينات لا تُخفَّض — فهي التزامات قانونية لا تُؤجَّل بقرار
   * من المنشأة. القابل للتأجيل هو ما تستحقه المنشأة لنفسها.
   */
  const requestedRecovery = money.round(advanceDue);

  const beforeRecovery = money.subtract(
    gross,
    money.sum([employeeInsurance, incomeTax, otherDeductions]),
  );

  const advanceRecovery = money.min(requestedRecovery, money.max(beforeRecovery, 0));
  const carriedForward = money.subtract(requestedRecovery, advanceRecovery);

  const totalDeductions = money.sum([
    employeeInsurance,
    incomeTax,
    otherDeductions,
    advanceRecovery,
  ]);

  /*
   * قد يبقى الصافي سالبًا بعد تصفير الاسترداد إن كانت الضرائب والتأمينات
   * وحدها تتجاوز المستحقات — حالة شاذة (راتب أساسي منخفض مع غياب كثيف)
   * تُكشف في `runPayroll` كتحذير بدل أن تُخفى.
   */
  const netPay = money.subtract(gross, totalDeductions);

  return {
    employeeId: employee?.id,
    employeeCode: employee?.code,
    employeeName: employee?.name,
    jobTitle: employee?.jobTitle ?? null,
    departmentId: employee?.departmentId ?? null,
    departmentName: employee?.departmentName ?? null,
    costCenterId: employee?.costCenterId ?? null,
    bankAccount: employee?.bankAccount ?? null,

    /* المستحقات */
    basic,
    allowanceRows,
    allowances,
    bonusRows,
    bonuses,
    overtime,
    gross,

    /* التأمينات */
    insuranceBase: base,
    employeeInsurance,
    employerInsurance,

    /* الضريبة */
    taxableIncome: monthlyTaxable,
    incomeTax,

    /* الاستقطاعات */
    absenceDeduction: absence,
    otherDeductionRows: otherRows,
    otherDeductions,
    advanceRecovery,
    totalDeductions,

    /* الصافي */
    netPay,
    carriedForward,

    /** التكلفة الكاملة على المنشأة — الإجمالي + حصة صاحب العمل. */
    employerCost: money.add(gross, employerInsurance),
  };
}

/* ==========================================================================
   5) المسيّر الشهري
   ========================================================================== */

/**
 * يُشغّل مسيّر رواتب لمجموعة موظفين.
 *
 * @param {object[]} employees
 * @param {object} options
 * @param {string} options.period            "2026-11"
 * @param {object} [options.attendanceByEmployee]  `{ [employeeId]: {...} }`
 * @param {object} [options.adjustmentsByEmployee]
 * @param {object} [options.advancesByEmployee]
 * @param {object} [options.settings]
 * @returns {{ period:string, payslips:object[], totals:object, warnings:object[] }}
 */
export function runPayroll(employees = [], options = {}) {
  const {
    period,
    attendanceByEmployee = {},
    adjustmentsByEmployee = {},
    advancesByEmployee = {},
    settings = {},
  } = options;

  if (!period) {
    throw ruleViolation("مسيّر الرواتب يحتاج فترة (مثل 2026-11).", { field: "period" });
  }

  const warnings = [];

  const payslips = employees
    .filter((employee) => {
      /* الموظف المنتهية خدمته قبل بداية الفترة لا يدخل المسيّر. */
      if (employee?.status === "terminated" || employee?.status === "resigned") {
        const endedAt = String(employee.endDate ?? "").slice(0, 7);
        if (endedAt && endedAt < period) return false;
      }
      /* ولا الموظف الذي لم يلتحق بعد. */
      const hiredAt = String(employee?.hireDate ?? "").slice(0, 7);
      if (hiredAt && hiredAt > period) return false;

      return true;
    })
    .map((employee) => {
      const slip = calculatePayslip(employee, {
        attendance: attendanceByEmployee[employee.id] ?? {},
        adjustments: adjustmentsByEmployee[employee.id] ?? [],
        advanceDue: advancesByEmployee[employee.id] ?? 0,
        settings,
      });

      if (money.isPositive(slip.carriedForward)) {
        warnings.push({
          employeeId: employee.id,
          employeeName: employee.name,
          type: "advance_deferred",
          message:
            `قسط سلفة ${employee.name} يتجاوز ما يحتمله راتبه هذا الشهر. ` +
            `استُرد ${slip.advanceRecovery} ورُحِّل ${slip.carriedForward} إلى الشهر التالي.`,
        });
      }

      if (money.isNegative(slip.netPay)) {
        warnings.push({
          employeeId: employee.id,
          employeeName: employee.name,
          type: "net_below_zero",
          message:
            `صافي راتب ${employee.name} سالب (${slip.netPay}) بعد الضرائب والتأمينات وخصم الغياب. ` +
            "راجع سجل حضوره وراتبه الأساسي — المسيّر لا يُعتمد بقسيمة سالبة.",
        });
      }

      if (!money.isPositive(slip.basic)) {
        warnings.push({
          employeeId: employee.id,
          employeeName: employee.name,
          type: "no_basic_salary",
          message: `${employee.name} بلا راتب أساسي مُسجَّل.`,
        });
      }

      return slip;
    });

  return {
    period,
    periodLabel: formatPeriod(period),
    payslips,
    totals: summarizePayroll(payslips),
    warnings,
  };
}

/**
 * يجمع مسيّرًا في مجاميع جاهزة للقيد المحاسبي.
 *
 * أسماء الحقول هنا هي نفسها التي تقرأها `payrollApprovalLines` في
 * js/domain/posting-rules.js — عقد صريح بين الوحدتين.
 */
export function summarizePayroll(payslips = []) {
  const totals = {
    headcount: payslips.length,

    basic: money.sumBy(payslips, "basic"),
    allowances: money.sumBy(payslips, "allowances"),
    bonuses: money.sumBy(payslips, "bonuses"),
    overtime: money.sumBy(payslips, "overtime"),
    gross: money.sumBy(payslips, "gross"),

    employeeInsurance: money.sumBy(payslips, "employeeInsurance"),
    employerInsurance: money.sumBy(payslips, "employerInsurance"),
    incomeTax: money.sumBy(payslips, "incomeTax"),
    advanceRecovery: money.sumBy(payslips, "advanceRecovery"),
    otherDeductions: money.sumBy(payslips, "otherDeductions"),
    totalDeductions: money.sumBy(payslips, "totalDeductions"),

    netPay: money.sumBy(payslips, "netPay"),
    employerCost: money.sumBy(payslips, "employerCost"),
  };

  /*
   * فحص تماسك: الإجمالي − الاستقطاعات = الصافي. فرق هنا يعني خللًا في
   * الحساب لا في العرض، فنكشفه بدل تمريره إلى القيد المحاسبي.
   */
  totals.isConsistent = money.equals(
    money.subtract(totals.gross, totals.totalDeductions),
    totals.netPay,
  );

  return totals;
}

/** توزيع المسيّر على الإدارات — لتقرير تكلفة العمالة. */
export function payrollByDepartment(payslips = [], departments = []) {
  const byDepartment = new Map();

  for (const slip of payslips) {
    const key = String(slip.departmentId ?? "__none__");
    const bucket = byDepartment.get(key) ?? { headcount: 0, gross: 0, net: 0, cost: 0 };

    bucket.headcount += 1;
    bucket.gross = money.add(bucket.gross, slip.gross);
    bucket.net = money.add(bucket.net, slip.netPay);
    bucket.cost = money.add(bucket.cost, slip.employerCost);

    byDepartment.set(key, bucket);
  }

  return [...byDepartment.entries()]
    .map(([key, bucket]) => {
      const department = departments.find((row) => String(row.id) === key);
      return {
        departmentId: key === "__none__" ? null : key,
        name: department?.name ?? "بلا إدارة",
        ...bucket,
        averageCost: bucket.headcount ? money.round(bucket.cost / bucket.headcount) : 0,
      };
    })
    .sort((a, b) => money.toMinor(b.cost) - money.toMinor(a.cost));
}

/* ==========================================================================
   6) السلف
   ========================================================================== */

/**
 * جدول أقساط سلفة.
 *
 * القسط الأخير يستوعب فروق التقريب: 1000 على 3 أشهر = 333.33 + 333.33 +
 * 333.34، لا ثلاثة أقساط متساوية تترك قرشًا معلقًا إلى الأبد.
 */
export function advanceSchedule({ amount, installments, startPeriod }) {
  const count = Math.max(1, Math.floor(Number(installments) || 1));
  const parts = money.allocate(amount, count);

  const [year, month] = String(startPeriod ?? "").split("-").map(Number);

  return parts.map((part, index) => {
    const date = new Date(Date.UTC(year || 2026, (month || 1) - 1 + index, 1));
    return {
      installment: index + 1,
      period: date.toISOString().slice(0, 7),
      amount: part,
      status: "pending",
    };
  });
}

/** القسط المستحق على موظف في فترة — صفر إن لم يكن عليه سلف. */
export function advanceDueFor(advances = [], employeeId, period) {
  return money.sum(
    advances
      .filter(
        (advance) =>
          String(advance.employeeId) === String(employeeId) &&
          advance.status !== "recovered" &&
          advance.status !== "cancelled",
      )
      .flatMap((advance) =>
        (advance.schedule ?? [])
          .filter((row) => row.period === period && row.status === "pending")
          .map((row) => row.amount),
      ),
  );
}

/** المتبقي على سلفة بعد ما استُرد منها. */
export function advanceOutstanding(advance) {
  const recovered = money.sum(
    (advance?.schedule ?? [])
      .filter((row) => row.status === "recovered")
      .map((row) => row.amount),
  );
  return money.max(money.subtract(advance?.amount ?? 0, recovered), 0);
}

/* -------------------------------------------------------------------------- */

const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/** "2026-11" → "نوفمبر 2026" */
export function formatPeriod(period) {
  const [year, month] = String(period ?? "").split("-");
  const name = MONTH_NAMES[Number(month) - 1];
  return name ? `${name} ${year}` : String(period ?? "");
}

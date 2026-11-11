/**
 * بيانات الموارد البشرية التجريبية:
 * الموظفون، الحضور، الإجازات، السلف، ومسيّرات الرواتب وقسائمها.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  القسائم والمجاميع هنا **محسوبة بمحرك الرواتب** لا مكتوبة بأرقام جاهزة.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * هذا الملف يبني الموظفين وحضورهم وسلفهم، ثم يُمرّرها إلى `runPayroll` في
 * js/domain/payroll.js ليحسب القسائم. النتيجة: ما تعرضه الشاشة هو بالضبط ما
 * يحسبه المحرك، فأي خلل في الحساب يظهر في البيانات التجريبية نفسها بدل أن
 * تُخفيه أرقام مكتوبة يدويًا «تبدو صحيحة».
 */

import * as money from "../core/money.js";
import {
  createRandom,
  REFERENCE_DATE,
  CURRENT_PERIOD,
  DEPARTMENTS,
  POSITIONS,
  SHIFTS,
  BANKS,
  GOVERNORATES,
  buildName,
  addDays,
  monthRange,
  endOfMonth,
} from "./seed.js";
import { runPayroll, advanceSchedule, advanceDueFor, advanceOutstanding, formatPeriod, PayrollStatus } from "../domain/payroll.js";
import { evaluateDay, summarizeAttendance, leaveDays, LEAVE_TYPES, LeaveStatus } from "../domain/attendance.js";

const random = createRandom(556_204);
const TODAY = REFERENCE_DATE.toISOString().slice(0, 10);

/** الهيكل التنظيمي — مُعاد تصديره ليبقى مصدرًا واحدًا. */
export const departments = DEPARTMENTS;
export const positions = POSITIONS;
export const shifts = SHIFTS;
export const leaveTypes = Object.entries(LEAVE_TYPES).map(([key, value]) => ({ id: key, ...value }));

/* ============================================================================
   1. الموظفون
   ============================================================================ */

/**
 * البدلات القياسية. النسبة محسوبة على الأساسي، والمبلغ ثابت — لا الاثنان.
 */
const ALLOWANCE_CATALOG = [
  { key: "transport", label: "بدل انتقال", amount: 1_200 },
  { key: "meal", label: "بدل وجبة", amount: 800 },
  { key: "phone", label: "بدل هاتف", amount: 400 },
  { key: "housing", label: "بدل سكن", rate: 0.15 },
  { key: "nature_of_work", label: "بدل طبيعة عمل", rate: 0.1 },
  { key: "management", label: "بدل إدارة", rate: 0.2 },
];

/**
 * توزيع عدد الموظفين على الوظائف — يُنتج هيكلًا هرميًا معقولًا:
 * موظف واحد في الوظائف القيادية وعدد أكبر في الوظائف التنفيذية.
 */
const HEADCOUNT = {
  1: 1, 2: 1, 3: 1, 4: 2, 5: 4, 6: 2,
  7: 1, 8: 2,
  9: 1, 10: 8,
  11: 1, 12: 3,
  13: 1, 14: 5, 15: 4,
  16: 1, 17: 3, 18: 12, 19: 2,
  20: 1, 21: 3,
  22: 1,
  23: 2,
  24: 1, 25: 6,
};

export const employees = (() => {
  const out = [];
  let id = 0;

  for (const position of POSITIONS) {
    const count = HEADCOUNT[position.id] ?? 1;
    const department = DEPARTMENTS.find((row) => row.id === position.departmentId);

    for (let index = 0; index < count; index += 1) {
      id += 1;

      const gender = random.chance(0.3) ? "female" : "male";
      const name = buildName(random, gender);
      const basicSalary = money.round(
        random.int(position.basicSalaryFrom, position.basicSalaryTo) / 100,
      ) * 100;

      const hireDate = random.date(3200, 40);
      /* سنة التجربة: من عُيّن حديثًا يكون تحت التجربة ثلاثة أشهر. */
      const monthsEmployed = Math.floor(
        (REFERENCE_DATE - new Date(`${hireDate}T00:00:00Z`)) / (30 * 86_400_000),
      );

      const allowances = random.sample(
        ALLOWANCE_CATALOG.filter((row) =>
          position.gradeLevel >= 7 ? true : row.key !== "management",
        ),
        position.gradeLevel >= 7 ? random.int(3, 5) : random.int(1, 3),
      );

      /* خدمات منتهية قليلة — ليُظهر النظام تاريخ العاملين لا الحاضرين فقط. */
      const terminated = id % 23 === 0 && monthsEmployed > 14;

      out.push({
        id,
        code: `EMP-${String(id).padStart(4, "0")}`,
        name,
        nameEn: null,
        gender,
        nationalId: random.nationalId(),
        birthDate: random.date(16_000, 7_500),
        maritalStatus: random.pick(["single", "married", "married", "married"]),
        governorate: random.pick(GOVERNORATES),
        address: `${random.pick(GOVERNORATES)} — ${random.pick(["شارع المحطة", "شارع الجمهورية", "حي الزهور", "المنطقة الثامنة"])}`,
        phone: random.phone(),
        emergencyPhone: random.phone(),
        email: `emp${id}@amanalhayah-hospital.example`,

        positionId: position.id,
        jobTitle: position.title,
        departmentId: position.departmentId,
        departmentName: department?.name ?? "—",
        costCenterId: department?.costCenterId ?? null,
        managerId: department?.managerId === id ? null : department?.managerId ?? null,
        gradeLevel: position.gradeLevel,
        shiftId: position.departmentId === 7 ? random.pick([2, 2, 3, 4]) : 1,

        contractType: random.pickWeighted([["permanent", 7], ["fixed_term", 2], ["part_time", 1]]),
        contractStartDate: hireDate,
        contractEndDate: null,
        hireDate,
        endDate: terminated ? addDays(hireDate, random.int(400, 1400)) : null,
        status: terminated
          ? random.pick(["terminated", "resigned"])
          : monthsEmployed < 3
            ? "probation"
            : "employed",

        basicSalary,
        allowances,
        insuranceBase: basicSalary,
        insuranceExempt: false,
        taxExempt: false,
        socialInsuranceNumber: String(random.int(10_000_000, 99_999_999)),

        bankName: random.pick(BANKS).name,
        bankAccount: String(random.int(1_000_000_000, 9_999_999_999)),
        paymentMethod: position.gradeLevel >= 3 ? "bank_transfer" : random.pick(["bank_transfer", "cash"]),

        leaveEntitlements: {
          annual: position.gradeLevel >= 7 ? 30 : monthsEmployed > 120 ? 30 : 21,
          sick: 15,
          casual: 6,
        },
        leaveCarriedOver: { annual: random.int(0, 8) },

        documents: [
          { id: 1, type: "national_id", label: "صورة بطاقة الرقم القومي", uploadedAt: hireDate, expiryDate: random.futureDate(200, 2000), status: "valid" },
          { id: 2, type: "qualification", label: "المؤهل الدراسي", uploadedAt: hireDate, expiryDate: null, status: "valid" },
          { id: 3, type: "contract", label: "عقد العمل الموقَّع", uploadedAt: hireDate, expiryDate: null, status: "valid" },
          ...(random.chance(0.5)
            ? [{ id: 4, type: "criminal_record", label: "فيش وتشبيه", uploadedAt: hireDate, expiryDate: addDays(hireDate, 365), status: addDays(hireDate, 365) < TODAY ? "expired" : "valid" }]
            : []),
        ],

        notes: null,
      });
    }
  }

  return out;
})();

/** الموظفون على رأس العمل — مدخل كل حساب في الموديول. */
export const activeEmployees = employees.filter(
  (employee) => employee.status === "employed" || employee.status === "probation",
);

/* ============================================================================
   2. الحضور والانصراف
   ============================================================================ */

const shiftById = new Map(SHIFTS.map((shift) => [shift.id, shift]));

/** الأعياد والعطلات الرسمية في مدى البيانات. */
export const holidays = [
  { id: 1, date: "2026-01-07", name: "عيد الميلاد المجيد" },
  { id: 2, date: "2026-01-25", name: "عيد ثورة 25 يناير" },
  { id: 3, date: "2026-04-25", name: "عيد تحرير سيناء" },
  { id: 4, date: "2026-05-01", name: "عيد العمال" },
  { id: 5, date: "2026-06-30", name: "عيد ثورة 30 يونيو" },
  { id: 6, date: "2026-07-23", name: "عيد ثورة 23 يوليو" },
  { id: 7, date: "2026-10-06", name: "عيد القوات المسلحة" },
];

const holidayDates = new Set(holidays.map((holiday) => holiday.date));

/**
 * سجلات البصمة للشهرين الأخيرين.
 *
 * شهران فقط لا عام كامل: السجل اليومي لـ 73 موظفًا × 300 يوم = 22 ألف صف،
 * وهو حجم لا تحتاجه شاشة عرض ويُبطئ أول تحميل. الشهران يُغطيان كل الحالات
 * (حاضر، متأخر، غائب، إجازة، راحة، عطلة، بصمة ناقصة) ويكفيان للتقارير.
 */
export const attendanceRecords = (() => {
  const out = [];
  let id = 0;

  const start = addDays(TODAY, -59);

  for (let offset = 0; offset <= 59; offset += 1) {
    const date = addDays(start, offset);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();

    for (const employee of activeEmployees) {
      /* من لم يُعيَّن بعد لا سجل له. */
      if (employee.hireDate > date) continue;

      const shift = shiftById.get(employee.shiftId) ?? SHIFTS[0];
      id += 1;

      if (holidayDates.has(date)) {
        out.push({ id, employeeId: employee.id, employeeName: employee.name, departmentId: employee.departmentId, date, shiftId: shift.id, checkIn: null, checkOut: null, status: "holiday", source: "system" });
        continue;
      }

      /* `workDays` بصيغة JS: 0 = الأحد. */
      if (!shift.workDays.includes(weekday)) {
        out.push({ id, employeeId: employee.id, employeeName: employee.name, departmentId: employee.departmentId, date, shiftId: shift.id, checkIn: null, checkOut: null, status: "day_off", source: "system" });
        continue;
      }

      const roll = random.float();

      /* إجازة معتمدة (تُربط لاحقًا بطلبات الإجازات). */
      if (roll < 0.045) {
        out.push({ id, employeeId: employee.id, employeeName: employee.name, departmentId: employee.departmentId, date, shiftId: shift.id, checkIn: null, checkOut: null, status: "on_leave", leaveType: random.pick(["annual", "annual", "sick", "casual"]), source: "leave_request" });
        continue;
      }

      /* غياب بدون إذن. */
      if (roll < 0.065) {
        out.push({ id, employeeId: employee.id, employeeName: employee.name, departmentId: employee.departmentId, date, shiftId: shift.id, checkIn: null, checkOut: null, status: "absent", source: "device" });
        continue;
      }

      /* بصمة انصراف مفقودة — حالة واقعية تحتاج تصحيحًا يدويًا. */
      const missingCheckout = roll < 0.085;

      const [startHour, startMinute] = shift.startTime.split(":").map(Number);
      const lateMinutes = random.pickWeighted([
        [0, 11], [5, 3], [12, 3], [25, 2], [45, 1], [70, 1],
      ]);
      const checkInMinutes = startHour * 60 + startMinute + lateMinutes - random.int(0, 10);

      const workMinutes =
        Math.max(0, (Number(shift.endTime.split(":")[0]) - startHour) * 60) +
        random.pickWeighted([[0, 10], [35, 3], [95, 3], [160, 2], [240, 1]]);

      const toTime = (minutes) =>
        `${String(Math.floor((minutes % 1440) / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

      out.push({
        id,
        employeeId: employee.id,
        employeeName: employee.name,
        departmentId: employee.departmentId,
        date,
        shiftId: shift.id,
        checkIn: toTime(Math.max(0, checkInMinutes)),
        checkOut: missingCheckout ? null : toTime(checkInMinutes + workMinutes),
        status: null,
        source: "device",
      });
    }
  }

  /* التقييم في المحرك لا هنا: الحالة ودقائق التأخر مُشتقّة من الوردية. */
  return out.map((record) => ({
    ...record,
    ...evaluateDay(record, shiftById.get(record.shiftId) ?? SHIFTS[0]),
    id: record.id,
    employeeId: record.employeeId,
    employeeName: record.employeeName,
    departmentId: record.departmentId,
    shiftId: record.shiftId,
    source: record.source,
    leaveType: record.leaveType ?? null,
  }));
})();

/* ============================================================================
   3. طلبات الإجازات
   ============================================================================ */

export const leaveRequests = (() => {
  const out = [];
  let id = 0;

  for (const employee of activeEmployees) {
    const count = random.int(0, 4);

    for (let index = 0; index < count; index += 1) {
      id += 1;

      const type = random.pickWeighted([
        ["annual", 6], ["sick", 3], ["casual", 3], ["unpaid", 1],
        ...(employee.gender === "female" ? [["maternity", 1]] : []),
      ]);

      const fromDate = random.date(240, -25);
      const days = type === "maternity" ? 90 : random.pickWeighted([[1, 4], [2, 3], [3, 2], [5, 2], [7, 1], [14, 1]]);
      const toDate = addDays(fromDate, days - 1);

      /* الطلب المستقبلي معلّق، والماضي غالبًا معتمد. */
      const isFuture = fromDate > TODAY;
      const status = isFuture
        ? random.pickWeighted([["pending", 6], ["approved", 4]])
        : random.pickWeighted([["approved", 8], ["rejected", 1], ["cancelled", 1]]);

      out.push({
        id,
        requestNumber: `LV-2026-${String(id).padStart(4, "0")}`,
        employeeId: employee.id,
        employeeName: employee.name,
        employeeCode: employee.code,
        departmentId: employee.departmentId,
        departmentName: employee.departmentName,
        type,
        typeLabel: LEAVE_TYPES[type]?.label ?? type,
        isPaid: LEAVE_TYPES[type]?.paid ?? true,
        fromDate,
        toDate,
        days,
        reason: random.pick([
          "ظروف عائلية",
          "سفر خارج المحافظة",
          "إجازة اعتيادية",
          "عارض صحي",
          "مناسبة عائلية",
          "متابعة إجراءات شخصية",
        ]),
        requestedAt: `${addDays(fromDate, -random.int(2, 14))}T10:00:00+02:00`,
        status,
        approvedBy: status === "approved" ? "مدير الموارد البشرية / إيمان القاضي" : null,
        approvedAt: status === "approved" ? `${addDays(fromDate, -random.int(1, 5))}T13:00:00+02:00` : null,
        rejectionReason: status === "rejected" ? "تعارض مع جدول العمل في نفس الفترة." : null,
        coveringEmployeeId: random.chance(0.4) ? random.pick(activeEmployees).id : null,
        notes: null,
      });
    }
  }

  return out.sort((a, b) => String(b.fromDate).localeCompare(String(a.fromDate)));
})();

/** أرصدة الإجازات — مُشتقّة في `js/domain/attendance.js` لا مخزَّنة. */
export const leaveBalanceInputs = { requests: leaveRequests, year: 2026 };

/* ============================================================================
   4. سلف الموظفين
   ============================================================================ */

export const employeeAdvances = (() => {
  const out = [];
  let id = 0;

  /* نحو 18% من العاملين عليهم سلفة — نسبة واقعية. */
  for (const employee of random.sample(activeEmployees, Math.round(activeEmployees.length * 0.18))) {
    id += 1;

    const amount = money.round(
      Math.min(employee.basicSalary * random.pick([1, 1.5, 2, 3]), 60_000),
    );
    const installments = random.pick([3, 4, 6, 6, 12]);
    const startPeriod = random.pick(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    const schedule = advanceSchedule({ amount, installments, startPeriod });

    /* الأقساط التي مرّ موعدها تُعدّ مستردّة. */
    for (const row of schedule) {
      if (row.period < CURRENT_PERIOD) row.status = "recovered";
    }

    const outstanding = advanceOutstanding({ amount, schedule });

    out.push({
      id,
      advanceNumber: `ADV-2026-${String(id).padStart(4, "0")}`,
      employeeId: employee.id,
      employeeName: employee.name,
      employeeCode: employee.code,
      departmentName: employee.departmentName,
      amount,
      installments,
      installmentAmount: schedule[0]?.amount ?? 0,
      startPeriod,
      schedule,
      recovered: money.subtract(amount, outstanding),
      outstanding,
      reason: random.pick([
        "سلفة شخصية",
        "مصاريف علاج",
        "مصاريف دراسية",
        "ظروف طارئة",
        "سلفة مقدَّمة على الراتب",
      ]),
      requestedAt: `${startPeriod}-01T09:00:00+02:00`,
      approvedBy: "المدير المالي / هشام البحيري",
      paidFromAccountId: 1111,
      status: money.isZero(outstanding) ? "recovered" : "partially_recovered",
      notes: null,
    });
  }

  return out;
})();

/* ============================================================================
   5. مسيّرات الرواتب

   تُحسب بـ `runPayroll`. الحضور يُلخَّص من سجلات البصمة للشهور المتاحة،
   والشهور الأقدم تُحسب بحضور كامل — وهو الافتراض الصريح لا تقديرًا مخفيًا.
   ============================================================================ */

/** إعدادات الرواتب — تُدار من شاشة إعدادات الرواتب. */
export const payrollSettings = {
  insurance: { employeeRate: 0.11, employerRate: 0.1875, minBase: 2_300, maxBase: 14_500 },
  personalExemption: 20_000,
  overtime: { weekdayFactor: 1.35, weekendFactor: 1.7, holidayFactor: 2, monthlyHours: 240 },
  absence: { monthDays: 30, monthlyHours: 240 },
  taxBrackets: [
    { upTo: 40_000, rate: 0 },
    { upTo: 55_000, rate: 0.1 },
    { upTo: 70_000, rate: 0.15 },
    { upTo: 200_000, rate: 0.2 },
    { upTo: 400_000, rate: 0.225 },
    { upTo: null, rate: 0.25 },
  ],
  payDay: 5,
  payrollBankAccountId: 4,
};

/** يلخّص حضور كل موظف في فترة — مدخل محرك الرواتب. */
function attendanceForPeriod(period) {
  const byEmployee = {};

  for (const record of attendanceRecords) {
    if (String(record.date).slice(0, 7) !== period) continue;
    (byEmployee[record.employeeId] ??= []).push(record);
  }

  return Object.fromEntries(
    Object.entries(byEmployee).map(([employeeId, days]) => [employeeId, summarizeAttendance(days)]),
  );
}

export const payrollRuns = (() => {
  const periods = monthRange("2026-01", CURRENT_PERIOD);
  const out = [];

  periods.forEach((period, index) => {
    const isCurrent = period === CURRENT_PERIOD;

    const attendance = attendanceForPeriod(period);

    /* أقساط السلف المستحقة في هذه الفترة. */
    const advances = Object.fromEntries(
      activeEmployees.map((employee) => [
        employee.id,
        advanceDueFor(employeeAdvances, employee.id, period),
      ]),
    );

    const result = runPayroll(activeEmployees, {
      period,
      attendanceByEmployee: attendance,
      advancesByEmployee: advances,
      settings: payrollSettings,
    });

    /*
     * دورة حياة المسيّر: الشهور المنتهية مصروفة، والشهر الذي قبل الجاري
     * معتمد ومُرحَّل، والجاري محسوب بانتظار الاعتماد. هذا يُظهر كل حالة من
     * حالات المسيّر في الشاشة بدل حالة واحدة متكررة.
     */
    const status = isCurrent
      ? PayrollStatus.CALCULATED
      : index === periods.length - 2
        ? PayrollStatus.APPROVED
        : PayrollStatus.PAID;

    out.push({
      id: index + 1,
      runNumber: `PR-${period.replace("-", "")}`,
      period,
      periodLabel: formatPeriod(period),
      fromDate: `${period}-01`,
      toDate: endOfMonth(period),
      payDate: addDays(endOfMonth(period), payrollSettings.payDay),
      headcount: result.payslips.length,
      totals: result.totals,
      warnings: result.warnings,
      status,
      costCenterId: 1,

      calculatedBy: "موظف موارد بشرية / دعاء شلبي",
      calculatedAt: `${endOfMonth(period)}T12:00:00+02:00`,
      approvedBy: status === PayrollStatus.CALCULATED ? null : "المدير المالي / هشام البحيري",
      approvedAt: status === PayrollStatus.CALCULATED ? null : `${endOfMonth(period)}T16:00:00+02:00`,
      paidAt: status === PayrollStatus.PAID ? `${addDays(endOfMonth(period), 5)}T11:00:00+02:00` : null,
      paidFromAccountId: status === PayrollStatus.PAID ? 1124 : null,

      /**
       * مرجع القيد المحاسبي. المسيّر المعتمد يحمل مفتاح ترحيله، فلا يُرحَّل
       * مرتين — راجع `postingKey` في js/domain/posting.js.
       */
      accrualPostingKey: status === PayrollStatus.CALCULATED ? null : `payroll_approval:${index + 1}:accrual`,
      paymentPostingKey: status === PayrollStatus.PAID ? `payroll_payment:${index + 1}:payment` : null,

      notes: isCurrent ? "مسيّر الشهر الجاري — محسوب وبانتظار الاعتماد." : null,

      /** القسائم التفصيلية — تُعرض في شاشة المسيّر وتُطبع كقسائم فردية. */
      payslips: result.payslips.map((slip, slipIndex) => ({
        ...slip,
        id: (index + 1) * 1000 + slipIndex + 1,
        payrollRunId: index + 1,
        period,
        periodLabel: formatPeriod(period),
        payslipNumber: `PS-${period.replace("-", "")}-${String(slipIndex + 1).padStart(3, "0")}`,
        status,
      })),
    });
  });

  return out.reverse();
})();

/** قسائم كل المسيّرات في مجموعة واحدة — لشاشة «قسائم الرواتب». */
export const payslips = payrollRuns.flatMap((run) => run.payslips);

/** المسيّر الجاري — تقرؤه لوحة التحكم. */
export const currentPayrollRun = payrollRuns.find((run) => run.period === CURRENT_PERIOD) ?? payrollRuns[0];

export { TODAY as HR_TODAY };

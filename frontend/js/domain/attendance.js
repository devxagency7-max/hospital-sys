/**
 * الحضور والإجازات — القواعد والحسابات.
 *
 * دوال خالصة. مصدر الحقيقة لأرقام الحضور التي يقرأها مسيّر الرواتب:
 * أيام الغياب ودقائق التأخير وساعات العمل الإضافي تُشتق هنا من سجلات
 * البصمة والورديات، ثم تُمرَّر إلى js/domain/payroll.js.
 *
 * الفصل مقصود: محرك الرواتب لا يعرف ما الوردية ولا متى تبدأ، ومحرك الحضور
 * لا يعرف أجر الساعة. كل منهما يتغيّر لأسباب مختلفة تمامًا.
 */

import * as money from "../core/money.js";
import { ruleViolation } from "../core/errors.js";

/* ==========================================================================
   1) المفردات
   ========================================================================== */

export const AttendanceStatus = Object.freeze({
  PRESENT: "present",
  LATE: "late",
  ABSENT: "absent",
  ON_LEAVE: "on_leave",
  HALF_DAY: "half_day",
  DAY_OFF: "day_off",
  HOLIDAY: "holiday",
});

export const LeaveStatus = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
});

/**
 * أنواع الإجازات. `paid` يحدد إن كانت مدفوعة، و`deductsBalance` إن كانت
 * تُخصم من الرصيد السنوي.
 *
 * الإجازة المرضية مدفوعة ولا تُخصم من الرصيد السنوي — هذان حقلان مستقلان
 * لا حقل واحد، ودمجهما يجعل الإجازة المرضية تأكل الرصيد السنوي خطأً.
 */
export const LEAVE_TYPES = Object.freeze({
  annual: { label: "إجازة سنوية", paid: true, deductsBalance: true, defaultDays: 21 },
  sick: { label: "إجازة مرضية", paid: true, deductsBalance: false, defaultDays: 15 },
  unpaid: { label: "إجازة بدون أجر", paid: false, deductsBalance: false, defaultDays: 0 },
  casual: { label: "إجازة عارضة", paid: true, deductsBalance: true, defaultDays: 6 },
  maternity: { label: "إجازة وضع", paid: true, deductsBalance: false, defaultDays: 90 },
  bereavement: { label: "إجازة وفاة", paid: true, deductsBalance: false, defaultDays: 3 },
  hajj: { label: "إجازة حج", paid: true, deductsBalance: false, defaultDays: 30 },
});

/* ==========================================================================
   2) الوقت
   ========================================================================== */

/** "08:30" → 510 دقيقة من منتصف الليل. */
export function toMinutes(time) {
  const [hours, minutes] = String(time ?? "").split(":").map(Number);
  if (!Number.isFinite(hours)) return 0;
  return hours * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

/** 510 → "08:30" */
export function fromMinutes(total) {
  const value = Math.max(0, Math.round(total));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

/** دقائق بين وقتين، مع دعم الوردية التي تعبر منتصف الليل. */
export function minutesBetween(from, to) {
  const start = toMinutes(from);
  const end = toMinutes(to);
  return end >= start ? end - start : end + 1440 - start;
}

/* ==========================================================================
   3) تقييم يوم واحد
   ========================================================================== */

/**
 * يُقيّم سجل حضور يوم واحد مقابل ورديته.
 *
 * @param {object} record `{ date, checkIn, checkOut, status? }`
 * @param {object} shift  `{ startTime, endTime, graceMinutes, breakMinutes, minHalfDayMinutes }`
 * @returns {object} سجل مُقيَّم بحالته ودقائق تأخره وساعات عمله
 */
export function evaluateDay(record, shift = {}) {
  const {
    startTime = "09:00",
    endTime = "17:00",
    graceMinutes = 15,
    breakMinutes = 60,
    minHalfDayMinutes = 240,
  } = shift;

  const base = {
    date: record?.date,
    employeeId: record?.employeeId,
    checkIn: record?.checkIn ?? null,
    checkOut: record?.checkOut ?? null,
    shiftStart: startTime,
    shiftEnd: endTime,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    workedMinutes: 0,
    overtimeMinutes: 0,
  };

  /* --- حالات لا تُقاس بالبصمة --- */
  if (record?.status === AttendanceStatus.HOLIDAY) {
    return { ...base, status: AttendanceStatus.HOLIDAY };
  }
  if (record?.status === AttendanceStatus.DAY_OFF) {
    return { ...base, status: AttendanceStatus.DAY_OFF };
  }
  if (record?.status === AttendanceStatus.ON_LEAVE) {
    return { ...base, status: AttendanceStatus.ON_LEAVE, leaveType: record.leaveType ?? null };
  }

  /* --- لا بصمة دخول = غياب --- */
  if (!record?.checkIn) {
    return { ...base, status: AttendanceStatus.ABSENT };
  }

  const scheduledMinutes = Math.max(0, minutesBetween(startTime, endTime) - breakMinutes);
  const lateRaw = toMinutes(record.checkIn) - toMinutes(startTime);
  const lateMinutes = Math.max(0, lateRaw - graceMinutes);

  /*
   * بصمة دخول بلا خروج: لا نفترض أنه عمل اليوم كاملًا ولا أنه غائب. نُعلّم
   * السجل كناقص ويُصحَّح يدويًا — تقدير أي من الافتراضين يُنتج راتبًا خاطئًا
   * بلا أثر يدل على سببه.
   */
  if (!record.checkOut) {
    return {
      ...base,
      status: lateMinutes > 0 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
      lateMinutes,
      incomplete: true,
      note: "بصمة انصراف مفقودة — يحتاج تصحيحًا يدويًا.",
    };
  }

  const workedMinutes = Math.max(0, minutesBetween(record.checkIn, record.checkOut) - breakMinutes);
  const earlyLeaveMinutes = Math.max(0, toMinutes(endTime) - toMinutes(record.checkOut));
  const overtimeMinutes = Math.max(0, workedMinutes - scheduledMinutes);

  let status = AttendanceStatus.PRESENT;
  if (workedMinutes < minHalfDayMinutes) status = AttendanceStatus.HALF_DAY;
  else if (lateMinutes > 0) status = AttendanceStatus.LATE;

  return {
    ...base,
    status,
    lateMinutes,
    earlyLeaveMinutes,
    workedMinutes,
    overtimeMinutes,
    scheduledMinutes,
  };
}

/* ==========================================================================
   4) ملخص فترة لموظف
   ========================================================================== */

/**
 * يلخّص حضور موظف في فترة، بالشكل الذي يتوقعه `calculatePayslip`.
 *
 * `overtimeHours` مُقسَّم إلى أيام عادية وعطلات ورسمية لأن لكلٍّ معاملًا
 * مختلفًا في أجر الإضافي — تجميعها في رقم واحد يُسقط الفرق.
 *
 * @param {object[]} days سجلات مُقيَّمة من `evaluateDay`
 * @returns {object} `{ absentDays, lateMinutes, overtimeHours:{...}, ... }`
 */
export function summarizeAttendance(days = []) {
  const summary = {
    totalDays: days.length,
    presentDays: 0,
    lateDays: 0,
    absentDays: 0,
    leaveDays: 0,
    halfDays: 0,
    offDays: 0,
    holidayDays: 0,
    incompleteDays: 0,

    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    workedMinutes: 0,

    overtimeHours: { weekdayHours: 0, weekendHours: 0, holidayHours: 0 },
  };

  for (const day of days) {
    summary.lateMinutes += day.lateMinutes ?? 0;
    summary.earlyLeaveMinutes += day.earlyLeaveMinutes ?? 0;
    summary.workedMinutes += day.workedMinutes ?? 0;
    if (day.incomplete) summary.incompleteDays += 1;

    switch (day.status) {
      case AttendanceStatus.PRESENT:
        summary.presentDays += 1;
        break;
      case AttendanceStatus.LATE:
        summary.presentDays += 1;
        summary.lateDays += 1;
        break;
      case AttendanceStatus.ABSENT:
        summary.absentDays += 1;
        break;
      case AttendanceStatus.ON_LEAVE:
        summary.leaveDays += 1;
        break;
      case AttendanceStatus.HALF_DAY:
        summary.halfDays += 1;
        summary.presentDays += 1;
        break;
      case AttendanceStatus.DAY_OFF:
        summary.offDays += 1;
        break;
      case AttendanceStatus.HOLIDAY:
        summary.holidayDays += 1;
        break;
      default:
        break;
    }

    /* الإضافي يُنسب لنوع اليوم الذي وقع فيه. */
    const hours = (day.overtimeMinutes ?? 0) / 60;
    if (!hours) continue;

    if (day.status === AttendanceStatus.HOLIDAY) summary.overtimeHours.holidayHours += hours;
    else if (day.status === AttendanceStatus.DAY_OFF) summary.overtimeHours.weekendHours += hours;
    else summary.overtimeHours.weekdayHours += hours;
  }

  /* نصف اليوم يُحتسب نصف غياب في خصم الراتب. */
  summary.absentDaysEquivalent = summary.absentDays + summary.halfDays * 0.5;

  summary.attendanceRate =
    summary.totalDays - summary.offDays - summary.holidayDays > 0
      ? summary.presentDays / (summary.totalDays - summary.offDays - summary.holidayDays)
      : 1;

  // تقريب الساعات لمنزلتين — دقائق البصمة لا تُنتج كسورًا أدق من ذلك بمعنى.
  for (const key of Object.keys(summary.overtimeHours)) {
    summary.overtimeHours[key] = Math.round(summary.overtimeHours[key] * 100) / 100;
  }

  return summary;
}

/* ==========================================================================
   5) الإجازات
   ========================================================================== */

/** عدد أيام طلب إجازة (شامل الطرفين). */
export function leaveDays(request) {
  const from = Date.parse(`${String(request?.fromDate ?? "").slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${String(request?.toDate ?? "").slice(0, 10)}T00:00:00Z`);

  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  if (to < from) {
    throw ruleViolation("تاريخ نهاية الإجازة قبل بدايتها.", { field: "toDate" });
  }

  return Math.round((to - from) / 86_400_000) + 1;
}

/**
 * رصيد إجازات موظف من نوع معيّن.
 *
 * المستهلك يُحسب من الطلبات **المعتمدة فقط**: الطلب المعلّق لم يُقرَّر بعد،
 * وخصمه من الرصيد يمنع الموظف من تقديم طلب آخر بسبب طلب قد يُرفض. لكنه
 * يُعرض كـ`pending` ليُؤخذ في الحسبان عند الاعتماد.
 */
export function leaveBalance(employee, requests = [], { type = "annual", year } = {}) {
  const definition = LEAVE_TYPES[type] ?? LEAVE_TYPES.annual;
  const entitlement = employee?.leaveEntitlements?.[type] ?? definition.defaultDays;
  const carriedOver = employee?.leaveCarriedOver?.[type] ?? 0;

  const inYear = (request) =>
    !year || String(request.fromDate ?? "").slice(0, 4) === String(year);

  const relevant = requests.filter(
    (request) =>
      String(request.employeeId) === String(employee?.id) &&
      request.type === type &&
      inYear(request),
  );

  const used = relevant
    .filter((request) => request.status === LeaveStatus.APPROVED)
    .reduce((total, request) => total + (request.days ?? leaveDays(request)), 0);

  const pending = relevant
    .filter((request) => request.status === LeaveStatus.PENDING)
    .reduce((total, request) => total + (request.days ?? leaveDays(request)), 0);

  const total = entitlement + carriedOver;

  return {
    type,
    label: definition.label,
    entitlement,
    carriedOver,
    total,
    used,
    pending,
    remaining: Math.max(0, total - used),
    /** المتاح فعليًا لو اعتُمدت كل الطلبات المعلّقة — يمنع الإفراط في الاعتماد. */
    availableIfAllApproved: Math.max(0, total - used - pending),
    deductsBalance: definition.deductsBalance,
  };
}

/**
 * يتحقق أن طلب الإجازة قابل للاعتماد.
 *
 * يرفض: تجاوز الرصيد، والتداخل مع إجازة معتمدة أخرى. التداخل خطأ شائع
 * يُنتج موظفًا «في إجازتين» فيُخصم مرتين من رصيده.
 */
export function assertLeaveApprovable(request, { balance, existingRequests = [] } = {}) {
  if (request?.status !== LeaveStatus.PENDING) {
    throw ruleViolation(`لا يُعتمد إلا طلب معلّق (الحالة الحالية: ${request?.status}).`);
  }

  const days = request.days ?? leaveDays(request);

  if (balance?.deductsBalance && days > balance.remaining) {
    throw ruleViolation(
      `رصيد ${balance.label} المتبقي ${balance.remaining} يومًا، والطلب ${days} أيام. ` +
        "لا يمكن اعتماد الطلب.",
      { field: "days" },
    );
  }

  const overlap = existingRequests.find(
    (other) =>
      String(other.id) !== String(request.id) &&
      String(other.employeeId) === String(request.employeeId) &&
      other.status === LeaveStatus.APPROVED &&
      String(other.fromDate) <= String(request.toDate) &&
      String(other.toDate) >= String(request.fromDate),
  );

  if (overlap) {
    throw ruleViolation(
      `الطلب يتداخل مع إجازة معتمدة من ${overlap.fromDate} إلى ${overlap.toDate}.`,
      { field: "fromDate" },
    );
  }

  return request;
}

/** هل الموظف في إجازة معتمدة في تاريخ معيّن؟ */
export function isOnLeave(employeeId, date, requests = []) {
  const day = String(date).slice(0, 10);

  return requests.some(
    (request) =>
      String(request.employeeId) === String(employeeId) &&
      request.status === LeaveStatus.APPROVED &&
      String(request.fromDate) <= day &&
      String(request.toDate) >= day,
  );
}

/* ==========================================================================
   6) تقارير
   ========================================================================== */

/** ملخص حضور كل الموظفين في فترة — لتقرير الحضور الشهري. */
export function attendanceReport(employees = [], records = [], { dateFrom, dateTo, shifts = {} } = {}) {
  const inRange = (record) => {
    const day = String(record.date ?? "").slice(0, 10);
    if (dateFrom && day < dateFrom) return false;
    if (dateTo && day > dateTo) return false;
    return true;
  };

  const byEmployee = new Map();
  for (const record of records.filter(inRange)) {
    const key = String(record.employeeId);
    if (!byEmployee.has(key)) byEmployee.set(key, []);
    byEmployee.get(key).push(record);
  }

  const rows = employees.map((employee) => {
    const shift = shifts[employee.shiftId] ?? {};
    const days = (byEmployee.get(String(employee.id)) ?? []).map((record) =>
      evaluateDay(record, shift),
    );

    return {
      employeeId: employee.id,
      code: employee.code,
      name: employee.name,
      departmentName: employee.departmentName ?? "—",
      ...summarizeAttendance(days),
    };
  });

  return {
    rows: rows.sort((a, b) => a.attendanceRate - b.attendanceRate),
    totals: {
      employees: rows.length,
      presentDays: rows.reduce((total, row) => total + row.presentDays, 0),
      absentDays: rows.reduce((total, row) => total + row.absentDays, 0),
      lateDays: rows.reduce((total, row) => total + row.lateDays, 0),
      leaveDays: rows.reduce((total, row) => total + row.leaveDays, 0),
      lateMinutes: rows.reduce((total, row) => total + row.lateMinutes, 0),
      incompleteDays: rows.reduce((total, row) => total + row.incompleteDays, 0),
      averageAttendanceRate: rows.length
        ? rows.reduce((total, row) => total + row.attendanceRate, 0) / rows.length
        : 0,
    },
  };
}

/** تكلفة الغياب التقديرية — لربط تقرير الحضور بأثره المالي. */
export function absenceCost(rows = [], employeesById = new Map(), { monthDays = 30 } = {}) {
  return money.sum(
    rows.map((row) => {
      const employee = employeesById.get(String(row.employeeId));
      const daily = monthDays ? money.round((employee?.basicSalary ?? 0) / monthDays) : 0;
      return money.multiply(daily, row.absentDaysEquivalent ?? row.absentDays ?? 0);
    }),
  );
}

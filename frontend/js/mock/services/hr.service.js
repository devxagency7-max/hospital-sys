/**
 * خدمة الموارد البشرية — الموظفون، الحضور، الإجازات، السلف، الرواتب.
 *
 * التكامل المحاسبي: اعتماد المسيّر وصرفه يُرحّلان عبر `postDocument`، بمفتاحي
 * حدث مختلفين (`accrual` و `payment`) حتى يُقبل الحدثان المشروعان ويُرفض
 * تكرار أيٍّ منهما.
 */

import { ruleViolation, notFound, validationError } from "../../core/errors.js";
import * as money from "../../core/money.js";
import {
  runPayroll,
  summarizePayroll,
  payrollByDepartment,
  advanceSchedule,
  advanceDueFor,
  advanceOutstanding,
  assertPayrollMutable,
  formatPeriod,
  PayrollStatus,
} from "../../domain/payroll.js";
import {
  evaluateDay,
  summarizeAttendance,
  attendanceReport,
  absenceCost,
  leaveBalance,
  leaveDays,
  assertLeaveApprovable,
  LEAVE_TYPES,
  LeaveStatus,
} from "../../domain/attendance.js";
import { SourceType } from "../../domain/posting.js";
import { db, all, find, insert, update, where, query } from "../db.js";
import { postDocument, audit, entryForDocument } from "./posting.service.js";
import { REFERENCE_DATE, CURRENT_PERIOD, endOfMonth } from "../seed.js";

const TODAY = REFERENCE_DATE.toISOString().slice(0, 10);

/* ==========================================================================
   1) الموظفون والهيكل التنظيمي
   ========================================================================== */

/** الموظفون على رأس العمل — مدخل كل حساب. */
function activeEmployees() {
  return all("employees").filter(
    (employee) => employee.status === "employed" || employee.status === "probation",
  );
}

export function listEmployees(params = {}) {
  const result = query("employees", params);

  return {
    ...result,
    data: result.data.map((employee) => ({
      ...employee,
      allowancesTotal: money.sum(
        (employee.allowances ?? []).map((row) =>
          row.rate ? money.percentOf(employee.basicSalary, row.rate) : money.round(row.amount ?? 0),
        ),
      ),
      /** مستندات منتهية الصلاحية — تنبيه موارد بشرية واقعي. */
      expiredDocuments: (employee.documents ?? []).filter((doc) => doc.status === "expired").length,
      yearsOfService: employee.hireDate
        ? Math.floor((Date.parse(TODAY) - Date.parse(employee.hireDate)) / 31_557_600_000)
        : 0,
    })),
  };
}

export function getEmployee(id) {
  const employee = find("employees", id);
  if (!employee) throw notFound("الموظف غير موجود.");

  const attendance = where("attendanceRecords", (row) => String(row.employeeId) === String(id));
  const requests = where("leaveRequests", (row) => String(row.employeeId) === String(id));
  const advances = where("employeeAdvances", (row) => String(row.employeeId) === String(id));
  const slips = where("payslips", (row) => String(row.employeeId) === String(id));

  const manager = employee.managerId ? find("employees", employee.managerId) : null;
  const department = find("departments", employee.departmentId);
  const position = find("positions", employee.positionId);
  const shift = find("shifts", employee.shiftId);

  return {
    ...employee,
    departmentName: department?.name ?? "—",
    positionTitle: position?.title ?? employee.jobTitle,
    shiftName: shift?.name ?? "—",
    managerName: manager?.name ?? null,
    directReports: all("employees").filter(
      (row) => String(row.managerId) === String(employee.id),
    ).length,

    /** أرصدة الإجازات لكل نوع — مُشتقّة لا مخزَّنة. */
    leaveBalances: Object.keys(LEAVE_TYPES).map((type) =>
      leaveBalance(employee, requests, { type, year: Number(TODAY.slice(0, 4)) }),
    ),

    attendanceSummary: summarizeAttendance(
      attendance.filter((row) => String(row.date).slice(0, 7) === CURRENT_PERIOD),
    ),
    leaveRequests: requests.slice(0, 20),
    advances: advances.map((advance) => ({
      ...advance,
      outstanding: advanceOutstanding(advance),
    })),
    payslips: slips.slice(0, 12),
  };
}

/** الهيكل التنظيمي بشكل شجري مع أعداد الموظفين. */
export function organizationChart() {
  const employees = all("employees");
  const active = activeEmployees();

  const rows = all("departments").map((department) => {
    const own = active.filter((employee) => employee.departmentId === department.id);
    const manager = department.managerId ? employees.find((row) => row.id === department.managerId) : null;
    const center = find("costCenters", department.costCenterId);

    return {
      ...department,
      managerName: manager?.name ?? null,
      managerTitle: manager?.jobTitle ?? null,
      costCenterName: center?.name ?? null,
      headcount: own.length,
      positionsCount: all("positions").filter((row) => row.departmentId === department.id).length,
      payrollCost: money.sumBy(
        where("payslips", (row) => row.period === CURRENT_PERIOD && row.departmentId === department.id),
        "employerCost",
      ),
    };
  });

  return {
    rows,
    totals: {
      departments: rows.length,
      headcount: active.length,
      totalEmployees: employees.length,
      positions: all("positions").length,
      payrollCost: money.sumBy(rows, "payrollCost"),
    },
  };
}

/* ==========================================================================
   2) الحضور
   ========================================================================== */

const shiftMap = () => Object.fromEntries(all("shifts").map((shift) => [shift.id, shift]));

export function getAttendanceReport(params = {}) {
  const period = params.period ?? CURRENT_PERIOD;

  const report = attendanceReport(activeEmployees(), all("attendanceRecords"), {
    dateFrom: params.dateFrom ?? `${period}-01`,
    dateTo: params.dateTo ?? endOfMonth(period),
    shifts: shiftMap(),
  });

  const byId = new Map(all("employees").map((employee) => [String(employee.id), employee]));

  return {
    ...report,
    period,
    periodLabel: formatPeriod(period),
    /** تكلفة الغياب — يربط تقرير الحضور بأثره المالي. */
    absenceCost: absenceCost(report.rows, byId),
  };
}

/** يصحّح سجل حضور — البصمة الناقصة تحتاج تدخلاً يدويًا موثَّقًا. */
export function correctAttendance(id, payload, { user } = {}) {
  const record = find("attendanceRecords", id);
  if (!record) throw notFound("سجل الحضور غير موجود.");

  const period = String(record.date).slice(0, 7);
  const run = all("payrollRuns").find((row) => row.period === period);

  /*
   * تعديل الحضور بعد اعتماد مسيّر الشهر يجعل القسائم المُعتمدة مخالفة
   * لسجل الحضور الذي بُنيت عليه. نرفض ونطلب تسوية في الشهر التالي — وهو
   * ما يفعله قسم الموارد البشرية فعلًا.
   */
  if (run && [PayrollStatus.APPROVED, PayrollStatus.PAID].includes(run.status)) {
    throw ruleViolation(
      `مسيّر رواتب ${run.periodLabel} معتمد بالفعل، فلا يُعدَّل حضور هذا الشهر. ` +
        "سجّل التسوية على مسيّر الشهر الجاري.",
    );
  }

  if (!String(payload?.reason ?? "").trim()) {
    throw ruleViolation("تصحيح سجل الحضور يتطلب سببًا — للتدقيق.", { field: "reason" });
  }

  const shift = find("shifts", record.shiftId) ?? all("shifts")[0];

  const corrected = {
    ...record,
    checkIn: payload.checkIn ?? record.checkIn,
    checkOut: payload.checkOut ?? record.checkOut,
    status: payload.status ?? null,
  };

  const next = update("attendanceRecords", id, {
    ...evaluateDay(corrected, shift),
    employeeId: record.employeeId,
    employeeName: record.employeeName,
    departmentId: record.departmentId,
    shiftId: record.shiftId,
    source: "manual_correction",
    correctedBy: user?.name ?? "—",
    correctedAt: new Date().toISOString(),
    correctionReason: String(payload.reason).trim(),
  });

  audit({
    action: "attendance.correct", actionLabel: "تصحيح سجل حضور",
    module: "الموارد البشرية", entity: "attendance_record", entityId: next.id,
    details: `${record.employeeName} — ${record.date} — ${payload.reason}`, user,
  });

  return next;
}

/* ==========================================================================
   3) الإجازات
   ========================================================================== */

export function listLeaveRequests(params = {}) {
  const result = query("leaveRequests", params);

  return {
    ...result,
    data: result.data.map((request) => ({
      ...request,
      days: request.days ?? leaveDays(request),
    })),
  };
}

export function createLeaveRequest(payload, { user } = {}) {
  const employee = find("employees", payload?.employeeId);
  if (!employee) throw notFound("الموظف غير موجود.");

  const errors = {};
  if (!payload?.fromDate) errors.fromDate = "تاريخ البداية مطلوب.";
  if (!payload?.toDate) errors.toDate = "تاريخ النهاية مطلوب.";
  if (!payload?.type || !LEAVE_TYPES[payload.type]) errors.type = "نوع الإجازة مطلوب.";
  if (Object.keys(errors).length) throw validationError(errors);

  const days = leaveDays(payload);
  const sequence = all("leaveRequests").length + 1;

  const request = insert("leaveRequests", {
    requestNumber: `LV-2026-${String(sequence).padStart(4, "0")}`,
    employeeId: employee.id,
    employeeName: employee.name,
    employeeCode: employee.code,
    departmentId: employee.departmentId,
    departmentName: employee.departmentName,
    type: payload.type,
    typeLabel: LEAVE_TYPES[payload.type].label,
    isPaid: LEAVE_TYPES[payload.type].paid,
    fromDate: payload.fromDate,
    toDate: payload.toDate,
    days,
    reason: payload.reason ?? null,
    requestedAt: new Date().toISOString(),
    status: LeaveStatus.PENDING,
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    coveringEmployeeId: payload.coveringEmployeeId ?? null,
    notes: null,
  });

  /** الرصيد يُعرض مع الطلب، فيرى المعتمد الأثر قبل القرار. */
  const balance = leaveBalance(
    employee,
    where("leaveRequests", (row) => String(row.employeeId) === String(employee.id)),
    { type: payload.type, year: Number(String(payload.fromDate).slice(0, 4)) },
  );

  return { request, balance };
}

export function approveLeaveRequest(id, { user } = {}) {
  const request = find("leaveRequests", id);
  if (!request) throw notFound("طلب الإجازة غير موجود.");

  const employee = find("employees", request.employeeId);
  if (!employee) throw notFound("الموظف غير موجود.");

  const existing = where("leaveRequests", (row) => String(row.employeeId) === String(employee.id));
  const balance = leaveBalance(employee, existing, {
    type: request.type,
    year: Number(String(request.fromDate).slice(0, 4)),
  });

  /* الحراسة في طبقة المجال: الرصيد والتداخل. */
  assertLeaveApprovable(request, { balance, existingRequests: existing });

  const next = update("leaveRequests", id, {
    status: LeaveStatus.APPROVED,
    approvedBy: user?.name ?? "—",
    approvedAt: new Date().toISOString(),
  });

  /*
   * اعتماد الإجازة يُحدّث سجل الحضور لأيامها: الموظف «في إجازة» لا «غائب».
   * بلا هذا التحديث يُخصم من راتبه غيابٌ وهو في إجازة معتمدة.
   */
  for (const record of all("attendanceRecords")) {
    if (String(record.employeeId) !== String(employee.id)) continue;
    if (record.date < next.fromDate || record.date > next.toDate) continue;
    if (record.status === "holiday" || record.status === "day_off") continue;

    update("attendanceRecords", record.id, {
      status: "on_leave",
      leaveType: next.type,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      workedMinutes: 0,
      overtimeMinutes: 0,
      source: "leave_request",
    });
  }

  audit({
    action: "leave.approve", actionLabel: "اعتماد طلب إجازة",
    module: "الموارد البشرية", entity: "leave_request", entityId: next.id,
    details: `${next.requestNumber} — ${next.employeeName} — ${next.days} يوم`, user,
  });

  return next;
}

export function rejectLeaveRequest(id, { reason, user } = {}) {
  const request = find("leaveRequests", id);
  if (!request) throw notFound("طلب الإجازة غير موجود.");

  if (request.status !== LeaveStatus.PENDING) {
    throw ruleViolation(`لا يُرفض إلا طلب معلّق (الحالة الحالية: ${request.status}).`);
  }
  if (!String(reason ?? "").trim()) {
    throw ruleViolation("رفض الطلب يتطلب سببًا.", { field: "reason" });
  }

  return update("leaveRequests", id, {
    status: LeaveStatus.REJECTED,
    rejectionReason: String(reason).trim(),
    approvedBy: user?.name ?? "—",
    approvedAt: new Date().toISOString(),
  });
}

/** أرصدة إجازات كل الموظفين — لتقرير الإجازات. */
export function leaveBalancesReport(params = {}) {
  const type = params.type ?? "annual";
  const year = Number(params.year ?? TODAY.slice(0, 4));
  const requests = all("leaveRequests");

  const rows = activeEmployees().map((employee) => ({
    employeeId: employee.id,
    code: employee.code,
    name: employee.name,
    departmentName: employee.departmentName,
    jobTitle: employee.jobTitle,
    ...leaveBalance(employee, requests, { type, year }),
  }));

  return {
    type,
    year,
    rows: rows.sort((a, b) => b.remaining - a.remaining),
    totals: {
      employees: rows.length,
      entitlement: rows.reduce((total, row) => total + row.total, 0),
      used: rows.reduce((total, row) => total + row.used, 0),
      pending: rows.reduce((total, row) => total + row.pending, 0),
      remaining: rows.reduce((total, row) => total + row.remaining, 0),
    },
  };
}

/* ==========================================================================
   4) السلف
   ========================================================================== */

export function createAdvance(payload, { user } = {}) {
  const employee = find("employees", payload?.employeeId);
  if (!employee) throw notFound("الموظف غير موجود.");

  const amount = money.round(payload?.amount ?? 0);
  const installments = Number(payload?.installments) || 1;

  if (!money.isPositive(amount)) {
    throw validationError({ amount: "مبلغ السلفة يجب أن يكون أكبر من صفر." });
  }
  if (installments > db.systemPreferences.maxAdvanceInstalments) {
    throw ruleViolation(
      `أقصى عدد أقساط مسموح ${db.systemPreferences.maxAdvanceInstalments}.`,
      { field: "installments" },
    );
  }

  /*
   * سقف السلفة: القسط لا يتجاوز نصف الراتب الأساسي. بلا هذا السقف يُنتج
   * المسيّر صافيًا صفرًا ويُرحّل القسط شهرًا بعد شهر إلى ما لا نهاية.
   */
  const installmentAmount = money.round(amount / installments);
  if (money.compare(installmentAmount, money.multiply(employee.basicSalary, 0.5)) > 0) {
    throw ruleViolation(
      `القسط الشهري ${installmentAmount} يتجاوز نصف الراتب الأساسي ` +
        `(${money.multiply(employee.basicSalary, 0.5)}). زد عدد الأقساط أو أنقص المبلغ.`,
      { field: "installments" },
    );
  }

  /* سلفة قائمة تمنع سلفة جديدة — سياسة شائعة وواضحة. */
  const outstanding = where(
    "employeeAdvances",
    (row) => String(row.employeeId) === String(employee.id) && row.status !== "recovered",
  );
  if (outstanding.length) {
    throw ruleViolation(
      `على ${employee.name} سلفة قائمة (${outstanding[0].advanceNumber}) بمتبقٍّ ` +
        `${advanceOutstanding(outstanding[0])}. لا تُمنح سلفة جديدة قبل استرداد السابقة.`,
    );
  }

  const startPeriod = payload?.startPeriod ?? nextPeriod(CURRENT_PERIOD);
  const schedule = advanceSchedule({ amount, installments, startPeriod });
  const sequence = all("employeeAdvances").length + 1;

  const advance = insert("employeeAdvances", {
    advanceNumber: `ADV-2026-${String(sequence).padStart(4, "0")}`,
    employeeId: employee.id,
    employeeName: employee.name,
    employeeCode: employee.code,
    departmentName: employee.departmentName,
    amount,
    installments,
    installmentAmount,
    startPeriod,
    schedule,
    recovered: 0,
    outstanding: amount,
    reason: payload?.reason ?? null,
    requestedAt: new Date().toISOString(),
    approvedBy: user?.name ?? "—",
    paidFromAccountId: payload?.accountId ?? 1111,
    status: "partially_recovered",
    notes: null,
  });

  const posting = postDocument({
    sourceType: SourceType.EMPLOYEE_ADVANCE,
    sourceId: advance.id,
    document: {
      amount,
      employeeName: employee.name,
      accountId: advance.paidFromAccountId,
    },
    date: payload?.date ?? TODAY,
    description: `سلفة ${advance.advanceNumber} — ${employee.name}`,
    reference: advance.advanceNumber,
    user,
  });

  audit({
    action: "advance.create", actionLabel: "صرف سلفة موظف",
    module: "الموارد البشرية", entity: "employee_advance", entityId: advance.id,
    details: `${advance.advanceNumber} — ${employee.name} — ${amount}`, user,
  });

  return { advance, journalEntry: posting.entry };
}

/* ==========================================================================
   5) مسيّرات الرواتب
   ========================================================================== */

export function listPayrollRuns(params = {}) {
  const result = query("payrollRuns", params);

  return {
    ...result,
    /* القسائم ثقيلة — تُستبعد من القائمة وتُجلب في شاشة المسيّر. */
    data: result.data.map(({ payslips: _slips, ...run }) => ({
      ...run,
      warningsCount: run.warnings?.length ?? 0,
    })),
  };
}

export function getPayrollRun(id) {
  const run = find("payrollRuns", id);
  if (!run) throw notFound("المسيّر غير موجود.");

  return {
    ...run,
    byDepartment: payrollByDepartment(run.payslips ?? [], all("departments")),
    accrualEntry: entryForDocument(SourceType.PAYROLL_APPROVAL, run.id, "accrual"),
    paymentEntry: entryForDocument(SourceType.PAYROLL_PAYMENT, run.id, "payment"),
  };
}

/**
 * يُشغّل أو يُعيد تشغيل مسيّر فترة.
 *
 * إعادة التشغيل مسموحة قبل الاعتماد ومرفوضة بعده: المسيّر المعتمد مُرحَّل
 * محاسبيًا، وإعادة حسابه تُنتج أرقامًا تخالف القيد الموجود في الدفتر.
 */
export function processPayroll(payload, { user } = {}) {
  const period = payload?.period ?? CURRENT_PERIOD;
  const existing = all("payrollRuns").find((run) => run.period === period);

  if (existing) assertPayrollMutable(existing);

  const employees = activeEmployees();

  /* الحضور من سجلات البصمة للفترة. */
  const attendanceByEmployee = {};
  for (const record of all("attendanceRecords")) {
    if (String(record.date).slice(0, 7) !== period) continue;
    (attendanceByEmployee[record.employeeId] ??= []).push(record);
  }

  const summarized = Object.fromEntries(
    Object.entries(attendanceByEmployee).map(([employeeId, days]) => [
      employeeId,
      summarizeAttendance(days),
    ]),
  );

  const advancesByEmployee = Object.fromEntries(
    employees.map((employee) => [
      employee.id,
      advanceDueFor(all("employeeAdvances"), employee.id, period),
    ]),
  );

  const result = runPayroll(employees, {
    period,
    attendanceByEmployee: summarized,
    advancesByEmployee,
    settings: db.payrollSettings,
  });

  const payload_ = {
    runNumber: `PR-${period.replace("-", "")}`,
    period,
    periodLabel: formatPeriod(period),
    fromDate: `${period}-01`,
    toDate: endOfMonth(period),
    payDate: addDaysLocal(endOfMonth(period), db.payrollSettings.payDay),
    headcount: result.payslips.length,
    totals: result.totals,
    warnings: result.warnings,
    status: PayrollStatus.CALCULATED,
    costCenterId: 1,
    calculatedBy: user?.name ?? "—",
    calculatedAt: new Date().toISOString(),
    approvedBy: null,
    approvedAt: null,
    paidAt: null,
    paidFromAccountId: null,
    accrualPostingKey: null,
    paymentPostingKey: null,
    notes: null,
    payslips: result.payslips.map((slip, index) => ({
      ...slip,
      id: (existing?.id ?? all("payrollRuns").length + 1) * 1000 + index + 1,
      payrollRunId: existing?.id ?? null,
      period,
      periodLabel: formatPeriod(period),
      payslipNumber: `PS-${period.replace("-", "")}-${String(index + 1).padStart(3, "0")}`,
      status: PayrollStatus.CALCULATED,
    })),
  };

  const run = existing
    ? update("payrollRuns", existing.id, payload_)
    : insert("payrollRuns", payload_);

  audit({
    action: "payroll.process", actionLabel: "تشغيل مسيّر رواتب", severity: "warning",
    module: "الموارد البشرية", entity: "payroll_run", entityId: run.id,
    details: `${run.runNumber} — ${run.headcount} موظف — صافي ${run.totals.netPay}`, user,
  });

  return run;
}

/**
 * يعتمد مسيّرًا ويُرحّله محاسبيًا.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  السيناريو 1 من التكامل بين الموديولات:
 *  الموارد البشرية → اعتماد المسيّر → قيد محاسبي → صرف → التقارير المالية
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function approvePayroll(id, { user } = {}) {
  const run = find("payrollRuns", id);
  if (!run) throw notFound("المسيّر غير موجود.");

  if (run.status !== PayrollStatus.CALCULATED && run.status !== PayrollStatus.PENDING) {
    throw ruleViolation(`لا يُعتمد مسيّر في الحالة «${run.status}».`);
  }

  /* المسيّر غير المتماسك لا يُعتمد — قيده سيخرج غير متوازن. */
  if (!run.totals.isConsistent) {
    throw ruleViolation(
      "مجاميع المسيّر غير متماسكة (الإجمالي ناقص الاستقطاعات لا يساوي الصافي). " +
        "أعد تشغيل المسيّر قبل اعتماده.",
    );
  }

  const negative = (run.payslips ?? []).filter((slip) => money.isNegative(slip.netPay));
  if (negative.length) {
    throw ruleViolation(
      `${negative.length} قسيمة بصافي سالب (${negative.slice(0, 2).map((slip) => slip.employeeName).join("، ")}). ` +
        "راجع الحضور والاستقطاعات قبل الاعتماد.",
    );
  }

  const posting = postDocument({
    sourceType: SourceType.PAYROLL_APPROVAL,
    sourceId: run.id,
    sourceEvent: "accrual",
    document: { totals: run.totals, periodLabel: run.periodLabel, costCenterId: run.costCenterId },
    date: run.toDate,
    description: `اعتماد مسيّر رواتب ${run.periodLabel}`,
    reference: run.runNumber,
    costCenterId: run.costCenterId,
    user,
  });

  const next = update("payrollRuns", id, {
    status: PayrollStatus.APPROVED,
    approvedBy: user?.name ?? "—",
    approvedAt: new Date().toISOString(),
    accrualPostingKey: posting.entry?.postingKey ?? null,
    payslips: (run.payslips ?? []).map((slip) => ({ ...slip, status: PayrollStatus.APPROVED })),
  });

  /* أقساط السلف المستحقة في الفترة تُعلَّم كمستردّة. */
  for (const advance of all("employeeAdvances")) {
    const row = (advance.schedule ?? []).find(
      (entry) => entry.period === run.period && entry.status === "pending",
    );
    if (!row) continue;

    const schedule = advance.schedule.map((entry) =>
      entry.period === run.period && entry.status === "pending"
        ? { ...entry, status: "recovered" }
        : entry,
    );
    const outstanding = advanceOutstanding({ ...advance, schedule });

    update("employeeAdvances", advance.id, {
      schedule,
      recovered: money.subtract(advance.amount, outstanding),
      outstanding,
      status: money.isZero(outstanding) ? "recovered" : "partially_recovered",
    });
  }

  audit({
    action: "payroll.approve", actionLabel: "اعتماد مسيّر رواتب", severity: "critical",
    module: "الموارد البشرية", entity: "payroll_run", entityId: next.id,
    details: `${next.runNumber} — صافي ${next.totals.netPay} — قيد ${posting.entry?.entryNumber}`,
    user,
  });

  return { run: next, journalEntry: posting.entry };
}

/** يصرف رواتب مسيّر معتمد ويُرحّل الصرف. */
export function payPayroll(id, payload, { user } = {}) {
  const run = find("payrollRuns", id);
  if (!run) throw notFound("المسيّر غير موجود.");

  if (run.status !== PayrollStatus.APPROVED) {
    throw ruleViolation("لا يُصرف إلا مسيّر معتمد.");
  }

  const bank = find("bankAccounts", payload?.bankAccountId ?? db.payrollSettings.payrollBankAccountId);
  if (!bank) throw notFound("الحساب البنكي غير موجود.");

  const amount = run.totals.netPay;

  if (money.compare(amount, money.add(bank.balance, bank.overdraftLimit ?? 0)) > 0) {
    throw ruleViolation(
      `رصيد ${bank.bankName} (${bank.balance}) لا يكفي لصرف ${amount}. ` +
        "غذِّ حساب الرواتب أولًا.",
    );
  }

  const posting = postDocument({
    sourceType: SourceType.PAYROLL_PAYMENT,
    sourceId: run.id,
    sourceEvent: "payment",
    document: { amount, periodLabel: run.periodLabel, accountId: bank.accountId },
    date: payload?.date ?? TODAY,
    description: `صرف رواتب ${run.periodLabel}`,
    reference: run.runNumber,
    user,
  });

  update("bankAccounts", bank.id, { balance: money.subtract(bank.balance, amount) });

  const next = update("payrollRuns", id, {
    status: PayrollStatus.PAID,
    paidAt: new Date().toISOString(),
    paidFromAccountId: bank.accountId,
    paymentPostingKey: posting.entry?.postingKey ?? null,
    payslips: (run.payslips ?? []).map((slip) => ({ ...slip, status: PayrollStatus.PAID })),
  });

  audit({
    action: "payroll.pay", actionLabel: "صرف رواتب", severity: "critical",
    module: "الموارد البشرية", entity: "payroll_run", entityId: next.id,
    details: `${next.runNumber} — ${amount} من ${bank.bankName}`, user,
  });

  return { run: next, journalEntry: posting.entry };
}

/** قسيمة راتب واحدة للطباعة. */
export function getPayslip(id) {
  const slip = find("payslips", id);
  if (!slip) throw notFound("القسيمة غير موجودة.");

  const employee = find("employees", slip.employeeId);
  const run = all("payrollRuns").find((row) => row.period === slip.period);

  return {
    ...slip,
    employee: employee
      ? {
          code: employee.code,
          name: employee.name,
          jobTitle: employee.jobTitle,
          departmentName: employee.departmentName,
          hireDate: employee.hireDate,
          bankName: employee.bankName,
          bankAccount: employee.bankAccount,
          socialInsuranceNumber: employee.socialInsuranceNumber,
        }
      : null,
    run: run ? { runNumber: run.runNumber, status: run.status, payDate: run.payDate } : null,
    company: db.companyInfo,
  };
}

/* -------------------------------------------------------------------------- */

function nextPeriod(period) {
  const [year, month] = String(period).split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 1));
  return date.toISOString().slice(0, 7);
}

function addDaysLocal(isoDate, days) {
  const date = new Date(`${String(isoDate).slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(days ?? 0));
  return date.toISOString().slice(0, 10);
}

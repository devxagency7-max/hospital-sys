/**
 * اختبارات الغرف والأسرّة ومحرك استحقاق الإقامة اليومي.
 *
 *   node tests/rooms-admission.test.mjs
 *
 * الضمانات التي يحرسها هذا الملف:
 *   1. وحدة الإقامة لا تُحجز لمريضين، ولا يُحجز لمريض سريران.
 *   2. تعريفة الإقامة تأتي من دليل الخدمات لا من رقم مُدخَل.
 *   3. كل ليلة إقامة تُحمَّل مرة واحدة بالضبط — لا يوم يضيع ولا يوم يُكرَّر.
 *   4. إجمالي الإقامة مشتق جمعًا لسطوره دائمًا.
 */

import { assert, section, report } from "./harness.mjs";
import {
  listRooms,
  listRoomTypes,
  getRoom,
  getOccupancyBoard,
  setRoomStatus,
  tariffForRoom,
  runDailyBedCharges,
  accrueAdmissionDay,
  backfillAdmissionCharges,
  getAdmissionCostSummary,
  datesBetween,
  ROOM_STATUS_LABELS,
} from "../js/mock/services/rooms.service.js";
import { createAdmission, dischargeAdmission, getPatient } from "../js/mock/services/patients.service.js";
import { all, find } from "../js/mock/db.js";

const STAFF = { user: { name: "موظف استقبال — اختبار" } };

/** إجمالي سطور دفتر الاستحقاق لإقامة. */
function chargeLines(admissionId) {
  return all("admissionCharges").filter((c) => String(c.admissionId) === String(admissionId));
}

/* ==========================================================================
   1. كيان الوحدات وحالة الإشغال
   ========================================================================== */

section("كيان الغرف والأسرّة وحالة الإشغال");

const board = getOccupancyBoard();
const rooms = listRooms().data;

assert("الوحدات القابلة للحجز كيان مستقل لا نص حر", rooms.length > 0);
assert("كل وحدة لها كود ونوع وتعريفة يومية",
  rooms.every((r) => r.code && r.roomTypeId && typeof r.dailyRate === "number"));
assert("كل وحدة لها حالة معروفة", rooms.every((r) => ROOM_STATUS_LABELS[r.status]));
assert("لوحة الإشغال مجمَّعة بالدور", board.floors.length >= 3);
assert("مجموع وحدات الأدوار يساوي إجمالي الوحدات",
  board.floors.reduce((sum, f) => sum + f.total, 0) === rooms.length);

assert("لا وحدة مشغولة بلا مريض معروف",
  rooms.filter((r) => r.status === "occupied").every((r) => r.currentPatientId && r.currentAdmissionId));
assert("لا وحدة فاضية تحمل شاغلًا",
  rooms.filter((r) => r.status === "vacant").every((r) => !r.currentAdmissionId));

assert("نسبة الإشغال تُقاس على الوحدات في الخدمة لا على الكل",
  board.summary.inService === board.summary.total - board.summary.maintenance);

/* ==========================================================================
   2. التعريفة مصدرها دليل الخدمات
   ========================================================================== */

section("تعريفة الإقامة مشتقة من دليل الخدمات لا مخزَّنة");

const types = listRoomTypes().data;
assert("أنواع الوحدات معرَّفة", types.length >= 4);
assert("لا نوع يُخزّن سعرًا مكرَّرًا — السعر يُحسب من الخدمة",
  all("roomTypes").every((t) => t.dailyRate === undefined));

const sampleType = types[0];
const sampleService = find("hospitalServices", sampleType.serviceId);
assert("سعر الإقامة مطابق لسعر خدمة الإقامة في الدليل",
  sampleType.roomRate === sampleService.price);
assert("التعريفة اليومية = الإقامة + التمريض",
  sampleType.dailyRate === sampleType.roomRate + sampleType.nursingRate);

const vacant = listRooms({ status: "vacant" }).data;
assert("توجد وحدات فاضية للحجز", vacant.length > 0);

const target = vacant[0];
const tariff = tariffForRoom(target.id);
assert("تعريفة الوحدة تُحسب من نوعها", tariff.dailyRate === target.dailyRate);

/* ==========================================================================
   3. الحجز — وحدة واحدة لمريض واحد
   ========================================================================== */

section("الحجز: وحدة واحدة لمريض واحد لا أكثر");

/* مريض غير مقيم. */
const freePatient = all("patients").find((p) => p.status !== "inpatient");
assert("يوجد مريض غير مقيم", Boolean(freePatient));

const admission = createAdmission(
  { patientId: freePatient.id, roomId: target.id, diagnosis: "متابعة بعد جراحة", admissionDate: "2026-11-04" },
  STAFF,
);

assert("تم فتح الإقامة بكود فريد", String(admission.code).startsWith("ADM-"));
assert("الإقامة مربوطة بالوحدة بمعرّفها لا بنصّها", admission.roomId === target.id);
assert("التعريفة المتعاقدة مأخوذة من النوع لا من إدخال الموظف",
  admission.dailyRate === target.dailyRate);

const afterBooking = getRoom(target.id);
assert("الوحدة صارت مشغولة", afterBooking.status === "occupied");
assert("الوحدة تحمل اسم شاغلها", afterBooking.currentPatientId === freePatient.id);
assert("حالة المريض صارت مقيمًا", getPatient(freePatient.id).status === "inpatient");

let doubleBooked = false;
const otherPatient = all("patients").find((p) => p.status !== "inpatient" && p.id !== freePatient.id);
try {
  createAdmission({ patientId: otherPatient.id, roomId: target.id }, STAFF);
} catch {
  doubleBooked = true;
}
assert("لا تُحجز الوحدة نفسها لمريضين", doubleBooked);

let secondBedForSamePatient = false;
const anotherVacant = listRooms({ status: "vacant" }).data[0];
try {
  createAdmission({ patientId: freePatient.id, roomId: anotherVacant.id }, STAFF);
} catch {
  secondBedForSamePatient = true;
}
assert("لا يُحجز سريران لمريض واحد", secondBedForSamePatient);

let futureAdmission = false;
try {
  createAdmission({ patientId: otherPatient.id, roomId: anotherVacant.id, admissionDate: "2027-01-01" }, STAFF);
} catch {
  futureAdmission = true;
}
assert("لا تُفتح إقامة بتاريخ مستقبلي", futureAdmission);

let occupiedStatusChange = false;
try {
  setRoomStatus(target.id, { status: "maintenance" }, STAFF);
} catch {
  occupiedStatusChange = true;
}
assert("لا تُغيَّر حالة وحدة مشغولة قبل تسجيل الخروج", occupiedStatusChange);

/* ==========================================================================
   4. محرك الاستحقاق اليومي — كل ليلة مرة واحدة
   ========================================================================== */

section("محرك الاستحقاق اليومي: كل ليلة مرة واحدة بالضبط");

const nights = datesBetween("2026-11-04", "2026-11-07").length;
assert("حساب الليالي شامل الطرفين", nights === 4);

const summary = getAdmissionCostSummary(admission.id);
assert("ليالي الإقامة محسوبة من التواريخ", summary.nights === nights);
assert("كل ليلة حُمِّلت عند فتح الإقامة",
  summary.total === target.dailyRate * nights);
assert("الإجمالي مشتق جمعًا لسطوره",
  summary.total === chargeLines(admission.id).reduce((s, c) => s + c.amount, 0));
assert("سجل الإقامة لا يُخزّن إجمالًا مكرَّرًا",
  find("admissions", admission.id).totalCost === undefined);
assert("سجل الإقامة لا يُخزّن عدد أيام مكرَّرًا",
  find("admissions", admission.id).daysCount === undefined);

/* التكرار لا يُحمِّل مرتين. */
const beforeRerun = chargeLines(admission.id).length;
const rerun = accrueAdmissionDay(admission.id, "2026-11-05", STAFF);
assert("إعادة تحميل نفس اليوم لا تُنشئ سطرًا", rerun.created.length === 0);
assert("إعادة التحميل تُعلن ما تجاهلته بدل الصمت", rerun.skipped.length > 0);
assert("عدد السطور لم يتغير بعد إعادة التشغيل",
  chargeLines(admission.id).length === beforeRerun);

const backfill = backfillAdmissionCharges(admission.id, STAFF);
assert("الإلحاق الكامل لا يُكرر ما حُمِّل", backfill.linesCreated === 0);
assert("الإجمالي ثابت بعد الإلحاق",
  getAdmissionCostSummary(admission.id).total === summary.total);

/* تشغيل جماعي على كل الإقامات القائمة. */
const dailyRun = runDailyBedCharges({ date: "2026-11-07" }, STAFF);
assert("التشغيل الجماعي يغطي الإقامات القائمة", dailyRun.admissionsProcessed > 0);
assert("التشغيل الجماعي لا يُكرر يومًا محمَّلًا", dailyRun.linesCreated === 0);
assert("التشغيل الجماعي يُعلن عدد السطور المتجاهلة", dailyRun.linesSkipped > 0);

/* يوم جديد يُحمَّل فعلاً. */
const newDayRun = runDailyBedCharges({ date: "2026-11-08" }, STAFF);
assert("يوم جديد يُحمَّل بالفعل", newDayRun.linesCreated > 0);
assert("مبلغ اليوم الجديد أكبر من صفر", newDayRun.amountAccrued > 0);
assert("إعادة تشغيل اليوم الجديد لا تُكرره",
  runDailyBedCharges({ date: "2026-11-08" }, STAFF).linesCreated === 0);

/* ==========================================================================
   5. الخروج — تحميل آخر ليلة ثم إخلاء الوحدة
   ========================================================================== */

section("الخروج: آخر ليلة تُحمَّل قبل إخلاء السرير");

const beforeDischarge = getAdmissionCostSummary(admission.id).total;
const discharged = dischargeAdmission(admission.id, { dischargeDate: "2026-11-09" }, STAFF);

assert("حالة الإقامة صارت خروجًا", discharged.status === "discharged");
assert("تاريخ الخروج مثبت", discharged.dischargeDate === "2026-11-09");
assert("آخر ليلة حُمِّلت قبل الإخلاء",
  discharged.costSummary.total > beforeDischarge);
assert("إجمالي الخروج = التعريفة × الليالي",
  discharged.costSummary.total === target.dailyRate * discharged.costSummary.nights);

const released = getRoom(target.id);
assert("الوحدة تُخلى بعد الخروج", released.currentAdmissionId === null);
assert("الوحدة تصير «تحت التنظيف» لا «فاضية» فورًا", released.status === "cleaning");
assert("حالة المريض صارت تم الخروج", getPatient(freePatient.id).status === "discharged");

let doubleDischarge = false;
try {
  dischargeAdmission(admission.id, {}, STAFF);
} catch {
  doubleDischarge = true;
}
assert("لا يُسجَّل خروج مرتين", doubleDischarge);

/* الوحدة المنظَّفة غير قابلة للحجز حتى تُعلن جاهزة. */
let bookCleaning = false;
try {
  createAdmission({ patientId: otherPatient.id, roomId: target.id }, STAFF);
} catch {
  bookCleaning = true;
}
assert("لا تُحجز وحدة تحت التنظيف", bookCleaning);

setRoomStatus(target.id, { status: "vacant" }, STAFF);
assert("إعلان الجهوزية يُعيد الوحدة للحجز", getRoom(target.id).status === "vacant");

/* ==========================================================================
   6. الإقامة القائمة لا تُترك بلا تعريفة
   ========================================================================== */

section("حراسة البيانات: لا إقامة بلا وحدة ولا وحدة بلا تعريفة");

assert("كل إقامة في البيانات مربوطة بوحدة",
  all("admissions").every((a) => a.roomId));
assert("كل نوع وحدة مربوط بخدمة إقامة في الدليل",
  all("roomTypes").every((t) => find("hospitalServices", t.serviceId)));
assert("كل سطر استحقاق يحمل مفتاح تفرّد",
  all("admissionCharges").every((c) => Boolean(c.sourceRef)));

const refs = all("admissionCharges").map((c) => c.sourceRef);
assert("لا سطرَي استحقاق بنفس المفتاح", new Set(refs).size === refs.length);

report();

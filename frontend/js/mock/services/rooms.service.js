/**
 * خدمة الغرف والأسرّة ومحرك استحقاق الإقامة اليومي.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  مسؤوليتان لا ثالثة لهما:
 *
 *  1. **الإشغال**: من يشغل أي وحدة الآن، وما الفاضي القابل للحجز. الحجز
 *     يمرّ من هنا وحده، فلا تُحجز وحدة لمريضين.
 *
 *  2. **الاستحقاق اليومي**: توليد رسم الإقامة والتمريض لكل ليلة إقامة في
 *     دفتر `admissionCharges`. التوليد **فكري الطابع (idempotent)**: تشغيله
 *     مرتين على نفس اليوم لا يُحمِّل المريض مرتين.
 *
 *  ما ليس من مسؤوليتها: الفوترة. الدفتر يتراكم، والفاتورة تسحب منه لاحقًا.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { notFound, validationError, ruleViolation } from "../../core/errors.js";
import * as money from "../../core/money.js";
import { all, find, insert, update, query } from "../db.js";
import { audit } from "./posting.service.js";
import { REFERENCE_DATE } from "../seed.js";

const TODAY = REFERENCE_DATE.toISOString().slice(0, 10);

/** حالات الوحدة التي تسمح بحجز جديد. */
const BOOKABLE_STATUSES = Object.freeze(["vacant"]);

/** وصف عربي لحالات الوحدة — تُستخدم في الواجهة ورسائل الأخطاء. */
export const ROOM_STATUS_LABELS = Object.freeze({
  vacant: "فاضية — جاهزة للحجز",
  occupied: "مشغولة",
  cleaning: "تحت التنظيف والتجهيز",
  maintenance: "خارج الخدمة — صيانة",
});

/* ==========================================================================
   1) مساعدات مشتركة
   ========================================================================== */

/** يُعيد قائمة التواريخ من البداية حتى النهاية (شاملة الطرفين). */
export function datesBetween(fromDate, toDate) {
  const out = [];
  const cursor = new Date(`${fromDate}T00:00:00.000Z`);
  const end = new Date(`${toDate}T00:00:00.000Z`);

  /* نطاق مقلوب يعني خطأ إدخال لا نطاقًا فارغًا — لا نُخفيه بإرجاع []. */
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) {
    throw validationError({ date: "تاريخ غير صالح في نطاق الإقامة." });
  }

  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/** تعريفة الوحدة: نوعها + خدمة الإقامة + خدمة التمريض المصاحبة. */
export function tariffForRoom(roomId) {
  const room = find("rooms", roomId);
  if (!room) throw notFound("الوحدة غير موجودة.");

  const roomType = find("roomTypes", room.roomTypeId);
  if (!roomType) throw notFound("نوع الوحدة غير معروف.");

  /*
   * السعر يأتي من دليل الخدمات لا من حقل مخزَّن على النوع — فتعديل سعر
   * الخدمة يسري فورًا على كل الوحدات من نوعها.
   */
  const roomService = find("hospitalServices", roomType.serviceId);
  if (!roomService) {
    throw ruleViolation(
      `نوع الوحدة «${roomType.name}» غير مربوط بخدمة إقامة في دليل الخدمات — ` +
        "لا يمكن تسعير الإقامة. راجع دليل الخدمات الطبية.",
      { field: "roomTypeId" },
    );
  }

  const nursingService = roomType.nursingServiceId
    ? find("hospitalServices", roomType.nursingServiceId)
    : null;

  const dailyRate = money.add(roomService.price, nursingService?.price ?? 0);

  return { room, roomType, roomService, nursingService, dailyRate };
}

/* ==========================================================================
   2) الاستعلام والإشغال
   ========================================================================== */

export function listRoomTypes(params = {}) {
  const types = all("roomTypes").map((type) => {
    const roomService = find("hospitalServices", type.serviceId);
    const nursingService = type.nursingServiceId
      ? find("hospitalServices", type.nursingServiceId)
      : null;
    const units = all("rooms").filter((r) => String(r.roomTypeId) === String(type.id));

    return {
      ...type,
      roomRate: roomService?.price ?? 0,
      nursingRate: nursingService?.price ?? 0,
      dailyRate: money.add(roomService?.price ?? 0, nursingService?.price ?? 0),
      unitsCount: units.length,
      vacantCount: units.filter((r) => r.status === "vacant").length,
      occupiedCount: units.filter((r) => r.status === "occupied").length,
    };
  });

  const filtered = params.category && params.category !== "all"
    ? types.filter((t) => t.category === params.category)
    : types;

  return { data: filtered, meta: { total: filtered.length } };
}

/**
 * قائمة الوحدات مع حالة الإشغال وعدد ليالي الإقامة الحالية.
 *
 * الهدف شاشة واحدة يقرأها موظف الاستقبال بنظرة: الفاضي، المشغول وبمن،
 * ومن أمس كام. لذلك يُحسب كل ما تحتاجه الشاشة هنا ولا تُجمّعه بنفسها.
 */
export function listRooms(params = {}) {
  const rows = all("rooms").map((room) => {
    const roomType = find("roomTypes", room.roomTypeId);
    const roomService = roomType ? find("hospitalServices", roomType.serviceId) : null;
    const nursingService = roomType?.nursingServiceId
      ? find("hospitalServices", roomType.nursingServiceId)
      : null;

    const admission = room.currentAdmissionId ? find("admissions", room.currentAdmissionId) : null;
    const stayNights = admission ? datesBetween(admission.admissionDate, TODAY).length : 0;

    return {
      ...room,
      statusLabel: ROOM_STATUS_LABELS[room.status] ?? room.status,
      roomTypeName: roomType?.name ?? "—",
      category: roomType?.category ?? "room",
      department: roomType?.department ?? "—",
      capacity: roomType?.capacity ?? 1,
      roomRate: roomService?.price ?? 0,
      nursingRate: nursingService?.price ?? 0,
      dailyRate: money.add(roomService?.price ?? 0, nursingService?.price ?? 0),
      admissionCode: admission?.code ?? null,
      attendingDoctor: admission?.attendingDoctor ?? null,
      stayNights,
      isBookable: BOOKABLE_STATUSES.includes(room.status),
    };
  });

  const filtered = rows.filter((row) => {
    if (params.status && params.status !== "all" && row.status !== params.status) return false;
    if (params.category && params.category !== "all" && row.category !== params.category) return false;
    if (params.floor && params.floor !== "all" && row.floor !== params.floor) return false;
    if (params.roomTypeId && String(row.roomTypeId) !== String(params.roomTypeId)) return false;
    if (params.search) {
      const q = String(params.search).toLowerCase();
      const hit = ["code", "name", "floor", "wing", "currentPatientName", "roomTypeName"].some((key) =>
        String(row[key] ?? "").toLowerCase().includes(q),
      );
      if (!hit) return false;
    }
    return true;
  });

  return { data: filtered, meta: { total: filtered.length, ...occupancySummary(rows) } };
}

/** ملخص الإشغال — يُغذّي مؤشرات شاشة الاستقبال. */
function occupancySummary(rows) {
  const total = rows.length;
  const occupied = rows.filter((r) => r.status === "occupied").length;
  const vacant = rows.filter((r) => r.status === "vacant").length;
  const cleaning = rows.filter((r) => r.status === "cleaning").length;
  const maintenance = rows.filter((r) => r.status === "maintenance").length;

  /*
   * نسبة الإشغال تُقاس على الوحدات **الصالحة للخدمة** لا على الكل: وحدة
   * خارج الخدمة ليست «سريرًا فاضيًا متاحًا»، وإدخالها في المقام يُظهر طاقة
   * استيعاب غير موجودة.
   */
  const inService = total - maintenance;
  const occupancyRate = inService > 0 ? Math.round((occupied / inService) * 100) : 0;

  return { total, occupied, vacant, cleaning, maintenance, inService, occupancyRate };
}

/** لوحة الإشغال مجمَّعة بالدور والجناح — صفّ واحد لكل دور. */
export function getOccupancyBoard(params = {}) {
  const { data, meta } = listRooms(params);

  const floors = [];
  for (const room of data) {
    let floor = floors.find((f) => f.floor === room.floor);
    if (!floor) {
      floor = { floor: room.floor, rooms: [], occupied: 0, vacant: 0, total: 0 };
      floors.push(floor);
    }
    floor.rooms.push(room);
    floor.total += 1;
    if (room.status === "occupied") floor.occupied += 1;
    if (room.status === "vacant") floor.vacant += 1;
  }

  return { floors, summary: meta };
}

export function getRoom(id) {
  const room = find("rooms", id);
  if (!room) throw notFound("الوحدة غير موجودة.");

  const { roomType, roomService, nursingService, dailyRate } = tariffForRoom(id);
  const admission = room.currentAdmissionId ? find("admissions", room.currentAdmissionId) : null;

  /* سجل من شغل الوحدة سابقًا — يفيد في تتبع التنظيف والصيانة والخلافات. */
  const history = all("admissions")
    .filter((a) => String(a.roomId) === String(id))
    .sort((a, b) => String(b.admissionDate).localeCompare(String(a.admissionDate)));

  return {
    ...room,
    statusLabel: ROOM_STATUS_LABELS[room.status] ?? room.status,
    roomType,
    roomRate: roomService.price,
    nursingRate: nursingService?.price ?? 0,
    dailyRate,
    currentAdmission: admission,
    history,
  };
}

/**
 * تغيير حالة الوحدة يدويًا — للتنظيف والصيانة فقط.
 *
 * `occupied` و`vacant` **لا تُضبطان من هنا**: الإشغال نتيجة حجز أو خروج، لا
 * قرار يدوي. السماح بذلك يُنتج وحدة مشغولة بلا مريض أو مريضًا بلا سرير.
 */
export function setRoomStatus(id, payload = {}, { user } = {}) {
  const room = find("rooms", id);
  if (!room) throw notFound("الوحدة غير موجودة.");

  const status = payload.status;
  if (!["cleaning", "maintenance", "vacant"].includes(status)) {
    throw validationError({
      status: "الحالة المسموح ضبطها يدويًا: تحت التنظيف، أو خارج الخدمة، أو فاضية.",
    });
  }

  if (room.status === "occupied") {
    throw ruleViolation(
      `الوحدة «${room.name}» مشغولة بالمريض ${room.currentPatientName} — ` +
        "سجّل خروجه أولًا قبل تغيير حالتها.",
      { field: "status" },
    );
  }

  const updated = update("rooms", id, { status, notes: payload.notes ?? room.notes });

  audit({
    action: "room.status",
    actionLabel: "تغيير حالة وحدة إقامة",
    module: "حسابات المرضى",
    entity: "room",
    entityId: id,
    details: `${room.name} → ${ROOM_STATUS_LABELS[status]}${payload.notes ? ` (${payload.notes})` : ""}`,
    user,
  });

  return updated;
}

/* ==========================================================================
   3) الحجز والإخلاء — المسار الوحيد لتغيير الإشغال
   ========================================================================== */

/**
 * يحجز وحدة لإقامة. يُستدعى من خدمة الإقامات لا من شاشة.
 *
 * @throws إن كانت الوحدة غير قابلة للحجز — لا يُرجع `false` بصمت.
 */
export function occupyRoom(roomId, admission, { user } = {}) {
  const room = find("rooms", roomId);
  if (!room) throw notFound("الوحدة المطلوبة غير موجودة.");

  if (!BOOKABLE_STATUSES.includes(room.status)) {
    const who = room.currentPatientName ? ` (المريض: ${room.currentPatientName})` : "";
    throw ruleViolation(
      `الوحدة «${room.name}» غير متاحة للحجز — حالتها: ${ROOM_STATUS_LABELS[room.status]}${who}.`,
      { field: "roomId" },
    );
  }

  return update("rooms", roomId, {
    status: "occupied",
    currentAdmissionId: admission.id,
    currentPatientId: admission.patientId,
    currentPatientName: admission.patientName,
    occupiedSince: admission.admissionDate,
  });
}

/**
 * يُخلي وحدة بعد الخروج.
 *
 * الوحدة تصير `cleaning` لا `vacant`: السرير بعد خروج مريض يحتاج تجهيزًا،
 * وإعلانه فاضيًا فورًا يُنتج حجزًا على سرير غير جاهز.
 */
export function releaseRoom(roomId, { user } = {}) {
  const room = find("rooms", roomId);
  if (!room) return null;

  return update("rooms", roomId, {
    status: "cleaning",
    currentAdmissionId: null,
    currentPatientId: null,
    currentPatientName: null,
    occupiedSince: null,
  });
}

/* ==========================================================================
   4) محرك الاستحقاق اليومي (Bed-Day Accrual Engine)
   ========================================================================== */

/**
 * مفتاح تفرّد سطر الاستحقاق.
 *
 * هو ما يجعل التشغيل فكري الطابع: نفس (الإقامة، اليوم، البند) لا يُحمَّل
 * مرتين ولو شُغّل المحرك عشر مرات في اليوم.
 */
function chargeKey(admissionCode, date, category) {
  return `${admissionCode}/${date}/${category}`;
}

function chargeExists(sourceRef) {
  return all("admissionCharges").some((c) => c.sourceRef === sourceRef);
}

/**
 * يولّد سطور استحقاق إقامة ليوم واحد لإقامة واحدة.
 *
 * @returns {{created: object[], skipped: string[]}}
 */
export function accrueAdmissionDay(admissionId, date, { user } = {}) {
  const admission = find("admissions", admissionId);
  if (!admission) throw notFound("سجل الإقامة غير موجود.");

  if (!admission.roomId) {
    throw ruleViolation(
      `الإقامة ${admission.code} غير مربوطة بوحدة إقامة — لا يمكن تسعير ليلتها.`,
      { field: "roomId" },
    );
  }

  const { roomService, nursingService } = tariffForRoom(admission.roomId);

  const created = [];
  const skipped = [];

  const lines = [
    { category: "bed_day", categoryLabel: "رسم إقامة يومي", service: roomService, nameSuffix: ` — ${admission.roomNumber}` },
    { category: "nursing", categoryLabel: "إشراف طبي ورعاية تمريضية", service: nursingService, nameSuffix: "" },
  ];

  for (const line of lines) {
    if (!line.service) continue;

    const sourceRef = chargeKey(admission.code, date, line.category);
    if (chargeExists(sourceRef)) {
      skipped.push(sourceRef);
      continue;
    }

    created.push(
      insert("admissionCharges", {
        admissionId: admission.id,
        admissionCode: admission.code,
        patientId: admission.patientId,
        patientName: admission.patientName,
        date,
        category: line.category,
        categoryLabel: line.categoryLabel,
        serviceId: line.service.id,
        serviceName: `${line.service.name}${line.nameSuffix}`,
        quantity: 1,
        unitPrice: line.service.price,
        amount: line.service.price,
        source: "bed_day_engine",
        sourceRef,
        invoiceId: null,
        invoicedAt: null,
        createdBy: user?.name ?? "محرك الاستحقاق اليومي",
        createdAt: new Date().toISOString(),
      }),
    );
  }

  return { created, skipped };
}

/**
 * يشغّل محرك الاستحقاق على **كل** الإقامات القائمة ليوم محدد.
 *
 * هذا ما يُجدوَل في الباك-إند ليعمل بعد منتصف الليل. تشغيله يدويًا من
 * الشاشة آمن تمامًا بفضل مفتاح التفرّد.
 */
export function runDailyBedCharges(payload = {}, { user } = {}) {
  const date = payload.date ?? TODAY;
  const active = all("admissions").filter((a) => a.status === "active");

  const result = {
    date,
    admissionsProcessed: 0,
    linesCreated: 0,
    linesSkipped: 0,
    amountAccrued: 0,
    details: [],
  };

  for (const admission of active) {
    /* لا نُحمِّل ليلة قبل الدخول — تاريخ التشغيل قد يسبق تاريخ الإقامة. */
    if (String(date) < String(admission.admissionDate)) continue;

    const { created, skipped } = accrueAdmissionDay(admission.id, date, { user });
    const amount = created.reduce((sum, c) => money.add(sum, c.amount), 0);

    result.admissionsProcessed += 1;
    result.linesCreated += created.length;
    result.linesSkipped += skipped.length;
    result.amountAccrued = money.add(result.amountAccrued, amount);
    result.details.push({
      admissionId: admission.id,
      admissionCode: admission.code,
      patientName: admission.patientName,
      roomNumber: admission.roomNumber,
      linesCreated: created.length,
      alreadyCharged: skipped.length > 0,
      amount,
    });
  }

  audit({
    action: "admission.bed_charges_run",
    actionLabel: "تشغيل استحقاق الإقامة اليومي",
    module: "حسابات المرضى",
    entity: "admission_charge",
    entityId: null,
    details:
      `${date} — ${result.admissionsProcessed} إقامة · ${result.linesCreated} سطر جديد · ` +
      `${result.linesSkipped} سطر محمَّل سابقًا · ${result.amountAccrued} ج.م`,
    user,
  });

  return result;
}

/**
 * يُلحق كل الليالي الناقصة لإقامة — من الدخول حتى اليوم.
 *
 * يُستخدم عند استرجاع نظام توقف، أو عند تسجيل إقامة بتاريخ ماضٍ: تشغيل
 * «ليوم واحد» لا يكفي حينها، ونسيان الباقي هو تحديدًا اليوم الذي يضيع.
 */
export function backfillAdmissionCharges(admissionId, { user } = {}) {
  const admission = find("admissions", admissionId);
  if (!admission) throw notFound("سجل الإقامة غير موجود.");

  const lastDay = admission.dischargeDate ?? TODAY;
  const dates = datesBetween(admission.admissionDate, lastDay);

  let linesCreated = 0;
  let amount = 0;

  for (const date of dates) {
    const { created } = accrueAdmissionDay(admission.id, date, { user });
    linesCreated += created.length;
    amount = money.add(amount, created.reduce((sum, c) => money.add(sum, c.amount), 0));
  }

  return { admissionId: admission.id, admissionCode: admission.code, nights: dates.length, linesCreated, amount };
}

/* ==========================================================================
   5) دفتر استحقاق المريض
   ========================================================================== */

/** سطور الاستحقاق — بفلترة بالإقامة أو المريض أو حالة الفوترة. */
export function listAdmissionCharges(params = {}) {
  return query("admissionCharges", {
    searchFields: ["serviceName", "patientName", "admissionCode", "categoryLabel"],
    filters: {
      admissionId: params.admissionId,
      patientId: params.patientId,
      category: params.category,
    },
    sort: params.sort ?? "date",
    order: params.order ?? "desc",
    page: params.page,
    perPage: params.perPage,
    search: params.search,
  });
}

/**
 * ملخص تكلفة إقامة — **مشتق** جمعًا لسطور الدفتر، لا حقلًا مخزَّنًا.
 */
export function getAdmissionCostSummary(admissionId) {
  const admission = find("admissions", admissionId);
  if (!admission) throw notFound("سجل الإقامة غير موجود.");

  const charges = all("admissionCharges").filter(
    (c) => String(c.admissionId) === String(admissionId),
  );

  const byCategory = {};
  for (const charge of charges) {
    const bucket = (byCategory[charge.category] ??= {
      category: charge.category,
      categoryLabel: charge.categoryLabel,
      lines: 0,
      amount: 0,
    });
    bucket.lines += 1;
    bucket.amount = money.add(bucket.amount, charge.amount);
  }

  const lastDay = admission.dischargeDate ?? TODAY;
  const nights = datesBetween(admission.admissionDate, lastDay).length;

  const total = charges.reduce((sum, c) => money.add(sum, c.amount), 0);
  const uninvoiced = charges
    .filter((c) => !c.invoiceId)
    .reduce((sum, c) => money.add(sum, c.amount), 0);

  return {
    admissionId: admission.id,
    admissionCode: admission.code,
    patientId: admission.patientId,
    patientName: admission.patientName,
    roomNumber: admission.roomNumber,
    admissionDate: admission.admissionDate,
    dischargeDate: admission.dischargeDate,
    nights,
    linesCount: charges.length,
    total,
    uninvoiced,
    invoiced: money.subtract(total, uninvoiced),
    byCategory: Object.values(byCategory),
    charges: charges.sort((a, b) => String(a.date).localeCompare(String(b.date))),
  };
}

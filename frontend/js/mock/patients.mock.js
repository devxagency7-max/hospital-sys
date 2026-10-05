/**
 * بيانات المرضى التجريبية.
 *
 * عقد البيانات في docs/06-UI-DATA-CONTRACTS.md. الحقول الزائدة عن العقد
 * (المحافظة، فصيلة الدم، …) تمثل ما يحتاجه ملف المريض 360°، وقد يعدّلها
 * مطور الباك-إند — والشاشات تقرأها عبر `patients.api.js` لا مباشرة.
 *
 * كل الأسماء والأرقام مُختلقة.
 */

import {
  createRandom,
  buildName,
  GOVERNORATES,
  DEPARTMENTS,
} from "./seed.js";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const MARITAL = ["single", "married", "divorced", "widowed"];

const INSURERS = [
  null,
  "التأمين الصحي الشامل",
  "مصر للتأمين",
  "أكسا للتأمين الطبي",
  "ميدمارك",
];

const CHRONIC_CONDITIONS = [
  "ضغط مرتفع",
  "سكري من النوع الثاني",
  "ربو شعبي",
  "قصور شرايين تاجية",
  "قصور درقية",
  "التهاب مفاصل روماتويدي",
];

const ALLERGIES = ["بنسلين", "أسبرين", "مكسرات", "لاتكس", "يود"];

/** يُنتج 148 مريضًا — حجم كافٍ لاختبار الترقيم والبحث بأحجام واقعية. */
function generatePatients(count = 148) {
  const random = createRandom(910_001);
  const patients = [];

  for (let index = 0; index < count; index += 1) {
    const id = 1001 + index;
    const gender = random.chance(0.52) ? "female" : "male";
    const hasInsurance = random.chance(0.38);

    // الأرشفة نادرة، والمرضى غير النشطين لم يزوروا المستشفى منذ فترة طويلة.
    const status = random.pickWeighted([
      ["active", 88],
      ["inactive", 10],
      ["archived", 2],
    ]);

    const birthYear = random.int(1940, 2024);
    const registeredDaysAgo = random.int(1, 1500);

    patients.push({
      id,
      patientCode: `P-${id}`,
      name: buildName(random, gender),
      gender,
      dateOfBirth: `${birthYear}-${String(random.int(1, 12)).padStart(2, "0")}-${String(
        random.int(1, 28),
      ).padStart(2, "0")}`,
      phone: random.phone(),
      altPhone: random.chance(0.3) ? random.phone() : null,
      nationalId: String(random.int(2, 3)) + String(random.int(1000000000000, 9999999999999)).slice(0, 13),
      governorate: random.pick(GOVERNORATES),
      address: `${random.int(1, 180)} شارع ${random.pick(["الجمهورية", "النصر", "الهرم", "التحرير", "فيصل", "الجلاء", "السلام"])}`,
      maritalStatus: random.pick(MARITAL),
      bloodType: random.chance(0.75) ? random.pick(BLOOD_TYPES) : null,
      status,

      // التأمين
      insuranceProvider: hasInsurance ? random.pick(INSURERS.slice(1)) : null,
      insuranceNumber: hasInsurance ? `INS-${random.int(100000, 999999)}` : null,

      // ملخص طبي
      chronicConditions: random.chance(0.32)
        ? random.sample(CHRONIC_CONDITIONS, random.int(1, 2))
        : [],
      allergies: random.chance(0.18) ? random.sample(ALLERGIES, 1) : [],

      // بيانات تشغيلية
      primaryDepartmentId: random.pick(DEPARTMENTS).id,
      registeredAt: random.date(registeredDaysAgo),
      lastVisitAt: status === "active" ? random.date(random.int(0, 120)) : random.date(random.int(200, 900)),
      visitsCount: random.int(1, 46),

      // رصيد المريض: موجب = مستحق على المريض.
      outstandingBalance: random.chance(0.34) ? random.money(120, 18500) : 0,

      emergencyContactName: random.chance(0.6) ? buildName(random, random.chance(0.5) ? "female" : "male") : null,
      emergencyContactPhone: random.chance(0.6) ? random.phone() : null,
      notes: null,
    });
  }

  return patients;
}

export const patients = generatePatients();

/** سجل زيارات مختصر لملف المريض — يُولَّد عند الطلب لتوفير الذاكرة. */
export function buildVisitHistory(patientId) {
  const patient = patients.find((item) => item.id === patientId);
  if (!patient) return [];

  const random = createRandom(patientId * 31 + 7);
  const visits = [];
  const count = Math.min(patient.visitsCount, 18);

  for (let index = 0; index < count; index += 1) {
    const department = DEPARTMENTS.find((item) => item.id === patient.primaryDepartmentId);

    visits.push({
      id: patientId * 100 + index,
      patientId,
      date: random.dateTime(random.int(1, 720)),
      type: random.pickWeighted([
        ["outpatient", 7],
        ["emergency", 2],
        ["inpatient", 1],
      ]),
      departmentId: random.chance(0.7) ? patient.primaryDepartmentId : random.pick(DEPARTMENTS).id,
      departmentName: random.chance(0.7) ? department?.name : random.pick(DEPARTMENTS).name,
      diagnosis: random.pick([
        "التهاب رئوي حاد",
        "متابعة ضغط الدم",
        "كسر بالساعد الأيمن",
        "التهاب لوزتين",
        "ألم بأسفل الظهر",
        "متابعة سكر",
        "التهاب مسالك بولية",
        "فحص دوري",
      ]),
      status: random.pickWeighted([
        ["completed", 9],
        ["cancelled", 1],
      ]),
    });
  }

  return visits.sort((a, b) => b.date.localeCompare(a.date));
}

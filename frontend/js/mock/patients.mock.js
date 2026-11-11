/**
 * بيانات حسابات المرضى والخدمات الطبية التجريبية:
 * سجل المرضى، دليل الخدمات (غرف، عناية مركزة، عمليات، فحوصات)،
 * حالات الإقامة، فواتير المرضى، وسندات القبض.
 */

import { createRandom, REFERENCE_DATE, buildName } from "./seed.js";

const random = createRandom(884_219);

/* ============================================================================
   1. دليل الخدمات الطبية للمستشفى
   ============================================================================ */

export const hospitalServices = [
  // --- إقامة وغرف ---
  { id: 1, code: "SRV-ROOM-01", category: "room", categoryName: "إقامة وغرف", name: "إقامة يومية — جناح ملكي فاخر", price: 3500, unit: "يوم", department: "القسم الداخلي" },
  { id: 2, code: "SRV-ROOM-02", category: "room", categoryName: "إقامة وغرف", name: "إقامة يومية — غرفة مفردة ممتازة", price: 1600, unit: "يوم", department: "القسم الداخلي" },
  { id: 3, code: "SRV-ROOM-03", category: "room", categoryName: "إقامة وغرف", name: "إقامة يومية — غرفة مزدوجة مشتركة", price: 900, unit: "يوم", department: "القسم الداخلي" },
  { id: 4, code: "SRV-ROOM-04", category: "room", categoryName: "إقامة وغرف", name: "إشراف طبي ورعاية تمريضية فندقية", price: 400, unit: "يوم", department: "القسم الداخلي" },

  // --- عناية مركزة ICU ---
  { id: 5, code: "SRV-ICU-01", category: "icu", categoryName: "عناية مركزة", name: "إقامة يومية — عناية مركزة عامة ICU", price: 5200, unit: "يوم", department: "العناية المركزة" },
  { id: 6, code: "SRV-ICU-02", category: "icu", categoryName: "عناية مركزة", name: "إقامة يومية — عناية مركزة للقلب CCU", price: 6000, unit: "يوم", department: "العناية المركزة" },
  { id: 7, code: "SRV-ICU-03", category: "icu", categoryName: "عناية مركزة", name: "إقامة يومية — مبتسرين وحضّانات NICU", price: 4200, unit: "يوم", department: "المبتسرين" },
  { id: 8, code: "SRV-ICU-04", category: "icu", categoryName: "عناية مركزة", name: "تنفس صناعي ومراقبة حيوية متقدمة", price: 1800, unit: "يوم", department: "العناية المركزة" },

  // --- عمليات جراحية ---
  { id: 9, code: "SRV-SURG-01", category: "surgery", categoryName: "عمليات جراحية", name: "جراحة استئصال مرارة بالمنظار", price: 16500, unit: "عملية", department: "العمليات" },
  { id: 10, code: "SRV-SURG-02", category: "surgery", categoryName: "عمليات جراحية", name: "جراحة قلب مفتوح وتبديل شرايين", price: 65000, unit: "عملية", department: "جراحة القلب" },
  { id: 11, code: "SRV-SURG-03", category: "surgery", categoryName: "عمليات جراحية", name: "قسطرة قلبية علاجية وتركيب دعامات", price: 32000, unit: "إجراء", department: "القسطرة" },
  { id: 12, code: "SRV-SURG-04", category: "surgery", categoryName: "عمليات جراحية", name: "استبدال مفصل ركبة جراحي كامل", price: 42000, unit: "عملية", department: "جراحة العظام" },
  { id: 13, code: "SRV-SURG-05", category: "surgery", categoryName: "عمليات جراحية", name: "ولادة قيصرية ورعاية متكاملة", price: 12500, unit: "عملية", department: "النساء والولادة" },
  { id: 14, code: "SRV-SURG-06", category: "surgery", categoryName: "عمليات جراحية", name: "تخدير جراحي كلي وإشراف إفاقة", price: 3200, unit: "حالة", department: "التخدير" },
  { id: 15, code: "SRV-SURG-07", category: "surgery", categoryName: "عمليات جراحية", name: "كشك عمليات جراحية ومستهلكات معقمة", price: 4500, unit: "حالة", department: "العمليات" },

  // --- استشارات وفحوصات وتحاليل ---
  { id: 16, code: "SRV-CONS-01", category: "consultation", categoryName: "كشوفات واستشارات", name: "كشف استشاري تخصصي", price: 450, unit: "كشف", department: "العيادات الخارجية" },
  { id: 17, code: "SRV-CONS-02", category: "consultation", categoryName: "كشوفات واستشارات", name: "كشف طوارئ وتقييم فوري", price: 250, unit: "زيارة", department: "الطوارئ" },
  { id: 18, code: "SRV-RAD-01", category: "radiology", categoryName: "أشعة وتصوير", name: "أشعة رنين مغناطيسي MRI", price: 2600, unit: "فحص", department: "الأشعة" },
  { id: 19, code: "SRV-RAD-02", category: "radiology", categoryName: "أشعة وتصوير", name: "أشعة مقطعية متعددة المقاطع CT", price: 1750, unit: "فحص", department: "الأشعة" },
  { id: 20, code: "SRV-LAB-01", category: "lab", categoryName: "تحاليل طبية", name: "باقة تحاليل شاملة (كبد، كلى، سكر، دهون)", price: 680, unit: "تحليل", department: "المعامل" },
  { id: 21, code: "SRV-PHARM-01", category: "medication", categoryName: "أدوية ومستلزمات", name: "بروتوكول أدوية ومحاليل وريدية للقسم الداخلي", price: 1450, unit: "حزمة", department: "الصيدلية" },
];

/* ============================================================================
   2. شركات التأمين الطبي والجهات المتعاقدة
   ============================================================================ */

export const insuranceProviders = [
  { id: 1, name: "مصر للتأمين", defaultCoverage: 0.85, phone: "19234" },
  { id: 2, name: "بوبا مصر (Bupa)", defaultCoverage: 0.9, phone: "16892" },
  { id: 3, name: "أكسا للتأمين (AXA)", defaultCoverage: 0.8, phone: "19782" },
  { id: 4, name: "نقابة المهندسين المصرية", defaultCoverage: 0.75, phone: "16723" },
  { id: 5, name: "نقابة الأطباء — مشروع العلاج", defaultCoverage: 0.8, phone: "16345" },
  { id: 6, name: "الهيئة العامة للتأمين الصحي", defaultCoverage: 0.95, phone: "19800" },
];

/* ============================================================================
   3. سجل المرضى
   ============================================================================ */

const PATIENT_NAMES = [
  ["أحمد محمود خليل", "male"],
  ["سارة إبراهيم الدسوقي", "female"],
  ["محمود عبد الفتاح النجار", "male"],
  ["فاطمة حسن القاضي", "female"],
  ["طارق كمال الصياد", "male"],
  ["منى عز الدين رضوان", "female"],
  ["ياسر مصطفى الجندي", "male"],
  ["نوران سعيد الشناوي", "female"],
  ["عمر شريف المهدي", "male"],
  ["هناء عاطف منصور", "female"],
  ["خالد عبد الرحيم بركات", "male"],
  ["إيمان وجدي التلمساني", "female"],
  ["شريف جلال البيلي", "male"],
  ["دعاء زكريا البنا", "female"],
  ["كريم عادل مرسي", "male"],
];

export const patients = PATIENT_NAMES.map(([name, gender], index) => {
  const id = index + 1;
  const isInsurance = index % 3 !== 0;
  const provider = isInsurance ? insuranceProviders[index % insuranceProviders.length] : null;
  const coverageRate = provider ? provider.defaultCoverage : 0;
  
  // حالات المرضى: محجوز، طوارئ/عيادات، تم الخروج
  const status = index < 6 ? "inpatient" : index < 11 ? "discharged" : "outpatient";
  const roomTypes = ["جناح خاص 301", "غرفة مفردة 204", "سرير عناية ICU-02", "سرير عناية CCU-01", "غرفة 108", "سرير عناية NICU-03"];
  const room = status === "inpatient" ? roomTypes[index % roomTypes.length] : null;

  return {
    id,
    code: `PAT-${String(id).padStart(4, "0")}`,
    name,
    gender,
    nationalId: `2${random.int(60, 99)}${String(random.int(1, 12)).padStart(2, "0")}${String(random.int(1, 28)).padStart(2, "0")}220194${id}`,
    phone: `01${random.pick(["0", "1", "2", "5"])}${random.int(10000000, 99999999)}`,
    birthDate: `19${random.int(60, 98)}-${String(random.int(1, 12)).padStart(2, "0")}-${String(random.int(1, 28)).padStart(2, "0")}`,
    bloodGroup: random.pick(["A+", "B+", "O+", "AB+", "O-", "A-"]),
    insuranceType: isInsurance ? "insurance" : "cash",
    insuranceProvider: provider?.name ?? "نقدي / خاص",
    insuranceProviderId: provider?.id ?? null,
    policyNumber: isInsurance ? `POL-${random.int(100000, 999999)}` : "—",
    coverageRate,
    status, // inpatient | outpatient | discharged
    statusLabel: status === "inpatient" ? "مقيم / منوّم" : status === "discharged" ? "تم الخروج" : "عيادات خارجية",
    currentRoom: room,
    admissionDate: status === "inpatient" ? "2026-11-04" : status === "discharged" ? "2026-10-18" : null,
    attendingDoctor: random.pick([
      "د. حازم عبد العزيز — استشاري الجراحة العامة",
      "د. طارق الشربيني — استشاري الرعاية المركزة",
      "د. شيرين حسني — استشاري أمراض القلب",
      "د. محمد سامي — استشاري جراحة العظام",
      "د. نيفين كمال — استشاري الباطنة العامة",
    ]),
    totalBilled: 0, // محسوبة تالياً
    totalPaid: 0,
    balance: 0,
    notes: isInsurance ? `تغطية تأمينية معتمدة بنسبة ${Math.round(coverageRate * 100)}%` : "مريض علاج نقدي خاص",
  };
});

/* ============================================================================
   4. سجل الإقامة والعمليات والعناية المركزة (Admissions)
   ============================================================================ */

export const admissions = [
  {
    id: 1,
    code: "ADM-2026-0001",
    patientId: 1,
    patientName: "أحمد محمود خليل",
    patientCode: "PAT-0001",
    stayType: "room",
    stayTypeLabel: "إقامة غرف",
    department: "القسم الداخلي",
    roomNumber: "جناح خاص 301",
    dailyRate: 3500,
    admissionDate: "2026-11-04",
    dischargeDate: null,
    daysCount: 7,
    attendingDoctor: "د. حازم عبد العزيز — استشاري الجراحة العامة",
    status: "active",
    statusLabel: "محجوز حالياً",
    diagnosis: "استئصال مرارة بالمنظار مع متابعة ما بعد الجراحة",
    totalCost: 3500 * 7 + 16500 + 3200 + 4500, // إقامة + جراحة + تخدير + تعقيم
  },
  {
    id: 2,
    code: "ADM-2026-0002",
    patientId: 2,
    patientName: "سارة إبراهيم الدسوقي",
    patientCode: "PAT-0002",
    stayType: "icu",
    stayTypeLabel: "عناية مركزة (ICU)",
    department: "العناية المركزة",
    roomNumber: "سرير عناية ICU-02",
    dailyRate: 5200,
    admissionDate: "2026-11-06",
    dischargeDate: null,
    daysCount: 5,
    attendingDoctor: "د. طارق الشربيني — استشاري الرعاية المركزة",
    status: "active",
    statusLabel: "محجوز حالياً",
    diagnosis: "قصور تنفسي حاد ومراقبة ضغط دم شرياني",
    totalCost: 5200 * 5 + 1800 * 5 + 2600 + 680,
  },
  {
    id: 3,
    code: "ADM-2026-0003",
    patientId: 3,
    patientName: "محمود عبد الفتاح النجار",
    patientCode: "PAT-0003",
    stayType: "surgery",
    stayTypeLabel: "عمليات وقسطرة",
    department: "القسطرة وجراحة القلب",
    roomNumber: "سرير عناية CCU-01",
    dailyRate: 6000,
    admissionDate: "2026-11-07",
    dischargeDate: null,
    daysCount: 4,
    attendingDoctor: "د. شيرين حسني — استشاري أمراض القلب",
    status: "active",
    statusLabel: "محجوز حالياً",
    diagnosis: "ذبحة صدرية غير مستقرة وقسطرة علاجية ودعامات",
    totalCost: 32000 + 6000 * 4 + 1750 + 680,
  },
  {
    id: 4,
    code: "ADM-2026-0004",
    patientId: 4,
    patientName: "فاطمة حسن القاضي",
    patientCode: "PAT-0004",
    stayType: "room",
    stayTypeLabel: "إقامة غرف",
    department: "النساء والولادة",
    roomNumber: "غرفة مفردة 204",
    dailyRate: 1600,
    admissionDate: "2026-11-08",
    dischargeDate: null,
    daysCount: 3,
    attendingDoctor: "د. حازم عبد العزيز",
    status: "active",
    statusLabel: "محجوز حالياً",
    diagnosis: "ولادة قيصرية ورعاية أمومة ووليد",
    totalCost: 12500 + 1600 * 3 + 1450,
  },
  {
    id: 5,
    code: "ADM-2026-0005",
    patientId: 7,
    patientName: "ياسر مصطفى الجندي",
    patientCode: "PAT-0007",
    stayType: "room",
    stayTypeLabel: "إقامة سابقة",
    department: "جراحة العظام",
    roomNumber: "غرفة 108",
    dailyRate: 1600,
    admissionDate: "2026-10-18",
    dischargeDate: "2026-10-25",
    daysCount: 7,
    attendingDoctor: "د. محمد سامي — استشاري جراحة العظام",
    status: "discharged",
    statusLabel: "تم الخروج بعد الشفاء",
    diagnosis: "استبدال مفصل ركبة ومتابعة علاج طبيعي",
    totalCost: 42000 + 1600 * 7 + 2600 + 1450,
  },
];

/* ============================================================================
   5. فواتير المرضى (Patient Invoices)
   ============================================================================ */

export const patientInvoices = [
  {
    id: 1,
    invoiceNumber: "PINV-2026-0001",
    patientId: 1,
    patientName: "أحمد محمود خليل",
    patientCode: "PAT-0001",
    date: "2026-11-04",
    dueDate: "2026-11-15",
    insuranceType: "insurance",
    insuranceProvider: "مصر للتأمين",
    coverageRate: 0.85,
    status: "partially_paid",
    statusLabel: "مسددة جزئياً",
    lines: [
      { id: 1, serviceCode: "SRV-ROOM-01", description: "إقامة يومية — جناح ملكي فاخر (7 أيام)", category: "room", categoryName: "إقامة غرف", quantity: 7, unitPrice: 3500, total: 24500 },
      { id: 2, serviceCode: "SRV-SURG-01", description: "جراحة استئصال مرارة بالمنظار", category: "surgery", categoryName: "عمليات جراحية", quantity: 1, unitPrice: 16500, total: 16500 },
      { id: 3, serviceCode: "SRV-SURG-06", description: "تخدير جراحي كلي وإشراف إفاقة", category: "surgery", categoryName: "عمليات جراحية", quantity: 1, unitPrice: 3200, total: 3200 },
      { id: 4, serviceCode: "SRV-SURG-07", description: "كشك عمليات جراحية ومستهلكات معقمة", category: "surgery", categoryName: "عمليات جراحية", quantity: 1, unitPrice: 4500, total: 4500 },
      { id: 5, serviceCode: "SRV-PHARM-01", description: "بروتوكول أدوية ومحاليل وريدية للقسم الداخلي", category: "medication", categoryName: "أدوية وعلاج", quantity: 1, unitPrice: 1450, total: 1450 },
    ],
    subtotal: 50150,
    discount: 150,
    totalAfterDiscount: 50000,
    insuranceAmount: 42500, // 85%
    patientAmount: 7500,    // 15%
    paidAmount: 5000,
    remainingAmount: 2500,
  },
  {
    id: 2,
    invoiceNumber: "PINV-2026-0002",
    patientId: 2,
    patientName: "سارة إبراهيم الدسوقي",
    patientCode: "PAT-0002",
    date: "2026-11-06",
    dueDate: "2026-11-20",
    insuranceType: "insurance",
    insuranceProvider: "بوبا مصر (Bupa)",
    coverageRate: 0.9,
    status: "unpaid",
    statusLabel: "غير مسددة",
    lines: [
      { id: 1, serviceCode: "SRV-ICU-01", description: "إقامة يومية — عناية مركزة عامة ICU (5 أيام)", category: "icu", categoryName: "عناية مركزة", quantity: 5, unitPrice: 5200, total: 26000 },
      { id: 2, serviceCode: "SRV-ICU-04", description: "تنفس صناعي ومراقبة حيوية متقدمة (5 أيام)", category: "icu", categoryName: "عناية مركزة", quantity: 5, unitPrice: 1800, total: 9000 },
      { id: 3, serviceCode: "SRV-RAD-01", description: "أشعة رنين مغناطيسي MRI", category: "radiology", categoryName: "أشعة وتصوير", quantity: 1, unitPrice: 2600, total: 2600 },
      { id: 4, serviceCode: "SRV-LAB-01", description: "باقة تحاليل شاملة (وظائف كبد وكلى وسكر)", category: "lab", categoryName: "تحاليل طبية", quantity: 1, unitPrice: 680, total: 680 },
    ],
    subtotal: 38280,
    discount: 280,
    totalAfterDiscount: 38000,
    insuranceAmount: 34200, // 90%
    patientAmount: 3800,    // 10%
    paidAmount: 0,
    remainingAmount: 3800,
  },
  {
    id: 3,
    invoiceNumber: "PINV-2026-0003",
    patientId: 3,
    patientName: "محمود عبد الفتاح النجار",
    patientCode: "PAT-0003",
    date: "2026-11-07",
    dueDate: "2026-11-18",
    insuranceType: "cash",
    insuranceProvider: "نقدي / خاص",
    coverageRate: 0,
    status: "paid",
    statusLabel: "مسددة بالكامل",
    lines: [
      { id: 1, serviceCode: "SRV-SURG-03", description: "قسطرة قلبية علاجية وتركيب دعامات تداخلية", category: "surgery", categoryName: "عمليات جراحية", quantity: 1, unitPrice: 32000, total: 32000 },
      { id: 2, serviceCode: "SRV-ICU-02", description: "إقامة يومية — عناية مركزة للقلب CCU (4 أيام)", category: "icu", categoryName: "عناية مركزة", quantity: 4, unitPrice: 6000, total: 24000 },
      { id: 3, serviceCode: "SRV-RAD-02", description: "أشعة مقطعية متعددة المقاطع CT", category: "radiology", categoryName: "أشعة وتصوير", quantity: 1, unitPrice: 1750, total: 1750 },
      { id: 4, serviceCode: "SRV-LAB-01", description: "باقة تحاليل طبية شاملة", category: "lab", categoryName: "تحاليل طبية", quantity: 1, unitPrice: 680, total: 680 },
    ],
    subtotal: 58430,
    discount: 430,
    totalAfterDiscount: 58000,
    insuranceAmount: 0,
    patientAmount: 58000,
    paidAmount: 58000,
    remainingAmount: 0,
  },
  {
    id: 4,
    invoiceNumber: "PINV-2026-0004",
    patientId: 4,
    patientName: "فاطمة حسن القاضي",
    patientCode: "PAT-0004",
    date: "2026-11-08",
    dueDate: "2026-11-22",
    insuranceType: "insurance",
    insuranceProvider: "أكسا للتأمين (AXA)",
    coverageRate: 0.8,
    status: "partially_paid",
    statusLabel: "مسددة جزئياً",
    lines: [
      { id: 1, serviceCode: "SRV-SURG-05", description: "ولادة قيصرية ورعاية طبية شاملة", category: "surgery", categoryName: "عمليات جراحية", quantity: 1, unitPrice: 12500, total: 12500 },
      { id: 2, serviceCode: "SRV-ROOM-02", description: "إقامة يومية — غرفة مفردة ممتازة (3 أيام)", category: "room", categoryName: "إقامة غرف", quantity: 3, unitPrice: 1600, total: 4800 },
      { id: 3, serviceCode: "SRV-PHARM-01", description: "بروتوكول أدوية ومحاليل علاجية", category: "medication", categoryName: "أدوية وعلاج", quantity: 1, unitPrice: 1450, total: 1450 },
    ],
    subtotal: 18750,
    discount: 250,
    totalAfterDiscount: 18500,
    insuranceAmount: 14800, // 80%
    patientAmount: 3700,    // 20%
    paidAmount: 2000,
    remainingAmount: 1700,
  },
  {
    id: 5,
    invoiceNumber: "PINV-2026-0005",
    patientId: 7,
    patientName: "ياسر مصطفى الجندي",
    patientCode: "PAT-0007",
    date: "2026-10-25",
    dueDate: "2026-11-05",
    insuranceType: "insurance",
    insuranceProvider: "الهيئة العامة للتأمين الصحي",
    coverageRate: 0.95,
    status: "paid",
    statusLabel: "مسددة بالكامل",
    lines: [
      { id: 1, serviceCode: "SRV-SURG-04", description: "استبدال مفصل ركبة جراحي كامل", category: "surgery", categoryName: "عمليات جراحية", quantity: 1, unitPrice: 42000, total: 42000 },
      { id: 2, serviceCode: "SRV-ROOM-02", description: "إقامة يومية — غرفة مفردة (7 أيام)", category: "room", categoryName: "إقامة غرف", quantity: 7, unitPrice: 1600, total: 11200 },
      { id: 3, serviceCode: "SRV-RAD-01", description: "أشعة رنين مغناطيسي MRI للركبة", category: "radiology", categoryName: "أشعة وتصوير", quantity: 1, unitPrice: 2600, total: 2600 },
    ],
    subtotal: 55800,
    discount: 800,
    totalAfterDiscount: 55000,
    insuranceAmount: 52250, // 95%
    patientAmount: 2750,    // 5%
    paidAmount: 2750,
    remainingAmount: 0,
  },
];

/* ============================================================================
   6. سندات القبض والدفعات النقدية والبنكية للمرضى (Patient Receipts)
   ============================================================================ */

export const patientReceipts = [
  {
    id: 1,
    receiptNumber: "PRC-2026-0001",
    patientId: 1,
    patientName: "أحمد محمود خليل",
    patientCode: "PAT-0001",
    invoiceId: 1,
    invoiceNumber: "PINV-2026-0001",
    date: "2026-11-04",
    amount: 5000,
    type: "deposit",
    typeLabel: "تأمين دخول مقدم",
    paymentMethod: "cash",
    paymentMethodLabel: "نقدي بالخزينة",
    targetAccount: "الخزينة الرئيسية (1111)",
    notes: "دفعة تأمين دخول عند بدء الإقامة واستئصال المرارة",
  },
  {
    id: 2,
    receiptNumber: "PRC-2026-0002",
    patientId: 3,
    patientName: "محمود عبد الفتاح النجار",
    patientCode: "PAT-0003",
    invoiceId: 3,
    invoiceNumber: "PINV-2026-0003",
    date: "2026-11-07",
    amount: 25000,
    type: "deposit",
    typeLabel: "تأمين عمليات وقسطرة",
    paymentMethod: "card",
    paymentMethodLabel: "بطاقة بنكية / فيزا",
    targetAccount: "البنك الأهلي المصري (1121)",
    notes: "دفعة أولى قبل دخول كشك القسطرة وركوب الدعامات",
  },
  {
    id: 3,
    receiptNumber: "PRC-2026-0003",
    patientId: 3,
    patientName: "محمود عبد الفتاح النجار",
    patientCode: "PAT-0003",
    invoiceId: 3,
    invoiceNumber: "PINV-2026-0003",
    date: "2026-11-10",
    amount: 33000,
    type: "invoice_payment",
    typeLabel: "سداد باقي الفاتورة",
    paymentMethod: "bank_transfer",
    paymentMethodLabel: "تحويل بنكي",
    targetAccount: "بنك مصر — حساب التشغيل (1122)",
    notes: "تسوية وسداد نهائي لكامل الفاتورة عند الخروج",
  },
  {
    id: 4,
    receiptNumber: "PRC-2026-0004",
    patientId: 4,
    patientName: "فاطمة حسن القاضي",
    patientCode: "PAT-0004",
    invoiceId: 4,
    invoiceNumber: "PINV-2026-0004",
    date: "2026-11-08",
    amount: 2000,
    type: "deposit",
    typeLabel: "تأمين دخول مقدم",
    paymentMethod: "cash",
    paymentMethodLabel: "نقدي بالخزينة",
    targetAccount: "الخزينة الرئيسية (1111)",
    notes: "تأمين دخول قسم النساء والتوليد",
  },
  {
    id: 5,
    receiptNumber: "PRC-2026-0005",
    patientId: 7,
    patientName: "ياسر مصطفى الجندي",
    patientCode: "PAT-0007",
    invoiceId: 5,
    invoiceNumber: "PINV-2026-0005",
    date: "2026-10-25",
    amount: 2750,
    type: "invoice_payment",
    typeLabel: "سداد نسبة التحمل",
    paymentMethod: "cash",
    paymentMethodLabel: "نقدي بالخزينة",
    targetAccount: "الخزينة الرئيسية (1111)",
    notes: "سداد كامل نسبة التحمل الخاصة بالمريض (5%)",
  },
];

// تحديث إجماليات المرضى من الفواتير والسندات
for (const patient of patients) {
  const patientInvs = patientInvoices.filter((inv) => inv.patientId === patient.id);
  const patientRecs = patientReceipts.filter((rec) => rec.patientId === patient.id);

  patient.totalBilled = patientInvs.reduce((sum, inv) => sum + inv.patientAmount, 0);
  patient.totalPaid = patientRecs.reduce((sum, rec) => sum + rec.amount, 0);
  patient.balance = Math.max(0, patient.totalBilled - patient.totalPaid);
}

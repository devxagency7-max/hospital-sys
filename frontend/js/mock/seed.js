/**
 * مولّد عشوائي حتمي للبيانات التجريبية + المفردات المشتركة.
 *
 * `Math.random` تُنتج بيانات مختلفة في كل تحديث للصفحة، فيصبح أي فرق في
 * الواجهة غير قابل للتتبّع: هل تغيّر الكود أم تغيّرت البيانات؟ هذا المولّد
 * يُنتج نفس المجموعة في كل مرة، وتغييرها يحتاج تغيير البذرة صراحةً.
 *
 * مهم: كل الأسماء والأرقام وبيانات الشركات هنا مُختلقة بالكامل. ممنوع إدخال
 * بيانات عملاء أو موظفين حقيقية في هذا المجلد.
 */

/** mulberry32 — مولّد صغير وسريع وكافٍ لبيانات عرض. */
export function createRandom(seed = 20261107) {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    /** كسر في [0, 1). */
    float: next,

    /** عدد صحيح في [min, max] (طرفاه مشمولان). */
    int(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },

    /** عدد بمنزلتين عشريتين — للمبالغ المالية. */
    money(min, max) {
      return Math.round((min + next() * (max - min)) * 100) / 100;
    },

    /** عنصر عشوائي من مصفوفة. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },

    /** عدة عناصر مختلفة من مصفوفة. */
    sample(items, count) {
      const pool = [...items];
      const out = [];
      while (out.length < count && pool.length) {
        out.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
      }
      return out;
    },

    /** true باحتمال `probability`. */
    chance(probability) {
      return next() < probability;
    },

    /** عنصر مرجَّح: pickWeighted([["paid", 6], ["unpaid", 2]]). */
    pickWeighted(entries) {
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
      let threshold = next() * total;
      for (const [value, weight] of entries) {
        threshold -= weight;
        if (threshold <= 0) return value;
      }
      return entries[entries.length - 1][0];
    },

    /** تاريخ ISO بين منذ `fromDaysAgo` ومنذ `toDaysAgo`. */
    date(fromDaysAgo, toDaysAgo = 0) {
      const days = this.int(Math.min(toDaysAgo, fromDaysAgo), Math.max(toDaysAgo, fromDaysAgo));
      const date = new Date(REFERENCE_DATE);
      date.setDate(date.getDate() - days);
      return date.toISOString().slice(0, 10);
    },

    /** تاريخ ووقت ISO كامل. */
    dateTime(fromDaysAgo, toDaysAgo = 0) {
      const days = this.int(Math.min(toDaysAgo, fromDaysAgo), Math.max(toDaysAgo, fromDaysAgo));
      const date = new Date(REFERENCE_DATE);
      date.setDate(date.getDate() - days);
      date.setHours(this.int(8, 20), this.pick([0, 15, 30, 45]), 0, 0);
      return date.toISOString();
    },

    /** تاريخ في المستقبل — لتواريخ الصلاحية والاستحقاق. */
    futureDate(minDays, maxDays) {
      const date = new Date(REFERENCE_DATE);
      date.setDate(date.getDate() + this.int(minDays, maxDays));
      return date.toISOString().slice(0, 10);
    },

    /** وقت بصيغة HH:MM. */
    time(minHour, maxHour) {
      return `${String(this.int(minHour, maxHour)).padStart(2, "0")}:${String(
        this.pick([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]),
      ).padStart(2, "0")}`;
    },

    /** رقم موبايل مصري مُختلق. */
    phone() {
      const prefix = this.pick(["010", "011", "012", "015"]);
      return prefix + String(this.int(10000000, 99999999));
    },

    /** رقم قومي مُختلق (14 رقمًا، البنية صحيحة والقيمة مُختلقة). */
    nationalId() {
      return `2${this.int(85, 99)}${String(this.int(1, 12)).padStart(2, "0")}${String(
        this.int(1, 28),
      ).padStart(2, "0")}${this.int(10, 27)}${String(this.int(10000, 99999)).padStart(5, "0")}`;
    },
  };
}

/**
 * تاريخ مرجعي ثابت.
 * لو استخدمنا `new Date()` لتحوّلت «فاتورة متأخرة 20 يومًا» إلى 400 يوم بعد
 * عام، فتفقد البيانات معناها. التثبيت يجعل المجموعة مفهومة دائمًا.
 */
export const REFERENCE_DATE = new Date("2026-11-07T09:00:00+03:00");

/** السنة المالية الجارية في البيانات التجريبية. */
export const FISCAL_YEAR = 2026;

/** الفترة الجارية بصيغة YYYY-MM — تستخدمها بيانات الرواتب والحضور. */
export const CURRENT_PERIOD = REFERENCE_DATE.toISOString().slice(0, 7);

/* --------------------------------------------------------------------------
   مفردات عربية مُختلقة
   -------------------------------------------------------------------------- */

export const FIRST_NAMES_MALE = [
  "أحمد", "محمد", "محمود", "مصطفى", "خالد", "عمر", "يوسف", "كريم", "طارق",
  "هشام", "شريف", "إسلام", "وليد", "سامح", "أيمن", "باسم", "حسام", "رامي",
  "زياد", "عادل", "فادي", "ماجد", "نادر", "سيد", "عبدالرحمن", "إبراهيم",
];

export const FIRST_NAMES_FEMALE = [
  "فاطمة", "مريم", "نورهان", "سارة", "هدى", "أميرة", "دعاء", "منى", "رانيا",
  "ياسمين", "إيمان", "شيماء", "نهى", "سلمى", "هند", "ريهام", "آية", "دينا",
  "عزة", "نجلاء", "وفاء", "سمية", "جميلة", "حبيبة",
];

export const FAMILY_NAMES = [
  "عبدالله", "السيد", "حسن", "إبراهيم", "عبدالعزيز", "الشامي", "فتحي",
  "رمضان", "صلاح", "منصور", "الغزالي", "عثمان", "زكي", "شاكر", "البحيري",
  "القاضي", "سليمان", "النجار", "الحداد", "مرسي", "عطية", "شلبي", "خليل",
  "درويش", "الفقي", "بدران",
];

export const GOVERNORATES = [
  "القاهرة", "الجيزة", "الإسكندرية", "القليوبية", "الشرقية", "الدقهلية",
  "المنوفية", "الغربية", "بني سويف", "الفيوم", "أسيوط", "سوهاج", "المنيا",
  "بورسعيد", "السويس", "الإسماعيلية", "دمياط", "كفر الشيخ", "البحيرة", "الأقصر",
];

/* --------------------------------------------------------------------------
   الهيكل التنظيمي
   -------------------------------------------------------------------------- */

/**
 * إدارات الشركة. `costCenterId` يربط الإدارة بمركز تكلفتها، فتُنسب
 * مصروفاتها تلقائيًا عند الترحيل.
 */
export const DEPARTMENTS = [
  { id: 1, code: "DEP-ADM", name: "الإدارة العليا", nameEn: "Executive Management", managerId: 1, costCenterId: 1, parentId: null },
  { id: 2, code: "DEP-FIN", name: "الإدارة المالية والحسابات", nameEn: "Finance & Accounting", managerId: 2, costCenterId: 2, parentId: 1 },
  { id: 3, code: "DEP-HR", name: "الموارد البشرية", nameEn: "Human Resources", managerId: 5, costCenterId: 3, parentId: 1 },
  { id: 4, code: "DEP-SAL", name: "المبيعات والتسويق", nameEn: "Sales & Marketing", managerId: 8, costCenterId: 4, parentId: 1 },
  { id: 5, code: "DEP-PRC", name: "المشتريات", nameEn: "Procurement", managerId: 11, costCenterId: 5, parentId: 1 },
  { id: 6, code: "DEP-WHS", name: "المخازن واللوجستيات", nameEn: "Warehousing & Logistics", managerId: 13, costCenterId: 6, parentId: 1 },
  { id: 7, code: "DEP-OPS", name: "التشغيل والإنتاج", nameEn: "Operations", managerId: 16, costCenterId: 7, parentId: 1 },
  { id: 8, code: "DEP-IT", name: "تقنية المعلومات", nameEn: "Information Technology", managerId: 20, costCenterId: 8, parentId: 1 },
  { id: 9, code: "DEP-LEG", name: "الشؤون القانونية", nameEn: "Legal Affairs", managerId: 22, costCenterId: 2, parentId: 1 },
  { id: 10, code: "DEP-MNT", name: "الصيانة والخدمات", nameEn: "Maintenance & Facilities", managerId: 24, costCenterId: 7, parentId: 1 },
];

/** الوظائف. `gradeLevel` يحكم سلّم الرواتب، و`departmentId` الإدارة التابعة. */
export const POSITIONS = [
  { id: 1, code: "POS-001", title: "المدير العام", departmentId: 1, gradeLevel: 10, basicSalaryFrom: 55000, basicSalaryTo: 90000 },
  { id: 2, code: "POS-002", title: "المدير المالي", departmentId: 2, gradeLevel: 9, basicSalaryFrom: 40000, basicSalaryTo: 65000 },
  { id: 3, code: "POS-003", title: "رئيس الحسابات", departmentId: 2, gradeLevel: 7, basicSalaryFrom: 25000, basicSalaryTo: 38000 },
  { id: 4, code: "POS-004", title: "محاسب أول", departmentId: 2, gradeLevel: 5, basicSalaryFrom: 14000, basicSalaryTo: 22000 },
  { id: 5, code: "POS-005", title: "محاسب", departmentId: 2, gradeLevel: 4, basicSalaryFrom: 9000, basicSalaryTo: 15000 },
  { id: 6, code: "POS-006", title: "أمين خزينة", departmentId: 2, gradeLevel: 4, basicSalaryFrom: 8500, basicSalaryTo: 13000 },
  { id: 7, code: "POS-007", title: "مدير الموارد البشرية", departmentId: 3, gradeLevel: 8, basicSalaryFrom: 30000, basicSalaryTo: 48000 },
  { id: 8, code: "POS-008", title: "أخصائي موارد بشرية", departmentId: 3, gradeLevel: 4, basicSalaryFrom: 9000, basicSalaryTo: 14000 },
  { id: 9, code: "POS-009", title: "مدير المبيعات", departmentId: 4, gradeLevel: 8, basicSalaryFrom: 28000, basicSalaryTo: 45000 },
  { id: 10, code: "POS-010", title: "مندوب مبيعات", departmentId: 4, gradeLevel: 3, basicSalaryFrom: 7000, basicSalaryTo: 12000 },
  { id: 11, code: "POS-011", title: "مدير المشتريات", departmentId: 5, gradeLevel: 8, basicSalaryFrom: 27000, basicSalaryTo: 42000 },
  { id: 12, code: "POS-012", title: "مسؤول مشتريات", departmentId: 5, gradeLevel: 4, basicSalaryFrom: 9500, basicSalaryTo: 15000 },
  { id: 13, code: "POS-013", title: "مدير المخازن", departmentId: 6, gradeLevel: 7, basicSalaryFrom: 22000, basicSalaryTo: 34000 },
  { id: 14, code: "POS-014", title: "أمين مخزن", departmentId: 6, gradeLevel: 3, basicSalaryFrom: 7500, basicSalaryTo: 12000 },
  { id: 15, code: "POS-015", title: "سائق ومناوب توصيل", departmentId: 6, gradeLevel: 2, basicSalaryFrom: 6000, basicSalaryTo: 9000 },
  { id: 16, code: "POS-016", title: "مدير التشغيل", departmentId: 7, gradeLevel: 8, basicSalaryFrom: 29000, basicSalaryTo: 46000 },
  { id: 17, code: "POS-017", title: "مشرف خط إنتاج", departmentId: 7, gradeLevel: 5, basicSalaryFrom: 13000, basicSalaryTo: 20000 },
  { id: 18, code: "POS-018", title: "فني تشغيل", departmentId: 7, gradeLevel: 3, basicSalaryFrom: 7000, basicSalaryTo: 11500 },
  { id: 19, code: "POS-019", title: "أخصائي مراقبة جودة", departmentId: 7, gradeLevel: 5, basicSalaryFrom: 12000, basicSalaryTo: 18000 },
  { id: 20, code: "POS-020", title: "مدير تقنية المعلومات", departmentId: 8, gradeLevel: 8, basicSalaryFrom: 32000, basicSalaryTo: 50000 },
  { id: 21, code: "POS-021", title: "مهندس نظم", departmentId: 8, gradeLevel: 6, basicSalaryFrom: 18000, basicSalaryTo: 28000 },
  { id: 22, code: "POS-022", title: "مستشار قانوني", departmentId: 9, gradeLevel: 7, basicSalaryFrom: 24000, basicSalaryTo: 36000 },
  { id: 23, code: "POS-023", title: "سكرتير تنفيذي", departmentId: 1, gradeLevel: 3, basicSalaryFrom: 8000, basicSalaryTo: 13000 },
  { id: 24, code: "POS-024", title: "مشرف صيانة", departmentId: 10, gradeLevel: 5, basicSalaryFrom: 12500, basicSalaryTo: 19000 },
  { id: 25, code: "POS-025", title: "عامل خدمات", departmentId: 10, gradeLevel: 1, basicSalaryFrom: 5000, basicSalaryTo: 7500 },
];

/** الورديات. */
export const SHIFTS = [
  { id: 1, code: "SH-ADM", name: "الوردية الإدارية", startTime: "09:00", endTime: "17:00", breakMinutes: 60, graceMinutes: 15, minHalfDayMinutes: 240, workDays: [0, 1, 2, 3, 4] },
  { id: 2, code: "SH-MOR", name: "وردية صباحية", startTime: "07:00", endTime: "15:00", breakMinutes: 45, graceMinutes: 10, minHalfDayMinutes: 240, workDays: [0, 1, 2, 3, 4, 6] },
  { id: 3, code: "SH-EVE", name: "وردية مسائية", startTime: "15:00", endTime: "23:00", breakMinutes: 45, graceMinutes: 10, minHalfDayMinutes: 240, workDays: [0, 1, 2, 3, 4, 6] },
  { id: 4, code: "SH-NGT", name: "وردية ليلية", startTime: "23:00", endTime: "07:00", breakMinutes: 60, graceMinutes: 15, minHalfDayMinutes: 240, workDays: [0, 1, 2, 3, 4] },
];

/* --------------------------------------------------------------------------
   مراكز التكلفة
   -------------------------------------------------------------------------- */

export const COST_CENTERS = [
  { id: 1, code: "CC-100", name: "الإدارة العامة", nameEn: "General Administration", type: "administrative", managerId: 1, parentId: null, status: "active" },
  { id: 2, code: "CC-200", name: "الإدارة المالية", nameEn: "Finance", type: "administrative", managerId: 2, parentId: 1, status: "active" },
  { id: 3, code: "CC-300", name: "الموارد البشرية", nameEn: "Human Resources", type: "administrative", managerId: 5, parentId: 1, status: "active" },
  { id: 4, code: "CC-400", name: "المبيعات والتسويق", nameEn: "Sales & Marketing", type: "revenue", managerId: 8, parentId: null, status: "active" },
  { id: 5, code: "CC-500", name: "المشتريات", nameEn: "Procurement", type: "support", managerId: 11, parentId: 1, status: "active" },
  { id: 6, code: "CC-600", name: "المخازن واللوجستيات", nameEn: "Logistics", type: "support", managerId: 13, parentId: null, status: "active" },
  { id: 7, code: "CC-700", name: "التشغيل والإنتاج", nameEn: "Operations", type: "production", managerId: 16, parentId: null, status: "active" },
  { id: 8, code: "CC-800", name: "تقنية المعلومات", nameEn: "IT", type: "support", managerId: 20, parentId: 1, status: "active" },
  { id: 9, code: "CC-910", name: "مشروع توسعة الفرع الثاني", nameEn: "Branch 2 Expansion", type: "project", managerId: 1, parentId: null, status: "active" },
  { id: 10, code: "CC-920", name: "مشروع تحديث الأنظمة", nameEn: "Systems Upgrade", type: "project", managerId: 20, parentId: null, status: "inactive" },
];

/* --------------------------------------------------------------------------
   الفروع
   -------------------------------------------------------------------------- */

export const BRANCHES = [
  { id: 1, code: "BR-MAIN", name: "المركز الرئيسي — القاهرة", governorate: "القاهرة", address: "مدينة نصر، شارع عباس العقاد", phone: "0224011234", isMain: true, status: "active" },
  { id: 2, code: "BR-ALX", name: "فرع الإسكندرية", governorate: "الإسكندرية", address: "سموحة، طريق الحرية", phone: "0334567890", isMain: false, status: "active" },
  { id: 3, code: "BR-GIZ", name: "فرع الجيزة — المعرض", governorate: "الجيزة", address: "الهرم، شارع الملك فيصل", phone: "0235551122", isMain: false, status: "active" },
];

/* --------------------------------------------------------------------------
   المخازن ووحدات القياس
   -------------------------------------------------------------------------- */

export const WAREHOUSES = [
  { id: 1, code: "WH-MAIN", name: "المخزن الرئيسي", nameEn: "Main Warehouse", branchId: 1, managerId: 13, location: "مدينة نصر — المقر الرئيسي", inventoryAccountId: 11411, costingMethod: "weighted_average", allowNegative: false, status: "active" },
  { id: 2, code: "WH-RAW", name: "مخزن المواد الخام", nameEn: "Raw Materials", branchId: 1, managerId: 14, location: "العاشر من رمضان — المصنع", inventoryAccountId: 11412, costingMethod: "fifo", allowNegative: false, status: "active" },
  { id: 3, code: "WH-FIN", name: "مخزن الإنتاج التام", nameEn: "Finished Goods", branchId: 1, managerId: 14, location: "العاشر من رمضان — المصنع", inventoryAccountId: 11413, costingMethod: "fifo", allowNegative: false, status: "active" },
  { id: 4, code: "WH-SPR", name: "مخزن قطع الغيار", nameEn: "Spare Parts", branchId: 1, managerId: 24, location: "مدينة نصر — ورشة الصيانة", inventoryAccountId: 11414, costingMethod: "weighted_average", allowNegative: false, status: "active" },
  { id: 5, code: "WH-ALX", name: "مخزن فرع الإسكندرية", nameEn: "Alexandria Branch Store", branchId: 2, managerId: 14, location: "سموحة", inventoryAccountId: 11415, costingMethod: "weighted_average", allowNegative: false, status: "active" },
  { id: 6, code: "WH-OFF", name: "مخزن المستلزمات المكتبية", nameEn: "Office Supplies", branchId: 1, managerId: 23, location: "مدينة نصر — الدور الأرضي", inventoryAccountId: 11411, costingMethod: "weighted_average", allowNegative: false, status: "active" },
];

export const UNITS = [
  { id: 1, code: "PCS", name: "قطعة", nameEn: "Piece", baseUnitId: null, factor: 1, decimals: 0 },
  { id: 2, code: "BOX", name: "كرتونة", nameEn: "Box", baseUnitId: 1, factor: 12, decimals: 0 },
  { id: 3, code: "PAL", name: "طبلية", nameEn: "Pallet", baseUnitId: 2, factor: 40, decimals: 0 },
  { id: 4, code: "KG", name: "كيلوجرام", nameEn: "Kilogram", baseUnitId: null, factor: 1, decimals: 2 },
  { id: 5, code: "TON", name: "طن", nameEn: "Ton", baseUnitId: 4, factor: 1000, decimals: 3 },
  { id: 6, code: "LTR", name: "لتر", nameEn: "Litre", baseUnitId: null, factor: 1, decimals: 2 },
  { id: 7, code: "MTR", name: "متر", nameEn: "Metre", baseUnitId: null, factor: 1, decimals: 2 },
  { id: 8, code: "M2", name: "متر مربع", nameEn: "Square Metre", baseUnitId: null, factor: 1, decimals: 2 },
  { id: 9, code: "SET", name: "طقم", nameEn: "Set", baseUnitId: null, factor: 1, decimals: 0 },
  { id: 10, code: "ROL", name: "لفة", nameEn: "Roll", baseUnitId: null, factor: 1, decimals: 0 },
];

export const ITEM_CATEGORIES = [
  { id: 1, code: "CAT-RAW", name: "مواد خام", nameEn: "Raw Materials", parentId: null, inventoryAccountId: 11412, status: "active" },
  { id: 2, code: "CAT-RAW-MTL", name: "خامات معدنية", nameEn: "Metal Stock", parentId: 1, inventoryAccountId: 11412, status: "active" },
  { id: 3, code: "CAT-RAW-PLS", name: "خامات بلاستيكية", nameEn: "Plastic Stock", parentId: 1, inventoryAccountId: 11412, status: "active" },
  { id: 4, code: "CAT-PKG", name: "مواد تعبئة وتغليف", nameEn: "Packaging", parentId: null, inventoryAccountId: 11412, status: "active" },
  { id: 5, code: "CAT-FIN", name: "منتجات تامة", nameEn: "Finished Goods", parentId: null, inventoryAccountId: 11413, status: "active" },
  { id: 6, code: "CAT-TRD", name: "أصناف تجارية للبيع", nameEn: "Trading Goods", parentId: null, inventoryAccountId: 11411, status: "active" },
  { id: 7, code: "CAT-SPR", name: "قطع غيار ومستهلكات", nameEn: "Spare Parts", parentId: null, inventoryAccountId: 11414, status: "active" },
  { id: 8, code: "CAT-OFF", name: "مستلزمات مكتبية", nameEn: "Office Supplies", parentId: null, inventoryAccountId: 11411, status: "active" },
  { id: 9, code: "CAT-CLN", name: "مواد نظافة وصيانة", nameEn: "Cleaning & Maintenance", parentId: null, inventoryAccountId: 11411, status: "active" },
  { id: 10, code: "CAT-ELC", name: "أجهزة ومعدات كهربائية", nameEn: "Electrical Equipment", parentId: null, inventoryAccountId: 11411, status: "active" },
];

/* --------------------------------------------------------------------------
   أطراف التعامل
   -------------------------------------------------------------------------- */

export const SUPPLIER_SEEDS = [
  { name: "شركة الدلتا للصناعات المعدنية", activity: "خامات معدنية", governorate: "الشرقية" },
  { name: "النيل الأزرق للبلاستيك", activity: "خامات بلاستيكية", governorate: "القاهرة" },
  { name: "مجموعة الأهرام للتغليف", activity: "مواد تعبئة وتغليف", governorate: "الجيزة" },
  { name: "الشرق الأوسط للتوريدات العمومية", activity: "توريدات عمومية", governorate: "القاهرة" },
  { name: "المصرية لقطع الغيار الصناعية", activity: "قطع غيار", governorate: "الإسكندرية" },
  { name: "دلتا تك للأنظمة والحاسبات", activity: "تقنية معلومات", governorate: "القاهرة" },
  { name: "شركة الوفاء للمستلزمات المكتبية", activity: "مستلزمات مكتبية", governorate: "القليوبية" },
  { name: "الصفا للنقل والشحن", activity: "خدمات لوجستية", governorate: "القاهرة" },
  { name: "ميتال برو للسبائك", activity: "خامات معدنية", governorate: "السويس" },
  { name: "البركة للكيماويات الصناعية", activity: "كيماويات", governorate: "الإسكندرية" },
  { name: "شركة اليسر للمقاولات والصيانة", activity: "صيانة ومقاولات", governorate: "الجيزة" },
  { name: "الحرية للأجهزة الكهربائية", activity: "أجهزة كهربائية", governorate: "القاهرة" },
];

export const CUSTOMER_SEEDS = [
  { name: "شركة النور للتجارة والتوزيع", activity: "تجارة وتوزيع", governorate: "القاهرة", segment: "wholesale" },
  { name: "مجموعة الفتح التجارية", activity: "تجارة تجزئة", governorate: "الجيزة", segment: "retail" },
  { name: "الشركة المتحدة للمقاولات", activity: "مقاولات", governorate: "القاهرة", segment: "corporate" },
  { name: "مؤسسة الأمل للتوريدات", activity: "توريدات", governorate: "الإسكندرية", segment: "wholesale" },
  { name: "شركة الهدى للصناعات الغذائية", activity: "صناعات غذائية", governorate: "المنوفية", segment: "corporate" },
  { name: "سلسلة أسواق الخير", activity: "تجارة تجزئة", governorate: "القاهرة", segment: "retail" },
  { name: "شركة الصفوة للتجارة الدولية", activity: "تصدير واستيراد", governorate: "بورسعيد", segment: "export" },
  { name: "مجموعة الريادة للاستثمار الصناعي", activity: "صناعة", governorate: "الشرقية", segment: "corporate" },
  { name: "مؤسسة البناء الحديث", activity: "مواد بناء", governorate: "الدقهلية", segment: "wholesale" },
  { name: "شركة المستقبل للتوزيع", activity: "توزيع", governorate: "أسيوط", segment: "wholesale" },
  { name: "أسواق النخبة", activity: "تجارة تجزئة", governorate: "الإسكندرية", segment: "retail" },
  { name: "الشركة العربية للتجهيزات", activity: "تجهيزات", governorate: "القاهرة", segment: "corporate" },
  { name: "مجموعة طيبة التجارية", activity: "تجارة عامة", governorate: "الأقصر", segment: "wholesale" },
  { name: "شركة الواحة للتصدير", activity: "تصدير", governorate: "الإسماعيلية", segment: "export" },
  { name: "مؤسسة الإتقان للخدمات", activity: "خدمات", governorate: "الغربية", segment: "corporate" },
];

/* --------------------------------------------------------------------------
   طرق الدفع والبنوك
   -------------------------------------------------------------------------- */

export const PAYMENT_METHODS = [
  { id: "cash", name: "نقدي", nameEn: "Cash", requiresReference: false },
  { id: "bank_transfer", name: "تحويل بنكي", nameEn: "Bank Transfer", requiresReference: true },
  { id: "cheque", name: "شيك", nameEn: "Cheque", requiresReference: true },
  { id: "card", name: "بطاقة بنكية", nameEn: "Card", requiresReference: true },
  { id: "wallet", name: "محفظة إلكترونية", nameEn: "E-Wallet", requiresReference: true },
  { id: "credit", name: "آجل (على الحساب)", nameEn: "On Account", requiresReference: false },
];

export const BANKS = [
  { name: "البنك الأهلي المصري", swift: "NBEGEGCX" },
  { name: "بنك مصر", swift: "BMISEGCX" },
  { name: "البنك التجاري الدولي", swift: "CIBEEGCX" },
  { name: "بنك القاهرة", swift: "CAIREGCX" },
];

/* --------------------------------------------------------------------------
   مساعدات
   -------------------------------------------------------------------------- */

/** يبني اسمًا ثلاثيًا مُختلقًا. */
export function buildName(random, gender) {
  const first = random.pick(gender === "female" ? FIRST_NAMES_FEMALE : FIRST_NAMES_MALE);
  const middle = random.pick(FIRST_NAMES_MALE);
  const family = random.pick(FAMILY_NAMES);
  return `${first} ${middle} ${family}`;
}

/** يضيف أيامًا إلى تاريخ ISO ويُعيد ISO. */
export function addDays(isoDate, days) {
  const date = new Date(`${String(isoDate).slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** يُعيد قائمة الفترات الشهرية (YYYY-MM) من فترة إلى فترة. */
export function monthRange(fromPeriod, toPeriod) {
  const out = [];
  const [fromYear, fromMonth] = String(fromPeriod).split("-").map(Number);
  const [toYear, toMonth] = String(toPeriod).split("-").map(Number);

  let cursor = new Date(Date.UTC(fromYear, fromMonth - 1, 1));
  const end = new Date(Date.UTC(toYear, toMonth - 1, 1));

  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 7));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  return out;
}

/** آخر يوم في شهر (YYYY-MM) بصيغة ISO. */
export function endOfMonth(period) {
  const [year, month] = String(period).split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

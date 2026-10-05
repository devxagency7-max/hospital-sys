/**
 * مولّد عشوائي حتمي للبيانات التجريبية.
 *
 * `Math.random` تُنتج بيانات مختلفة في كل تحديث للصفحة، فيصبح أي فرق في
 * الواجهة غير قابل للتتبّع: هل تغيّر الكود أم تغيّرت البيانات؟ هذا المولّد
 * يُنتج نفس المجموعة في كل مرة، وتغييرها يحتاج تغيير البذرة صراحةً.
 *
 * مهم: كل الأسماء والأرقام هنا مُختلقة بالكامل. ممنوع إدخال بيانات مرضى
 * حقيقية في هذا المجلد (docs/10-PRE-CODING-CHECKLIST.md).
 */

/** mulberry32 — مولّد صغير وسريع وكافٍ لبيانات عرض. */
export function createRandom(seed = 20261005) {
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

    /** تاريخ في المستقبل — لتواريخ الصلاحية والمواعيد. */
    futureDate(minDays, maxDays) {
      const date = new Date(REFERENCE_DATE);
      date.setDate(date.getDate() + this.int(minDays, maxDays));
      return date.toISOString().slice(0, 10);
    },

    /** رقم موبايل مصري مُختلق. */
    phone() {
      const prefix = this.pick(["010", "011", "012", "015"]);
      return prefix + String(this.int(10000000, 99999999));
    },
  };
}

/**
 * تاريخ مرجعي ثابت.
 * لو استخدمنا `new Date()` لتحوّلت «فاتورة متأخرة 20 يومًا» إلى 400 يوم بعد
 * عام، فتفقد البيانات معناها. التثبيت يجعل المجموعة مفهومة دائمًا.
 */
export const REFERENCE_DATE = new Date("2026-10-05T09:00:00+03:00");

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

export const DEPARTMENTS = [
  { id: 1, name: "الباطنة" },
  { id: 2, name: "الجراحة العامة" },
  { id: 3, name: "الأطفال" },
  { id: 4, name: "النساء والتوليد" },
  { id: 5, name: "العظام" },
  { id: 6, name: "القلب والأوعية الدموية" },
  { id: 7, name: "الأنف والأذن والحنجرة" },
  { id: 8, name: "الجلدية" },
  { id: 9, name: "المسالك البولية" },
  { id: 10, name: "الرمد" },
  { id: 11, name: "الأسنان" },
  { id: 12, name: "الطوارئ" },
];

export const DOCTORS = [
  { id: 1, name: "د. سامي عبدالفتاح", departmentId: 1, title: "استشاري باطنة" },
  { id: 2, name: "د. منال الشاذلي", departmentId: 4, title: "استشاري نساء وتوليد" },
  { id: 3, name: "د. عمرو حجازي", departmentId: 2, title: "استشاري جراحة عامة" },
  { id: 4, name: "د. هالة سعيد", departmentId: 3, title: "استشاري أطفال" },
  { id: 5, name: "د. طارق المنشاوي", departmentId: 5, title: "استشاري عظام" },
  { id: 6, name: "د. ياسر قنديل", departmentId: 6, title: "استشاري قلب" },
  { id: 7, name: "د. نيفين رشاد", departmentId: 8, title: "أخصائي جلدية" },
  { id: 8, name: "د. مجدي الأبيض", departmentId: 9, title: "استشاري مسالك" },
  { id: 9, name: "د. شيرين فؤاد", departmentId: 10, title: "أخصائي رمد" },
  { id: 10, name: "د. كمال الديب", departmentId: 12, title: "استشاري طوارئ" },
];

export const WAREHOUSES = [
  { id: 1, code: "WH-MAIN", name: "المخزن الرئيسي" },
  { id: 2, code: "WH-PHAR", name: "مخزن الصيدلية" },
  { id: 3, code: "WH-LAB", name: "مخزن المختبر" },
  { id: 4, code: "WH-RAD", name: "مخزن الأشعة" },
  { id: 5, code: "WH-OR", name: "مخزن غرف العمليات" },
];

export const SUPPLIERS = [
  { id: 1, code: "SUP-001", name: "شركة النيل للأدوية", phone: "0223456789" },
  { id: 2, code: "SUP-002", name: "المصرية للمستلزمات الطبية", phone: "0227654321" },
  { id: 3, code: "SUP-003", name: "دلتا فارما للتوزيع", phone: "0402345678" },
  { id: 4, code: "SUP-004", name: "الأهرام للأجهزة الطبية", phone: "0233445566" },
  { id: 5, code: "SUP-005", name: "مجموعة الشفاء الطبية", phone: "0225556677" },
];

export const PAYMENT_METHODS = [
  { id: "cash", name: "نقدي" },
  { id: "card", name: "بطاقة بنكية" },
  { id: "transfer", name: "تحويل بنكي" },
  { id: "wallet", name: "محفظة إلكترونية" },
  { id: "insurance", name: "تأمين" },
];

export const SERVICES = [
  { id: 1, code: "SRV-001", name: "استشارة عيادة خارجية", price: 250, category: "عيادات" },
  { id: 2, code: "SRV-002", name: "إعادة استشارة", price: 150, category: "عيادات" },
  { id: 3, code: "SRV-003", name: "كشف طوارئ", price: 300, category: "طوارئ" },
  { id: 4, code: "SRV-004", name: "صورة دم كاملة (CBC)", price: 180, category: "مختبر" },
  { id: 5, code: "SRV-005", name: "وظائف كبد", price: 260, category: "مختبر" },
  { id: 6, code: "SRV-006", name: "وظائف كلى", price: 240, category: "مختبر" },
  { id: 7, code: "SRV-007", name: "سكر صائم", price: 90, category: "مختبر" },
  { id: 8, code: "SRV-008", name: "أشعة صدر", price: 320, category: "أشعة" },
  { id: 9, code: "SRV-009", name: "أشعة مقطعية على البطن", price: 1850, category: "أشعة" },
  { id: 10, code: "SRV-010", name: "رنين مغناطيسي على المخ", price: 3200, category: "أشعة" },
  { id: 11, code: "SRV-011", name: "موجات صوتية على البطن", price: 450, category: "أشعة" },
  { id: 12, code: "SRV-012", name: "رسم قلب بالمجهود", price: 700, category: "قلب" },
  { id: 13, code: "SRV-013", name: "إقامة غرفة خاصة / ليلة", price: 1200, category: "إقامة" },
  { id: 14, code: "SRV-014", name: "إقامة رعاية مركزة / ليلة", price: 4500, category: "إقامة" },
  { id: 15, code: "SRV-015", name: "عملية استئصال مرارة بالمنظار", price: 18000, category: "عمليات" },
  { id: 16, code: "SRV-016", name: "عملية ولادة قيصرية", price: 14000, category: "عمليات" },
  { id: 17, code: "SRV-017", name: "تركيب شريحة عظام", price: 22000, category: "عمليات" },
  { id: 18, code: "SRV-018", name: "جلسة علاج طبيعي", price: 200, category: "علاج طبيعي" },
];

/** يبني اسمًا ثلاثيًا مُختلقًا. */
export function buildName(random, gender) {
  const first = random.pick(gender === "female" ? FIRST_NAMES_FEMALE : FIRST_NAMES_MALE);
  const middle = random.pick(FIRST_NAMES_MALE);
  const family = random.pick(FAMILY_NAMES);
  return `${first} ${middle} ${family}`;
}

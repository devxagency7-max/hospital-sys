/**
 * أصناف ومخزون تجريبي.
 *
 * حالة الصنف مشتقة من الكمية مقابل حد الطلب، لا مستقلة عنها — حتى لا يظهر صنف
 * بـ «رصيد منخفض» وكميته 400.
 */

import { createRandom, WAREHOUSES, SUPPLIERS, REFERENCE_DATE } from "./seed.js";
import * as money from "../core/money.js";

export const itemCategories = [
  { id: 1, name: "أدوية", code: "MED" },
  { id: 2, name: "مستلزمات طبية", code: "SUP" },
  { id: 3, name: "كواشف مختبر", code: "LAB" },
  { id: 4, name: "أفلام ومواد أشعة", code: "RAD" },
  { id: 5, name: "مستهلكات غرف عمليات", code: "OPR" },
  { id: 6, name: "قرطاسية وإدارية", code: "ADM" },
];

export const units = [
  { id: 1, name: "علبة", code: "BOX" },
  { id: 2, name: "شريط", code: "STR" },
  { id: 3, name: "قرص", code: "TAB" },
  { id: 4, name: "أمبول", code: "AMP" },
  { id: 5, name: "زجاجة", code: "BTL" },
  { id: 6, name: "عبوة", code: "PCK" },
  { id: 7, name: "قطعة", code: "PCS" },
  { id: 8, name: "كيس", code: "BAG" },
];

export const warehouses = WAREHOUSES;
export const suppliers = SUPPLIERS;

/** أسماء أصناف واقعية لكل تصنيف. */
const CATALOG = {
  1: [
    "باراسيتامول 500 مجم", "أموكسيسيلين 500 مجم", "أوميبرازول 20 مجم",
    "ميتفورمين 850 مجم", "أملوديبين 5 مجم", "أتورفاستاتين 20 مجم",
    "ديكلوفيناك صوديوم أمبول", "سيفترياكسون 1 جم فيال", "سالبوتامول بخاخ",
    "إنسولين جلارجين قلم", "وارفارين 5 مجم", "ليفوفلوكساسين 500 مجم",
    "محلول ملح 0.9% 500 مل", "محلول رينجر لاكتات 500 مل", "هيبارين 5000 وحدة",
    "ديكساميثازون أمبول", "رانيتيدين 150 مجم", "بريدنيزولون 5 مجم",
    "فيتامين د3 50000 وحدة", "حمض الفوليك 5 مجم",
  ],
  2: [
    "قفازات فحص لاتكس مقاس M", "قفازات جراحية معقمة 7.5", "كمامة جراحية 3 طبقات",
    "سرنجة 5 مل", "سرنجة 10 مل", "كانيولا وريدية 20G", "شاش معقم 10×10",
    "لاصق طبي 2.5 سم", "قطن طبي 500 جم", "محلول بوفيدون أيودين 500 مل",
    "كيس بول معقم", "أنبوبة أكسجين أنفية", "ترمومتر رقمي",
    "جهاز قياس ضغط ديجيتال", "مشمع سرير يستخدم مرة واحدة",
  ],
  3: [
    "كاشف صورة دم كاملة", "كاشف وظائف كبد", "كاشف وظائف كلى",
    "شرائط سكر الدم", "أنابيب EDTA بنفسجية", "أنابيب سيرم صفراء",
    "محلول معايرة كيميائي", "كاشف HbA1c", "وسط استنبات بكتيري",
  ],
  4: [
    "فيلم أشعة 35×43 سم", "فيلم أشعة 24×30 سم", "صبغة غير أيونية 100 مل",
    "جيل موجات صوتية 5 لتر", "ورق طباعة سونار", "درع رصاصي واقي",
  ],
  5: [
    "خيط جراحي فيكريل 2/0", "خيط جراحي حريري 3/0", "مشرط جراحي مقاس 11",
    "دباسة جلد جراحية", "دريب جراحي معقم", "أنبوبة شفط جراحي",
    "شاش لاباروسكوبي", "كيس نفايات طبية خطرة",
  ],
  6: [
    "ورق A4 80 جم", "أحبار طابعة ليزر أسود", "ملف مريض كرتوني",
    "دباسة مكتبية", "أسطوانة ورق حراري للكاشير",
  ],
};

function generateItems() {
  const random = createRandom(330_091);
  const items = [];
  let id = 3001;

  for (const category of itemCategories) {
    for (const name of CATALOG[category.id]) {
      const minimumQuantity = random.pick([10, 20, 30, 50, 100]);

      // توزيع الكميات مقصود: أغلب الأصناف سليمة، وبعضها منخفض أو نافد —
      // حتى تُظهر لوحة التحكم تنبيهات حقيقية بدل قوائم فارغة.
      const level = random.pickWeighted([
        ["healthy", 68],
        ["low", 22],
        ["out", 10],
      ]);

      const quantity =
        level === "out"
          ? 0
          : level === "low"
            ? random.int(1, minimumQuantity)
            : random.int(minimumQuantity + 1, minimumQuantity * 8);

      const costPrice = money.round(
        category.id === 1 ? random.money(4, 320) : random.money(1.5, 1400),
      );

      items.push({
        id: id++,
        code: `${category.code}-${String(id - 3000).padStart(3, "0")}`,
        name,
        categoryId: category.id,
        category: category.name,
        unitId: random.pick(units).id,
        unit: random.pick(units).name,
        quantity,
        minimumQuantity,
        reorderQuantity: minimumQuantity * 3,
        costPrice,
        sellingPrice: money.multiply(costPrice, random.pick([1.2, 1.3, 1.45, 1.6])),
        warehouseId: random.pick(warehouses).id,
        preferredSupplierId: random.pick(suppliers).id,
        /** يُشتق في `db.js` — لا نثبّته هنا لئلا يتناقض مع الكمية بعد أي حركة. */
        status: null,
        tracksBatches: category.id === 1 || category.id === 3,
        isActive: random.chance(0.95),
      });
    }
  }

  return items;
}

export const items = generateItems();

/** تشغيلات (batches) للأصناف التي تتبع تاريخ صلاحية. */
export const batches = (() => {
  const random = createRandom(550_019);
  const out = [];
  let id = 40_001;

  for (const item of items.filter((candidate) => candidate.tracksBatches)) {
    const count = random.int(1, 3);

    for (let index = 0; index < count; index += 1) {
      // بعض التشغيلات منتهية وبعضها قارب الانتهاء — مادة تنبيهات الصلاحية.
      const horizon = random.pickWeighted([
        ["expired", 12],
        ["near", 22],
        ["fine", 66],
      ]);

      const expiryDate =
        horizon === "expired"
          ? random.date(random.int(10, 240))
          : horizon === "near"
            ? random.futureDate(1, 75)
            : random.futureDate(180, 900);

      out.push({
        id: id++,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        batchNumber: `B-${random.int(10000, 99999)}`,
        quantity: Math.max(0, Math.floor(item.quantity / count)),
        expiryDate,
        warehouseId: item.warehouseId,
        supplierId: item.preferredSupplierId,
        receivedAt: random.date(random.int(30, 500)),
      });
    }
  }

  return out;
})();

/** حركات مخزنية — سجل لا يُحذف منه (docs/07-FRONTEND-RULES.md). */
export const stockMovements = (() => {
  const random = createRandom(660_041);
  const out = [];
  let id = 80_001;

  for (let index = 0; index < 320; index += 1) {
    const item = random.pick(items);
    const type = random.pickWeighted([
      ["issue", 44],
      ["receipt", 30],
      ["transfer", 14],
      ["adjustment", 8],
      ["return", 4],
    ]);

    const quantity = random.int(1, 40);
    const signedQuantity = type === "receipt" || type === "return" ? quantity : -quantity;

    out.push({
      id: id++,
      reference: `MV-${String(index + 1).padStart(5, "0")}`,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      type,
      quantity,
      signedQuantity,
      unitCost: item.costPrice,
      totalCost: money.multiply(item.costPrice, quantity),
      warehouseId: item.warehouseId,
      toWarehouseId: type === "transfer" ? random.pick(warehouses).id : null,
      date: random.dateTime(random.int(0, 180)),
      performedBy: random.pick(["عبدالله محمد", "سعاد مرسي", "خالد عطية", "منى شاكر"]),
      status: type === "adjustment" ? random.pickWeighted([["approved", 7], ["pending", 3]]) : "approved",
      notes: null,
    });
  }

  return out.sort((a, b) => b.date.localeCompare(a.date));
})();

/** يصنّف حالة الصنف من الكمية — مصدر الحقيقة الوحيد لحالة المخزون. */
export function deriveItemStatus(item) {
  if (!item.isActive) return "inactive";
  if (item.quantity <= 0) return "out_of_stock";
  if (item.quantity <= item.minimumQuantity) return "low_stock";
  return "available";
}

/** يصنّف حالة التشغيلة من تاريخ الصلاحية. */
export function deriveBatchStatus(batch, referenceDate = REFERENCE_DATE) {
  const expiry = new Date(batch.expiryDate);
  const daysLeft = Math.ceil((expiry - referenceDate) / 86_400_000);

  if (daysLeft < 0) return "expired";
  if (daysLeft <= 90) return "near_expiry";
  return "available";
}

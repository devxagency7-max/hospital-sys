/**
 * بيانات المخازن التجريبية:
 * الأصناف والتصنيفات والوحدات، المخازن، الحركات، التشغيلات، والجرد الفعلي.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  هذا الملف هو **مصدر الحقيقة لأرصدة المخزون**، ودفتر الأستاذ يتبعه.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * الاتجاه مقصود وهو عكس بقية الموديولات: في المحاسبة المالية تُشتقّ أرصدة
 * العملاء والبنوك من الدفتر، أما المخزون فالعكس — الكمية والتكلفة واقعة
 * مادية يملكها المخزن، والحساب الرقابي يجب أن يتبعها. لذلك هذا الملف لا
 * يستورد من js/mock/accounting.mock.js، بل يُصدِّر `inventoryClosingByAccount`
 * ويقرأها القيد الافتتاحي في الدفتر.
 *
 * الاتجاه المعاكس كان سيجعل «قيمة المخزون» في التقرير رقمًا مُجبرًا على
 * مطابقة الدفتر بدل أن يكون ناتج تقييم الحركات فعلًا — وهو ما يُفقد محرك
 * التقييم (FIFO / المتوسط المرجّح) معناه كله.
 */

import * as money from "../core/money.js";
import {
  createRandom,
  REFERENCE_DATE,
  WAREHOUSES,
  UNITS,
  ITEM_CATEGORIES,
  addDays,
} from "./seed.js";
import { valuate, deriveStockStatus, deriveBatchStatus, MOVEMENT_LABELS } from "../domain/valuation.js";

const random = createRandom(884_117);
const TODAY = REFERENCE_DATE.toISOString().slice(0, 10);

/** مُعاد تصديرها لتبقى مصدرًا واحدًا. */
export const warehouses = WAREHOUSES;
export const units = UNITS;
export const itemCategories = ITEM_CATEGORIES;

/* ============================================================================
   1. كتالوج الأصناف
   ============================================================================ */

/**
 * بذور الأصناف: اسم عربي وإنجليزي، تصنيف، وحدة، ونطاق تكلفة.
 * `tracking` يحدد ما يحتاجه الصنف: تشغيلات، صلاحية، أو أرقام تسلسلية.
 */
const ITEM_SEEDS = [
  /* --- أدوية أقراص وكبسولات --- */
  { name: "أموكسيسيلين 500 مج — علبة 30 كبسولة", nameEn: "Amoxicillin 500mg — 30 Caps", categoryId: 2, unitId: 1, cost: [38, 46], tracking: ["batch"] },
  { name: "باراسيتامول 500 مج — علبة 20 قرصًا", nameEn: "Paracetamol 500mg — 20 Tabs", categoryId: 2, unitId: 1, cost: [40, 48], tracking: ["batch"] },
  { name: "أوميبرازول 20 مج — علبة", nameEn: "Omeprazole 20mg Pack", categoryId: 2, unitId: 1, cost: [85, 105], tracking: ["batch"] },
  { name: "مضاد فيروسات — علبة أقراص", nameEn: "Antiviral Tablets Pack", categoryId: 2, unitId: 1, cost: [420, 480], tracking: ["batch"] },
  { name: "مكمل غذائي كالسيوم — علبة", nameEn: "Calcium Supplement Pack", categoryId: 2, unitId: 1, cost: [62, 74], tracking: [] },
  { name: "إيبوبروفين 400 مج — علبة", nameEn: "Ibuprofen 400mg Pack", categoryId: 2, unitId: 1, cost: [96, 118], tracking: ["batch"] },

  /* --- حقن ومحاليل وريدية --- */
  { name: "محلول ملح 0.9% — كيس 500 مل", nameEn: "Normal Saline 0.9% 500ml", categoryId: 3, unitId: 1, cost: [52, 62], tracking: ["batch", "expiry"] },
  { name: "محلول جلوكوز 5% — كيس 500 مل", nameEn: "Dextrose 5% 500ml", categoryId: 3, unitId: 1, cost: [48, 58], tracking: ["batch", "expiry"] },
  { name: "حقن سيفترياكسون 1 جم", nameEn: "Ceftriaxone 1g Vial", categoryId: 3, unitId: 1, cost: [180, 220], tracking: ["batch", "expiry"] },
  { name: "حقن مسكّن — أمبول", nameEn: "Analgesic Ampoule", categoryId: 3, unitId: 1, cost: [185, 225], tracking: ["batch", "expiry"] },
  { name: "أنسولين سريع المفعول — فيال", nameEn: "Rapid Insulin Vial", categoryId: 3, unitId: 1, cost: [310, 380], tracking: ["batch", "expiry"] },

  /* --- تعقيم وضمادات --- */
  { name: "شاش طبي معقم — لفة", nameEn: "Sterile Gauze Roll", categoryId: 4, unitId: 10, cost: [14, 19], tracking: [] },
  { name: "ضمادات جروح متنوعة — علبة", nameEn: "Assorted Wound Dressings", categoryId: 4, unitId: 1, cost: [9, 13], tracking: [] },
  { name: "بلاستر طبي لاصق — لفة", nameEn: "Medical Adhesive Tape", categoryId: 4, unitId: 10, cost: [22, 30], tracking: [] },
  { name: "قطن طبي — عبوة", nameEn: "Medical Cotton Pack", categoryId: 4, unitId: 4, cost: [58, 70], tracking: [] },
  { name: "أغلفة تعقيم للأدوات — لفة", nameEn: "Sterilization Wrap Roll", categoryId: 4, unitId: 10, cost: [34, 44], tracking: [] },
  { name: "صناديق تعقيم ستانلس", nameEn: "Stainless Sterilization Box", categoryId: 4, unitId: 1, cost: [160, 200], tracking: [] },

  /* --- مستلزمات العمليات والرعاية الحرجة --- */
  { name: "جهاز مراقبة مؤشرات حيوية", nameEn: "Vital Signs Monitor", categoryId: 5, unitId: 1, cost: [8_400, 9_800], tracking: ["serial"] },
  { name: "جهاز تنفس صناعي محمول", nameEn: "Portable Ventilator", categoryId: 5, unitId: 1, cost: [14_500, 16_800], tracking: ["serial"] },
  { name: "طقم أدوات جراحة عامة", nameEn: "General Surgery Instrument Set", categoryId: 5, unitId: 1, cost: [1_850, 2_200], tracking: ["batch"] },
  { name: "خيوط جراحية ماصة — عبوة", nameEn: "Absorbable Sutures Pack", categoryId: 5, unitId: 1, cost: [980, 1_200], tracking: ["batch"] },
  { name: "أنابيب تخدير وتنفس — عبوة", nameEn: "Anesthesia Breathing Tubes", categoryId: 5, unitId: 1, cost: [46, 58], tracking: ["batch"] },
  { name: "مشارط جراحية معقمة — عبوة", nameEn: "Sterile Scalpels Pack", categoryId: 5, unitId: 1, cost: [620, 760], tracking: [] },

  /* --- مستهلكات طبية عامة --- */
  { name: "جهاز قياس ضغط رقمي", nameEn: "Digital BP Monitor", categoryId: 6, unitId: 1, cost: [2_400, 2_900], tracking: ["serial"] },
  { name: "جهاز قياس سكر الدم", nameEn: "Glucometer", categoryId: 6, unitId: 1, cost: [3_900, 4_600], tracking: ["serial"] },
  { name: "سرنجات 5 مل — كرتونة", nameEn: "Syringes 5ml — Box", categoryId: 6, unitId: 2, cost: [52, 64], tracking: ["batch"] },
  { name: "سرنجات 10 مل — كرتونة", nameEn: "Syringes 10ml — Box", categoryId: 6, unitId: 2, cost: [78, 94], tracking: ["batch"] },
  { name: "كانيولا وريدية — علبة", nameEn: "IV Cannula Box", categoryId: 6, unitId: 1, cost: [740, 920], tracking: [] },
  { name: "قسطرة بولية — علبة", nameEn: "Urinary Catheter Box", categoryId: 6, unitId: 1, cost: [118, 145], tracking: [] },
  { name: "أطقم محاليل وريدية — طقم", nameEn: "IV Administration Sets", categoryId: 6, unitId: 9, cost: [240, 310], tracking: [] },
  { name: "كمامات طبية — علبة 50", nameEn: "Medical Masks 50-pack", categoryId: 6, unitId: 1, cost: [38, 48], tracking: [] },
  { name: "واقيات وجه طبية", nameEn: "Medical Face Shields", categoryId: 6, unitId: 1, cost: [420, 520], tracking: [] },

  /* --- قطع غيار الأجهزة الطبية --- */
  { name: "حساس أكسجين لجهاز تنفس", nameEn: "Ventilator O2 Sensor", categoryId: 7, unitId: 1, cost: [380, 460], tracking: [] },
  { name: "بطارية جهاز مراقبة", nameEn: "Monitor Battery", categoryId: 7, unitId: 1, cost: [95, 125], tracking: [] },
  { name: "فلتر جهاز غسيل كلوي", nameEn: "Dialysis Filter", categoryId: 7, unitId: 1, cost: [210, 265], tracking: ["expiry"] },
  { name: "جل الموجات فوق الصوتية", nameEn: "Ultrasound Gel", categoryId: 7, unitId: 6, cost: [92, 118], tracking: ["batch", "expiry"] },
  { name: "وصلات وأسلاك أجهزة — طقم", nameEn: "Device Cables Set", categoryId: 7, unitId: 9, cost: [140, 180], tracking: [] },
  { name: "إلكترودات رسم قلب — عبوة", nameEn: "ECG Electrodes Pack", categoryId: 7, unitId: 1, cost: [68, 88], tracking: [] },

  /* --- مستلزمات مكتبية --- */
  { name: "ورق طباعة A4 — رزمة", nameEn: "A4 Paper Ream", categoryId: 8, unitId: 1, cost: [128, 155], tracking: [] },
  { name: "حبر طابعة ليزر أسود", nameEn: "Laser Toner Black", categoryId: 8, unitId: 1, cost: [1_150, 1_400], tracking: ["expiry"] },
  { name: "أقلام جاف — عبوة 50", nameEn: "Ballpoint Pens 50-pack", categoryId: 8, unitId: 1, cost: [78, 96], tracking: [] },
  { name: "ملفات وحوافظ مستندات", nameEn: "File Folders", categoryId: 8, unitId: 1, cost: [16, 22], tracking: [] },
  { name: "دباسات ومشابك", nameEn: "Staplers & Clips", categoryId: 8, unitId: 9, cost: [110, 140], tracking: [] },

  /* --- نظافة وتطهير --- */
  { name: "منظّف أرضيات طبي", nameEn: "Hospital Floor Cleaner", categoryId: 9, unitId: 6, cost: [42, 54], tracking: ["expiry"] },
  { name: "مطهّر أسطح طبي", nameEn: "Medical Surface Disinfectant", categoryId: 9, unitId: 6, cost: [58, 72], tracking: ["expiry"] },
  { name: "أكياس نفايات طبية حمراء", nameEn: "Red Biohazard Bags", categoryId: 9, unitId: 10, cost: [36, 46], tracking: [] },
  { name: "قفازات نيتريل — كرتونة", nameEn: "Nitrile Gloves Box", categoryId: 9, unitId: 2, cost: [52, 66], tracking: [] },
  { name: "أغطية أحذية ورؤوس — عبوة", nameEn: "Shoe & Head Covers Pack", categoryId: 9, unitId: 1, cost: [180, 230], tracking: [] },

  /* --- أجهزة ومعدات طبية --- */
  { name: "جهاز أشعة محمول", nameEn: "Portable X-Ray Unit", categoryId: 10, unitId: 1, cost: [18_500, 22_000], tracking: ["serial"] },
  { name: "جهاز تعقيم بالبخار (أوتوكلاف)", nameEn: "Steam Autoclave", categoryId: 10, unitId: 1, cost: [4_200, 5_100], tracking: ["serial"] },
];

/**
 * المخزن الافتراضي لكل تصنيف — الصنف يسكن المخزن المناسب لطبيعته.
 * توزيع الأصناف عشوائيًا على المخازن يُنتج خامات في مخزن المستلزمات المكتبية.
 */
const CATEGORY_WAREHOUSES = {
  2: [2], 3: [2], 4: [2, 1], 5: [3], 6: [1], 7: [4], 8: [6], 9: [6, 1], 10: [1],
};

export const items = ITEM_SEEDS.map((seed, index) => {
  const id = index + 1;
  const unit = UNITS.find((row) => row.id === seed.unitId);
  const category = ITEM_CATEGORIES.find((row) => row.id === seed.categoryId);
  const costPrice = money.round(random.money(seed.cost[0], seed.cost[1]));

  /* هامش ربح معقول حسب طبيعة الصنف. */
  const margin = seed.categoryId === 6 ? random.money(0.22, 0.38) : random.money(0.15, 0.3);

  /*
   * الحد الأدنى يُشتق من **قيمة** المخزون المستهدفة للصنف لا من رقم مُنتقى
   * عشوائيًا: المنشأة تربط حدودها بالمال المُجمَّد لا بعدد القطع. اختيار الحد
   * عشوائيًا (20…500 قطعة) يعطي 500 مولّد كهربائي بـ 22 ألف جنيه للواحد —
   * أحد عشر مليونًا في صنف واحد، وإجمالي مخزون يتجاوز إيراد السنة كله.
   *
   * القيمة المستهدفة للصنف 8–25 ألف جنيه لكل «حد أدنى»، فيستقر إجمالي
   * المخزون حول ثلاثة أشهر من تكلفة المبيعات — وهي النسبة المعتادة.
   */
  const targetStockValue = random.money(8_000, 25_000);
  const minLevel = Math.min(600, Math.max(2, Math.round(targetStockValue / costPrice)));

  return {
    id,
    code: `ITM-${String(id).padStart(4, "0")}`,
    barcode: `62${String(random.int(10_000_000_000, 99_999_999_999))}`,
    name: seed.name,
    nameEn: seed.nameEn,
    categoryId: seed.categoryId,
    category: category?.name ?? "—",
    unitId: seed.unitId,
    unit: unit?.name ?? "—",
    unitCode: unit?.code ?? "—",
    decimals: unit?.decimals ?? 0,

    costPrice,
    sellingPrice: money.round(costPrice * (1 + margin)),
    lastPurchasePrice: money.round(costPrice * random.money(0.95, 1.06)),
    /** طريقة التقييم لكل صنف — تغلب على طريقة المخزن. */
    costingMethod: [2, 3, 5].includes(seed.categoryId) ? "fifo" : "weighted_average",

    minLevel,
    maxLevel: minLevel * random.int(12, 20),
    reorderPoint: Math.round(minLevel * 1.4),
    leadTimeDays: random.int(3, 25),

    trackBatches: seed.tracking.includes("batch"),
    trackExpiry: seed.tracking.includes("expiry"),
    trackSerials: seed.tracking.includes("serial"),

    /** المخازن المسموح تخزين الصنف فيها. */
    warehouseIds: CATEGORY_WAREHOUSES[seed.categoryId] ?? [1],
    defaultWarehouseId: (CATEGORY_WAREHOUSES[seed.categoryId] ?? [1])[0],
    inventoryAccountId: category?.inventoryAccountId ?? 11411,

    taxId: 1,
    imageUrl: null,
    isSellable: [5, 6].includes(seed.categoryId),
    isPurchasable: true,
    createdAt: random.date(900, 200),
    status: random.chance(0.96) ? "active" : "inactive",
    notes: null,
  };
});

/* ============================================================================
   2. حركات المخزون

   التوليد زمني: رصيد افتتاحي، ثم إضافات وصرف وتحويلات وتسويات على مدار
   السنة. التقييم كله في js/domain/valuation.js — هذا الملف يُنتج الحركات
   فقط ولا يحسب تكلفة صرف واحدة بنفسه.
   ============================================================================ */

const warehouseById = new Map(WAREHOUSES.map((warehouse) => [warehouse.id, warehouse]));

export const stockMovements = (() => {
  const out = [];
  let id = 0;
  let documentSequence = { receipt: 0, issue: 0, transfer: 0, adjustment: 0, return_in: 0 };

  const push = (movement) => {
    id += 1;
    out.push({ id, ...movement });
  };

  for (const item of items) {
    for (const warehouseId of item.warehouseIds) {
      const warehouse = warehouseById.get(warehouseId);
      /* الصنف الثانوي في مخزن إضافي يحمل كميات أقل. */
      const isPrimary = warehouseId === item.defaultWarehouseId;
      const scale = isPrimary ? 1 : 0.35;

      /* --- الرصيد الافتتاحي --- */
      const openingQty = Math.max(
        1,
        Math.round(item.minLevel * random.money(2.5, 6) * scale),
      );

      push({
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        warehouseId,
        warehouseName: warehouse?.name ?? "—",
        type: "opening",
        typeLabel: MOVEMENT_LABELS.opening,
        date: "2026-01-01",
        quantity: openingQty,
        unitCost: money.round(item.costPrice * random.money(0.9, 0.98)),
        reference: "OB-2026",
        documentType: "opening_balance",
        batchNumber: item.trackBatches ? `B-2025-${String(random.int(100, 999))}` : null,
        performedBy: "أمين مخزن / وليد البحيري",
        notes: null,
      });

      /* --- إضافات الشراء خلال السنة --- */
      const receiptCount = random.int(2, 6);
      for (let index = 0; index < receiptCount; index += 1) {
        documentSequence.receipt += 1;
        const date = random.date(300, 3);

        push({
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          warehouseId,
          warehouseName: warehouse?.name ?? "—",
          type: "receipt",
          typeLabel: MOVEMENT_LABELS.receipt,
          date,
          quantity: Math.max(1, Math.round(item.minLevel * random.money(1.5, 4) * scale)),
          /* تكلفة الشراء تتغيّر بين الشحنات — وهذا ما يجعل FIFO يختلف عن المتوسط. */
          unitCost: money.round(item.costPrice * random.money(0.92, 1.14)),
          reference: `GRN-2026-${String(documentSequence.receipt).padStart(4, "0")}`,
          documentType: "goods_receipt",
          supplierId: random.int(1, 12),
          batchNumber: item.trackBatches ? `B-2026-${String(random.int(1000, 9999))}` : null,
          expiryDate: item.trackExpiry ? random.futureDate(-60, 600) : null,
          performedBy: "أمين مخزن / وليد البحيري",
          notes: null,
        });
      }

      /* --- الصرف --- */
      const issueCount = random.int(3, 9);
      for (let index = 0; index < issueCount; index += 1) {
        documentSequence.issue += 1;

        push({
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          warehouseId,
          warehouseName: warehouse?.name ?? "—",
          type: "issue",
          typeLabel: MOVEMENT_LABELS.issue,
          date: random.date(290, 2),
          quantity: Math.max(1, Math.round(item.minLevel * random.money(0.5, 1.8) * scale)),
          /**
           * التكلفة **لا تُكتب** في حركة الصرف: محرك التقييم يحسبها من
           * الطبقات. كتابتها هنا تعني مصدر حقيقة ثانيًا يخالف ما يُرحَّل.
           */
          unitCost: null,
          reference: `ISS-2026-${String(documentSequence.issue).padStart(4, "0")}`,
          documentType: "goods_issue",
          reason: random.pick([
            "صرف للأقسام الداخلية",
            "صرف للعيادات الخارجية",
            "صرف لغرف العمليات",
            "استهلاك إداري",
            "صرف للصيانة",
          ]),
          costCenterId: random.pick([4, 6, 7, 7, 1]),
          performedBy: "أمين مخزن / وليد البحيري",
          notes: null,
        });
      }
    }
  }

  /* --- تحويلات بين المخازن --- */
  for (let index = 0; index < 14; index += 1) {
    documentSequence.transfer += 1;
    const item = random.pick(items.filter((row) => row.warehouseIds.length > 1));
    if (!item) continue;

    const [fromWarehouseId, toWarehouseId] = random.sample(item.warehouseIds, 2);
    if (!toWarehouseId) continue;

    const date = random.date(200, 2);
    const quantity = Math.max(1, Math.round(item.minLevel * random.money(0.2, 0.6)));
    const reference = `TRN-2026-${String(documentSequence.transfer).padStart(4, "0")}`;

    /*
     * التحويل حركتان لا واحدة: صادرة من المخزن الأول وواردة إلى الثاني،
     * بنفس المرجع. حركة واحدة بحقلي «من» و«إلى» تكسر كل تقييم يعمل على
     * (صنف × مخزن) — وهو التقييم الصحيح الوحيد.
     */
    push({
      itemId: item.id, itemCode: item.code, itemName: item.name,
      warehouseId: fromWarehouseId, warehouseName: warehouseById.get(fromWarehouseId)?.name ?? "—",
      type: "transfer_out", typeLabel: MOVEMENT_LABELS.transfer_out,
      date, quantity, unitCost: null,
      reference, documentType: "stock_transfer",
      counterWarehouseId: toWarehouseId,
      counterWarehouseName: warehouseById.get(toWarehouseId)?.name ?? "—",
      performedBy: "أمين مخزن / وليد البحيري", notes: null,
    });

    push({
      itemId: item.id, itemCode: item.code, itemName: item.name,
      warehouseId: toWarehouseId, warehouseName: warehouseById.get(toWarehouseId)?.name ?? "—",
      type: "transfer_in", typeLabel: MOVEMENT_LABELS.transfer_in,
      date, quantity,
      /* الوارد يدخل بتكلفة الصادر — يُعاد ضبطها بعد التقييم أدناه. */
      unitCost: item.costPrice,
      reference, documentType: "stock_transfer",
      counterWarehouseId: fromWarehouseId,
      counterWarehouseName: warehouseById.get(fromWarehouseId)?.name ?? "—",
      performedBy: "أمين مخزن / وليد البحيري", notes: null,
    });
  }

  /* --- تسويات الجرد --- */
  for (let index = 0; index < 11; index += 1) {
    documentSequence.adjustment += 1;
    const item = random.pick(items);
    const warehouseId = item.defaultWarehouseId;
    const increase = random.chance(0.35);

    push({
      itemId: item.id, itemCode: item.code, itemName: item.name,
      warehouseId, warehouseName: warehouseById.get(warehouseId)?.name ?? "—",
      type: increase ? "adjustment_in" : "adjustment_out",
      typeLabel: increase ? MOVEMENT_LABELS.adjustment_in : MOVEMENT_LABELS.adjustment_out,
      date: random.date(150, 5),
      quantity: Math.max(1, Math.round(item.minLevel * random.money(0.03, 0.15))),
      unitCost: increase ? money.round(item.costPrice) : null,
      reference: `ADJ-2026-${String(documentSequence.adjustment).padStart(4, "0")}`,
      documentType: "stock_adjustment",
      reason: increase
        ? random.pick(["زيادة جرد — خطأ تسجيل سابق", "استرجاع كمية غير مُسجَّلة"])
        : random.pick(["تلف أثناء التخزين", "عجز جرد", "كسر ومهملات", "انتهاء صلاحية"]),
      approvedBy: "مدير المخازن / نادر سليمان",
      performedBy: "المراجع الداخلي / نادر الفقي",
      notes: null,
    });
  }

  /* --- مرتجعات واردة من العملاء --- */
  for (let index = 0; index < 6; index += 1) {
    documentSequence.return_in += 1;
    const item = random.pick(items.filter((row) => row.isSellable));

    push({
      itemId: item.id, itemCode: item.code, itemName: item.name,
      warehouseId: item.defaultWarehouseId,
      warehouseName: warehouseById.get(item.defaultWarehouseId)?.name ?? "—",
      type: "return_in", typeLabel: MOVEMENT_LABELS.return_in,
      date: random.date(90, 2),
      quantity: Math.max(1, Math.round(item.minLevel * random.money(0.05, 0.2))),
      unitCost: money.round(item.costPrice),
      reference: `SRT-2026-${String(documentSequence.return_in).padStart(4, "0")}`,
      documentType: "sales_return",
      customerId: random.int(1, 15),
      reason: random.pick(["أصناف غير مطابقة للمواصفة", "فائض عن حاجة العميل", "تلف أثناء النقل"]),
      performedBy: "أمين مخزن / وليد البحيري", notes: null,
    });
  }

  return out.sort(
    (a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id,
  );
})();

/* ============================================================================
   3. التقييم — يُشغَّل مرة واحدة ويُقرأ منه كل شيء
   ============================================================================ */

/** يُجمِّع حركات (صنف × مخزن). */
const movementBuckets = (() => {
  const buckets = new Map();
  for (const movement of stockMovements) {
    const key = `${movement.itemId}|${movement.warehouseId}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(movement);
  }
  return buckets;
})();

/**
 * نتيجة التقييم لكل (صنف × مخزن).
 *
 * ضمانة عدم السالب: المولّد أعلاه قد يُنتج صرفًا يتجاوز المتاح (الكميات
 * عشوائية)، ومحرك التقييم يُسجّل ذلك في `shortfalls` بدل إخفائه. نُصحّحه
 * هنا بإضافة شراء تعويضي بتاريخ أسبق — وهو ما يفعله المخزن فعلًا: لا يُصرف
 * ما ليس موجودًا، فإن ظهر صرف فقد سبقه توريد لم يُسجَّل.
 */
export const stockBalances = (() => {
  const rows = [];

  for (const [key, bucket] of movementBuckets) {
    const [itemId, warehouseId] = key.split("|").map(Number);
    const item = items.find((row) => row.id === itemId);
    if (!item) continue;

    let movements = bucket;
    let result = valuate(movements, item.costingMethod);

    /* تعويض أي نقص مكتشف — مرة واحدة تكفي لأن التعويض بكامل العجز. */
    if (result.shortfalls.length) {
      const missing = result.shortfalls.reduce((total, row) => total + row.unavailable, 0);

      const compensation = {
        id: 900_000 + rows.length,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        warehouseId,
        warehouseName: warehouseById.get(warehouseId)?.name ?? "—",
        type: "opening",
        typeLabel: MOVEMENT_LABELS.opening,
        date: "2026-01-01",
        quantity: Math.ceil(missing),
        unitCost: money.round(item.costPrice * 0.94),
        reference: "OB-2026",
        documentType: "opening_balance",
        batchNumber: null,
        performedBy: "أمين مخزن / وليد البحيري",
        notes: "تكملة رصيد افتتاحي — الكمية المنصرفة تجاوزت المُسجَّل.",
      };

      stockMovements.push(compensation);
      movements = [...movements, compensation];
      bucket.push(compensation);
      result = valuate(movements, item.costingMethod);
    }

    /** الكمية المحجوزة — أمر بيع مؤكَّد أو طلب صرف معتمد لم يُنفَّذ بعد. */
    const reserved = random.chance(0.22)
      ? Math.min(result.quantityOnHand, Math.round(item.minLevel * random.money(0.1, 0.5)))
      : 0;

    rows.push({
      /**
       * المعرّف إلزامي: `update` في js/mock/db.js يُطابق بـ
       * `String(row.id) === String(id)`، و`String(undefined)` تساوي نفسها —
       * فصف بلا معرّف يجعل أي تحديث يُصيب أول صف بلا معرّف في المجموعة، لا
       * الصف المقصود. باگ فعلي: إذن إضافة على صنف حدّث رصيد صنف آخر.
       */
      id: rows.length + 1,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      itemNameEn: item.nameEn,
      categoryId: item.categoryId,
      category: item.category,
      unit: item.unit,
      warehouseId,
      warehouseName: warehouseById.get(warehouseId)?.name ?? "—",
      /**
       * حساب المخزون يأتي من **المخزن** لا من تصنيف الصنف.
       *
       * المخزن هو ما يُفرد له حساب في الدليل (مخزون المصنع، مخزون الفرع)،
       * والصنف الواحد قد يسكن مخزنين على حسابين مختلفين. اعتماد تصنيف الصنف
       * يترك حساب مخزن الفرع بلا رصيد في الموديول بينما يحمل حركة تحويل في
       * الدفتر — فرق لا يُفسَّر في شاشة المطابقة.
       */
      inventoryAccountId:
        warehouseById.get(warehouseId)?.inventoryAccountId ?? item.inventoryAccountId,
      costingMethod: item.costingMethod,

      onHand: result.quantityOnHand,
      reserved,
      available: Math.max(0, result.quantityOnHand - reserved),
      averageCost: result.averageCost,
      totalValue: result.totalValue,
      layers: result.layers.length,

      minLevel: item.minLevel,
      maxLevel: item.maxLevel,
      reorderPoint: item.reorderPoint,
      status: deriveStockStatus({
        onHand: result.quantityOnHand,
        minLevel: item.minLevel,
        maxLevel: item.maxLevel,
        reorderPoint: item.reorderPoint,
      }),
      lastMovementDate: movements[movements.length - 1]?.date ?? null,
    });
  }

  return rows.sort((a, b) => money.toMinor(b.totalValue) - money.toMinor(a.totalValue));
})();

/** ترتيب الحركات بعد إضافة التعويضات. */
stockMovements.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id);

/**
 * قيمة المخزون لكل حساب مخزون في الدليل.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  هذا هو العقد مع دفتر الأستاذ: القيد الافتتاحي في js/mock/accounting.mock.js
 *  يقرأ هذه القيم ويضبط أرصدة حسابات المخزون الافتتاحية بحيث يُطابق رصيد
 *  الحساب الرقابي في نهاية الفترة قيمة المخزون المحسوبة هنا.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const inventoryClosingByAccount = (() => {
  const totals = {};

  for (const row of stockBalances) {
    const account = String(row.inventoryAccountId);
    totals[account] = money.add(totals[account] ?? 0, row.totalValue);
  }

  return totals;
})();

/** إجمالي قيمة المخزون — تقرؤه لوحة التحكم. */
export const totalInventoryValue = money.sumBy(stockBalances, "totalValue");

/* ============================================================================
   4. التشغيلات (Batches) وتتبّع الصلاحية
   ============================================================================ */

export const batches = (() => {
  const out = [];
  let id = 0;

  for (const movement of stockMovements) {
    if (!movement.batchNumber) continue;

    const item = items.find((row) => row.id === movement.itemId);
    if (!item) continue;

    id += 1;

    /*
     * الكمية المتبقية في التشغيلة تُقرَّب من نصيبها في رصيد الصنف الحالي —
     * بديل مبسَّط عن تتبّع كل تشغيلة حركةً بحركة، وهو ما يحتاجه الباك-إند
     * الحقيقي. التبسيط مُعلَن هنا لا مُخفى في الشاشة.
     */
    const balance = stockBalances.find(
      (row) => row.itemId === movement.itemId && row.warehouseId === movement.warehouseId,
    );
    const share = balance && balance.onHand > 0 ? random.money(0.1, 0.5) : 0;

    out.push({
      id,
      batchNumber: movement.batchNumber,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      warehouseId: movement.warehouseId,
      warehouseName: movement.warehouseName,
      receivedDate: movement.date,
      productionDate: addDays(movement.date, -random.int(5, 60)),
      expiryDate: movement.expiryDate ?? (item.trackExpiry ? addDays(movement.date, random.int(120, 720)) : null),
      initialQuantity: movement.quantity,
      quantity: Math.round((balance?.onHand ?? 0) * share),
      unitCost: movement.unitCost ?? item.costPrice,
      supplierId: movement.supplierId ?? null,
      reference: movement.reference,
      notes: null,
    });
  }

  /* الحالة مُشتقّة من تاريخ الصلاحية — لا تُخزَّن. */
  return out
    .map((batch) => ({
      ...batch,
      status: deriveBatchStatus(batch, REFERENCE_DATE),
      value: money.multiply(batch.unitCost, batch.quantity),
    }))
    .filter((batch) => batch.quantity > 0)
    .sort((a, b) => String(a.expiryDate ?? "9999").localeCompare(String(b.expiryDate ?? "9999")));
})();

/* ============================================================================
   5. الجرد الفعلي
   ============================================================================ */

export const stockCounts = [
  {
    id: 1,
    countNumber: "SC-2026-0001",
    warehouseId: 1,
    warehouseName: "المخزن الرئيسي",
    type: "full",
    plannedDate: "2026-06-30",
    startedAt: "2026-06-30T08:00:00+03:00",
    completedAt: "2026-07-01T16:00:00+03:00",
    status: "completed",
    countedBy: "المراجع الداخلي / نادر الفقي",
    approvedBy: "مدير المخازن / نادر سليمان",
    itemsCounted: 18,
    itemsWithVariance: 4,
    adjustmentReference: "ADJ-2026-0003",
    notes: "جرد نصف سنوي. فروق محدودة سُوّيت بإذن تسوية واحد.",
  },
  {
    id: 2,
    countNumber: "SC-2026-0002",
    warehouseId: 2,
    warehouseName: "مخزن المواد الخام",
    type: "full",
    plannedDate: "2026-06-30",
    startedAt: "2026-06-30T08:00:00+03:00",
    completedAt: "2026-07-02T14:00:00+03:00",
    status: "completed",
    countedBy: "المراجع الداخلي / نادر الفقي",
    approvedBy: "مدير المخازن / نادر سليمان",
    itemsCounted: 11,
    itemsWithVariance: 2,
    adjustmentReference: "ADJ-2026-0005",
    notes: null,
  },
  {
    id: 3,
    countNumber: "SC-2026-0003",
    warehouseId: 4,
    warehouseName: "مخزن قطع الغيار",
    type: "cycle",
    plannedDate: "2026-10-15",
    startedAt: "2026-10-15T09:00:00+03:00",
    completedAt: "2026-10-15T15:00:00+03:00",
    status: "completed",
    countedBy: "أمين مخزن / وليد البحيري",
    approvedBy: "مدير المخازن / نادر سليمان",
    itemsCounted: 6,
    itemsWithVariance: 1,
    adjustmentReference: "ADJ-2026-0009",
    notes: "جرد دوري لعيّنة من الأصناف عالية الحركة.",
  },
  {
    id: 4,
    countNumber: "SC-2026-0004",
    warehouseId: 1,
    warehouseName: "المخزن الرئيسي",
    type: "full",
    plannedDate: "2026-11-10",
    startedAt: null,
    completedAt: null,
    status: "scheduled",
    countedBy: null,
    approvedBy: null,
    itemsCounted: 0,
    itemsWithVariance: 0,
    adjustmentReference: null,
    notes: "الجرد السنوي المخطَّط — لم يبدأ بعد.",
  },
];

/** سطور الجرد المكتمل — المقارنة بين الدفتري والفعلي. */
export const stockCountLines = (() => {
  const out = [];
  let id = 0;

  for (const count of stockCounts.filter((row) => row.status === "completed")) {
    const scope = stockBalances
      .filter((row) => row.warehouseId === count.warehouseId)
      .slice(0, count.itemsCounted);

    scope.forEach((row, index) => {
      id += 1;
      const hasVariance = index < count.itemsWithVariance;
      const variance = hasVariance
        ? random.pick([-1, 1]) * Math.max(1, Math.round(row.onHand * random.money(0.01, 0.06)))
        : 0;

      out.push({
        id,
        stockCountId: count.id,
        itemId: row.itemId,
        itemCode: row.itemCode,
        itemName: row.itemName,
        unit: row.unit,
        bookQuantity: row.onHand,
        countedQuantity: row.onHand + variance,
        variance,
        unitCost: row.averageCost,
        varianceValue: money.multiply(row.averageCost, variance),
        reason: hasVariance ? random.pick(["فرق تسجيل", "تلف غير مُسجَّل", "خطأ في الصرف"]) : null,
      });
    });
  }

  return out;
})();

export const requisitions = [
  {
    id: 1,
    code: "REQ-2026-001",
    branchId: 2,
    branchName: "مخزن فرع 1 (الصيدلية المركزية)",
    itemId: 2,
    itemCode: "ITM-0002",
    itemName: "باراسيتامول 500 مج — علبة 20 قرصًا",
    category: "أدوية أقراص وكبسولات",
    unit: "علبة",
    requestedQty: 10,
    status: "pending_review",
    urgency: "high",
    fulfillmentSource: null,
    sourceBranchId: null,
    sourceBranchName: null,
    supplierId: null,
    supplierName: null,
    poReference: null,
    dispatchedQty: null,
    dispatchedAt: null,
    dispatchedBy: null,
    driverName: null,
    receivedQty: null,
    discrepancyCount: null,
    discrepancyNotes: null,
    inspectedAt: null,
    inspectedBy: null,
    createdAt: "2026-11-12T08:30:15.000Z",
    createdBy: "طارق إبراهيم (أمين مخزن فرع 1)",
    notes: "عجز في رصيد الصيدلية بسبب ضغط الحالات اليوم",
    timeline: [
      {
        stage: "created",
        title: "إنشاء طلب النواقص",
        timestamp: "2026-11-12T08:30:15.000Z",
        user: "طارق إبراهيم (أمين مخزن فرع 1)",
        notes: "طلب احتياج عاجل 10 علب",
        statusLabel: "قيد المراجعة بالرئيسي",
      },
    ],
  },
  {
    id: 2,
    code: "REQ-2026-002",
    branchId: 3,
    branchName: "مخزن فرع 2 (العيادات الخارجية)",
    itemId: 7,
    itemCode: "ITM-0007",
    itemName: "محلول ملح 0.9% — كيس 500 مل",
    category: "حقن ومحاليل وريدية",
    unit: "كيس",
    requestedQty: 20,
    status: "in_transit",
    urgency: "normal",
    fulfillmentSource: "hub",
    sourceBranchId: null,
    sourceBranchName: null,
    supplierId: null,
    supplierName: null,
    poReference: null,
    dispatchedQty: 20,
    dispatchedAt: "2026-11-12T09:42:00.000Z",
    dispatchedBy: "محمود الشامي (أمين المخزن الرئيسي)",
    driverName: "سيد عطية (سائق الحركة)",
    receivedQty: null,
    discrepancyCount: null,
    discrepancyNotes: null,
    inspectedAt: null,
    inspectedBy: null,
    createdAt: "2026-11-12T07:15:00.000Z",
    createdBy: "ياسمين القاضي (فرع 2)",
    notes: "احتياج أسبوعي للعيادات الخارجية",
    timeline: [
      {
        stage: "created",
        title: "إنشاء طلب النواقص",
        timestamp: "2026-11-12T07:15:00.000Z",
        user: "ياسمين القاضي (فرع 2)",
        notes: "احتياج أسبوعي",
        statusLabel: "قيد المراجعة",
      },
      {
        stage: "reviewed",
        title: "مراجعة واعتماد التوفير من الرئيسي",
        timestamp: "2026-11-12T08:10:00.000Z",
        user: "محمود الشامي (المخزن الرئيسي)",
        notes: "الصنف متوفر بالرصيد",
        statusLabel: "تم الصرف",
      },
      {
        stage: "dispatched",
        title: "شحن البضاعة وإذن خروج للفرع",
        timestamp: "2026-11-12T09:42:00.000Z",
        user: "محمود الشامي",
        notes: "تم التسليم للسائق سيد عطية وتثبيت الختم الزمني بالثانية",
        statusLabel: "في الطريق للفرع",
      },
    ],
  },
  {
    id: 3,
    code: "REQ-2026-003",
    branchId: 2,
    branchName: "مخزن فرع 1 (الصيدلية المركزية)",
    itemId: 1,
    itemCode: "ITM-0001",
    itemName: "أموكسيسيلين 500 مج — علبة 30 كبسولة",
    category: "أدوية أقراص وكبسولات",
    unit: "علبة",
    requestedQty: 15,
    status: "under_inspection",
    urgency: "urgent",
    fulfillmentSource: "branch_transfer",
    sourceBranchId: 4,
    sourceBranchName: "مخزن فرع 3 (الطوارئ والرعاية)",
    supplierId: null,
    supplierName: null,
    poReference: null,
    dispatchedQty: 15,
    dispatchedAt: "2026-11-12T10:05:00.000Z",
    dispatchedBy: "مسؤول فرع 3",
    driverName: "محمود رمضان",
    receivedQty: null,
    discrepancyCount: null,
    discrepancyNotes: null,
    inspectedAt: null,
    inspectedBy: null,
    createdAt: "2026-11-12T06:45:00.000Z",
    createdBy: "طارق إبراهيم (فرع 1)",
    notes: "طلب تحويل دواء أموكسيسيلين",
    timeline: [
      {
        stage: "created",
        title: "إنشاء طلب النواقص",
        timestamp: "2026-11-12T06:45:00.000Z",
        user: "طارق إبراهيم (فرع 1)",
        notes: "طلب عاجل",
        statusLabel: "قيد المراجعة",
      },
      {
        stage: "reviewed",
        title: "فحص الفائض والتحويل الداخلي الذكي",
        timestamp: "2026-11-12T07:20:00.000Z",
        user: "محمود الشامي",
        notes: "تم التحويل من مخزن فرع 3 لوجود فائض وتوفير الشراء",
        statusLabel: "تحويل بين الفروع",
      },
      {
        stage: "dispatched",
        title: "خروج شحنة التحويل الداخلي",
        timestamp: "2026-11-12T10:05:00.000Z",
        user: "مسؤول فرع 3",
        notes: "تم التسليم لسيارة النقل الداخلي",
        statusLabel: "في الطريق",
      },
      {
        stage: "arrived",
        title: "وصول الشحنة لمقر الفرع",
        timestamp: "2026-11-12T11:00:00.000Z",
        user: "طارق إبراهيم (فرع 1)",
        notes: "الشحنة على رصيف الاستلام، جاري العد والفحص الفعلي",
        statusLabel: "قيد الفحص والعد",
      },
    ],
  },
  {
    id: 4,
    code: "REQ-2026-004",
    branchId: 6,
    branchName: "مخزن فرع 4 (المستلزمات العامة)",
    itemId: 11,
    itemCode: "ITM-0011",
    itemName: "أنسولين سريع المفعول — فيال",
    category: "حقن ومحاليل وريدية",
    unit: "فيال",
    requestedQty: 10,
    status: "discrepancy",
    urgency: "urgent",
    fulfillmentSource: "hub",
    sourceBranchId: null,
    sourceBranchName: null,
    supplierId: null,
    supplierName: null,
    poReference: null,
    dispatchedQty: 10,
    dispatchedAt: "2026-11-12T09:00:00.000Z",
    dispatchedBy: "محمود الشامي (أمين المخزن الرئيسي)",
    driverName: "وليد سامح",
    receivedQty: 8,
    discrepancyCount: 2,
    discrepancyNotes: "عجز عدد 2 فيال غير موجودين داخل الكرتونة، تم إخطار السائق وأمين المخزن الرئيسي فور الفحص بالثانية",
    inspectedAt: "2026-11-12T11:45:22.000Z",
    inspectedBy: "عادل فادي (أمين مخزن فرع 4)",
    createdAt: "2026-11-11T14:00:00.000Z",
    createdBy: "عادل فادي",
    notes: "طلب توريد أنسولين",
    timeline: [
      {
        stage: "created",
        title: "إنشاء طلب نواقص",
        timestamp: "2026-11-11T14:00:00.000Z",
        user: "عادل فادي (فرع 4)",
        notes: "طلب رصيد إضافي",
        statusLabel: "قيد المراجعة",
      },
      {
        stage: "reviewed",
        title: "اعتماد الصرف من الرئيسي",
        timestamp: "2026-11-11T16:30:00.000Z",
        user: "محمود الشامي",
        notes: "تمت الموافقة على صرف 10 فيال",
        statusLabel: "معتمد",
      },
      {
        stage: "dispatched",
        title: "خروج الشحنة (10 فيال)",
        timestamp: "2026-11-12T09:00:00.000Z",
        user: "محمود الشامي",
        notes: "تم الشحن مع السائق وليد سامح",
        statusLabel: "في الطريق",
      },
      {
        stage: "inspection_discrepancy",
        title: "⚠️ إثبات عجز رقابي بالثانية",
        timestamp: "2026-11-12T11:45:22.000Z",
        user: "عادل فادي (أمين فرع 4)",
        notes: "المستلم الفعلي 8 فقط. تم تسجيل عجز 2 فيال رسمياً وإدخال 8 فقط لعهدة الفرع",
        statusLabel: "استلام مع عجز وخلاف",
      },
    ],
  },
  {
    id: 5,
    code: "REQ-2026-005",
    branchId: 4,
    branchName: "مخزن فرع 3 (الطوارئ والرعاية)",
    itemId: 3,
    itemCode: "ITM-0003",
    itemName: "أوميبرازول 20 مج — علبة",
    category: "أدوية أقراص وكبسولات",
    unit: "علبة",
    requestedQty: 25,
    status: "completed",
    urgency: "normal",
    fulfillmentSource: "hub",
    sourceBranchId: null,
    sourceBranchName: null,
    supplierId: null,
    supplierName: null,
    poReference: null,
    dispatchedQty: 25,
    dispatchedAt: "2026-11-11T14:30:00.000Z",
    dispatchedBy: "محمود الشامي",
    driverName: "سيد عطية",
    receivedQty: 25,
    discrepancyCount: 0,
    discrepancyNotes: null,
    inspectedAt: "2026-11-12T12:30:10.000Z",
    inspectedBy: "زياد منصور (أمين فرع 3)",
    createdAt: "2026-11-11T10:00:00.000Z",
    createdBy: "زياد منصور",
    notes: "طلب أوميبرازول",
    timeline: [
      {
        stage: "created",
        title: "إنشاء طلب نواقص",
        timestamp: "2026-11-11T10:00:00.000Z",
        user: "زياد منصور",
        notes: "طلب احتياج",
        statusLabel: "قيد المراجعة",
      },
      {
        stage: "reviewed",
        title: "اعتماد الصرف",
        timestamp: "2026-11-11T12:00:00.000Z",
        user: "محمود الشامي",
        notes: "متوفر بالرئيسي",
        statusLabel: "معتمد",
      },
      {
        stage: "dispatched",
        title: "خروج الشحنة",
        timestamp: "2026-11-11T14:30:00.000Z",
        user: "محمود الشامي",
        notes: "تم الشحن",
        statusLabel: "في الطريق",
      },
      {
        stage: "completed",
        title: "✅ فحص مطابق 100% وإغلاق الطلب",
        timestamp: "2026-11-12T12:30:10.000Z",
        user: "زياد منصور",
        notes: "تم استلام 25 علبة بالكامل بحالة سليمة وإضافتها لعهدة مخزن فرع 3",
        statusLabel: "مكتمل",
      },
    ],
  },
  {
    id: 6,
    code: "REQ-2026-006",
    branchId: 2,
    branchName: "مخزن فرع 1 (الصيدلية المركزية)",
    itemId: 9,
    itemCode: "ITM-0009",
    itemName: "حقن سيفترياكسون 1 جم",
    category: "حقن ومحاليل وريدية",
    unit: "أمبول",
    requestedQty: 50,
    status: "supplier_ordered",
    urgency: "urgent",
    fulfillmentSource: "supplier",
    sourceBranchId: null,
    sourceBranchName: null,
    supplierId: 2,
    supplierName: "النيل فارما للمستحضرات الطبية",
    poReference: "PO-2026-0089",
    dispatchedQty: null,
    dispatchedAt: null,
    dispatchedBy: null,
    driverName: null,
    receivedQty: null,
    discrepancyCount: null,
    discrepancyNotes: null,
    inspectedAt: null,
    inspectedBy: null,
    createdAt: "2026-11-12T09:00:00.000Z",
    createdBy: "طارق إبراهيم",
    notes: "طلب عاجل لحقن سيفترياكسون",
    timeline: [
      {
        stage: "created",
        title: "طلب نواقص عاجل",
        timestamp: "2026-11-12T09:00:00.000Z",
        user: "طارق إبراهيم",
        notes: "نقص حاد في المستحضر",
        statusLabel: "قيد المراجعة",
      },
      {
        stage: "supplier_ordered",
        title: "🟣 إصدار أمر شراء للمورد",
        timestamp: "2026-11-12T10:15:00.000Z",
        user: "محمود الشامي (المخزن الرئيسي)",
        notes: "الصنف غير متوفر في أي فرع، تم إرسال أمر شراء للمورد النيل فارما برقم PO-2026-0089",
        statusLabel: "تم الطلب من المورد",
      },
    ],
  },
];

export { TODAY as INVENTORY_TODAY };


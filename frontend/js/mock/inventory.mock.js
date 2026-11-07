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
  /* --- خامات معدنية --- */
  { name: "صفائح حديد مجلفن 1.5 مم", nameEn: "Galvanized Steel Sheet 1.5mm", categoryId: 2, unitId: 4, cost: [38, 46], tracking: ["batch"] },
  { name: "صفائح حديد مجلفن 2 مم", nameEn: "Galvanized Steel Sheet 2mm", categoryId: 2, unitId: 4, cost: [40, 48], tracking: ["batch"] },
  { name: "أنابيب ألومنيوم 40 مم", nameEn: "Aluminium Tube 40mm", categoryId: 2, unitId: 7, cost: [85, 105], tracking: ["batch"] },
  { name: "قضبان نحاس 10 مم", nameEn: "Copper Rod 10mm", categoryId: 2, unitId: 4, cost: [420, 480], tracking: ["batch"] },
  { name: "زوايا حديد 50×50", nameEn: "Steel Angle 50x50", categoryId: 2, unitId: 7, cost: [62, 74], tracking: [] },
  { name: "أسلاك لحام معدني", nameEn: "Welding Wire", categoryId: 2, unitId: 4, cost: [96, 118], tracking: ["batch"] },

  /* --- خامات بلاستيكية --- */
  { name: "حبيبات بوليبروبيلين PP", nameEn: "PP Granules", categoryId: 3, unitId: 4, cost: [52, 62], tracking: ["batch", "expiry"] },
  { name: "حبيبات بولي إيثيلين HDPE", nameEn: "HDPE Granules", categoryId: 3, unitId: 4, cost: [48, 58], tracking: ["batch", "expiry"] },
  { name: "مركّز ألوان صناعي — أزرق", nameEn: "Masterbatch Blue", categoryId: 3, unitId: 4, cost: [180, 220], tracking: ["batch", "expiry"] },
  { name: "مركّز ألوان صناعي — أحمر", nameEn: "Masterbatch Red", categoryId: 3, unitId: 4, cost: [185, 225], tracking: ["batch", "expiry"] },
  { name: "مادة مانعة للأكسدة", nameEn: "Antioxidant Additive", categoryId: 3, unitId: 4, cost: [310, 380], tracking: ["batch", "expiry"] },

  /* --- تعبئة وتغليف --- */
  { name: "كراتين تغليف مقاس كبير", nameEn: "Carton Box — Large", categoryId: 4, unitId: 1, cost: [14, 19], tracking: [] },
  { name: "كراتين تغليف مقاس وسط", nameEn: "Carton Box — Medium", categoryId: 4, unitId: 1, cost: [9, 13], tracking: [] },
  { name: "شرائط لاصقة صناعية", nameEn: "Industrial Tape", categoryId: 4, unitId: 10, cost: [22, 30], tracking: [] },
  { name: "أكياس بلاستيك شفافة", nameEn: "Clear Poly Bags", categoryId: 4, unitId: 4, cost: [58, 70], tracking: [] },
  { name: "ملصقات باركود حرارية", nameEn: "Thermal Barcode Labels", categoryId: 4, unitId: 10, cost: [34, 44], tracking: [] },
  { name: "طبليات خشبية قياسية", nameEn: "Wooden Pallets", categoryId: 4, unitId: 1, cost: [160, 200], tracking: [] },

  /* --- منتجات تامة --- */
  { name: "وحدة تكييف هواء 1.5 حصان", nameEn: "AC Unit 1.5HP", categoryId: 5, unitId: 1, cost: [8_400, 9_800], tracking: ["serial"] },
  { name: "وحدة تكييف هواء 3 حصان", nameEn: "AC Unit 3HP", categoryId: 5, unitId: 1, cost: [14_500, 16_800], tracking: ["serial"] },
  { name: "خزان مياه بلاستيك 1000 لتر", nameEn: "Water Tank 1000L", categoryId: 5, unitId: 1, cost: [1_850, 2_200], tracking: ["batch"] },
  { name: "خزان مياه بلاستيك 500 لتر", nameEn: "Water Tank 500L", categoryId: 5, unitId: 1, cost: [980, 1_200], tracking: ["batch"] },
  { name: "مواسير بلاستيك PPR 25 مم", nameEn: "PPR Pipe 25mm", categoryId: 5, unitId: 7, cost: [46, 58], tracking: ["batch"] },
  { name: "لوح معدني مُشكَّل — موديل A", nameEn: "Formed Metal Panel A", categoryId: 5, unitId: 1, cost: [620, 760], tracking: [] },

  /* --- أصناف تجارية --- */
  { name: "مضخة مياه 1 حصان", nameEn: "Water Pump 1HP", categoryId: 6, unitId: 1, cost: [2_400, 2_900], tracking: ["serial"] },
  { name: "مضخة مياه 2 حصان", nameEn: "Water Pump 2HP", categoryId: 6, unitId: 1, cost: [3_900, 4_600], tracking: ["serial"] },
  { name: "كابل كهربائي 3×2.5 مم", nameEn: "Electric Cable 3x2.5", categoryId: 6, unitId: 7, cost: [52, 64], tracking: ["batch"] },
  { name: "كابل كهربائي 3×4 مم", nameEn: "Electric Cable 3x4", categoryId: 6, unitId: 7, cost: [78, 94], tracking: ["batch"] },
  { name: "لوحة توزيع كهربائي 12 خط", nameEn: "Distribution Board 12-way", categoryId: 6, unitId: 1, cost: [740, 920], tracking: [] },
  { name: "قاطع كهربائي 32 أمبير", nameEn: "Circuit Breaker 32A", categoryId: 6, unitId: 1, cost: [118, 145], tracking: [] },
  { name: "مفاتيح وبرايز — طقم", nameEn: "Switches & Sockets Set", categoryId: 6, unitId: 9, cost: [240, 310], tracking: [] },
  { name: "لمبات LED 12 وات", nameEn: "LED Bulb 12W", categoryId: 6, unitId: 1, cost: [38, 48], tracking: [] },
  { name: "كشاف LED خارجي 100 وات", nameEn: "LED Floodlight 100W", categoryId: 6, unitId: 1, cost: [420, 520], tracking: [] },

  /* --- قطع غيار ومستهلكات --- */
  { name: "سير ماكينة مقاس 1200", nameEn: "Machine Belt 1200", categoryId: 7, unitId: 1, cost: [380, 460], tracking: [] },
  { name: "رولمان بلي 6205", nameEn: "Bearing 6205", categoryId: 7, unitId: 1, cost: [95, 125], tracking: [] },
  { name: "فلتر زيت صناعي", nameEn: "Industrial Oil Filter", categoryId: 7, unitId: 1, cost: [210, 265], tracking: ["expiry"] },
  { name: "زيت تشحيم صناعي", nameEn: "Industrial Lubricant", categoryId: 7, unitId: 6, cost: [92, 118], tracking: ["batch", "expiry"] },
  { name: "جوانات مطاطية — طقم", nameEn: "Rubber Gaskets Set", categoryId: 7, unitId: 9, cost: [140, 180], tracking: [] },
  { name: "صواميل ومسامير — عبوة", nameEn: "Nuts & Bolts Pack", categoryId: 7, unitId: 1, cost: [68, 88], tracking: [] },

  /* --- مستلزمات مكتبية --- */
  { name: "ورق طباعة A4 — رزمة", nameEn: "A4 Paper Ream", categoryId: 8, unitId: 1, cost: [128, 155], tracking: [] },
  { name: "حبر طابعة ليزر أسود", nameEn: "Laser Toner Black", categoryId: 8, unitId: 1, cost: [1_150, 1_400], tracking: ["expiry"] },
  { name: "أقلام جاف — عبوة 50", nameEn: "Ballpoint Pens 50-pack", categoryId: 8, unitId: 1, cost: [78, 96], tracking: [] },
  { name: "ملفات وحوافظ مستندات", nameEn: "File Folders", categoryId: 8, unitId: 1, cost: [16, 22], tracking: [] },
  { name: "دباسات ومشابك", nameEn: "Staplers & Clips", categoryId: 8, unitId: 9, cost: [110, 140], tracking: [] },

  /* --- نظافة وصيانة --- */
  { name: "منظّف أرضيات صناعي", nameEn: "Industrial Floor Cleaner", categoryId: 9, unitId: 6, cost: [42, 54], tracking: ["expiry"] },
  { name: "مطهّر أسطح", nameEn: "Surface Disinfectant", categoryId: 9, unitId: 6, cost: [58, 72], tracking: ["expiry"] },
  { name: "أكياس قمامة كبيرة", nameEn: "Large Garbage Bags", categoryId: 9, unitId: 10, cost: [36, 46], tracking: [] },
  { name: "قفازات عمل صناعية", nameEn: "Work Gloves", categoryId: 9, unitId: 9, cost: [52, 66], tracking: [] },
  { name: "خوذات أمان", nameEn: "Safety Helmets", categoryId: 9, unitId: 1, cost: [180, 230], tracking: [] },

  /* --- أجهزة كهربائية --- */
  { name: "مولد كهربائي محمول 3 ك.و", nameEn: "Portable Generator 3kW", categoryId: 10, unitId: 1, cost: [18_500, 22_000], tracking: ["serial"] },
  { name: "منظّم جهد 5 ك.ف.أ", nameEn: "Voltage Stabilizer 5kVA", categoryId: 10, unitId: 1, cost: [4_200, 5_100], tracking: ["serial"] },
];

/**
 * المخزن الافتراضي لكل تصنيف — الصنف يسكن المخزن المناسب لطبيعته.
 * توزيع الأصناف عشوائيًا على المخازن يُنتج خامات في مخزن المستلزمات المكتبية.
 */
const CATEGORY_WAREHOUSES = {
  2: [2], 3: [2], 4: [2, 1], 5: [3], 6: [1, 5], 7: [4], 8: [6], 9: [6, 1], 10: [1, 5],
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
            "صرف للإنتاج",
            "صرف لأمر بيع",
            "صرف للصيانة",
            "استهلاك إداري",
            "صرف لمشروع",
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

export { TODAY as INVENTORY_TODAY };

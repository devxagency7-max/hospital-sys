/**
 * بيانات المحاسبة المالية التجريبية:
 * العملاء والموردون ومستنداتهم، الخزائن والبنوك وحركاتها، الأصول الثابتة، والضرائب.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ضمانة المطابقة: الأستاذ المساعد يُطابق الحساب الرقابي في دفتر الأستاذ.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * أرصدة العملاء والموردين والخزائن والبنوك ومجمع الإهلاك هنا **مُشتقّة من
 * قيود دفتر الأستاذ** لا مكتوبة بأرقام مستقلة: هذا الملف يقرأ رصيد الحساب
 * الرقابي من js/mock/accounting.mock.js ثم يوزّعه على المستندات التفصيلية.
 *
 * السبب مباشر: بيانات تجريبية لا يُطابق فيها مجموع كشوف العملاء رصيد حساب
 * «العملاء» في الميزان تُظهر النظام وكأنه مُختَل في أول شاشة مطابقة يفتحها
 * المستخدم — وهي أول ما يفتحه أي محاسب يُقيّم نظامًا.
 */

import * as money from "../core/money.js";
import {
  createRandom,
  REFERENCE_DATE,
  CUSTOMER_SEEDS,
  SUPPLIER_SEEDS,
  BANKS,
  buildName,
  addDays,
} from "./seed.js";
import { accounts, journalEntries } from "./accounting.mock.js";
import { toMovements, aggregateByAccount } from "../domain/ledger.js";
import { statementAmount, signedBalance } from "../domain/accounts.js";

const random = createRandom(733_911);
const TODAY = REFERENCE_DATE.toISOString().slice(0, 10);

/* ============================================================================
   0. قراءة الأرصدة الرقابية من دفتر الأستاذ
   ============================================================================ */

const accountById = new Map(accounts.map((account) => [String(account.id), account]));
const aggregated = aggregateByAccount(toMovements(journalEntries));

function bucketOf(accountId) {
  return aggregated.get(String(accountId)) ?? { debit: 0, credit: 0 };
}

/**
 * رصيد حساب رقابي بتوقيع **النوع** — للمجاميع التي تدخل القوائم المالية.
 */
function controlBalance(accountId) {
  return statementAmount(accountById.get(String(accountId)), bucketOf(accountId));
}

/**
 * رصيد حساب بتوقيع **طبيعته الخاصة** — موجب دائمًا في جانبه الطبيعي.
 *
 * ضروري لحسابات المقابلة: «مجمع إهلاك» بتوقيع النوع يخرج سالبًا (لأنه يُخصم
 * من الأصول)، لكن سجل الأصول وقسائم الإهلاك تقرؤه كرقم موجب — فالمجمع ليس
 * رصيدًا سالبًا، بل رصيد دائن موجب يُطرح من التكلفة. تمريره سالبًا إلى مولّد
 * الأصول أعطى كل أصل مجمع إهلاك سالبًا وقيمة دفترية أكبر من تكلفته.
 */
function ownNatureBalance(accountId) {
  return signedBalance(accountById.get(String(accountId)), bucketOf(accountId));
}

const GL = {
  arLocal: controlBalance(1131),
  arExport: controlBalance(1132),
  notesReceivable: controlBalance(1133),
  ap: controlBalance(2111),
  cashMain: controlBalance(1111),
  cashPetty: controlBalance(1113),
  bankNbe: controlBalance(1121),
  bankMisr: controlBalance(1122),
  bankCib: controlBalance(1123),
  bankCairo: controlBalance(1124),

  /* مجمعات الإهلاك — بطبيعتها الدائنة، أي موجبة. */
  accDepBuildings: ownNatureBalance(1221),
  accDepMachinery: ownNatureBalance(1222),
  accDepFurniture: ownNatureBalance(1223),
  accDepComputers: ownNatureBalance(1224),
  accDepVehicles: ownNatureBalance(1225),

  costBuildings: controlBalance(1211),
  costMachinery: controlBalance(1212),
  costFurniture: controlBalance(1213),
  costComputers: controlBalance(1214),
  costVehicles: controlBalance(1215),
};

/* ============================================================================
   1. العملاء
   ============================================================================ */

const PAYMENT_TERMS = [
  { id: "cod", label: "نقدي عند التسليم", days: 0 },
  { id: "net15", label: "15 يومًا", days: 15 },
  { id: "net30", label: "30 يومًا", days: 30 },
  { id: "net45", label: "45 يومًا", days: 45 },
  { id: "net60", label: "60 يومًا", days: 60 },
];

export const customers = CUSTOMER_SEEDS.map((seed, index) => {
  const id = index + 1;
  const terms = random.pick(PAYMENT_TERMS);

  return {
    id,
    code: `CUS-${String(id).padStart(4, "0")}`,
    name: seed.name,
    nameEn: null,
    activity: seed.activity,
    segment: seed.segment,
    /** حساب العميل الرقابي: التصدير على حساب مستقل عن المحلي. */
    accountId: seed.segment === "export" ? 1132 : 1131,
    governorate: seed.governorate,
    address: `${seed.governorate} — ${random.pick(["شارع الجمهورية", "طريق النصر", "شارع الحرية", "المنطقة الصناعية", "شارع البحر"])}`,
    contactPerson: buildName(random, random.chance(0.3) ? "female" : "male"),
    phone: random.phone(),
    altPhone: random.chance(0.4) ? random.phone() : null,
    email: `info@customer${id}.example`,
    taxId: `${random.int(100, 999)}-${random.int(100, 999)}-${random.int(100, 999)}`,
    commercialRegister: String(random.int(10000, 99999)),
    paymentTermsId: terms.id,
    paymentTermsLabel: terms.label,
    paymentTermsDays: terms.days,
    creditLimit: random.pick([0, 500_000, 1_000_000, 1_500_000, 2_500_000, 4_000_000]),
    priceListId: random.pick([1, 1, 1, 2]),
    salesRepId: random.pick([9, 10]),
    openedAt: random.date(1200, 400),
    status: random.chance(0.93) ? "active" : "inactive",
    notes: null,
  };
});

/* ============================================================================
   2. الموردون
   ============================================================================ */

export const suppliers = SUPPLIER_SEEDS.map((seed, index) => {
  const id = index + 1;
  const terms = random.pick(PAYMENT_TERMS.slice(1));

  return {
    id,
    code: `SUP-${String(id).padStart(4, "0")}`,
    name: seed.name,
    nameEn: null,
    activity: seed.activity,
    accountId: 2111,
    governorate: seed.governorate,
    address: `${seed.governorate} — ${random.pick(["المنطقة الصناعية", "شارع المصانع", "طريق الإسكندرية الصحراوي", "مدينة العبور"])}`,
    contactPerson: buildName(random, random.chance(0.2) ? "female" : "male"),
    phone: random.phone(),
    email: `sales@supplier${id}.example`,
    taxId: `${random.int(100, 999)}-${random.int(100, 999)}-${random.int(100, 999)}`,
    commercialRegister: String(random.int(10000, 99999)),
    paymentTermsId: terms.id,
    paymentTermsLabel: terms.label,
    paymentTermsDays: terms.days,
    /** تقييم المورد — يُستخدم في تقرير أداء الموردين. */
    rating: random.int(3, 5),
    bankName: random.pick(BANKS).name,
    bankAccountNumber: String(random.int(1000000000, 9999999999)),
    openedAt: random.date(1400, 500),
    status: random.chance(0.95) ? "active" : "inactive",
    notes: null,
  };
});

/* ============================================================================
   3. فواتير العملاء ومستنداتها

   التوليد عكسي: نبدأ من الرصيد الرقابي المطلوب، نوزّعه على فواتير مفتوحة،
   ثم نشتق الإجماليات والمدفوعات. التوليد المباشر (فواتير عشوائية ثم جمع
   المتبقي) لا يُطابق الرصيد الرقابي أبدًا.
   ============================================================================ */

/** يوزّع مبلغًا على `count` حصة بأوزان عشوائية، ومجموعها يساوي المبلغ بالضبط. */
function distribute(total, count) {
  const weights = Array.from({ length: count }, () => 1 + random.float() * 4);
  return money.allocateByWeight(total, weights);
}

function buildPartyInvoices({
  parties,
  openTotal,
  openCount,
  settledCount,
  prefix,
  idBase,
  partyField,
  dateField = "date",
  natureOptions,
}) {
  const invoices = [];
  const shares = distribute(openTotal, openCount);
  let sequence = 0;

  /* --- الفواتير المفتوحة: متبقّيها مجموعه الرصيد الرقابي بالضبط --- */
  for (const remaining of shares) {
    sequence += 1;
    const party = random.pick(parties);

    /*
     * نسبة السداد تحدد العلاقة بين الإجمالي والمتبقي. صفر = لم يُسدَّد شيء،
     * فالإجمالي = المتبقي. غير ذلك نحسب الإجمالي من المتبقي، لا العكس —
     * فالمتبقي هو الرقم المُقيَّد بالرصيد الرقابي.
     */
    const paidRatio = random.pickWeighted([
      [0, 5],
      [0.25, 2],
      [0.5, 2],
      [0.75, 1],
    ]);

    const total = paidRatio === 0 ? remaining : money.round(remaining / (1 - paidRatio));
    const paid = money.subtract(total, remaining);

    const subtotal = money.round(total / 1.14);
    const tax = money.subtract(total, subtotal);

    const issued = random.date(150, 2);
    const dueDate = addDays(issued, party.paymentTermsDays);

    invoices.push({
      id: idBase + sequence,
      number: `${prefix}-2026-${String(sequence).padStart(4, "0")}`,
      [dateField]: issued,
      dueDate,
      [partyField]: party.id,
      partyName: party.name,
      partyCode: party.code,
      accountId: party.accountId,
      subtotal,
      discount: 0,
      tax,
      total,
      paid,
      remaining,
      currency: "EGP",
      paymentTermsLabel: party.paymentTermsLabel,
      lifecycleStatus: "issued",
      status: money.isZero(paid) ? "unpaid" : "partially_paid",
      nature: natureOptions ? random.pick(natureOptions) : undefined,
      costCenterId: random.pick([4, 4, 4, 5, 7]),
      issuedAt: `${issued}T11:00:00+02:00`,
      createdBy: "محاسب / كريم فتحي",
      notes: null,
    });
  }

  /* --- فواتير مسدَّدة بالكامل: لا تؤثر على الرصيد، وتُثري التقارير --- */
  for (let index = 0; index < settledCount; index += 1) {
    sequence += 1;
    const party = random.pick(parties);
    const total = money.round(random.money(45_000, 900_000));
    const subtotal = money.round(total / 1.14);
    const issued = random.date(300, 20);

    invoices.push({
      id: idBase + sequence,
      number: `${prefix}-2026-${String(sequence).padStart(4, "0")}`,
      [dateField]: issued,
      dueDate: addDays(issued, party.paymentTermsDays),
      [partyField]: party.id,
      partyName: party.name,
      partyCode: party.code,
      accountId: party.accountId,
      subtotal,
      discount: 0,
      tax: money.subtract(total, subtotal),
      total,
      paid: total,
      remaining: 0,
      currency: "EGP",
      paymentTermsLabel: party.paymentTermsLabel,
      lifecycleStatus: "issued",
      status: "paid",
      nature: natureOptions ? random.pick(natureOptions) : undefined,
      costCenterId: random.pick([4, 4, 4, 5, 7]),
      issuedAt: `${issued}T11:00:00+02:00`,
      createdBy: "محاسب / كريم فتحي",
      notes: null,
    });
  }

  return invoices.sort((a, b) => String(b[dateField]).localeCompare(String(a[dateField])));
}

const customerInvoiceRows = buildPartyInvoices({
  parties: customers.filter((customer) => customer.status === "active"),
  openTotal: money.sum([GL.arLocal, GL.arExport]),
  openCount: 34,
  settledCount: 26,
  prefix: "SI",
  idBase: 1000,
  partyField: "customerId",
});

export const customerInvoices = customerInvoiceRows.map((row) => ({
  ...row,
  invoiceNumber: row.number,
  customerName: row.partyName,
  customerCode: row.partyCode,
}));

/** بنود الفواتير — تُعرض في تفصيل الفاتورة. */
export const customerInvoiceLines = customerInvoices.flatMap((invoice) => {
  const count = random.int(1, 4);
  const shares = money.allocateByWeight(
    invoice.subtotal,
    Array.from({ length: count }, () => 1 + random.float() * 3),
  );

  return shares.map((lineTotal, index) => {
    const quantity = random.int(5, 400);
    return {
      id: invoice.id * 100 + index + 1,
      invoiceId: invoice.id,
      lineNumber: index + 1,
      itemId: random.int(1, 40),
      description: random.pick([
        "توريد مستلزمات طبية حسب أمر التوريد",
        "توريد أدوية ومحاليل",
        "خدمات تعقيم وتجهيز",
        "توريد قطع غيار أجهزة طبية",
        "توريد مستلزمات تشغيل",
      ]),
      quantity,
      unitPrice: money.round(lineTotal / quantity),
      lineTotal,
      revenueAccountId: invoice.accountId === 1132 ? 4112 : 4111,
      taxRate: invoice.accountId === 1132 ? 0 : 0.14,
    };
  });
});

/** تحصيلات العملاء — المستند الذي خفّض المتبقي. */
export const customerReceipts = (() => {
  const out = [];
  let sequence = 0;

  for (const invoice of customerInvoices) {
    if (money.isZero(invoice.paid)) continue;

    const splits = invoice.status === "paid" && random.chance(0.35) ? 2 : 1;
    const amounts = money.allocate(invoice.paid, splits);

    amounts.forEach((amount, index) => {
      sequence += 1;
      const method = random.pickWeighted([
        ["bank_transfer", 6],
        ["cheque", 3],
        ["cash", 2],
        ["card", 1],
      ]);

      out.push({
        id: 3000 + sequence,
        receiptNumber: `RCV-2026-${String(sequence).padStart(4, "0")}`,
        date: addDays(invoice.date, random.int(3, 40) + index * 15),
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        amount,
        method,
        /**
         * الصندوق أو البنك الذي دخل فيه المال — يحكم القيد المحاسبي.
         *
         * محصور في الحسابات التي يستخدمها الدفتر فعلًا (الخزينة الرئيسية،
         * الأهلي، بنك مصر). توزيعه على حساب لا يحمل الدفتر حركة عليه يجعل
         * الأستاذ المساعد لذلك الحساب يتجاوز رصيده الرقابي، فتظهر مطابقة
         * بنكية برصيد كشف سالب — تناقض مصدره البيانات لا الحساب.
         */
        accountId: method === "cash" ? 1111 : random.pick([1121, 1121, 1121, 1122]),
        reference: method === "cash" ? null : `${method === "cheque" ? "CHQ" : "TRF"}-${random.int(100000, 999999)}`,
        methodLabel: { cash: "نقدي", bank_transfer: "تحويل بنكي", cheque: "شيك", card: "بطاقة بنكية" }[method],
        receivedBy: "أمين الخزينة / سامح زكي",
        status: "posted",
        notes: null,
      });
    });
  }

  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
})();

/** إشعارات دائنة للعملاء — تصحيح قيمة فاتورة بعد إصدارها. */
export const customerCreditNotes = Array.from({ length: 9 }, (_unused, index) => {
  const invoice = random.pick(customerInvoices.filter((row) => row.status !== "unpaid"));
  const amount = money.round(invoice.total * random.pick([0.03, 0.05, 0.08, 0.12]));
  const tax = money.round(amount - amount / 1.14);

  return {
    id: 4000 + index + 1,
    creditNoteNumber: `CN-2026-${String(index + 1).padStart(4, "0")}`,
    date: addDays(invoice.date, random.int(10, 60)),
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    amount,
    tax,
    reason: random.pick([
      "خصم كمية متأخر الاتفاق عليه",
      "تصحيح سعر وحدة في الفاتورة",
      "مردودات جزئية — أصناف غير مطابقة",
      "تسوية فرق وزن عند التسليم",
    ]),
    status: random.pickWeighted([["approved", 6], ["pending", 2], ["rejected", 1]]),
    requestedBy: "مسؤول تعاقدات / رامي خليل",
    approvedBy: "المدير المالي / هشام البحيري",
    notes: null,
  };
});

/* ============================================================================
   4. فواتير الموردين ومدفوعاتها
   ============================================================================ */

const supplierInvoiceRows = buildPartyInvoices({
  parties: suppliers.filter((supplier) => supplier.status === "active"),
  openTotal: GL.ap,
  openCount: 28,
  settledCount: 22,
  prefix: "PI",
  idBase: 5000,
  partyField: "supplierId",
  natureOptions: ["inventory", "inventory", "inventory", "expense"],
});

export const supplierInvoices = supplierInvoiceRows.map((row) => ({
  ...row,
  invoiceNumber: row.number,
  supplierName: row.partyName,
  supplierCode: row.partyCode,
  /** رقم فاتورة المورد الأصلية — مرجع خارجي لا يُولّده النظام. */
  supplierInvoiceNumber: `${random.int(1000, 9999)}/2026`,
  inventoryAccountId: row.nature === "inventory" ? random.pick([11411, 11412]) : null,
  expenseAccountId: row.nature === "expense" ? random.pick([5224, 5225, 5231, 532, 533]) : null,
}));

export const supplierPayments = (() => {
  const out = [];
  let sequence = 0;

  for (const invoice of supplierInvoices) {
    if (money.isZero(invoice.paid)) continue;

    sequence += 1;
    const method = random.pickWeighted([
      ["bank_transfer", 6],
      ["cheque", 4],
      ["cash", 1],
    ]);

    out.push({
      id: 6000 + sequence,
      paymentNumber: `PAY-2026-${String(sequence).padStart(4, "0")}`,
      date: addDays(invoice.date, random.int(5, 55)),
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      supplierId: invoice.supplierId,
      supplierName: invoice.supplierName,
      amount: invoice.paid,
      method,
      accountId: method === "cash" ? 1111 : random.pick([1121, 1121, 1122]),
      reference: method === "cash" ? null : `${method === "cheque" ? "CHQ" : "TRF"}-${random.int(100000, 999999)}`,
      /** الشيك المؤجَّل لا يُعدّ سدادًا حتى يُصرَف — حالته مستقلة. */
      clearanceStatus: method === "cheque" ? random.pickWeighted([["cleared", 7], ["outstanding", 3]]) : "cleared",
      paidBy: "أمين الخزينة / سامح زكي",
      approvedBy: "المدير المالي / هشام البحيري",
      status: "posted",
      notes: null,
    });
  }

  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
})();

/* ============================================================================
   5. الخزائن النقدية
   ============================================================================ */

export const cashBoxes = [
  { id: 1, code: "CB-MAIN", name: "الخزينة الرئيسية", accountId: 1111, custodianId: 6, custodian: "أمين الخزينة / سامح زكي", location: "المقر الرئيسي — الدور الأول", currency: "EGP", openingBalance: 227_000, balance: GL.cashMain, maxLimit: 1_200_000, lastReconciledAt: "2026-10-31", status: "active" },
  { id: 3, code: "CB-PETTY", name: "خزينة المصروفات النثرية", accountId: 1113, custodianId: 23, custodian: "سكرتير تنفيذي / هند درويش", location: "المقر الرئيسي — الاستقبال", currency: "EGP", openingBalance: 15_000, balance: GL.cashPetty, maxLimit: 50_000, lastReconciledAt: "2026-11-01", status: "active" },
];

/**
 * حركات الخزينة.
 *
 * مُشتقّة من مستندات التحصيل والسداد النقدية لا مولَّدة بشكل مستقل: حركة
 * خزينة لا يقابلها مستند هي بالضبط العجز الذي يكشفه الجرد، وتوليدها عشوائيًا
 * يجعل كل جرد في البيانات التجريبية يُظهر عجزًا وهميًا.
 */
export const cashMovements = (() => {
  const out = [];
  let sequence = 0;

  const boxByAccount = new Map(cashBoxes.map((box) => [String(box.accountId), box]));

  for (const receipt of customerReceipts.filter((row) => row.method === "cash")) {
    sequence += 1;
    out.push({
      id: 7000 + sequence,
      voucherNumber: `CRV-2026-${String(sequence).padStart(4, "0")}`,
      date: receipt.date,
      cashBoxId: boxByAccount.get(String(receipt.accountId))?.id ?? 1,
      direction: "in",
      type: "customer_receipt",
      amount: receipt.amount,
      description: `تحصيل نقدي من ${receipt.customerName}`,
      partyType: "customer",
      partyId: receipt.customerId,
      reference: receipt.receiptNumber,
      sourceType: "customer_receipt",
      sourceId: receipt.id,
      performedBy: receipt.receivedBy,
      status: "posted",
    });
  }

  for (const payment of supplierPayments.filter((row) => row.method === "cash")) {
    sequence += 1;
    out.push({
      id: 7000 + sequence,
      voucherNumber: `CPV-2026-${String(sequence).padStart(4, "0")}`,
      date: payment.date,
      cashBoxId: boxByAccount.get(String(payment.accountId))?.id ?? 1,
      direction: "out",
      type: "supplier_payment",
      amount: payment.amount,
      description: `سداد نقدي إلى ${payment.supplierName}`,
      partyType: "supplier",
      partyId: payment.supplierId,
      reference: payment.paymentNumber,
      sourceType: "supplier_payment",
      sourceId: payment.id,
      performedBy: payment.paidBy,
      status: "posted",
    });
  }

  /* مصروفات نثرية من خزينة النثرية — مستندات صرف مستقلة. */
  for (let index = 0; index < 18; index += 1) {
    sequence += 1;
    out.push({
      id: 7000 + sequence,
      voucherNumber: `CPV-2026-${String(sequence).padStart(4, "0")}`,
      date: random.date(60, 1),
      cashBoxId: 3,
      direction: "out",
      type: "expense",
      amount: money.round(random.money(250, 4_800)),
      description: random.pick([
        "مواصلات وانتقالات",
        "ضيافة واستقبال",
        "بريد وشحن مستندات",
        "أدوات مكتبية عاجلة",
        "صيانة طارئة",
        "رسوم حكومية ودمغات",
      ]),
      partyType: null,
      partyId: null,
      counterAccountId: random.pick([5225, 5232, 544, 5224]),
      costCenterId: random.pick([1, 2, 3, 8]),
      reference: null,
      sourceType: "cash_payment",
      sourceId: 7000 + sequence,
      performedBy: "سكرتير تنفيذي / هند درويش",
      status: "posted",
    });
  }

  /* تحويلات بين الخزائن والبنوك — توريد الفائض. */
  for (let month = 1; month <= 10; month += 1) {
    sequence += 1;
    const mm = String(month).padStart(2, "0");
    out.push({
      id: 7000 + sequence,
      voucherNumber: `CTR-2026-${String(month).padStart(4, "0")}`,
      date: `2026-${mm}-27`,
      cashBoxId: 1,
      direction: "out",
      type: "transfer_to_bank",
      amount: 650_000,
      description: "توريد فائض الخزينة إلى البنك الأهلي",
      partyType: null,
      partyId: null,
      toAccountId: 1121,
      reference: `DEP-2026-${mm}`,
      sourceType: "bank_deposit",
      sourceId: 1000 + month,
      performedBy: "أمين الخزينة / سامح زكي",
      status: "posted",
    });
  }

  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
})();

/** جرد الخزائن — المطابقة بين الرصيد الدفتري والفعلي. */
export const cashReconciliations = [
  { id: 1, cashBoxId: 1, date: "2026-10-31", bookBalance: 1_228_300, countedBalance: 1_228_300, difference: 0, status: "reconciled", countedBy: "المراجع الداخلي / نادر الفقي", notes: "مطابقة تامة." },
  { id: 3, cashBoxId: 3, date: "2026-11-01", bookBalance: 15_000, countedBalance: 15_000, difference: 0, status: "reconciled", countedBy: "مدير الحسابات", notes: null },
  { id: 4, cashBoxId: 1, date: "2026-11-07", bookBalance: GL.cashMain, countedBalance: null, difference: null, status: "counting", countedBy: null, notes: "جرد جارٍ — بانتظار العدّ الفعلي." },
];

/* ============================================================================
   6. الحسابات البنكية
   ============================================================================ */

export const bankAccounts = [
  { id: 1, code: "BNK-NBE-01", bankName: "البنك الأهلي المصري", branch: "فرع بني سويف الرئيسي", accountName: "مستشفى أمان الحياة", accountNumber: "4521003876091", iban: "EG380003004521003876091123", swift: "NBEGEGCX", accountId: 1121, currency: "EGP", type: "current", openingBalance: 1_840_000, balance: GL.bankNbe, overdraftLimit: 2_000_000, lastReconciledAt: "2026-10-31", status: "active" },
  { id: 2, code: "BNK-BM-01", bankName: "بنك مصر", branch: "فرع بني سويف", accountName: "مستشفى أمان الحياة", accountNumber: "1100294517003", iban: "EG120002001100294517003456", swift: "BMISEGCX", accountId: 1122, currency: "EGP", type: "current", openingBalance: 960_000, balance: GL.bankMisr, overdraftLimit: 500_000, lastReconciledAt: "2026-10-31", status: "active" },
  { id: 3, code: "BNK-CIB-01", bankName: "البنك التجاري الدولي", branch: "فرع بني سويف", accountName: "مستشفى أمان الحياة", accountNumber: "100078452100", iban: "EG450010000100078452100789", swift: "CIBEEGCX", accountId: 1123, currency: "EGP", type: "current", openingBalance: 420_000, balance: GL.bankCib, overdraftLimit: 0, lastReconciledAt: "2026-10-31", status: "active" },
  { id: 4, code: "BNK-CAI-PR", bankName: "بنك القاهرة", branch: "فرع بني سويف", accountName: "مستشفى أمان الحياة — حساب الرواتب", accountNumber: "7700458120036", iban: "EG770007007700458120036012", swift: "CAIREGCX", accountId: 1124, currency: "EGP", type: "payroll", openingBalance: 180_000, balance: GL.bankCairo, overdraftLimit: 0, lastReconciledAt: "2026-10-31", status: "active" },
];

/**
 * حركات البنوك — مُشتقّة من مستندات التحصيل والسداد غير النقدية.
 * نفس المنطق في `cashMovements`: الحركة تتبع مستندًا.
 */
export const bankTransactions = (() => {
  const out = [];
  let sequence = 0;
  const accountToBank = new Map(bankAccounts.map((bank) => [String(bank.accountId), bank]));

  /**
   * هل هذه الحركة مُطابَقة؟
   *
   * المطابقة تجري **حتى تاريخ كشف** لا عشوائيًا على الحركات: كل ما قبل تاريخ
   * آخر مطابقة مُطابَق، وما بعده معلَّق بانتظار الكشف التالي. التوزيع العشوائي
   * يُنتج حركات قديمة غير مُطابَقة بمبالغ ضخمة، فيخرج «رصيد كشف البنك» سالبًا
   * ويبدو النظام وكأنه يحسب المطابقة خطأً.
   */
  const reconciledThrough = new Map(
    bankAccounts.map((bank) => [String(bank.accountId), bank.lastReconciledAt ?? "2026-10-31"]),
  );
  const isReconciledBy = (date, accountId) =>
    String(date).slice(0, 10) <= (reconciledThrough.get(String(accountId)) ?? "2026-10-31");

  for (const receipt of customerReceipts.filter((row) => row.method !== "cash")) {
    sequence += 1;
    out.push({
      id: 8000 + sequence,
      date: receipt.date,
      bankAccountId: accountToBank.get(String(receipt.accountId))?.id ?? 1,
      direction: "in",
      type: receipt.method === "cheque" ? "cheque_deposit" : "incoming_transfer",
      amount: receipt.amount,
      description: `تحصيل من ${receipt.customerName}`,
      reference: receipt.reference,
      partyType: "customer",
      partyId: receipt.customerId,
      sourceType: "customer_receipt",
      sourceId: receipt.id,
      /** المطابقة البنكية: الحركة غير المُطابَقة لم تُؤكَّد في كشف البنك بعد. */
      reconciled: isReconciledBy(receipt.date, receipt.accountId),
      statementDate: isReconciledBy(receipt.date, receipt.accountId) ? receipt.date : null,
      status: "posted",
    });
  }

  for (const payment of supplierPayments.filter((row) => row.method !== "cash")) {
    sequence += 1;
    out.push({
      id: 8000 + sequence,
      date: payment.date,
      bankAccountId: accountToBank.get(String(payment.accountId))?.id ?? 1,
      direction: "out",
      type: payment.method === "cheque" ? "cheque_issued" : "outgoing_transfer",
      amount: payment.amount,
      description: `سداد إلى ${payment.supplierName}`,
      reference: payment.reference,
      partyType: "supplier",
      partyId: payment.supplierId,
      sourceType: "supplier_payment",
      sourceId: payment.id,
      /* الشيك المعلَّق لا يُطابَق حتى يُصرَف، ولو كان تاريخه قديمًا. */
      reconciled: payment.clearanceStatus === "cleared" && isReconciledBy(payment.date, payment.accountId),
      statementDate:
        payment.clearanceStatus === "cleared" && isReconciledBy(payment.date, payment.accountId)
          ? payment.date
          : null,
      status: "posted",
    });
  }

  /* الرواتب والإيداعات والأعباء البنكية. */
  for (let month = 1; month <= 10; month += 1) {
    const mm = String(month).padStart(2, "0");

    sequence += 1;
    out.push({
      id: 8000 + sequence, date: `2026-${mm}-05`, bankAccountId: 4, direction: "out",
      type: "payroll", amount: 730_500, description: "صرف رواتب الشهر السابق",
      reference: `PR-2026-${mm}`, partyType: null, partyId: null,
      sourceType: "payroll_payment", sourceId: month - 1, reconciled: true, statementDate: `2026-${mm}-05`, status: "posted",
    });

    sequence += 1;
    out.push({
      id: 8000 + sequence, date: `2026-${mm}-27`, bankAccountId: 1, direction: "in",
      type: "cash_deposit", amount: 650_000, description: "إيداع نقدي من الخزينة الرئيسية",
      reference: `DEP-2026-${mm}`, partyType: null, partyId: null,
      sourceType: "bank_deposit", sourceId: 1000 + month, reconciled: true, statementDate: `2026-${mm}-27`, status: "posted",
    });
  }

  sequence += 1;
  out.push({
    id: 8000 + sequence, date: "2026-10-28", bankAccountId: 1, direction: "out",
    type: "bank_charges", amount: 47_200, description: "فوائد قرض وأعباء بنكية — الربع الثالث",
    reference: "INT-Q3-2026", partyType: null, partyId: null,
    sourceType: "manual", sourceId: 22, reconciled: true, statementDate: "2026-10-28", status: "posted",
  });

  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
})();

/** جلسات المطابقة البنكية. */
export const bankReconciliations = bankAccounts.map((bank, index) => {
  const unreconciled = bankTransactions.filter(
    (row) => row.bankAccountId === bank.id && !row.reconciled,
  );

  const outstanding = money.sum(
    unreconciled.map((row) => (row.direction === "out" ? row.amount : money.multiply(row.amount, -1))),
  );

  return {
    id: index + 1,
    bankAccountId: bank.id,
    bankName: bank.bankName,
    statementDate: bank.lastReconciledAt ?? "2026-10-31",
    /** رصيد كشف البنك = الرصيد الدفتري + المعلَّق (شيكات صادرة لم تُصرَف). */
    statementBalance: money.add(bank.balance, outstanding),
    bookBalance: bank.balance,
    outstandingCount: unreconciled.length,
    outstandingAmount: outstanding,
    difference: 0,
    status: unreconciled.length === 0 ? "reconciled" : "unreconciled",
    reconciledBy: "محاسب / كريم فتحي",
    notes: unreconciled.length
      ? `${unreconciled.length} حركة لم تظهر في كشف البنك بعد.`
      : "مطابقة تامة.",
  };
});

/* ============================================================================
   7. الأصول الثابتة

   مجمع إهلاك كل فئة يُطابق حسابه الرقابي في الدفتر، وتكلفة كل فئة كذلك.
   ============================================================================ */

export const assetCategories = [
  { id: 1, code: "FAC-BLD", name: "أراضٍ ومبانٍ", assetAccountId: 1211, accumulatedAccountId: 1221, expenseAccountId: 5241, defaultMethod: "straight_line", defaultLifeYears: 30, defaultSalvageRate: 0.1 },
  { id: 2, code: "FAC-MCH", name: "أجهزة ومعدات طبية", assetAccountId: 1212, accumulatedAccountId: 1222, expenseAccountId: 5241, defaultMethod: "straight_line", defaultLifeYears: 7, defaultSalvageRate: 0.08 },
  { id: 3, code: "FAC-FRN", name: "أثاث وتجهيزات مكتبية", assetAccountId: 1213, accumulatedAccountId: 1223, expenseAccountId: 5241, defaultMethod: "straight_line", defaultLifeYears: 8, defaultSalvageRate: 0.05 },
  { id: 4, code: "FAC-ICT", name: "أجهزة حاسب وشبكات", assetAccountId: 1214, accumulatedAccountId: 1224, expenseAccountId: 5241, defaultMethod: "double_declining", defaultLifeYears: 4, defaultSalvageRate: 0.05 },
  { id: 5, code: "FAC-VEH", name: "سيارات ووسائل نقل", assetAccountId: 1215, accumulatedAccountId: 1225, expenseAccountId: 5241, defaultMethod: "straight_line", defaultLifeYears: 6, defaultSalvageRate: 0.15 },
];

export const fixedAssets = (() => {
  /**
   * لكل فئة: عدد الأصول، وأسماؤها، وتكلفتها الإجمالية ومجمع إهلاكها —
   * كلاهما من الحساب الرقابي، موزَّعًا على الأصول.
   */
  const plan = [
    { categoryId: 1, cost: GL.costBuildings, accumulated: GL.accDepBuildings, names: ["مبنى المستشفى الرئيسي — بني سويف", "مبنى العيادات الخارجية", "أرض المستشفى", "مبنى المخازن الملحق"], costCenterId: 1 },
    { categoryId: 2, cost: GL.costMachinery, accumulated: GL.accDepMachinery, names: ["جهاز أشعة مقطعية", "جهاز رنين مغناطيسي", "جهاز أشعة سينية رقمي", "ماكينات غسيل كلوي — وحدة كاملة", "أجهزة تعقيم مركزي (أوتوكلاف)", "مولد كهربائي 500 ك.ف.أ", "أجهزة تنفس صناعي — العناية المركزة", "أجهزة مراقبة مرضى — الأقسام"], costCenterId: 7 },
    { categoryId: 3, cost: GL.costFurniture, accumulated: GL.accDepFurniture, names: ["أثاث مكاتب الإدارة العليا", "أثاث قاعة الاجتماعات", "تجهيزات الاستقبال والعيادات", "أثاث مكاتب الإدارة المالية", "أسرّة طبية وتجهيزات الغرف", "تكييفات مركزية — المستشفى"], costCenterId: 1 },
    { categoryId: 4, cost: GL.costComputers, accumulated: GL.accDepComputers, names: ["سيرفر التطبيقات الرئيسي", "سيرفر قواعد البيانات", "شبكة ومُبدّلات المستشفى", "أجهزة حاسب — الإدارة المالية", "أجهزة حاسب — التعاقدات", "طابعات وماسحات ضوئية", "نظام كاميرات المراقبة"], costCenterId: 8 },
    { categoryId: 5, cost: GL.costVehicles, accumulated: GL.accDepVehicles, names: ["سيارة إسعاف مجهزة — رقم 1", "سيارة إسعاف مجهزة — رقم 2", "سيارة إسعاف مجهزة — رقم 3", "سيارة نقل خفيف — المشتريات", "سيارة إدارية — المدير العام", "سيارة إدارية — المدير المالي", "ميكروباص نقل العاملين"], costCenterId: 6 },
  ];

  const out = [];
  let id = 0;

  for (const group of plan) {
    const category = assetCategories.find((row) => row.id === group.categoryId);
    const count = group.names.length;

    const weights = Array.from({ length: count }, () => 1 + random.float() * 3);
    const costs = money.allocateByWeight(group.cost, weights);
    /* مجمع الإهلاك يُوزَّع بنفس الأوزان، فتبقى نسبة الاستهلاك متقاربة ومعقولة. */
    const accumulations = money.allocateByWeight(group.accumulated, weights);

    group.names.forEach((name, index) => {
      id += 1;
      const cost = costs[index];
      const salvageValue = money.round(cost * category.defaultSalvageRate);
      const accumulated = money.min(accumulations[index], money.subtract(cost, salvageValue));

      const purchaseDate = random.date(2200, 400);

      out.push({
        id,
        code: `FA-${String(id).padStart(4, "0")}`,
        name,
        nameEn: null,
        categoryId: category.id,
        categoryName: category.name,
        assetAccountId: category.assetAccountId,
        accumulatedAccountId: category.accumulatedAccountId,
        expenseAccountId: category.expenseAccountId,
        costCenterId: group.costCenterId,
        custodianId: random.int(1, 25),
        serialNumber: `SN-${random.int(100000, 999999)}`,
        supplierId: random.int(1, 12),
        purchaseDate,
        inServiceDate: addDays(purchaseDate, random.int(0, 30)),
        acquisitionCost: cost,
        salvageValue,
        usefulLifeYears: category.defaultLifeYears,
        method: category.defaultMethod,
        rate: null,
        accumulatedDepreciation: accumulated,
        /**
         * القيمة الدفترية **لا تُخزَّن** — تُشتق في js/domain/depreciation.js
         * من التكلفة ومجمع الإهلاك. تخزينها يُنشئ حقلاً ثالثًا يتناقض مع
         * الحقلين الأولين عند أول تشغيل إهلاك لا يُحدّثه.
         */
        status: money.compare(accumulated, money.subtract(cost, salvageValue)) >= 0
          ? "fully_depreciated"
          : "in_service",
        disposalDate: null,
        disposalProceeds: null,
        notes: null,
      });
    });
  }

  /* أصل مُستبعد — ليُظهر مسار الاستبعاد في الشاشة والتقرير. */
  out.push({
    id: id + 1,
    code: `FA-${String(id + 1).padStart(4, "0")}`,
    name: "سيارة إدارية قديمة — بيعت",
    nameEn: null,
    categoryId: 5,
    categoryName: "سيارات ووسائل نقل",
    assetAccountId: 1215,
    accumulatedAccountId: 1225,
    expenseAccountId: 5241,
    costCenterId: 6,
    custodianId: 1,
    serialNumber: "SN-204517",
    supplierId: 12,
    purchaseDate: "2018-04-12",
    inServiceDate: "2018-05-01",
    acquisitionCost: 320_000,
    salvageValue: 48_000,
    usefulLifeYears: 6,
    method: "straight_line",
    rate: null,
    accumulatedDepreciation: 272_000,
    status: "disposed",
    disposalDate: "2026-06-18",
    disposalProceeds: 62_000,
    notes: "بيعت بمبلغ 62,000 ج.م — ربح استبعاد 14,000 ج.م.",
  });

  return out;
})();

/** تشغيلات الإهلاك الدورية المُنفَّذة. */
export const depreciationRuns = Array.from({ length: 10 }, (_unused, index) => {
  const month = index + 1;
  const mm = String(month).padStart(2, "0");

  return {
    id: month,
    runNumber: `DEP-2026-${mm}`,
    period: `2026-${mm}`,
    date: new Date(Date.UTC(2026, month, 0)).toISOString().slice(0, 10),
    assetsCount: fixedAssets.filter((asset) => asset.status !== "disposed").length,
    totalDepreciation: 123_750,
    journalEntryId: null,
    status: "posted",
    runBy: "محاسب / كريم فتحي",
    postedAt: `${new Date(Date.UTC(2026, month, 0)).toISOString().slice(0, 10)}T18:00:00+02:00`,
  };
});

/* ============================================================================
   8. الضرائب
   ============================================================================ */

export const taxes = [
  { id: 1, code: "VAT-14", name: "ضريبة القيمة المضافة", nameEn: "VAT", rate: 0.14, type: "vat", appliesTo: "sales_and_purchases", outputAccountId: 2131, inputAccountId: 1161, isDefault: true, status: "active", notes: "النسبة العامة." },
  { id: 2, code: "VAT-5", name: "ض.ق.م — نسبة مخفَّضة", nameEn: "VAT Reduced", rate: 0.05, type: "vat", appliesTo: "sales_and_purchases", outputAccountId: 2131, inputAccountId: 1161, isDefault: false, status: "active", notes: "لبعض الأصناف." },
  { id: 3, code: "VAT-0", name: "معفى / صفر", nameEn: "Zero-rated", rate: 0, type: "vat", appliesTo: "sales", outputAccountId: 2131, inputAccountId: null, isDefault: false, status: "active", notes: "الصادرات." },
  { id: 4, code: "WHT-1", name: "خصم وإضافة — توريدات", nameEn: "WHT Supplies", rate: 0.01, type: "withholding", appliesTo: "purchases", outputAccountId: 2132, inputAccountId: 1162, isDefault: false, status: "active", notes: null },
  { id: 5, code: "WHT-3", name: "خصم وإضافة — خدمات", nameEn: "WHT Services", rate: 0.03, type: "withholding", appliesTo: "purchases", outputAccountId: 2132, inputAccountId: 1162, isDefault: false, status: "active", notes: null },
  { id: 6, code: "WHT-5", name: "خصم وإضافة — مقاولات", nameEn: "WHT Contracting", rate: 0.05, type: "withholding", appliesTo: "purchases", outputAccountId: 2132, inputAccountId: 1162, isDefault: false, status: "active", notes: null },
  { id: 7, code: "CIT-225", name: "ضريبة أرباح تجارية", nameEn: "Corporate Income Tax", rate: 0.225, type: "income", appliesTo: "profit", outputAccountId: 2133, inputAccountId: null, isDefault: false, status: "active", notes: "تُحتسب سنويًا على صافي الربح الضريبي." },
];

/** إقرارات ض.ق.م الشهرية. */
export const taxReturns = Array.from({ length: 10 }, (_unused, index) => {
  const month = index + 1;
  const mm = String(month).padStart(2, "0");
  const output = money.round(random.money(580_000, 740_000));
  const input = money.round(random.money(480_000, 620_000));

  return {
    id: month,
    returnNumber: `VAT-2026-${mm}`,
    taxId: 1,
    period: `2026-${mm}`,
    dueDate: `2026-${String(month + 1).padStart(2, "0")}-15`,
    outputTax: output,
    inputTax: input,
    netPayable: money.max(money.subtract(output, input), 0),
    carriedForward: money.max(money.subtract(input, output), 0),
    status: month <= 9 ? "paid" : "pending",
    filedAt: month <= 9 ? `2026-${String(month + 1).padStart(2, "0")}-12` : null,
    filedBy: month <= 9 ? "رئيس الحسابات / هالة منصور" : null,
    notes: null,
  };
});

/* ============================================================================
   9. الأرصدة المُشتقّة — للتحقق والعرض
   ============================================================================ */

/**
 * ملخص المطابقة بين الأستاذ المساعد والحساب الرقابي.
 * تقرؤه شاشة «مطابقة الحسابات» وتستخدمه اختبارات البيانات.
 */
export const subsidiaryReconciliation = [
  {
    key: "receivables",
    label: "العملاء (مدينون)",
    controlAccounts: [1131, 1132],
    controlBalance: money.sum([GL.arLocal, GL.arExport]),
    subsidiaryBalance: money.sumBy(customerInvoices, "remaining"),
  },
  {
    key: "payables",
    label: "الموردون (دائنون)",
    controlAccounts: [2111],
    controlBalance: GL.ap,
    subsidiaryBalance: money.sumBy(supplierInvoices, "remaining"),
  },
  {
    key: "cash",
    label: "الخزائن النقدية",
    controlAccounts: [1111, 1113],
    controlBalance: money.sum([GL.cashMain, GL.cashPetty]),
    subsidiaryBalance: money.sumBy(cashBoxes, "balance"),
  },
  {
    key: "banks",
    label: "الحسابات البنكية",
    controlAccounts: [1121, 1122, 1123, 1124],
    controlBalance: money.sum([GL.bankNbe, GL.bankMisr, GL.bankCib, GL.bankCairo]),
    subsidiaryBalance: money.sumBy(bankAccounts, "balance"),
  },
  {
    key: "fixed_assets",
    label: "الأصول الثابتة — مجمع الإهلاك",
    controlAccounts: [1221, 1222, 1223, 1224, 1225],
    controlBalance: money.sum([
      GL.accDepBuildings, GL.accDepMachinery, GL.accDepFurniture,
      GL.accDepComputers, GL.accDepVehicles,
    ]),
    subsidiaryBalance: money.sumBy(
      fixedAssets.filter((asset) => asset.status !== "disposed"),
      "accumulatedDepreciation",
    ),
  },
].map((row) => ({
  ...row,
  difference: money.subtract(row.controlBalance, row.subsidiaryBalance),
  isReconciled: money.equals(row.controlBalance, row.subsidiaryBalance),
}));

export { TODAY as FINANCE_TODAY };

/**
 * قواعد الربط المحاسبي — ترجمة أحداث الموديولات إلى سطور قيد.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  هذا هو الملف الذي يُجيب على سؤال: «أي حساب يُدين وأي حساب يُدان؟»
 *  لا موديول آخر يجيب عليه. موديول الرواتب يقول «مسيّر اعتُمد بهذه الأرقام»،
 *  وهنا فقط تُقرَّر الحسابات.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * دوال خالصة. كل دالة تأخذ (مستند، خريطة الحسابات، سياق) وتُعيد سطور قيد
 * غير مُتحقَّق منها بعد — `buildEntry` في js/domain/posting.js هو من يتحقق
 * من توازنها. هذا الفصل مقصود: القواعد تصف النية، والبوابة تضمن الصحة.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  خريطة الحسابات (`accountMap`) تأتي من إعدادات النظام لا من كود مكتوب:
 *  دليل الحسابات يختلف من منشأة لأخرى، وتثبيت أرقام الحسابات في الكود يجعل
 *  النظام غير قابل للتركيب عند عميل آخر. الإعداد في /settings/posting-map.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import * as money from "../core/money.js";
import { ruleViolation } from "../core/errors.js";
import { debit, credit, SourceType } from "./posting.js";

/* ==========================================================================
   1) مفاتيح خريطة الربط
   ========================================================================== */

/**
 * المفاتيح التي يحتاجها النظام في خريطة الربط المحاسبي، ووصف كل منها.
 *
 * شاشة إعدادات الربط تبني نموذجها من هذا الكائن، فإضافة مفتاح جديد هنا
 * تظهر في الشاشة تلقائيًا — لا مكان ثانٍ يحتاج تحديثًا.
 */
export const MAP_KEYS = Object.freeze({
  /* --- النقدية --- */
  cashOnHand: "النقدية بالصناديق (الحساب الأب)",
  bankAccounts: "الحسابات البنكية (الحساب الأب)",
  cashInTransit: "النقدية تحت التحويل",

  /* --- العملاء والموردون --- */
  accountsReceivable: "العملاء والمدينون",
  accountsPayable: "الموردون والدائنون",
  advancesFromCustomers: "دفعات مقدمة من العملاء",
  advancesToSuppliers: "دفعات مقدمة للموردين",

  /* --- الإيرادات والمبيعات --- */
  salesRevenue: "إيرادات المبيعات",
  serviceRevenue: "إيرادات الخدمات",
  salesReturns: "مردودات المبيعات",
  salesDiscounts: "الخصم المسموح به",
  otherIncome: "إيرادات أخرى",

  /* --- المخزون وتكلفة المبيعات --- */
  inventory: "المخزون السلعي",
  goodsReceivedNotInvoiced: "مخزون مستلم ولم يُفوتر",
  costOfGoodsSold: "تكلفة المبيعات",
  inventoryShrinkage: "عجز وتلف المخزون",
  inventorySurplus: "زيادة المخزون (إيراد تسوية)",
  purchaseReturns: "مردودات المشتريات",

  /* --- الضرائب --- */
  outputVat: "ضريبة القيمة المضافة — المستحقة (مخرجات)",
  inputVat: "ضريبة القيمة المضافة — القابلة للخصم (مدخلات)",
  withholdingTax: "ضريبة الخصم والإضافة",
  payrollTaxPayable: "ضريبة كسب العمل المستحقة",

  /* --- الرواتب والموارد البشرية --- */
  salariesExpense: "مصروف الرواتب والأجور",
  allowancesExpense: "مصروف البدلات والمكافآت",
  overtimeExpense: "مصروف العمل الإضافي",
  employerSocialInsuranceExpense: "حصة صاحب العمل في التأمينات",
  salariesPayable: "رواتب وأجور مستحقة",
  socialInsurancePayable: "تأمينات اجتماعية مستحقة",
  employeeAdvances: "سلف وعهد الموظفين",
  payrollDeductionsPayable: "استقطاعات مستحقة أخرى",

  /* --- الأصول الثابتة --- */
  fixedAssets: "الأصول الثابتة",
  accumulatedDepreciation: "مجمع إهلاك الأصول الثابتة",
  depreciationExpense: "مصروف الإهلاك",
  gainOnAssetDisposal: "أرباح استبعاد أصول",
  lossOnAssetDisposal: "خسائر استبعاد أصول",

  /* --- الإغلاق --- */
  retainedEarnings: "الأرباح المرحلة",
  incomeSummary: "ملخص الأرباح والخسائر",
});

/**
 * يقرأ حسابًا من الخريطة، ويفشل بوضوح إن كان غير مُعَد.
 *
 * الفشل هنا مقصود وصريح: ترحيل فاتورة إلى حساب خاطئ أسوأ بكثير من رفض
 * ترحيلها ومطالبة المستخدم بإكمال إعداد الربط. الحساب الخاطئ يُكتشف بعد
 * شهور في مراجعة، والرفض يُكتشف في نفس الثانية.
 */
export function resolveAccount(accountMap, key, { optional = false } = {}) {
  const value = accountMap?.[key];

  if (value === undefined || value === null || value === "") {
    if (optional) return null;
    throw ruleViolation(
      `حساب «${MAP_KEYS[key] ?? key}» غير مُعَد في خريطة الربط المحاسبي. ` +
        "أكمل الإعداد من إعدادات ← الربط المحاسبي قبل تنفيذ هذه العملية.",
      { field: key },
    );
  }

  return value;
}

/** يسمح للمستند بتجاوز الخريطة بحساب صريح (مثل حساب إيراد لكل بند). */
function accountOr(explicit, accountMap, key, options) {
  return explicit ?? resolveAccount(accountMap, key, options);
}

/* ==========================================================================
   2) العملاء — الذمم المدينة
   ========================================================================== */

/**
 * فاتورة عميل:  مدين العميل، دائن الإيراد + ضريبة المخرجات.
 *
 * الخصم يُعرض كمصروف «خصم مسموح به» لا كتخفيض للإيراد، فيبقى الإيراد
 * الإجمالي ظاهرًا في قائمة الدخل وتُقاس سياسة الخصم بشكل مستقل.
 *
 * @param {object} invoice `{ total, subtotal, discount, tax, customerId, lines }`
 */
export function customerInvoiceLines(invoice, accountMap) {
  const subtotal = money.round(invoice?.subtotal ?? 0);
  const discount = money.round(invoice?.discount ?? 0);
  const tax = money.round(invoice?.tax ?? 0);
  const total = money.round(invoice?.total ?? 0);

  const lines = [
    debit(resolveAccount(accountMap, "accountsReceivable"), total, {
      description: `مديونية العميل ${invoice?.customerName ?? ""}`.trim(),
      partyType: "customer",
      partyId: invoice?.customerId ?? null,
    }),
  ];

  if (money.isPositive(discount)) {
    lines.push(
      debit(resolveAccount(accountMap, "salesDiscounts"), discount, {
        description: "خصم مسموح به",
      }),
    );
  }

  /*
   * الإيراد يُوزَّع على حسابات البنود إن حملتها، وإلا يُجمَّع في حساب واحد.
   * التوزيع هنا لا في الشاشة: شاشة الفاتورة لا تعرف دليل الحسابات.
   */
  const byRevenueAccount = new Map();
  for (const row of invoice?.lines ?? []) {
    const key = row.revenueAccountId ?? null;
    byRevenueAccount.set(key, money.add(byRevenueAccount.get(key) ?? 0, row.lineTotal ?? 0));
  }

  if (byRevenueAccount.size > 0) {
    for (const [accountId, amount] of byRevenueAccount) {
      lines.push(
        credit(accountOr(accountId, accountMap, "salesRevenue"), amount, {
          description: "إيراد مبيعات",
          costCenterId: invoice?.costCenterId ?? null,
        }),
      );
    }
  } else {
    lines.push(
      credit(resolveAccount(accountMap, "salesRevenue"), subtotal, {
        description: "إيراد مبيعات",
        costCenterId: invoice?.costCenterId ?? null,
      }),
    );
  }

  if (money.isPositive(tax)) {
    lines.push(
      credit(resolveAccount(accountMap, "outputVat"), tax, {
        description: "ضريبة قيمة مضافة مستحقة",
      }),
    );
  }

  return lines;
}

/**
 * تحصيل من عميل: مدين الصندوق/البنك، دائن العميل.
 * `receipt.accountId` هو حساب الصندوق أو البنك الذي دخل فيه المال فعلًا.
 */
export function customerReceiptLines(receipt, accountMap) {
  const amount = money.round(receipt?.amount ?? 0);

  return [
    debit(accountOr(receipt?.accountId, accountMap, "cashOnHand"), amount, {
      description: `تحصيل من ${receipt?.customerName ?? "عميل"}`,
    }),
    credit(resolveAccount(accountMap, "accountsReceivable"), amount, {
      description: `سداد مديونية ${receipt?.customerName ?? ""}`.trim(),
      partyType: "customer",
      partyId: receipt?.customerId ?? null,
    }),
  ];
}

/**
 * إشعار دائن لعميل: عكس جزئي لقيمة الفاتورة.
 * مدين مردودات المبيعات + عكس الضريبة، دائن العميل.
 */
export function customerCreditNoteLines(creditNote, accountMap) {
  const amount = money.round(creditNote?.amount ?? 0);
  const tax = money.round(creditNote?.tax ?? 0);
  const net = money.subtract(amount, tax);

  return [
    debit(resolveAccount(accountMap, "salesReturns"), net, {
      description: `إشعار دائن ${creditNote?.creditNoteNumber ?? ""}`.trim(),
    }),
    ...(money.isPositive(tax)
      ? [
          debit(resolveAccount(accountMap, "outputVat"), tax, {
            description: "عكس ضريبة مخرجات",
          }),
        ]
      : []),
    credit(resolveAccount(accountMap, "accountsReceivable"), amount, {
      description: `تخفيض مديونية ${creditNote?.customerName ?? ""}`.trim(),
      partyType: "customer",
      partyId: creditNote?.customerId ?? null,
    }),
  ];
}

/* ==========================================================================
   3) الموردون — الذمم الدائنة
   ========================================================================== */

/**
 * فاتورة مورد. الطرف المدين يعتمد على طبيعة المشترى:
 *   - مخزون  → حساب المخزون (أصل)
 *   - مصروف  → حساب المصروف المحدَّد في المستند
 *
 * `invoice.nature` تأخذ "inventory" أو "expense".
 */
export function supplierInvoiceLines(invoice, accountMap) {
  const subtotal = money.round(invoice?.subtotal ?? 0);
  const tax = money.round(invoice?.tax ?? 0);
  const total = money.round(invoice?.total ?? 0);
  const nature = invoice?.nature ?? "inventory";

  const debitAccount =
    nature === "inventory"
      ? accountOr(invoice?.inventoryAccountId, accountMap, "inventory")
      : accountOr(invoice?.expenseAccountId, accountMap, "costOfGoodsSold");

  return [
    debit(debitAccount, subtotal, {
      description: nature === "inventory" ? "إضافة مخزون بالتكلفة" : "مصروف مُفوتر",
      costCenterId: invoice?.costCenterId ?? null,
    }),
    ...(money.isPositive(tax)
      ? [
          debit(resolveAccount(accountMap, "inputVat"), tax, {
            description: "ضريبة قيمة مضافة قابلة للخصم",
          }),
        ]
      : []),
    credit(resolveAccount(accountMap, "accountsPayable"), total, {
      description: `التزام تجاه ${invoice?.supplierName ?? "مورد"}`,
      partyType: "supplier",
      partyId: invoice?.supplierId ?? null,
    }),
  ];
}

/** دفعة لمورد: مدين المورد، دائن الصندوق/البنك. */
export function supplierPaymentLines(payment, accountMap) {
  const amount = money.round(payment?.amount ?? 0);

  return [
    debit(resolveAccount(accountMap, "accountsPayable"), amount, {
      description: `سداد لـ ${payment?.supplierName ?? "مورد"}`,
      partyType: "supplier",
      partyId: payment?.supplierId ?? null,
    }),
    credit(accountOr(payment?.accountId, accountMap, "cashOnHand"), amount, {
      description: "صرف من الخزينة/البنك",
    }),
  ];
}

/** مرتجع لمورد: مدين المورد (تخفيض التزام)، دائن المخزون. */
export function supplierReturnLines(returnDoc, accountMap) {
  const amount = money.round(returnDoc?.amount ?? 0);
  const tax = money.round(returnDoc?.tax ?? 0);
  const net = money.subtract(amount, tax);

  return [
    debit(resolveAccount(accountMap, "accountsPayable"), amount, {
      description: `مرتجع إلى ${returnDoc?.supplierName ?? "مورد"}`,
      partyType: "supplier",
      partyId: returnDoc?.supplierId ?? null,
    }),
    credit(accountOr(returnDoc?.inventoryAccountId, accountMap, "inventory"), net, {
      description: "خروج مخزون مرتجع بالتكلفة",
    }),
    ...(money.isPositive(tax)
      ? [
          credit(resolveAccount(accountMap, "inputVat"), tax, {
            description: "عكس ضريبة مدخلات",
          }),
        ]
      : []),
  ];
}

/* ==========================================================================
   4) الخزينة والبنوك
   ========================================================================== */

/**
 * تحويل بين صندوقين أو بين صندوق وبنك.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  هذا ليس إيرادًا ولا مصروفًا. مجموع الأصول لا يتغير — انتقلت النقدية من
 *  وعاء إلى وعاء. أي ربط يُنتج إيرادًا من تحويل داخلي خطأ جوهري.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function cashTransferLines(transfer, accountMap) {
  const amount = money.round(transfer?.amount ?? 0);

  const fromAccount = accountOr(transfer?.fromAccountId, accountMap, "cashOnHand");
  const toAccount = accountOr(transfer?.toAccountId, accountMap, "cashOnHand");

  if (String(fromAccount) === String(toAccount)) {
    throw ruleViolation("لا يُحوَّل مبلغ من حساب إلى نفسه.", { field: "toAccountId" });
  }

  return [
    debit(toAccount, amount, { description: `تحويل وارد — ${transfer?.toName ?? ""}`.trim() }),
    credit(fromAccount, amount, { description: `تحويل صادر — ${transfer?.fromName ?? ""}`.trim() }),
  ];
}

/**
 * إيصال قبض أو صرف نقدي عام (لا يخص عميلًا ولا موردًا).
 * `direction` تأخذ "in" أو "out"، و`counterAccountId` هو الطرف المقابل.
 */
export function cashVoucherLines(voucher, accountMap) {
  const amount = money.round(voucher?.amount ?? 0);
  const cashAccount = accountOr(voucher?.accountId, accountMap, "cashOnHand");
  const counterAccount = accountOr(
    voucher?.counterAccountId,
    accountMap,
    voucher?.direction === "in" ? "otherIncome" : "costOfGoodsSold",
  );

  return voucher?.direction === "in"
    ? [
        debit(cashAccount, amount, { description: voucher?.description ?? "قبض نقدي" }),
        credit(counterAccount, amount, {
          description: voucher?.description ?? "إيراد",
          costCenterId: voucher?.costCenterId ?? null,
        }),
      ]
    : [
        debit(counterAccount, amount, {
          description: voucher?.description ?? "مصروف",
          costCenterId: voucher?.costCenterId ?? null,
        }),
        credit(cashAccount, amount, { description: voucher?.description ?? "صرف نقدي" }),
      ];
}

/* ==========================================================================
   5) الموارد البشرية — الرواتب
   ========================================================================== */

/**
 * اعتماد مسيّر رواتب — القيد الأهم في الموديول.
 *
 * الطرف المدين (المصروف):
 *   الأساسي + البدلات + المكافآت + الإضافي + حصة صاحب العمل في التأمينات
 *
 * الطرف الدائن (الالتزامات):
 *   الصافي المستحق للموظفين
 *   + ضريبة كسب العمل المستقطعة
 *   + التأمينات (حصة الموظف + حصة صاحب العمل)
 *   + السلف المستردة من المسيّر
 *   + استقطاعات أخرى
 *
 * لاحظ أن السلف المستردة تُدان على حساب «سلف الموظفين» (أصل) لا كإيراد:
 * المنشأة تستعيد مالًا سلّفته، فينقص الأصل ولا ينشأ إيراد.
 *
 * @param {object} payroll ملخص مسيّر من js/domain/payroll.js
 */
export function payrollApprovalLines(payroll, accountMap) {
  const t = payroll?.totals ?? payroll ?? {};

  const basic = money.round(t.basic ?? 0);
  const allowances = money.round(t.allowances ?? 0);
  const bonuses = money.round(t.bonuses ?? 0);
  const overtime = money.round(t.overtime ?? 0);
  const employerInsurance = money.round(t.employerInsurance ?? 0);

  const incomeTax = money.round(t.incomeTax ?? 0);
  const employeeInsurance = money.round(t.employeeInsurance ?? 0);
  const advanceRecovery = money.round(t.advanceRecovery ?? 0);
  const otherDeductions = money.round(t.otherDeductions ?? 0);
  const netPay = money.round(t.netPay ?? 0);

  const lines = [
    debit(resolveAccount(accountMap, "salariesExpense"), basic, {
      description: "الرواتب الأساسية",
      costCenterId: payroll?.costCenterId ?? null,
    }),
  ];

  if (money.isPositive(money.add(allowances, bonuses))) {
    lines.push(
      debit(resolveAccount(accountMap, "allowancesExpense"), money.add(allowances, bonuses), {
        description: "البدلات والمكافآت",
        costCenterId: payroll?.costCenterId ?? null,
      }),
    );
  }

  if (money.isPositive(overtime)) {
    lines.push(
      debit(resolveAccount(accountMap, "overtimeExpense"), overtime, {
        description: "أجر العمل الإضافي",
        costCenterId: payroll?.costCenterId ?? null,
      }),
    );
  }

  if (money.isPositive(employerInsurance)) {
    lines.push(
      debit(resolveAccount(accountMap, "employerSocialInsuranceExpense"), employerInsurance, {
        description: "حصة صاحب العمل في التأمينات الاجتماعية",
        costCenterId: payroll?.costCenterId ?? null,
      }),
    );
  }

  lines.push(
    credit(resolveAccount(accountMap, "salariesPayable"), netPay, {
      description: `صافي رواتب مستحقة — ${payroll?.periodLabel ?? ""}`.trim(),
    }),
  );

  if (money.isPositive(incomeTax)) {
    lines.push(
      credit(resolveAccount(accountMap, "payrollTaxPayable"), incomeTax, {
        description: "ضريبة كسب عمل مستقطعة",
      }),
    );
  }

  const totalInsurance = money.add(employeeInsurance, employerInsurance);
  if (money.isPositive(totalInsurance)) {
    lines.push(
      credit(resolveAccount(accountMap, "socialInsurancePayable"), totalInsurance, {
        description: "تأمينات اجتماعية مستحقة (حصة الموظف وصاحب العمل)",
      }),
    );
  }

  if (money.isPositive(advanceRecovery)) {
    lines.push(
      credit(resolveAccount(accountMap, "employeeAdvances"), advanceRecovery, {
        description: "استرداد سلف من المسيّر",
      }),
    );
  }

  if (money.isPositive(otherDeductions)) {
    lines.push(
      credit(resolveAccount(accountMap, "payrollDeductionsPayable"), otherDeductions, {
        description: "استقطاعات أخرى مستحقة",
      }),
    );
  }

  return lines;
}

/** صرف الرواتب: مدين الرواتب المستحقة، دائن الصندوق/البنك. */
export function payrollPaymentLines(payment, accountMap) {
  const amount = money.round(payment?.amount ?? 0);

  return [
    debit(resolveAccount(accountMap, "salariesPayable"), amount, {
      description: `صرف رواتب ${payment?.periodLabel ?? ""}`.trim(),
    }),
    credit(accountOr(payment?.accountId, accountMap, "bankAccounts"), amount, {
      description: "صرف من الحساب البنكي/الخزينة",
    }),
  ];
}

/** سلفة موظف: مدين سلف الموظفين (أصل)، دائن الصندوق. */
export function employeeAdvanceLines(advance, accountMap) {
  const amount = money.round(advance?.amount ?? 0);

  return [
    debit(resolveAccount(accountMap, "employeeAdvances"), amount, {
      description: `سلفة للموظف ${advance?.employeeName ?? ""}`.trim(),
    }),
    credit(accountOr(advance?.accountId, accountMap, "cashOnHand"), amount, {
      description: "صرف سلفة",
    }),
  ];
}

/* ==========================================================================
   6) المخازن
   ========================================================================== */

/**
 * إذن إضافة مخزني بلا فاتورة مورد بعد.
 *
 * مدين المخزون، دائن «مخزون مستلم ولم يُفوتر». حساب وسيط مقصود: المخزون
 * دخل فعلًا فيجب أن يظهر في الأصول، لكن الالتزام تجاه المورد لا يُثبَّت على
 * حساب المورد قبل وصول فاتورته — وإلا ظهرت مديونية بقيمة تقديرية. عند ورود
 * الفاتورة يُقفل الحساب الوسيط ضد حساب المورد.
 */
export function inventoryReceiptLines(receipt, accountMap) {
  const value = money.round(receipt?.totalCost ?? 0);

  return [
    debit(accountOr(receipt?.inventoryAccountId, accountMap, "inventory"), value, {
      description: `إضافة مخزون — ${receipt?.warehouseName ?? ""}`.trim(),
    }),
    credit(
      receipt?.supplierId
        ? resolveAccount(accountMap, "goodsReceivedNotInvoiced")
        : accountOr(receipt?.counterAccountId, accountMap, "goodsReceivedNotInvoiced"),
      value,
      {
        description: receipt?.supplierId
          ? `مخزون مستلم من ${receipt?.supplierName ?? "مورد"} ولم يُفوتر`
          : "مقابل إضافة مخزنية",
        partyType: receipt?.supplierId ? "supplier" : null,
        partyId: receipt?.supplierId ?? null,
      },
    ),
  ];
}

/**
 * إذن صرف مخزني: الاعتراف بالتكلفة.
 *
 * مدين تكلفة المبيعات أو حساب المصروف (حسب جهة الصرف)، دائن المخزون.
 * القيمة تأتي من محرك التقييم (FIFO / متوسط مرجّح) في js/domain/valuation.js
 * — لا من سعر البيع ولا من آخر سعر شراء.
 */
export function inventoryIssueLines(issue, accountMap) {
  const cost = money.round(issue?.totalCost ?? 0);

  return [
    debit(accountOr(issue?.expenseAccountId, accountMap, "costOfGoodsSold"), cost, {
      description: `تكلفة أصناف منصرفة — ${issue?.reason ?? ""}`.trim(),
      costCenterId: issue?.costCenterId ?? null,
    }),
    credit(accountOr(issue?.inventoryAccountId, accountMap, "inventory"), cost, {
      description: `خروج مخزون — ${issue?.warehouseName ?? ""}`.trim(),
    }),
  ];
}

/**
 * تسوية مخزنية. الاتجاه يحدد الطرفين:
 *   زيادة → مدين المخزون، دائن «زيادة المخزون»
 *   نقص   → مدين «عجز وتلف»، دائن المخزون
 */
export function inventoryAdjustmentLines(adjustment, accountMap) {
  const value = money.round(Math.abs(adjustment?.valueChange ?? 0));
  const isIncrease = (adjustment?.valueChange ?? 0) > 0;

  if (money.isZero(value)) {
    throw ruleViolation("تسوية مخزنية بقيمة صفر لا تُرحَّل محاسبيًا.");
  }

  const inventoryAccount = accountOr(adjustment?.inventoryAccountId, accountMap, "inventory");

  return isIncrease
    ? [
        debit(inventoryAccount, value, { description: "زيادة مخزون بالجرد" }),
        credit(resolveAccount(accountMap, "inventorySurplus"), value, {
          description: `زيادة جرد — ${adjustment?.reason ?? ""}`.trim(),
          costCenterId: adjustment?.costCenterId ?? null,
        }),
      ]
    : [
        debit(resolveAccount(accountMap, "inventoryShrinkage"), value, {
          description: `عجز/تلف — ${adjustment?.reason ?? ""}`.trim(),
          costCenterId: adjustment?.costCenterId ?? null,
        }),
        credit(inventoryAccount, value, { description: "نقص مخزون بالجرد" }),
      ];
}

/**
 * تحويل مخزني بين مخزنين.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  التحويل الداخلي **لا يُنشئ إيرادًا ولا مشترياتٍ ولا تكلفة مبيعات.**
 *  الصنف لم يُبَع ولم يُشترَ — انتقل من رف إلى رف.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * إن كان لكل مخزن حساب مخزون مستقل في الدليل، فالقيد نقل بين حسابي مخزون
 * بنفس القيمة. وإن كان المخزون كله على حساب واحد فلا قيد من أصله، وهذه
 * الدالة تُعيد مصفوفة فارغة — و`shouldPost` أدناه تمنع إنشاء قيد فارغ.
 */
export function inventoryTransferLines(transfer, accountMap) {
  const value = money.round(transfer?.totalCost ?? 0);

  const fromAccount = transfer?.fromInventoryAccountId ?? null;
  const toAccount = transfer?.toInventoryAccountId ?? null;

  // لا حسابات مستقلة للمخازن، أو كلاهما نفس الحساب → لا أثر محاسبي.
  if (!fromAccount || !toAccount || String(fromAccount) === String(toAccount)) {
    return [];
  }

  return [
    debit(toAccount, value, {
      description: `تحويل وارد إلى ${transfer?.toWarehouseName ?? ""}`.trim(),
    }),
    credit(fromAccount, value, {
      description: `تحويل صادر من ${transfer?.fromWarehouseName ?? ""}`.trim(),
    }),
  ];
}

/* ==========================================================================
   7) الأصول الثابتة
   ========================================================================== */

/** شراء أصل: مدين الأصل الثابت، دائن النقدية أو المورد. */
export function assetAcquisitionLines(asset, accountMap) {
  const cost = money.round(asset?.acquisitionCost ?? 0);

  return [
    debit(accountOr(asset?.assetAccountId, accountMap, "fixedAssets"), cost, {
      description: `شراء أصل — ${asset?.name ?? ""}`.trim(),
      costCenterId: asset?.costCenterId ?? null,
    }),
    credit(
      asset?.supplierId
        ? resolveAccount(accountMap, "accountsPayable")
        : accountOr(asset?.paidFromAccountId, accountMap, "cashOnHand"),
      cost,
      {
        description: asset?.supplierId ? `التزام تجاه ${asset?.supplierName ?? "مورد"}` : "سداد نقدي",
        partyType: asset?.supplierId ? "supplier" : null,
        partyId: asset?.supplierId ?? null,
      },
    ),
  ];
}

/** الإهلاك الدوري: مدين مصروف الإهلاك، دائن مجمع الإهلاك. */
export function depreciationLines(run, accountMap) {
  const amount = money.round(run?.totalDepreciation ?? 0);

  return [
    debit(accountOr(run?.expenseAccountId, accountMap, "depreciationExpense"), amount, {
      description: `إهلاك دوري — ${run?.periodLabel ?? ""}`.trim(),
      costCenterId: run?.costCenterId ?? null,
    }),
    credit(accountOr(run?.accumulatedAccountId, accountMap, "accumulatedDepreciation"), amount, {
      description: "مجمع إهلاك الفترة",
    }),
  ];
}

/**
 * استبعاد أصل.
 *
 * مدين: مجمع الإهلاك المتراكم + المتحصلات النقدية (إن وُجدت)
 * دائن: تكلفة الأصل
 * والفرق ربح أو خسارة استبعاد — يُحسَب لا يُدخَل يدويًا.
 */
export function assetDisposalLines(disposal, accountMap) {
  const cost = money.round(disposal?.acquisitionCost ?? 0);
  const accumulated = money.round(disposal?.accumulatedDepreciation ?? 0);
  const proceeds = money.round(disposal?.proceeds ?? 0);

  const bookValue = money.subtract(cost, accumulated);
  const result = money.subtract(proceeds, bookValue);

  const lines = [
    debit(accountOr(disposal?.accumulatedAccountId, accountMap, "accumulatedDepreciation"), accumulated, {
      description: "إقفال مجمع إهلاك الأصل المستبعد",
    }),
  ];

  if (money.isPositive(proceeds)) {
    lines.push(
      debit(accountOr(disposal?.proceedsAccountId, accountMap, "cashOnHand"), proceeds, {
        description: "متحصلات بيع أصل",
      }),
    );
  }

  if (money.isNegative(result)) {
    lines.push(
      debit(resolveAccount(accountMap, "lossOnAssetDisposal"), money.multiply(result, -1), {
        description: "خسارة استبعاد أصل",
      }),
    );
  }

  lines.push(
    credit(accountOr(disposal?.assetAccountId, accountMap, "fixedAssets"), cost, {
      description: `استبعاد الأصل ${disposal?.name ?? ""}`.trim(),
    }),
  );

  if (money.isPositive(result)) {
    lines.push(
      credit(resolveAccount(accountMap, "gainOnAssetDisposal"), result, {
        description: "ربح استبعاد أصل",
      }),
    );
  }

  return lines;
}

/* ==========================================================================
   8) السجل الموحَّد
   ========================================================================== */

/**
 * خريطة النوع → دالة البناء.
 *
 * خدمة الترحيل تقرأ من هنا، فإضافة حدث جديد = دالة أعلاه + مدخل هنا، ولا
 * شيء ثالث. المدخل الناقص يُنتج خطأ صريحًا لا ترحيلًا صامتًا خاطئًا.
 */
export const POSTING_RULES = Object.freeze({
  [SourceType.CUSTOMER_INVOICE]: customerInvoiceLines,
  [SourceType.CUSTOMER_RECEIPT]: customerReceiptLines,
  [SourceType.CUSTOMER_CREDIT_NOTE]: customerCreditNoteLines,

  [SourceType.SUPPLIER_INVOICE]: supplierInvoiceLines,
  [SourceType.SUPPLIER_PAYMENT]: supplierPaymentLines,
  [SourceType.SUPPLIER_RETURN]: supplierReturnLines,

  [SourceType.CASH_RECEIPT]: cashVoucherLines,
  [SourceType.CASH_PAYMENT]: cashVoucherLines,
  [SourceType.CASH_TRANSFER]: cashTransferLines,
  [SourceType.BANK_DEPOSIT]: cashTransferLines,
  [SourceType.BANK_WITHDRAWAL]: cashTransferLines,

  [SourceType.ASSET_ACQUISITION]: assetAcquisitionLines,
  [SourceType.ASSET_DEPRECIATION]: depreciationLines,
  [SourceType.ASSET_DISPOSAL]: assetDisposalLines,

  [SourceType.PAYROLL_APPROVAL]: payrollApprovalLines,
  [SourceType.PAYROLL_PAYMENT]: payrollPaymentLines,
  [SourceType.EMPLOYEE_ADVANCE]: employeeAdvanceLines,

  [SourceType.INVENTORY_RECEIPT]: inventoryReceiptLines,
  [SourceType.INVENTORY_ISSUE]: inventoryIssueLines,
  [SourceType.INVENTORY_ADJUSTMENT]: inventoryAdjustmentLines,
  [SourceType.INVENTORY_RETURN]: supplierReturnLines,
  [SourceType.INVENTORY_TRANSFER]: inventoryTransferLines,
});

/**
 * يبني سطور القيد لحدث ما.
 *
 * @param {string} sourceType من `SourceType`
 * @param {object} document   المستند المصدري
 * @param {object} accountMap خريطة الربط المحاسبي
 */
export function buildLinesFor(sourceType, document, accountMap) {
  const rule = POSTING_RULES[sourceType];

  if (!rule) {
    throw ruleViolation(
      `لا قاعدة ربط محاسبي للحدث «${sourceType}». ` +
        "أضفها إلى js/domain/posting-rules.js قبل ترحيل هذا المستند.",
    );
  }

  return rule(document, accountMap);
}

/**
 * هل يستحق هذا الحدث قيدًا من أصله؟
 *
 * التحويل المخزني على حساب مخزون واحد لا أثر له، وقيد بلا سطور غير متوازن
 * بحكم التعريف. هذه الدالة تفصل «لا أثر محاسبي» عن «خطأ في البناء».
 */
export function shouldPost(lines = []) {
  return lines.some((row) => !money.isZero(row?.debit) || !money.isZero(row?.credit));
}

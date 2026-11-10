/**
 * بيانات المحاسبة العامة التجريبية:
 * دليل الحسابات، السنوات والفترات المالية، خريطة الربط المحاسبي، وقيود اليومية.
 *
 * دليل الحسابات هنا دليل مستشفى خاص بترميز هرمي من أربعة
 * مستويات، مبنيّ بحيث تكون كل أوراقه قابلة للترحيل عليها وكل أب مجموع أبنائه.
 */

import { createRandom, FISCAL_YEAR, REFERENCE_DATE, COST_CENTERS } from "./seed.js";
import { inventoryClosingByAccount } from "./inventory.mock.js";

const random = createRandom(410_593);

/* ============================================================================
   1. دليل الحسابات (Chart of Accounts)

   الترميز: 1 رقم للمستوى الأول، ثم رقم لكل مستوى تالٍ.
     1       الأصول
     11      الأصول المتداولة
     111     النقدية وما في حكمها
     1111    الخزينة الرئيسية        ← ورقة، قابلة للترحيل
   ============================================================================ */

export const accounts = [
  /* ===================== 1. الأصول ===================== */
  { id: 1, code: "1", name: "الأصول", nameEn: "Assets", type: "asset", parentId: null, level: 1, nature: "debit", status: "active" },

  { id: 11, code: "11", name: "الأصول المتداولة", nameEn: "Current Assets", type: "asset", parentId: 1, level: 2, nature: "debit", status: "active" },

  { id: 111, code: "111", name: "النقدية وما في حكمها", nameEn: "Cash & Cash Equivalents", type: "asset", parentId: 11, level: 3, nature: "debit", status: "active" },
  { id: 1111, code: "1111", name: "الخزينة الرئيسية", nameEn: "Main Cashbox", type: "asset", parentId: 111, level: 4, nature: "debit", status: "active", cashFlowSection: "operating" },
  { id: 1112, code: "1112", name: "خزينة فرع الإسكندرية", nameEn: "Alexandria Branch Cashbox", type: "asset", parentId: 111, level: 4, nature: "debit", status: "active" },
  { id: 1113, code: "1113", name: "خزينة المصروفات النثرية", nameEn: "Petty Cash", type: "asset", parentId: 111, level: 4, nature: "debit", status: "active" },
  { id: 1114, code: "1114", name: "نقدية تحت التحويل", nameEn: "Cash in Transit", type: "asset", parentId: 111, level: 4, nature: "debit", status: "active" },

  { id: 112, code: "112", name: "الحسابات البنكية", nameEn: "Bank Accounts", type: "asset", parentId: 11, level: 3, nature: "debit", status: "active" },
  { id: 1121, code: "1121", name: "البنك الأهلي المصري — جاري", nameEn: "NBE Current", type: "asset", parentId: 112, level: 4, nature: "debit", status: "active" },
  { id: 1122, code: "1122", name: "بنك مصر — حساب التشغيل", nameEn: "Banque Misr Operations", type: "asset", parentId: 112, level: 4, nature: "debit", status: "active" },
  { id: 1123, code: "1123", name: "البنك التجاري الدولي — جاري", nameEn: "CIB Current", type: "asset", parentId: 112, level: 4, nature: "debit", status: "active" },
  { id: 1124, code: "1124", name: "بنك القاهرة — حساب الرواتب", nameEn: "Banque du Caire Payroll", type: "asset", parentId: 112, level: 4, nature: "debit", status: "active" },

  { id: 113, code: "113", name: "العملاء والمدينون", nameEn: "Trade Receivables", type: "asset", parentId: 11, level: 3, nature: "debit", status: "active" },
  { id: 1131, code: "1131", name: "عملاء — تجارة محلية", nameEn: "Local Customers", type: "asset", parentId: 113, level: 4, nature: "debit", status: "active" },
  { id: 1132, code: "1132", name: "عملاء — سياحة علاجية", nameEn: "Medical Tourism Receivables", type: "asset", parentId: 113, level: 4, nature: "debit", status: "active" },
  { id: 1133, code: "1133", name: "أوراق قبض (شيكات تحت التحصيل)", nameEn: "Notes Receivable", type: "asset", parentId: 113, level: 4, nature: "debit", status: "active" },
  { id: 1134, code: "1134", name: "مخصص الديون المشكوك في تحصيلها", nameEn: "Allowance for Doubtful Debts", type: "asset", parentId: 113, level: 4, nature: "credit", status: "active" },

  { id: 114, code: "114", name: "المخزون", nameEn: "Inventory", type: "asset", parentId: 11, level: 3, nature: "debit", status: "active" },
  { id: 11411, code: "11411", name: "مخزون مستهلكات طبية عامة", nameEn: "General Medical Consumables Inventory", type: "asset", parentId: 114, level: 4, nature: "debit", status: "active" },
  { id: 11412, code: "11412", name: "مخزون أدوية", nameEn: "Medications Inventory", type: "asset", parentId: 114, level: 4, nature: "debit", status: "active" },
  { id: 11413, code: "11413", name: "مخزون مستلزمات العمليات", nameEn: "Surgical Supplies Inventory", type: "asset", parentId: 114, level: 4, nature: "debit", status: "active" },
  { id: 11414, code: "11414", name: "مخزون قطع غيار الأجهزة الطبية", nameEn: "Medical Equipment Spares Inventory", type: "asset", parentId: 114, level: 4, nature: "debit", status: "active" },
  { id: 11415, code: "11415", name: "مخزون فرع الإسكندرية", nameEn: "Alexandria Branch Inventory", type: "asset", parentId: 114, level: 4, nature: "debit", status: "active" },

  { id: 115, code: "115", name: "مدينون متنوعون وأرصدة مدينة أخرى", nameEn: "Other Receivables", type: "asset", parentId: 11, level: 3, nature: "debit", status: "active" },
  { id: 1151, code: "1151", name: "سلف وعهد الموظفين", nameEn: "Employee Advances", type: "asset", parentId: 115, level: 4, nature: "debit", status: "active" },
  { id: 1152, code: "1152", name: "دفعات مقدمة للموردين", nameEn: "Advances to Suppliers", type: "asset", parentId: 115, level: 4, nature: "debit", status: "active" },
  { id: 1153, code: "1153", name: "مصروفات مدفوعة مقدمًا", nameEn: "Prepaid Expenses", type: "asset", parentId: 115, level: 4, nature: "debit", status: "active" },
  { id: 1154, code: "1154", name: "تأمينات لدى الغير", nameEn: "Deposits with Others", type: "asset", parentId: 115, level: 4, nature: "debit", status: "active" },

  { id: 116, code: "116", name: "ضرائب مدينة", nameEn: "Tax Receivable", type: "asset", parentId: 11, level: 3, nature: "debit", status: "active" },
  { id: 1161, code: "1161", name: "ض.ق.م — مدخلات قابلة للخصم", nameEn: "Input VAT", type: "asset", parentId: 116, level: 4, nature: "debit", status: "active" },
  { id: 1162, code: "1162", name: "ضريبة خصم وإضافة مدفوعة مقدمًا", nameEn: "Withholding Tax Paid", type: "asset", parentId: 116, level: 4, nature: "debit", status: "active" },

  { id: 12, code: "12", name: "الأصول غير المتداولة (الثابتة)", nameEn: "Non-Current Assets", type: "asset", parentId: 1, level: 2, nature: "debit", status: "active" },

  { id: 121, code: "121", name: "الأصول الثابتة — بالتكلفة", nameEn: "Fixed Assets at Cost", type: "asset", parentId: 12, level: 3, nature: "debit", status: "active" },
  { id: 1211, code: "1211", name: "أراضٍ ومبانٍ", nameEn: "Land & Buildings", type: "asset", parentId: 121, level: 4, nature: "debit", status: "active", isFixedAsset: true },
  { id: 1212, code: "1212", name: "أجهزة ومعدات طبية", nameEn: "Medical Equipment", type: "asset", parentId: 121, level: 4, nature: "debit", status: "active", isFixedAsset: true },
  { id: 1213, code: "1213", name: "أثاث وتجهيزات مكتبية", nameEn: "Furniture & Fixtures", type: "asset", parentId: 121, level: 4, nature: "debit", status: "active", isFixedAsset: true },
  { id: 1214, code: "1214", name: "أجهزة حاسب وشبكات", nameEn: "Computers & Networks", type: "asset", parentId: 121, level: 4, nature: "debit", status: "active", isFixedAsset: true },
  { id: 1215, code: "1215", name: "سيارات ووسائل نقل", nameEn: "Vehicles", type: "asset", parentId: 121, level: 4, nature: "debit", status: "active", isFixedAsset: true },

  /**
   * مجمع الإهلاك: أصل بطبيعة **دائنة**.
   * حساب مقابلة (contra) — يُخفّض الأصول دون أن يكون خصمًا. تثبيت طبيعته
   * على نوعه (أصل → مدين) يقلب إشارته ويُفقد الميزانية توازنها.
   */
  { id: 122, code: "122", name: "مجمع إهلاك الأصول الثابتة", nameEn: "Accumulated Depreciation", type: "asset", parentId: 12, level: 3, nature: "credit", status: "active" },
  { id: 1221, code: "1221", name: "مجمع إهلاك المبانٍ", nameEn: "Acc. Dep. — Buildings", type: "asset", parentId: 122, level: 4, nature: "credit", status: "active" },
  { id: 1222, code: "1222", name: "مجمع إهلاك الآلات والمعدات", nameEn: "Acc. Dep. — Machinery", type: "asset", parentId: 122, level: 4, nature: "credit", status: "active" },
  { id: 1223, code: "1223", name: "مجمع إهلاك الأثاث والتجهيزات", nameEn: "Acc. Dep. — Furniture", type: "asset", parentId: 122, level: 4, nature: "credit", status: "active" },
  { id: 1224, code: "1224", name: "مجمع إهلاك أجهزة الحاسب", nameEn: "Acc. Dep. — Computers", type: "asset", parentId: 122, level: 4, nature: "credit", status: "active" },
  { id: 1225, code: "1225", name: "مجمع إهلاك السيارات", nameEn: "Acc. Dep. — Vehicles", type: "asset", parentId: 122, level: 4, nature: "credit", status: "active" },

  { id: 123, code: "123", name: "أصول غير ملموسة", nameEn: "Intangible Assets", type: "asset", parentId: 12, level: 3, nature: "debit", status: "active" },
  { id: 1231, code: "1231", name: "برامج وتراخيص نظم", nameEn: "Software & Licenses", type: "asset", parentId: 123, level: 4, nature: "debit", status: "active", isFixedAsset: true },
  { id: 1232, code: "1232", name: "مجمع إطفاء الأصول غير الملموسة", nameEn: "Accumulated Amortization", type: "asset", parentId: 123, level: 4, nature: "credit", status: "active" },

  /* ===================== 2. الخصوم ===================== */
  { id: 2, code: "2", name: "الخصوم والالتزامات", nameEn: "Liabilities", type: "liability", parentId: null, level: 1, nature: "credit", status: "active" },

  { id: 21, code: "21", name: "الخصوم المتداولة", nameEn: "Current Liabilities", type: "liability", parentId: 2, level: 2, nature: "credit", status: "active" },

  { id: 211, code: "211", name: "الموردون والدائنون", nameEn: "Trade Payables", type: "liability", parentId: 21, level: 3, nature: "credit", status: "active" },
  { id: 2111, code: "2111", name: "موردون محليون", nameEn: "Local Suppliers", type: "liability", parentId: 211, level: 4, nature: "credit", status: "active" },
  { id: 2112, code: "2112", name: "مخزون مستلم ولم يُفوتر", nameEn: "Goods Received Not Invoiced", type: "liability", parentId: 211, level: 4, nature: "credit", status: "active" },
  { id: 2113, code: "2113", name: "أوراق دفع (شيكات صادرة)", nameEn: "Notes Payable", type: "liability", parentId: 211, level: 4, nature: "credit", status: "active" },
  { id: 2114, code: "2114", name: "دفعات مقدمة من العملاء", nameEn: "Advances from Customers", type: "liability", parentId: 211, level: 4, nature: "credit", status: "active" },

  { id: 212, code: "212", name: "مستحقات العاملين", nameEn: "Payroll Liabilities", type: "liability", parentId: 21, level: 3, nature: "credit", status: "active" },
  { id: 2121, code: "2121", name: "رواتب وأجور مستحقة", nameEn: "Salaries Payable", type: "liability", parentId: 212, level: 4, nature: "credit", status: "active" },
  { id: 2122, code: "2122", name: "تأمينات اجتماعية مستحقة", nameEn: "Social Insurance Payable", type: "liability", parentId: 212, level: 4, nature: "credit", status: "active" },
  { id: 2123, code: "2123", name: "ضريبة كسب عمل مستحقة", nameEn: "Payroll Tax Payable", type: "liability", parentId: 212, level: 4, nature: "credit", status: "active" },
  { id: 2124, code: "2124", name: "استقطاعات أخرى مستحقة", nameEn: "Other Payroll Deductions", type: "liability", parentId: 212, level: 4, nature: "credit", status: "active" },

  { id: 213, code: "213", name: "ضرائب مستحقة", nameEn: "Taxes Payable", type: "liability", parentId: 21, level: 3, nature: "credit", status: "active" },
  { id: 2131, code: "2131", name: "ض.ق.م — مخرجات مستحقة", nameEn: "Output VAT", type: "liability", parentId: 213, level: 4, nature: "credit", status: "active" },
  { id: 2132, code: "2132", name: "ضريبة خصم وإضافة مستحقة", nameEn: "Withholding Tax Payable", type: "liability", parentId: 213, level: 4, nature: "credit", status: "active" },
  { id: 2133, code: "2133", name: "ضريبة أرباح تجارية مستحقة", nameEn: "Corporate Tax Payable", type: "liability", parentId: 213, level: 4, nature: "credit", status: "active" },

  { id: 214, code: "214", name: "مصروفات مستحقة ودائنون متنوعون", nameEn: "Accrued Expenses", type: "liability", parentId: 21, level: 3, nature: "credit", status: "active" },
  { id: 2141, code: "2141", name: "إيجارات ومرافق مستحقة", nameEn: "Accrued Rent & Utilities", type: "liability", parentId: 214, level: 4, nature: "credit", status: "active" },
  { id: 2142, code: "2142", name: "دائنون متنوعون", nameEn: "Sundry Creditors", type: "liability", parentId: 214, level: 4, nature: "credit", status: "active" },

  { id: 22, code: "22", name: "الخصوم غير المتداولة", nameEn: "Non-Current Liabilities", type: "liability", parentId: 2, level: 2, nature: "credit", status: "active" },
  { id: 221, code: "221", name: "قروض طويلة الأجل", nameEn: "Long-Term Loans", type: "liability", parentId: 22, level: 3, nature: "credit", status: "active" },
  { id: 2211, code: "2211", name: "قرض البنك الأهلي — تمويل آلات", nameEn: "NBE Equipment Loan", type: "liability", parentId: 221, level: 4, nature: "credit", status: "active", cashFlowSection: "financing" },

  /* ===================== 3. حقوق الملكية ===================== */
  { id: 3, code: "3", name: "حقوق الملكية", nameEn: "Equity", type: "equity", parentId: null, level: 1, nature: "credit", status: "active" },
  { id: 31, code: "31", name: "رأس المال", nameEn: "Capital", type: "equity", parentId: 3, level: 2, nature: "credit", status: "active" },
  { id: 311, code: "311", name: "رأس المال المدفوع", nameEn: "Paid-in Capital", type: "equity", parentId: 31, level: 3, nature: "credit", status: "active" },
  { id: 32, code: "32", name: "الاحتياطيات", nameEn: "Reserves", type: "equity", parentId: 3, level: 2, nature: "credit", status: "active" },
  { id: 321, code: "321", name: "الاحتياطي القانوني", nameEn: "Legal Reserve", type: "equity", parentId: 32, level: 3, nature: "credit", status: "active" },
  { id: 322, code: "322", name: "احتياطي عام", nameEn: "General Reserve", type: "equity", parentId: 32, level: 3, nature: "credit", status: "active" },
  { id: 33, code: "33", name: "الأرباح المرحلة", nameEn: "Retained Earnings", type: "equity", parentId: 3, level: 2, nature: "credit", status: "active" },
  { id: 331, code: "331", name: "أرباح مرحلة من سنوات سابقة", nameEn: "Retained Earnings b/f", type: "equity", parentId: 33, level: 3, nature: "credit", status: "active" },
  { id: 332, code: "332", name: "ملخص الأرباح والخسائر", nameEn: "Income Summary", type: "equity", parentId: 33, level: 3, nature: "credit", status: "active" },

  /* ===================== 4. الإيرادات ===================== */
  { id: 4, code: "4", name: "الإيرادات", nameEn: "Revenue", type: "revenue", parentId: null, level: 1, nature: "credit", status: "active" },
  { id: 41, code: "41", name: "إيرادات النشاط الرئيسي", nameEn: "Operating Revenue", type: "revenue", parentId: 4, level: 2, nature: "credit", status: "active" },
  { id: 411, code: "411", name: "إيرادات الخدمات الطبية", nameEn: "Medical Services Revenue", type: "revenue", parentId: 41, level: 3, nature: "credit", status: "active" },
  { id: 4111, code: "4111", name: "إيرادات خدمات طبية — محلي", nameEn: "Local Medical Services", type: "revenue", parentId: 411, level: 4, nature: "credit", status: "active" },
  { id: 4112, code: "4112", name: "إيرادات سياحة علاجية", nameEn: "Medical Tourism Revenue", type: "revenue", parentId: 411, level: 4, nature: "credit", status: "active" },
  { id: 412, code: "412", name: "إيرادات العمليات والإقامة", nameEn: "Surgery & Inpatient Revenue", type: "revenue", parentId: 41, level: 3, nature: "credit", status: "active" },
  { id: 413, code: "413", name: "إيرادات خدمات مساندة", nameEn: "Ancillary Services Revenue", type: "revenue", parentId: 41, level: 3, nature: "credit", status: "active" },
  { id: 42, code: "42", name: "إيرادات أخرى", nameEn: "Other Income", type: "revenue", parentId: 4, level: 2, nature: "credit", status: "active" },
  { id: 421, code: "421", name: "أرباح استبعاد أصول", nameEn: "Gain on Asset Disposal", type: "revenue", parentId: 42, level: 3, nature: "credit", status: "active" },
  { id: 422, code: "422", name: "زيادة مخزون بالجرد", nameEn: "Inventory Surplus", type: "revenue", parentId: 42, level: 3, nature: "credit", status: "active" },
  { id: 423, code: "423", name: "إيرادات متنوعة", nameEn: "Miscellaneous Income", type: "revenue", parentId: 42, level: 3, nature: "credit", status: "active" },

  /* ===================== 5. المصروفات ===================== */
  { id: 5, code: "5", name: "المصروفات", nameEn: "Expenses", type: "expense", parentId: null, level: 1, nature: "debit", status: "active" },

  { id: 51, code: "51", name: "تكلفة الخدمات الطبية", nameEn: "Cost of Medical Services", type: "expense", parentId: 5, level: 2, nature: "debit", status: "active" },
  { id: 511, code: "511", name: "تكلفة المستلزمات المصروفة", nameEn: "Cost of Supplies Issued", type: "expense", parentId: 51, level: 3, nature: "debit", status: "active" },
  { id: 5111, code: "5111", name: "تكلفة مستهلكات طبية مصروفة", nameEn: "Medical Consumables Cost", type: "expense", parentId: 511, level: 4, nature: "debit", status: "active" },
  { id: 5112, code: "5112", name: "تكلفة مستلزمات عمليات مصروفة", nameEn: "Surgical Supplies Cost", type: "expense", parentId: 511, level: 4, nature: "debit", status: "active" },
  { id: 512, code: "512", name: "أدوية مستهلكة", nameEn: "Medications Consumed", type: "expense", parentId: 51, level: 3, nature: "debit", status: "active" },
  { id: 513, code: "513", name: "عجز وتلف المخزون", nameEn: "Inventory Shrinkage", type: "expense", parentId: 51, level: 3, nature: "debit", status: "active" },

  { id: 52, code: "52", name: "مصروفات عمومية وإدارية", nameEn: "General & Administrative", type: "expense", parentId: 5, level: 2, nature: "debit", status: "active" },
  { id: 521, code: "521", name: "تكلفة العمالة", nameEn: "Personnel Costs", type: "expense", parentId: 52, level: 3, nature: "debit", status: "active" },
  { id: 5211, code: "5211", name: "رواتب وأجور", nameEn: "Salaries & Wages", type: "expense", parentId: 521, level: 4, nature: "debit", status: "active" },
  { id: 5212, code: "5212", name: "بدلات ومكافآت", nameEn: "Allowances & Bonuses", type: "expense", parentId: 521, level: 4, nature: "debit", status: "active" },
  { id: 5213, code: "5213", name: "أجور عمل إضافي", nameEn: "Overtime", type: "expense", parentId: 521, level: 4, nature: "debit", status: "active" },
  { id: 5214, code: "5214", name: "حصة صاحب العمل في التأمينات", nameEn: "Employer Social Insurance", type: "expense", parentId: 521, level: 4, nature: "debit", status: "active" },
  { id: 5215, code: "5215", name: "تدريب وتطوير", nameEn: "Training & Development", type: "expense", parentId: 521, level: 4, nature: "debit", status: "active" },

  { id: 522, code: "522", name: "مصروفات المقر والمرافق", nameEn: "Facilities & Utilities", type: "expense", parentId: 52, level: 3, nature: "debit", status: "active" },
  { id: 5221, code: "5221", name: "إيجارات", nameEn: "Rent", type: "expense", parentId: 522, level: 4, nature: "debit", status: "active" },
  { id: 5222, code: "5222", name: "كهرباء ومياه وغاز", nameEn: "Utilities", type: "expense", parentId: 522, level: 4, nature: "debit", status: "active" },
  { id: 5223, code: "5223", name: "اتصالات وإنترنت", nameEn: "Communications", type: "expense", parentId: 522, level: 4, nature: "debit", status: "active" },
  { id: 5224, code: "5224", name: "صيانة وإصلاحات", nameEn: "Repairs & Maintenance", type: "expense", parentId: 522, level: 4, nature: "debit", status: "active" },
  { id: 5225, code: "5225", name: "مستلزمات مكتبية ونظافة", nameEn: "Office & Cleaning Supplies", type: "expense", parentId: 522, level: 4, nature: "debit", status: "active" },

  { id: 523, code: "523", name: "مصروفات مهنية وحكومية", nameEn: "Professional & Government Fees", type: "expense", parentId: 52, level: 3, nature: "debit", status: "active" },
  { id: 5231, code: "5231", name: "أتعاب مهنية (مراجعة واستشارات)", nameEn: "Professional Fees", type: "expense", parentId: 523, level: 4, nature: "debit", status: "active" },
  { id: 5232, code: "5232", name: "رسوم ودمغات حكومية", nameEn: "Government Fees", type: "expense", parentId: 523, level: 4, nature: "debit", status: "active" },

  { id: 524, code: "524", name: "الإهلاك والإطفاء", nameEn: "Depreciation & Amortization", type: "expense", parentId: 52, level: 3, nature: "debit", status: "active" },
  { id: 5241, code: "5241", name: "مصروف إهلاك الأصول الثابتة", nameEn: "Depreciation Expense", type: "expense", parentId: 524, level: 4, nature: "debit", status: "active" },
  { id: 5242, code: "5242", name: "مصروف إطفاء الأصول غير الملموسة", nameEn: "Amortization Expense", type: "expense", parentId: 524, level: 4, nature: "debit", status: "active" },

  { id: 53, code: "53", name: "مصروفات تسويق وتعاقدات", nameEn: "Marketing & Contracting", type: "expense", parentId: 5, level: 2, nature: "debit", status: "active" },
  { id: 531, code: "531", name: "خصومات ومردودات", nameEn: "Discounts & Returns", type: "expense", parentId: 53, level: 3, nature: "debit", status: "active" },
  { id: 5311, code: "5311", name: "الخصم المسموح به", nameEn: "Allowed Discounts", type: "expense", parentId: 531, level: 4, nature: "debit", status: "active" },
  { id: 5312, code: "5312", name: "مردودات الإيرادات", nameEn: "Revenue Returns", type: "expense", parentId: 531, level: 4, nature: "debit", status: "active" },
  { id: 532, code: "532", name: "نقل وإسعاف وانتقالات", nameEn: "Transport & Ambulance", type: "expense", parentId: 53, level: 3, nature: "debit", status: "active" },
  { id: 533, code: "533", name: "دعاية وتسويق", nameEn: "Marketing & Advertising", type: "expense", parentId: 53, level: 3, nature: "debit", status: "active" },
  { id: 534, code: "534", name: "عمولات تعاقدات", nameEn: "Contracting Commissions", type: "expense", parentId: 53, level: 3, nature: "debit", status: "active" },

  { id: 54, code: "54", name: "مصروفات تمويلية وأخرى", nameEn: "Finance & Other Expenses", type: "expense", parentId: 5, level: 2, nature: "debit", status: "active" },
  { id: 541, code: "541", name: "فوائد وأعباء بنكية", nameEn: "Interest & Bank Charges", type: "expense", parentId: 54, level: 3, nature: "debit", status: "active" },
  { id: 542, code: "542", name: "خسائر استبعاد أصول", nameEn: "Loss on Asset Disposal", type: "expense", parentId: 54, level: 3, nature: "debit", status: "active" },
  { id: 543, code: "543", name: "فروق عملة", nameEn: "FX Differences", type: "expense", parentId: 54, level: 3, nature: "debit", status: "active" },
  { id: 544, code: "544", name: "مصروفات متنوعة", nameEn: "Miscellaneous Expenses", type: "expense", parentId: 54, level: 3, nature: "debit", status: "active" },
];

/* ============================================================================
   2. خريطة الربط المحاسبي (Posting Map)

   المفاتيح معرَّفة في MAP_KEYS في js/domain/posting-rules.js، والقيم هي
   معرّفات حسابات من الدليل أعلاه. تُعدَّل من شاشة إعدادات ← الربط المحاسبي.
   ============================================================================ */

export const postingMap = {
  cashOnHand: 1111,
  bankAccounts: 1121,
  cashInTransit: 1114,

  accountsReceivable: 1131,
  accountsPayable: 2111,
  advancesFromCustomers: 2114,
  advancesToSuppliers: 1152,

  salesRevenue: 4111,
  serviceRevenue: 413,
  salesReturns: 5312,
  salesDiscounts: 5311,
  otherIncome: 423,

  inventory: 11411,
  goodsReceivedNotInvoiced: 2112,
  costOfGoodsSold: 5111,
  inventoryShrinkage: 513,
  inventorySurplus: 422,
  purchaseReturns: 5312,

  outputVat: 2131,
  inputVat: 1161,
  withholdingTax: 2132,
  payrollTaxPayable: 2123,

  salariesExpense: 5211,
  allowancesExpense: 5212,
  overtimeExpense: 5213,
  employerSocialInsuranceExpense: 5214,
  salariesPayable: 2121,
  socialInsurancePayable: 2122,
  employeeAdvances: 1151,
  payrollDeductionsPayable: 2124,

  fixedAssets: 1212,
  accumulatedDepreciation: 1222,
  depreciationExpense: 5241,
  gainOnAssetDisposal: 421,
  lossOnAssetDisposal: 542,

  retainedEarnings: 331,
  incomeSummary: 332,
};

/* ============================================================================
   3. السنوات والفترات المالية
   ============================================================================ */

export const fiscalYears = [
  {
    id: 1,
    name: "السنة المالية 2025",
    year: 2025,
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    status: "closed",
    closedAt: "2026-02-18T11:40:00+02:00",
    closedBy: "رئيس الحسابات / هالة منصور",
  },
  {
    id: 2,
    name: "السنة المالية 2026",
    year: 2026,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "open",
    closedAt: null,
    closedBy: null,
  },
];

/**
 * الفترات الشهرية للسنة الجارية.
 *
 * الفترات السابقة للشهر الجاري مغلقة، والجارية مفتوحة، والقادمة مفتوحة أيضًا
 * لتسمح بقيود مُقدَّمة (استحقاقات). القيد على فترة مغلقة يُرفض — راجع
 * `assertPeriodOpen` في js/domain/posting.js.
 */
export const accountingPeriods = (() => {
  const currentMonth = REFERENCE_DATE.getMonth() + 1;

  return Array.from({ length: 12 }, (_unused, index) => {
    const month = index + 1;
    const start = `${FISCAL_YEAR}-${String(month).padStart(2, "0")}-01`;
    const end = new Date(Date.UTC(FISCAL_YEAR, month, 0)).toISOString().slice(0, 10);

    const MONTHS = [
      "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
      "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
    ];

    const isPast = month < currentMonth;

    return {
      id: 100 + month,
      fiscalYearId: 2,
      name: `${MONTHS[index]} ${FISCAL_YEAR}`,
      periodKey: `${FISCAL_YEAR}-${String(month).padStart(2, "0")}`,
      number: month,
      startDate: start,
      endDate: end,
      status: isPast ? "closed" : "open",
      closedAt: isPast ? `${end}T20:00:00+02:00` : null,
      closedBy: isPast ? "رئيس الحسابات / هالة منصور" : null,
      entriesCount: isPast ? random.int(40, 120) : random.int(5, 60),
    };
  });
})();

/* ============================================================================
   4. قيود اليومية

   القيود هنا هي مصدر كل رصيد في النظام — لا يوجد حقل `balance` مخزَّن على أي
   حساب. محرك دفتر الأستاذ (js/domain/ledger.js) يشتق الأرصدة من هذه القيود.

   البنية: القيود الافتتاحية أولًا (رصيد بداية السنة)، ثم قيود النشاط الشهرية.
   ============================================================================ */

/** يبني قيدًا بسطوره، مع حساب المجاميع. */
function entry({ id, number, date, description, lines, sourceType = "manual", sourceId = null, sourceEvent = "default", reference = null, status = "posted", createdBy = "محاسب / كريم فتحي", costCenterId = null, notes = null }) {
  const totalDebit = Math.round(lines.reduce((sum, line) => sum + (line.debit ?? 0), 0) * 100) / 100;
  const totalCredit = Math.round(lines.reduce((sum, line) => sum + (line.credit ?? 0), 0) * 100) / 100;

  const period = accountingPeriods.find(
    (candidate) => candidate.startDate <= date && date <= candidate.endDate,
  );

  return {
    id,
    entryNumber: `JV-${FISCAL_YEAR}-${String(number).padStart(5, "0")}`,
    date,
    description,
    lines: lines.map((line, index) => ({
      lineNumber: index + 1,
      accountId: line.accountId,
      debit: line.debit ?? 0,
      credit: line.credit ?? 0,
      description: line.description ?? null,
      costCenterId: line.costCenterId ?? costCenterId,
      partyType: line.partyType ?? null,
      partyId: line.partyId ?? null,
    })),
    totalDebit,
    totalCredit,
    sourceType,
    sourceId,
    reference,
    periodId: period?.id ?? null,
    costCenterId,
    createdBy,
    createdAt: `${date}T10:00:00+02:00`,
    approvedBy: status === "draft" || status === "pending_approval" ? null : "رئيس الحسابات / هالة منصور",
    approvedAt: status === "draft" || status === "pending_approval" ? null : `${date}T14:00:00+02:00`,
    postedBy: status === "posted" || status === "reversed" ? "رئيس الحسابات / هالة منصور" : null,
    postedAt: status === "posted" || status === "reversed" ? `${date}T14:30:00+02:00` : null,
    status,
    notes,
    postingKey: sourceType === "manual" || sourceId === null ? null : `${sourceType}:${sourceId}:${sourceEvent}`,
    isAutomatic: sourceType !== "manual",
  };
}

/** تقريب لمنزلتين — كل مبلغ في هذا الملف يمر منه. */
const round2 = (value) => Math.round(value * 100) / 100;
/** تقريب لأقرب 100 جنيه — يجعل الأرقام المُجمَّعة شهريًا قابلة للقراءة. */
const round100 = (value) => Math.round(value / 100) * 100;

const D = (accountId, debit, description, extra = {}) => ({ accountId, debit, description, ...extra });
const C = (accountId, credit, description, extra = {}) => ({ accountId, credit, description, ...extra });

/**
 * القيد الافتتاحي للسنة المالية 2026.
 * أرصدة بداية المدة المنقولة من إغلاق 2025.
 */
const openingEntry = entry({
  id: 1,
  number: 1,
  date: "2026-01-01",
  description: "الأرصدة الافتتاحية للسنة المالية 2026",
  sourceType: "opening_balance",
  sourceId: 2,
  reference: "OB-2026",
  createdBy: "رئيس الحسابات / هالة منصور",
  lines: [
    /* الأصول — مدين */
    D(1111, 185_000, "الخزينة الرئيسية — رصيد افتتاحي"),
    D(1112, 42_000, "خزينة الإسكندرية — رصيد افتتاحي"),
    D(1113, 15_000, "النثرية — رصيد افتتاحي"),
    D(1121, 1_840_000, "البنك الأهلي — رصيد افتتاحي"),
    D(1122, 960_000, "بنك مصر — رصيد افتتاحي"),
    D(1123, 420_000, "البنك التجاري الدولي — رصيد افتتاحي"),
    D(1124, 180_000, "بنك القاهرة (الرواتب) — رصيد افتتاحي"),
    D(1131, 2_640_000, "عملاء محليون — رصيد افتتاحي"),
    D(1132, 780_000, "عملاء سياحة علاجية — رصيد افتتاحي"),
    D(1133, 320_000, "شيكات تحت التحصيل"),
    /*
     * أرصدة المخزون الافتتاحية **نائبة** هنا، وتُضبط أدناه بعد بناء كل قيود
     * النشاط — راجع كتلة «معايرة أرصدة المخزون الافتتاحية».
     */
    D(11411, 0, "مخزون مستهلكات طبية — رصيد افتتاحي"),
    D(11412, 0, "مخزون أدوية — رصيد افتتاحي"),
    D(11413, 0, "مخزون مستلزمات عمليات — رصيد افتتاحي"),
    D(11414, 0, "مخزون قطع غيار أجهزة — رصيد افتتاحي"),
    D(11415, 0, "مخزون فرع الإسكندرية — رصيد افتتاحي"),
    D(1151, 96_000, "سلف الموظفين القائمة"),
    D(1152, 240_000, "دفعات مقدمة للموردين"),
    D(1153, 180_000, "مصروفات مدفوعة مقدمًا (إيجار وتأمين)"),
    D(1154, 85_000, "تأمينات لدى الغير"),
    D(1211, 6_500_000, "أراضٍ ومبانٍ — بالتكلفة"),
    D(1212, 4_850_000, "أجهزة ومعدات طبية — بالتكلفة"),
    D(1213, 720_000, "أثاث وتجهيزات — بالتكلفة"),
    D(1214, 640_000, "أجهزة حاسب وشبكات — بالتكلفة"),
    D(1215, 1_980_000, "سيارات ووسائل نقل — بالتكلفة"),
    D(1231, 480_000, "برامج وتراخيص"),

    /* حسابات المقابلة والخصوم وحقوق الملكية — دائن */
    C(1134, 132_000, "مخصص الديون المشكوك فيها"),
    C(1221, 1_040_000, "مجمع إهلاك المبانٍ"),
    C(1222, 1_746_000, "مجمع إهلاك الأجهزة الطبية"),
    C(1223, 288_000, "مجمع إهلاك الأثاث"),
    C(1224, 384_000, "مجمع إهلاك الحاسبات"),
    C(1225, 792_000, "مجمع إهلاك السيارات"),
    C(1232, 192_000, "مجمع إطفاء البرامج"),
    C(2111, 1_880_000, "موردون محليون — رصيد افتتاحي"),
    C(2113, 260_000, "أوراق دفع"),
    C(2114, 145_000, "دفعات مقدمة من العملاء"),
    C(2121, 730_500, "رواتب ديسمبر 2025 مستحقة — تُصرف في يناير"),
    C(2122, 118_000, "تأمينات اجتماعية مستحقة"),
    C(2123, 64_000, "ضريبة كسب عمل مستحقة"),
    C(2131, 196_000, "ض.ق.م مخرجات مستحقة"),
    C(2133, 310_000, "ضريبة أرباح تجارية مستحقة"),
    C(2141, 92_000, "إيجارات ومرافق مستحقة"),
    C(2142, 148_000, "دائنون متنوعون"),
    C(2211, 2_400_000, "قرض البنك الأهلي — تمويل أجهزة طبية"),
    C(311, 12_000_000, "رأس المال المدفوع"),
    C(321, 1_200_000, "الاحتياطي القانوني"),
    C(322, 650_000, "احتياطي عام"),
    C(331, 1_957_000, "أرباح مرحلة من سنوات سابقة"),
  ],
});

/* --------------------------------------------------------------------------
   قيود النشاط
   -------------------------------------------------------------------------- */

const activityEntries = [
  entry({
    id: 2, number: 2, date: "2026-10-05",
    description: "فاتورة خدمات طبية — شركة النور للتأمين الطبي",
    sourceType: "customer_invoice", sourceId: 1, reference: "SI-2026-0001", costCenterId: 4,
    lines: [
      D(1131, 456_000, "مديونية شركة النور للتأمين الطبي", { partyType: "customer", partyId: 1 }),
      C(4111, 400_000, "إيرادات خدمات طبية — محلي"),
      C(2131, 56_000, "ض.ق.م مخرجات 14%"),
    ],
  }),
  entry({
    id: 3, number: 3, date: "2026-10-05",
    description: "تكلفة المستلزمات المصروفة — فاتورة SI-2026-0001",
    sourceType: "inventory_issue", sourceId: 1, reference: "ISS-2026-0001", costCenterId: 4,
    lines: [
      D(5111, 268_000, "تكلفة مستهلكات طبية مصروفة"),
      C(11411, 268_000, "خروج مخزون بالتكلفة — المخزن الرئيسي"),
    ],
  }),
  entry({
    id: 4, number: 4, date: "2026-10-08",
    description: "تحصيل من شركة النور — تحويل بنكي",
    sourceType: "customer_receipt", sourceId: 1, reference: "RCV-2026-0001",
    lines: [
      D(1121, 300_000, "البنك الأهلي — تحصيل"),
      C(1131, 300_000, "سداد جزئي من شركة النور", { partyType: "customer", partyId: 1 }),
    ],
  }),
  entry({
    id: 5, number: 5, date: "2026-10-12",
    description: "فاتورة مورد — الشركة العربية لتوزيع الأدوية",
    sourceType: "supplier_invoice", sourceId: 1, reference: "PI-2026-0001", costCenterId: 5,
    lines: [
      D(11412, 520_000, "إضافة مخزون أدوية بالتكلفة"),
      D(1161, 72_800, "ض.ق.م مدخلات قابلة للخصم"),
      C(2111, 592_800, "التزام تجاه الشركة العربية لتوزيع الأدوية", { partyType: "supplier", partyId: 1 }),
    ],
  }),
  entry({
    id: 6, number: 6, date: "2026-10-18",
    description: "دفعة لشركة الدلتا — شيك رقم 884512",
    sourceType: "supplier_payment", sourceId: 1, reference: "PAY-2026-0001",
    lines: [
      D(2111, 400_000, "سداد لشركة الدلتا", { partyType: "supplier", partyId: 1 }),
      C(1121, 400_000, "البنك الأهلي — صرف شيك"),
    ],
  }),
  entry({
    id: 7, number: 7, date: "2026-10-20",
    description: "مصروفات تشغيل أكتوبر — كهرباء ومياه واتصالات",
    sourceType: "manual", costCenterId: 1,
    lines: [
      D(5222, 86_400, "كهرباء ومياه وغاز"),
      D(5223, 24_600, "اتصالات وإنترنت"),
      C(1111, 31_000, "الخزينة الرئيسية"),
      C(2141, 80_000, "مرافق مستحقة لم تُسدَّد"),
    ],
  }),
  entry({
    id: 8, number: 8, date: "2026-10-25",
    description: "تسوية مخزنية بالنقص — جرد المخزن الرئيسي",
    sourceType: "inventory_adjustment", sourceId: 1, reference: "ADJ-2026-0003", costCenterId: 6,
    lines: [
      D(513, 18_400, "عجز جرد — تلف أثناء التخزين"),
      C(11411, 18_400, "نقص مخزون بالجرد"),
    ],
  }),
  /*
   * مسيّر أكتوبر وإهلاكه يُولِّدهما المولّد الشهري أدناه (الشهر 10)، فلا
   * يُكتبان هنا — نسختان لنفس الحدث تعنيان قيدي رواتب لشهر واحد ومصروفًا
   * مُضاعفًا، وهو بالضبط ما تحرس منه مفاتيح الترحيل في js/domain/posting.js.
   *
   * ما يبقى هنا هو صرف رواتب أكتوبر في نوفمبر: المولّد يصرف رواتب الشهر
   * السابق في الخامس من كل شهر، وأكتوبر يُصرَف في نوفمبر — وهو شهر خارج
   * مدى المولّد.
   */
  entry({
    id: 11, number: 11, date: "2026-11-01",
    description: "تغذية حساب الرواتب — نوفمبر 2026",
    sourceType: "manual",
    createdBy: "أمين الخزينة / سامح زكي",
    notes: "تحويل داخلي بين حسابين بنكيين قبل الصرف — لا مصروف ولا إيراد.",
    lines: [
      D(1124, 730_500, "بنك القاهرة — حساب الرواتب"),
      C(1122, 730_500, "بنك مصر — حساب التشغيل"),
    ],
  }),
  entry({
    id: 10, number: 10, date: "2026-11-02",
    description: "صرف رواتب أكتوبر 2026 — تحويل بنكي",
    sourceType: "payroll_payment", sourceId: 10, sourceEvent: "payment", reference: "PR-2026-10",
    createdBy: "أمين الخزينة / سامح زكي",
    lines: [
      D(2121, 730_500, "صرف رواتب أكتوبر 2026"),
      C(1124, 730_500, "بنك القاهرة — حساب الرواتب"),
    ],
  }),
  entry({
    id: 12, number: 12, date: "2026-11-03",
    description: "فاتورة سياحة علاجية — شركة الصفوة للسياحة العلاجية",
    sourceType: "customer_invoice", sourceId: 7, reference: "SI-2026-0014", costCenterId: 4,
    lines: [
      D(1132, 1_240_000, "مديونية شركة الصفوة (سياحة علاجية)", { partyType: "customer", partyId: 7 }),
      C(4112, 1_240_000, "إيرادات سياحة علاجية — معفاة من ض.ق.م"),
    ],
  }),
  entry({
    id: 13, number: 13, date: "2026-11-03",
    description: "تكلفة المستلزمات المصروفة — فاتورة SI-2026-0014",
    sourceType: "inventory_issue", sourceId: 14, reference: "ISS-2026-0014", costCenterId: 4,
    lines: [
      D(5112, 806_000, "تكلفة مستلزمات عمليات مصروفة"),
      C(11413, 806_000, "خروج مخزون مستلزمات عمليات"),
    ],
  }),
  entry({
    id: 14, number: 14, date: "2026-11-04",
    description: "إيداع نقدي من الخزينة الرئيسية إلى البنك الأهلي",
    sourceType: "bank_deposit", sourceId: 3, reference: "TRF-2026-0012",
    createdBy: "أمين الخزينة / سامح زكي",
    lines: [
      D(1121, 120_000, "تحويل وارد — البنك الأهلي"),
      C(1111, 120_000, "تحويل صادر — الخزينة الرئيسية"),
    ],
  }),
  entry({
    id: 15, number: 15, date: "2026-11-05",
    description: "إشعار دائن — تسوية مطالبات مرضى النقدي",
    sourceType: "customer_credit_note", sourceId: 2, reference: "CN-2026-0004", costCenterId: 4,
    lines: [
      D(5312, 42_000, "مردودات ومسموحات إيرادات"),
      D(2131, 5_880, "عكس ض.ق.م مخرجات"),
      C(1131, 47_880, "تخفيض مديونية حسابات مرضى النقدي", { partyType: "customer", partyId: 2 }),
    ],
  }),
  entry({
    id: 16, number: 16, date: "2026-11-05",
    description: "شراء أجهزة حاسب للإدارة المالية",
    sourceType: "asset_acquisition", sourceId: 12, reference: "FA-2026-0012", costCenterId: 2,
    lines: [
      D(1214, 186_000, "شراء أصل — 6 أجهزة حاسب مكتبي"),
      D(1161, 26_040, "ض.ق.م مدخلات"),
      C(2111, 212_040, "التزام تجاه دلتا تك للأنظمة", { partyType: "supplier", partyId: 6 }),
    ],
  }),
  entry({
    id: 17, number: 17, date: "2026-11-06",
    description: "صرف سلفة للموظف محمود عادل النجار",
    sourceType: "employee_advance", sourceId: 7, reference: "ADV-2026-0007",
    createdBy: "أمين الخزينة / سامح زكي",
    lines: [
      D(1151, 18_000, "سلفة للموظف محمود عادل النجار"),
      C(1111, 18_000, "صرف سلفة من الخزينة الرئيسية"),
    ],
  }),
  entry({
    id: 18, number: 18, date: "2026-11-06",
    description: "تحويل مخزني من المخزن الرئيسي إلى مخزن الإسكندرية",
    sourceType: "inventory_transfer", sourceId: 5, reference: "TRN-2026-0005",
    notes: "تحويل داخلي — لا إيراد ولا مشتريات. نقل قيمة بين حسابي مخزون.",
    lines: [
      D(11415, 94_500, "تحويل وارد إلى مخزن الإسكندرية"),
      C(11411, 94_500, "تحويل صادر من المخزن الرئيسي"),
    ],
  }),
  entry({
    id: 19, number: 19, date: "2026-11-06",
    description: "تسوية ض.ق.م أكتوبر 2026 — مقاصة المدخلات مع المخرجات",
    sourceType: "manual",
    createdBy: "رئيس الحسابات / هالة منصور",
    lines: [
      D(2131, 98_800, "إقفال ض.ق.م مخرجات أكتوبر"),
      C(1161, 98_800, "خصم ض.ق.م مدخلات أكتوبر"),
    ],
  }),
  entry({
    id: 20, number: 20, date: "2026-11-07",
    description: "عمولات التعاقدات الطبية — أكتوبر 2026",
    sourceType: "manual", status: "pending_approval", costCenterId: 4,
    createdBy: "محاسب / كريم فتحي",
    notes: "بانتظار اعتماد رئيس الحسابات — مرفق كشف العمولات.",
    lines: [
      D(534, 64_800, "عمولات تعاقدات أكتوبر"),
      C(2142, 64_800, "دائنون متنوعون — عمولات مستحقة"),
    ],
  }),
  entry({
    id: 21, number: 21, date: "2026-11-07",
    description: "مصروفات صيانة دورية للأجهزة الطبية",
    sourceType: "manual", status: "draft", costCenterId: 7,
    createdBy: "محاسب / كريم فتحي",
    notes: "مسوّدة — في انتظار فاتورة المورد النهائية.",
    lines: [
      D(5224, 38_500, "صيانة وإصلاحات"),
      C(1111, 38_500, "الخزينة الرئيسية"),
    ],
  }),
  entry({
    id: 22, number: 22, date: "2026-10-28",
    description: "فوائد وأعباء بنكية — الربع الثالث",
    sourceType: "manual",
    lines: [
      D(541, 47_200, "فوائد قرض وأعباء بنكية"),
      C(1121, 47_200, "البنك الأهلي"),
    ],
  }),
  entry({
    id: 23, number: 23, date: "2026-10-15",
    description: "إيجار مباني المستشفى — الربع الرابع 2026",
    sourceType: "manual", costCenterId: 1,
    lines: [
      D(5221, 420_000, "إيجار الربع الرابع"),
      C(1122, 420_000, "بنك مصر — حساب التشغيل"),
    ],
  }),
  entry({
    id: 24, number: 24, date: "2026-10-22",
    description: "حملة تسويقية — معرض القاهرة الدولي",
    sourceType: "manual", costCenterId: 4,
    lines: [
      D(533, 165_000, "دعاية وتسويق"),
      D(1161, 23_100, "ض.ق.م مدخلات"),
      C(2142, 188_100, "دائنون متنوعون — وكالة الدعاية"),
    ],
  }),
  entry({
    id: 25, number: 25, date: "2026-09-30",
    description: "قيد خاطئ على مركز تكلفة غير صحيح — تم عكسه",
    sourceType: "manual", status: "reversed", costCenterId: 9,
    createdBy: "محاسب / كريم فتحي",
    notes: "عُكس بالقيد JV-2026-00026. السبب: مركز تكلفة خاطئ.",
    lines: [
      D(5225, 12_600, "مستلزمات مكتبية"),
      C(1113, 12_600, "خزينة النثرية"),
    ],
  }),
  entry({
    id: 26, number: 26, date: "2026-10-01",
    description: "عكس القيد JV-2026-00025 — مركز تكلفة خاطئ",
    sourceType: "manual", costCenterId: 9,
    createdBy: "رئيس الحسابات / هالة منصور",
    notes: "قيد عكسي آلي. السبب: مركز تكلفة خاطئ.",
    lines: [
      D(1113, 12_600, "خزينة النثرية"),
      C(5225, 12_600, "مستلزمات مكتبية"),
    ],
  }),
];

/* --------------------------------------------------------------------------
   قيود النشاط الشهري المتكرر (يناير – أكتوبر)

   بلا تاريخ تشغيلي للسنة، تُقرأ قائمة الدخل على شهر واحد فتُظهر خسارة
   مُضلِّلة: مصروفات شهر كامل مقابل إيراد أيام. هذه القيود تبني سنة تشغيل
   معقولة ومتوازنة، فتصبح كل التقارير الدورية (الميزان المقارن، قائمة الدخل،
   التدفقات) قابلة للقراءة فعلًا.

   نوفمبر مُتعمَّد أن يكون جزئيًا — التاريخ المرجعي هو 7 نوفمبر، والشهر
   الجاري ناقص بطبيعته. اكتماله كان سيجعل «الشهر الحالي» في لوحة التحكم
   يعرض شهرًا منتهيًا، وهو ما لا يحدث في نظام يعمل.
   -------------------------------------------------------------------------- */

const monthlyEntries = (() => {
  const out = [];
  let id = 100;
  let number = 100;

  const MONTHS = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر",
  ];

  for (let month = 1; month <= 10; month += 1) {
    const mm = String(month).padStart(2, "0");
    const label = `${MONTHS[month - 1]} ${FISCAL_YEAR}`;
    const lastDay = new Date(Date.UTC(FISCAL_YEAR, month, 0)).toISOString().slice(0, 10);

    /* الشهر السابق — يُصرَف مسيّره في الخامس من هذا الشهر. */
    const previousYear = month === 1 ? FISCAL_YEAR - 1 : FISCAL_YEAR;
    const previousMonth = month === 1 ? 12 : month - 1;
    const previousLabel = `${
      ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"][
        previousMonth - 1
      ]
    } ${previousYear}`;
    const previousReference = `PR-${previousYear}-${String(previousMonth).padStart(2, "0")}`;

    /* موسمية معقولة: الربع الأخير أقوى، ورمضان وأغسطس أهدأ. */
    const seasonality = [0.92, 0.88, 1.05, 1.12, 0.95, 1.0, 0.86, 0.82, 1.08, 1.15][month - 1];

    const localSales = round100(4_600_000 * seasonality * (1 + random.float() * 0.1));
    const exportSales = round100(1_450_000 * seasonality * (1 + random.float() * 0.18));
    const vat = round2(localSales * 0.14);

    /* هامش إجمالي بين 32% و 38% — واقعي لمستشفى خاص. */
    const cogsRate = 0.62 + random.float() * 0.06;
    const cogsLocal = round100(localSales * cogsRate);
    const cogsExport = round100(exportSales * (cogsRate + 0.03));

    /*
     * دورة المستلزمات: أدوية ومحاليل تُشترى ← تُجهَّز منها أطقم معقمة
     * لمخزن العمليات (التعقيم المركزي) ← تُصرف على الخدمات. المشتريات تتجاوز
     * الاستهلاك قليلًا وإلا نفد المخزون خلال الشهور، والتجهيز يتجاوز الصرف
     * قليلًا لنفس السبب.
     *
     * بدون قيد التجهيز (أدوية ← مستلزمات عمليات) يخرج مخزون مستلزمات
     * العمليات برصيد سالب: تكلفة الخدمات تصرف منه شهريًا ولا شيء يُضيف إليه.
     */
    const production = round100(cogsExport * 1.08);
    const purchaseRaw = round100(cogsExport * 1.15);
    const purchaseTrading = round100(cogsLocal * 1.04);
    const purchaseVat = round2((purchaseRaw + purchaseTrading) * 0.14);
    const purchaseTotal = round2(purchaseRaw + purchaseTrading + purchaseVat);
    const supplierPaid = round100(purchaseTotal * 0.9);
    /*
     * السداد موزَّع على بنكين بحسب ما يدخل كلًّا منهما فعلًا: البنك الأهلي
     * يستقبل التحصيلات المحلية فيحمل الجزء الأكبر، وبنك مصر يستقبل تحصيلات
     * التصدير ويغذّي حساب الرواتب فيحمل الجزء الأصغر. توجيه السداد كله إلى
     * بنك واحد يُنتج رصيدًا بنكيًا سالبًا — سحب على المكشوف لم يُتعاقد عليه.
     */
    const supplierPaidNbe = round100(supplierPaid * 0.92);

    /* تحصيل 88% من المفوتر محليًا — الباقي يبني رصيد ذمم واقعيًا. */
    const collectedLocal = round100((localSales + vat) * 0.88);
    const collectedExport = round100(exportSales * 0.72);
    const collectedLocalBank = round100(collectedLocal * 0.85);

    const opexRows = [
      [5221, 140_000, "إيجارات الشهر"],
      [5222, 82_000, "كهرباء ومياه وغاز"],
      [5223, 23_500, "اتصالات وإنترنت"],
      [5224, 46_000, "صيانة وإصلاحات"],
      [5225, 18_500, "مستلزمات مكتبية ونظافة"],
      [532, 94_000, "نقل وإسعاف وانتقالات"],
      [533, 72_000, "دعاية وتسويق"],
      [534, round100(localSales * 0.012), "عمولات تعاقدات"],
    ];
    const opexTotal = round2(opexRows.reduce((sum, [, amount]) => sum + amount, 0));
    /* يُسدَّد 92% فورًا والباقي يُستحق — فيبقى لحساب الدائنين رصيد واقعي. */
    const opexPaid = round100(opexTotal * 0.92);

    out.push(
      entry({
        id: id += 1, number: number += 1, date: `${FISCAL_YEAR}-${mm}-25`,
        description: `إجمالي إيرادات الخدمات الطبية ${label} — مجمَّع شهريًا`,
        sourceType: "manual", costCenterId: 4,
        createdBy: "محاسب / كريم فتحي",
        lines: [
          D(1131, round2(localSales + vat), "مديونية عملاء محليين — إيرادات الشهر"),
          D(1132, exportSales, "مديونية عملاء السياحة العلاجية — إيرادات الشهر"),
          C(4111, localSales, "إيرادات خدمات طبية — محلي"),
          C(4112, exportSales, "إيرادات سياحة علاجية — معفاة من ض.ق.م"),
          C(2131, vat, "ض.ق.م مخرجات 14%"),
        ],
      }),
      entry({
        id: id += 1, number: number += 1, date: `${FISCAL_YEAR}-${mm}-25`,
        description: `تكلفة الخدمات الطبية ${label}`,
        sourceType: "manual", costCenterId: 4,
        lines: [
          D(5111, cogsLocal, "تكلفة مستهلكات طبية مصروفة"),
          D(5112, cogsExport, "تكلفة مستلزمات عمليات مصروفة"),
          C(11411, cogsLocal, "خروج مخزون مستهلكات بالتكلفة"),
          C(11413, cogsExport, "خروج مخزون مستلزمات عمليات بالتكلفة"),
        ],
      }),
      entry({
        id: id += 1, number: number += 1, date: `${FISCAL_YEAR}-${mm}-28`,
        description: `تحصيلات ${label} من العملاء`,
        sourceType: "manual",
        createdBy: "أمين الخزينة / سامح زكي",
        lines: [
          D(1121, collectedLocalBank, "البنك الأهلي — تحصيلات"),
          D(1111, round2(collectedLocal - collectedLocalBank), "الخزينة الرئيسية — تحصيلات نقدية"),
          D(1122, collectedExport, "بنك مصر — تحصيلات سياحة علاجية"),
          C(1131, collectedLocal, "سداد عملاء محليين"),
          C(1132, collectedExport, "سداد عملاء السياحة العلاجية"),
        ],
      }),
      entry({
        id: id += 1, number: number += 1, date: lastDay,
        description: `مسيّر رواتب ${label}`,
        sourceType: "payroll_approval", sourceId: month, sourceEvent: "accrual", costCenterId: 1,
        reference: `PR-${FISCAL_YEAR}-${mm}`,
        createdBy: "موظف موارد بشرية / دعاء شلبي",
        lines: [
          D(5211, 728_000, "الرواتب الأساسية"),
          D(5212, 145_600, "البدلات والمكافآت"),
          D(5213, 26_400, "أجر العمل الإضافي"),
          D(5214, 136_500, "حصة صاحب العمل في التأمينات"),
          C(2121, 730_500, "صافي رواتب مستحقة"),
          C(2123, 76_900, "ضريبة كسب عمل مستقطعة"),
          C(2122, 216_600, "تأمينات اجتماعية مستحقة"),
          C(1151, 8_000, "استرداد أقساط سلف من المسيّر"),
          C(2124, 4_500, "استقطاعات أخرى مستحقة"),
        ],
      }),
      entry({
        id: id += 1, number: number += 1, date: `${FISCAL_YEAR}-${mm}-03`,
        description: `تغذية حساب الرواتب — ${label}`,
        sourceType: "manual",
        createdBy: "أمين الخزينة / سامح زكي",
        notes: "تحويل داخلي بين حسابين بنكيين قبل الصرف — لا مصروف ولا إيراد.",
        lines: [
          D(1124, 730_500, "بنك القاهرة — حساب الرواتب"),
          C(1122, 730_500, "بنك مصر — حساب التشغيل"),
        ],
      }),
      /*
       * `sourceId` هنا هو **المسيّر الذي يُصرَف** لا الشهر الذي يقع فيه
       * الصرف: رواتب الشهر تُصرَف في الخامس من الشهر التالي. ربطه بشهر
       * الصرف يُنتج مفتاح ترحيل مكررًا مع صرف الشهر التالي، فيحجز المفتاح
       * حدثًا ليس له.
       */
      entry({
        id: id += 1, number: number += 1, date: `${FISCAL_YEAR}-${mm}-05`,
        description: `صرف رواتب ${previousLabel}`,
        sourceType: "payroll_payment", sourceId: month - 1, sourceEvent: "payment",
        reference: previousReference,
        createdBy: "أمين الخزينة / سامح زكي",
        lines: [
          D(2121, 730_500, "صرف صافي الرواتب"),
          C(1124, 730_500, "بنك القاهرة — حساب الرواتب"),
        ],
      }),
      entry({
        id: id += 1, number: number += 1, date: `${FISCAL_YEAR}-${mm}-27`,
        description: `إيداع فائض الخزينة في البنك — ${label}`,
        sourceType: "bank_deposit", sourceId: 1000 + month, reference: `DEP-${FISCAL_YEAR}-${mm}`,
        createdBy: "أمين الخزينة / سامح زكي",
        notes: "ترحيل النقدية الزائدة عن حد الخزينة إلى البنك — إجراء خزينة دوري.",
        lines: [
          D(1121, 650_000, "البنك الأهلي — إيداع نقدي"),
          C(1111, 650_000, "الخزينة الرئيسية — توريد للبنك"),
        ],
      }),
      entry({
        id: id += 1, number: number += 1, date: `${FISCAL_YEAR}-${mm}-10`,
        description: `سلف موظفين مصروفة — ${label}`,
        sourceType: "manual",
        createdBy: "أمين الخزينة / سامح زكي",
        lines: [
          D(1151, 12_000, "سلف صُرفت للموظفين خلال الشهر"),
          C(1111, 12_000, "صرف من الخزينة الرئيسية"),
        ],
      }),
      entry({
        id: id += 1, number: number += 1, date: lastDay,
        description: `إهلاك ${label}`,
        sourceType: "asset_depreciation", sourceId: month, reference: `DEP-${FISCAL_YEAR}-${mm}`, costCenterId: 7,
        lines: [
          D(5241, 123_750, "مصروف إهلاك الأصول الثابتة"),
          C(1221, 18_056, "مجمع إهلاك المبانٍ"),
          C(1222, 56_583, "مجمع إهلاك الأجهزة الطبية"),
          C(1223, 7_200, "مجمع إهلاك الأثاث"),
          C(1224, 14_222, "مجمع إهلاك الحاسبات"),
          C(1225, 27_689, "مجمع إهلاك السيارات"),
        ],
      }),
      entry({
        id: id += 1, number: number += 1, date: `${FISCAL_YEAR}-${mm}-20`,
        description: `مصروفات تشغيلية وإدارية — ${label}`,
        sourceType: "manual", costCenterId: 1,
        lines: [
          ...opexRows.map(([accountId, amount, description]) => D(accountId, amount, description)),
          C(1121, opexPaid, "البنك الأهلي — سداد مصروفات الشهر"),
          C(2142, round2(opexTotal - opexPaid), "دائنون متنوعون — مصروفات مستحقة"),
        ],
      }),
      entry({
        id: id += 1, number: number += 1, date: `${FISCAL_YEAR}-${mm}-22`,
        description: `تجهيز مستلزمات العمليات (تعقيم مركزي) — ${label}`,
        sourceType: "manual", costCenterId: 7,
        notes: "استهلاك أدوية ومحاليل مقابل إضافة مستلزمات عمليات مجهَّزة. لا إيراد — تحويل داخلي بين حسابي مخزون.",
        lines: [
          D(11413, production, "إضافة مستلزمات عمليات مجهَّزة بالتكلفة"),
          C(11412, production, "استهلاك أدوية ومحاليل في التجهيز"),
        ],
      }),
      entry({
        id: id += 1, number: number += 1, date: `${FISCAL_YEAR}-${mm}-15`,
        description: `مشتريات أدوية ومستلزمات طبية — ${label}`,
        sourceType: "manual", costCenterId: 5,
        lines: [
          D(11412, purchaseRaw, "إضافة مخزون أدوية ومحاليل"),
          D(11411, purchaseTrading, "إضافة مخزون مستهلكات طبية"),
          D(1161, purchaseVat, "ض.ق.م مدخلات قابلة للخصم"),
          C(2111, purchaseTotal, "التزام تجاه الموردين"),
        ],
      }),
      entry({
        id: id += 1, number: number += 1, date: `${FISCAL_YEAR}-${mm}-18`,
        description: `سداد مستحقات الموردين — ${label}`,
        sourceType: "manual",
        createdBy: "أمين الخزينة / سامح زكي",
        lines: [
          D(2111, supplierPaid, "سداد للموردين"),
          C(1121, supplierPaidNbe, "البنك الأهلي — سداد الموردين"),
          C(1122, round2(supplierPaid - supplierPaidNbe), "بنك مصر — سداد الموردين"),
        ],
      }),
      entry({
        id: id += 1, number: number += 1, date: lastDay,
        description: `تسوية ض.ق.م ${label} — مقاصة المدخلات مع المخرجات`,
        sourceType: "manual",
        createdBy: "رئيس الحسابات / هالة منصور",
        lines: [
          D(2131, round2(Math.min(vat, purchaseVat)), "إقفال ض.ق.م مخرجات"),
          C(1161, round2(Math.min(vat, purchaseVat)), "خصم ض.ق.م مدخلات"),
        ],
      }),
    );
  }

  /*
   * تصحيح تلقائي: القيود أعلاه مبنية بأرقام مُقرَّبة، والتقريب قد يُنتج فرقًا
   * بالقروش. نُسوّي كل قيد غير متوازن على «دائنون متنوعون» — وهو ما يفعله
   * المحاسب فعلًا. البديل (تمرير القيد كما هو) يُنتج ميزانًا لا يتوازن ولا
   * يُعرف أي قيد سبّبه.
   */
  for (const row of out) {
    const difference = Math.round((row.totalDebit - row.totalCredit) * 100) / 100;
    if (difference === 0) continue;

    const side = difference > 0 ? "credit" : "debit";
    row.lines.push({
      lineNumber: row.lines.length + 1,
      accountId: 2142,
      debit: side === "debit" ? Math.abs(difference) : 0,
      credit: side === "credit" ? Math.abs(difference) : 0,
      description: "تسوية فرق تقريب",
      costCenterId: row.costCenterId,
      partyType: null,
      partyId: null,
    });

    if (side === "credit") row.totalCredit = Math.round((row.totalCredit + Math.abs(difference)) * 100) / 100;
    else row.totalDebit = Math.round((row.totalDebit + Math.abs(difference)) * 100) / 100;
  }

  return out;
})();

activityEntries.push(...monthlyEntries);

/* ============================================================================
   معايرة أرصدة المخزون الافتتاحية

   ═══════════════════════════════════════════════════════════════════════════
    الحساب الرقابي للمخزون يتبع موديول المخازن، لا العكس.
   ═══════════════════════════════════════════════════════════════════════════

   موديول المخازن (js/mock/inventory.mock.js) يملك الكمية والتكلفة، ويُقيّمهما
   بمحرك FIFO / المتوسط المرجّح. قيمته الختامية هي الحقيقة؛ ووظيفة الدفتر أن
   يُطابقها.

   لذلك نحسب هنا: الرصيد الافتتاحي = القيمة الختامية − صافي حركة الفترة على
   الحساب. الاتجاه المعاكس (تثبيت الافتتاحي ثم إجبار المخزون على مطابقته) كان
   سيُفقد محرك التقييم معناه: قيمة المخزون ستصبح رقمًا مكتوبًا لا ناتج تقييم.
   ============================================================================ */

(() => {
  const INVENTORY_ACCOUNTS = [11411, 11412, 11413, 11414, 11415];

  /* صافي حركة كل حساب مخزون في قيود النشاط (مدين − دائن). */
  const activityNet = new Map(INVENTORY_ACCOUNTS.map((accountId) => [accountId, 0]));

  for (const row of activityEntries) {
    /* القيد المعكوس وقيده العكسي كلاهما في الدفتر، فصافيهما صفر تلقائيًا. */
    if (row.status !== "posted" && row.status !== "reversed") continue;

    for (const line of row.lines) {
      if (!activityNet.has(line.accountId)) continue;
      activityNet.set(
        line.accountId,
        round2(activityNet.get(line.accountId) + (line.debit ?? 0) - (line.credit ?? 0)),
      );
    }
  }

  let openingTotal = 0;

  for (const accountId of INVENTORY_ACCOUNTS) {
    const closing = round2(inventoryClosingByAccount[String(accountId)] ?? 0);
    const required = round2(closing - activityNet.get(accountId));

    const line = openingEntry.lines.find((row) => row.accountId === accountId);

    /*
     * رصيد افتتاحي سالب لا معنى له: يعني أن حركة الفترة وحدها تتجاوز القيمة
     * الختامية. نُقيّده عند الصفر ونترك الفرق يظهر في المطابقة بدل أن نكتب
     * مخزونًا سالبًا في الميزانية.
     */
    line.debit = Math.max(0, required);
    line.description = `${line.description} (مُعاير على قيمة المخزون الفعلية)`;
    openingTotal = round2(openingTotal + line.debit);
  }

  openingEntry.totalDebit = round2(openingEntry.totalDebit + openingTotal);
})();

/*
 * التوازن ليس اتفاقًا: القيد الافتتاحي مكتوب يدويًا ببيانات واقعية، وأرصدة
 * المخزون فيه مُعايرة على موديول المخازن. السطر التالي يُحمِّل الفرق على
 * الأرباح المرحلة — وهو بالضبط ما يفعله المحاسب عند نقل الأرصدة. تركه بلا
 * تصحيح يُنتج ميزانًا غير متوازن في أول شاشة يفتحها المستخدم.
 */
(() => {
  const difference = round2(openingEntry.totalDebit - openingEntry.totalCredit);
  if (difference === 0) return;

  const retained = openingEntry.lines.find((line) => line.accountId === 331);
  retained.credit = round2(retained.credit + difference);
  retained.description = "أرباح مرحلة من سنوات سابقة (مُعدَّلة بفرق النقل)";

  openingEntry.totalCredit = round2(openingEntry.totalCredit + difference);
})();

/** القيد العكسي يحمل مرجع أصله — تقرأه شاشة القيود لعرض الرابط بينهما. */
activityEntries.find((candidate) => candidate.id === 26).reversalOf = 25;
activityEntries.find((candidate) => candidate.id === 26).isReversal = true;
activityEntries.find((candidate) => candidate.id === 25).reversedBy = "رئيس الحسابات / هالة منصور";
activityEntries.find((candidate) => candidate.id === 25).reversedAt = "2026-10-01T09:20:00+02:00";
activityEntries.find((candidate) => candidate.id === 25).reversalReason = "مركز تكلفة خاطئ";

export const journalEntries = [openingEntry, ...activityEntries].sort(
  (a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id,
);

/** مراكز التكلفة — مُصدَّرة من seed لتبقى مصدرًا واحدًا. */
export const costCenters = COST_CENTERS;

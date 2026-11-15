# مواصفة الباك-إند — ADVANCED ERP (نظام مستشفى)

> **آخر تحديث:** 15 نوفمبر 2026
> **الجمهور:** مطوّر الباك-إند الذي سينفّذ الخادم الحقيقي.
> **الحالة:** الواجهة مكتملة وتعمل على طبقة محاكاة كاملة (228 نقطة نهاية).
> هذا الملف هو **العقد**: نفّذ ما فيه بنفس الأسماء والأشكال، فتعمل الواجهة
> بلا تعديل سطر واحد فيها.

---

## 0. اقرأ هذا أولًا (خمس دقائق)

### ما هو هذا المشروع؟

نظام إدارة مستشفى: استقبال ومرضى وإقامة وغرف، مخازن وصيدليات فرعية،
محاسبة عامة ومالية، وموارد بشرية. الواجهة **مبنية بالكامل** (64 شاشة)
وتعمل الآن على محاكاة في المتصفح.

### مهمتك بالضبط

الواجهة تتحدث مع الخادم من **ملف واحد**: `frontend/js/api/http.js`.
وهناك مُحاكٍ يُنفّذ كل نقاط النهاية في `frontend/js/api/mock-adapter.js`.

```js
// frontend/js/core/config.js
export const API = {
  mode: "mock",        // ← بدّلها إلى "live"
  baseUrl: "/api",     // ← وضع عنوان خادمك
};
```

**مهمتك:** نفّذ نقاط النهاية المسجَّلة في `mock-adapter.js` بنفس:
- المسار والطريقة (`GET /rooms/occupancy-board`)
- شكل الاستجابة (`{ data, meta }` أو `{ data }`)
- أسماء الحقول حرفيًا (`baseTotalAfterDiscount` لا `base_total_after_discount`)

ثم بدّل `mode` إلى `"live"`. لا شيء آخر.

### أسرع طريقة لرؤية العقد كاملًا

```bash
cd frontend
npm install
npm run build          # بناء CSS (مطلوب مرة واحدة)
npm run dev            # http://localhost:4173
npm test               # 459 فحصًا + زيارة 64 مسارًا بمتصفح حقيقي
```

ثم افتح أي شاشة، وافتح تبويب الشبكة في المتصفح: كل طلب تراه هو نقطة نهاية
يجب أن تُنفّذها. وافتح `frontend/js/api/mock-adapter.js` — الملف كله جدول
`METHOD /path → دالة`، وهو قائمة أعمالك مرتّبة بالموديول.

```js
// للحصول على القائمة الكاملة نصًّا:
import { registeredEndpoints } from "./js/api/mock-adapter.js";
console.log(registeredEndpoints().join("\n"));   // 228 سطرًا
```

### أين المنطق الذي يجب أن تُقلّده؟

| الطبقة | المسار | ماذا تجد فيها |
|---|---|---|
| **قواعد المجال** | `frontend/js/domain/*.js` | دوال خالصة: التقييم، الترحيل، التسعير، الإهلاك، الرواتب. **انقلها كما هي** — هي المنطق الصحيح وقد اختُبرت. |
| **محاكاة الخدمات** | `frontend/js/mock/services/*.js` | تنسيق العمليات: التحقق، الحراسة، الترحيل، التدقيق. هي **مواصفة سلوك** خدماتك. |
| **البيانات** | `frontend/js/mock/*.mock.js` | شكل كل كيان بكل حقوله + بيانات واقعية للاختبار. |
| **الاختبارات** | `frontend/tests/*.test.mjs` | 459 فحصًا. **انقل كل ضمانة فيها لاختبارات خادمك.** |

---

## 1. القواعد التي لا تُخالَف

هذه ليست أسلوب كتابة — هي قواعد يكسر خرقُها صحة البيانات. كل واحدة منها
اكتُشفت من خطأ حقيقي في هذا المشروع.

### 1.1 المال أعداد صحيحة بالقروش

```js
// ❌ ممنوع
const margin = charged - cost;          // 94.19999999999999

// ✅
const margin = money.subtract(charged, cost);   // 94.2
```

الطرح العشري المباشر أنتج فعلًا `94.19999999999999` في هذا المشروع، وفشل
اختبار بسببه. **كل** عملية مالية تمر من وحدة مال واحدة (`js/core/money.js`
في الواجهة — افعل نفس الشيء عندك). في قاعدة البيانات: `BIGINT` بالقروش أو
`NUMERIC(18,2)`، **لا `FLOAT` ولا `DOUBLE` أبدًا**.

### 1.2 الأرصدة مُشتقّة لا مخزَّنة

| الرصيد | يُشتق من |
|---|---|
| رصيد حساب في الدليل | جمع سطور القيود المُرحَّلة |
| رصيد صنف في مخزن | جمع الحركات المخزنية (`stockMovements`) |
| إجمالي تكلفة إقامة | جمع سطور `admissionCharges` |
| عدد ليالي الإقامة | الفرق بين تاريخ الدخول والخروج |

**لا تُضف عمود `balance` مخزَّنًا.** كان سجل الإقامة في هذا المشروع يخزّن
`totalCost: 3500 * 7 + 16500` و`daysCount: 7` — فلم يطابق الإجمالي سطوره
أبدًا، وكان أحد السجلات بتاريخ دخول **مستقبلي** ومع ذلك محسوب له ثلاثة أيام.

للأداء: استخدم **Materialized View** أو جدول إسقاط (`projection`) يُحدَّث
في نفس المعاملة — لا حقلًا يُحدَّثه الكود يدويًا في عشرة أماكن.

### 1.3 الترحيل المحاسبي مركزي — نقطة دخول واحدة

لا موديول يبني قيد يومية بنفسه. الدالة الوحيدة هي:

```js
postDocument({ sourceType, sourceId, sourceEvent, document, date, description, reference, user })
```

وهي تترجم الحدث إلى سطور عبر خريطة قواعد (`js/domain/posting-rules.js`,
26 قاعدة). أي حدث مالي جديد = **دالة قاعدة جديدة + مدخل في الخريطة**، لا
قيد مكتوب بالإيد في خدمة.

وتضمن أربعة أشياء قبل أي كتابة:

1. **مفتاح تفرّد** (`sourceType:sourceId:sourceEvent`) — يمنع الترحيل المزدوج
   عند إعادة إرسال الطلب. هذا هو `Idempotency-Key` ويجب أن يكون
   `UNIQUE INDEX` في قاعدتك.
2. **توازن** — مجموع المدين = مجموع الدائن **بالقرش، بلا هامش**.
   اجعلها قيدًا على مستوى قاعدة البيانات (`CHECK` / `TRIGGER`)، لا تحققًا
   في الكود فقط.
3. **فترة مفتوحة** — لا ترحيل في فترة محاسبية مُقفلة.
4. **سجل تدقيق** — من، ماذا، متى، والتفاصيل.

### 1.4 القيود غير قابلة للتعديل (Append-Only)

القيد المُرحَّل لا يُعدَّل ولا يُحذف. التصحيح **بقيد عكسي** فقط. اجعل
الجدول append-only على مستوى الصلاحيات في قاعدة البيانات.

### 1.5 لا رسالة نجاح لعملية لم تُنفَّذ، ولا خطأ يُخفى بصمت

- عملية لا أثر لها ≠ عملية نجحت. أعِد `{ skipped: true, reason }` صريحة.
- فشل جزئي يُعلَن: `{ dispensedCount, failedCount, failed: [{ item, reason }] }`.
- قيمة مفقودة لا تُفترض. مثال حقيقي: غياب سعر صرف عملة **يرمي خطأً**، ولا
  يفترض `rate = 1` — فاتورة بـ 2,400 دولار تُرحَّل 2,400 جنيه، ويظهر الخلل
  بعد أشهر في فرق لا يُفسَّر.

### 1.6 شكل الاستجابة ثابت

```jsonc
// قائمة
{ "data": [ ... ], "meta": { "total": 120, "page": 1, "perPage": 20, "totalPages": 6, /* + إحصائيات الشاشة */ } }

// عنصر واحد
{ "data": { ... } }
```

**الفلترة والترتيب والترقيم على الخادم** لا في الواجهة. الجداول تتوقع ذلك،
ولو أعدت كل الصفوف لفلترتها محليًا فلن يعمل النظام مع آلاف الصفوف.

### 1.7 شكل الخطأ ثابت

```jsonc
{
  "code": "VALIDATION_ERROR",          // أو BUSINESS_RULE_VIOLATION | NOT_FOUND | ...
  "message": "راجع الحقول المظلَّلة.",
  "fields": { "receivedQty": "الكمية المستلمة مطلوبة." }
}
```

| الكود | HTTP | المعنى |
|---|---|---|
| `VALIDATION_ERROR` | 422 | حقول ناقصة أو غير صالحة — `fields` إلزامية |
| `BUSINESS_RULE_VIOLATION` | 409 | قاعدة عمل مُنعت العملية (رصيد غير كافٍ، حالة غير مسموحة) |
| `NOT_FOUND` | 404 | كيان غير موجود |
| `UNAUTHORIZED` | 401 | غير مُصادَق |
| `FORBIDDEN` | 403 | مُصادَق بلا صلاحية — **أو خارج نطاق مخزنه** |
| `ALREADY_POSTED` | 409 | مفتاح التفرّد مستخدم — الحدث مُرحَّل سابقًا |
| `PERIOD_CLOSED` | 409 | الفترة المحاسبية مُقفلة |

الرسائل **بالعربية** — الواجهة تعرضها للمستخدم كما هي.

### 1.8 الصلاحية والنطاق سؤالان مختلفان

```
can("inv.issue.create")   →  هل يملك الصرف أصلًا؟
canAccessWarehouse(3)     →  هل يملك الصرف من هذا المخزن؟
```

أمين مخزن فرع 1 يملك صلاحية الصرف، لكنه **لا يصرف من مخزن فرع 3**.
الخلط بينهما يُعطيه سلطة لا يملكها. راجع §7.

---

## 2. المخطط (Schema)

العملة الأساسية `EGP`. كل المبالغ بالقروش (`BIGINT`) أو `NUMERIC(18,2)`.

### 2.1 المحاسبة العامة

```sql
-- دليل الحسابات: هرمي، والترحيل على الأوراق فقط
accounts (
  id            BIGINT PK,
  code          VARCHAR(20) UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  name_en       TEXT,
  type          TEXT NOT NULL,       -- asset|liability|equity|revenue|expense
  parent_id     BIGINT REFERENCES accounts(id),
  level         SMALLINT NOT NULL,
  nature        TEXT NOT NULL,       -- debit|credit
  is_leaf       BOOLEAN NOT NULL,    -- الترحيل على الأوراق فقط
  status        TEXT NOT NULL        -- active|inactive
);
-- 127 حسابًا في البيانات التجريبية، 88 ورقة قابلة للترحيل

journal_entries (
  id            BIGINT PK,
  entry_number  VARCHAR(30) UNIQUE NOT NULL,
  date          DATE NOT NULL,
  period_id     BIGINT NOT NULL REFERENCES accounting_periods(id),
  description   TEXT NOT NULL,
  reference     TEXT,

  -- مصدر الحدث: يربط القيد بمستنده
  source_type   TEXT NOT NULL,       -- انظر §3 لقائمة الأنواع
  source_id     BIGINT,
  source_event  TEXT NOT NULL DEFAULT 'default',

  -- مفتاح التفرّد: يمنع الترحيل المزدوج. هذا هو Idempotency-Key.
  posting_key   TEXT NOT NULL,
  status        TEXT NOT NULL,       -- draft|posted|reversed
  reversed_by   BIGINT REFERENCES journal_entries(id),
  cost_center_id BIGINT,
  created_by    BIGINT NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_posting_key UNIQUE (posting_key)
);

journal_lines (
  id            BIGINT PK,
  entry_id      BIGINT NOT NULL REFERENCES journal_entries(id),
  account_id    BIGINT NOT NULL REFERENCES accounts(id),
  debit         NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit        NUMERIC(18,2) NOT NULL DEFAULT 0,
  description   TEXT,
  cost_center_id BIGINT,
  party_type    TEXT,                -- customer|supplier|employee|patient
  party_id      BIGINT,

  CONSTRAINT ck_one_side CHECK ((debit = 0) <> (credit = 0))
);

-- التوازن قيد على مستوى قاعدة البيانات لا تحقق في الكود
CREATE OR REPLACE FUNCTION assert_entry_balanced() RETURNS TRIGGER AS $$
DECLARE d NUMERIC(18,2); c NUMERIC(18,2);
BEGIN
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0) INTO d, c
    FROM journal_lines WHERE entry_id = NEW.entry_id;
  IF d <> c THEN
    RAISE EXCEPTION 'قيد غير متوازن: مدين % ودائن %', d, c;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

accounting_periods (
  id, fiscal_year_id, name, start_date, end_date,
  status TEXT NOT NULL              -- open|closed
);

fiscal_years (id, name, year, start_date, end_date, status, closed_at, closed_by);
cost_centers  (id, code, name, parent_id, status);

-- خريطة الربط المحاسبي: أي حساب لأي دور. يُعطّل الترحيل إن كان ناقصًا.
posting_map (key TEXT PK, account_id BIGINT NOT NULL REFERENCES accounts(id));
```

**مفاتيح `posting_map` المطلوبة** (كلها إلزامية — الترحيل يفشل بدونها):

```
cashOnHand · bankAccounts · cashInTransit
accountsReceivable · accountsPayable · advancesFromCustomers · advancesToSuppliers
salesRevenue · serviceRevenue · salesReturns · salesDiscounts · otherIncome
inventory · stockInTransit · goodsReceivedNotInvoiced · costOfGoodsSold
inventoryShrinkage · inventorySurplus · purchaseReturns · purchasePriceVariance
outputVat · inputVat · withholdingTax · payrollTaxPayable
salariesExpense · allowancesExpense · overtimeExpense
employerSocialInsuranceExpense · salariesPayable · socialInsurancePayable
employeeAdvances · payrollDeductionsPayable
fixedAssets · accumulatedDepreciation · depreciationExpense
gainOnAssetDisposal · lossOnAssetDisposal
retainedEarnings · incomeSummary
```

### 2.2 المخازن

```sql
warehouses (
  id, code, name, name_en, manager_id, location,
  inventory_account_id BIGINT NOT NULL REFERENCES accounts(id),
  costing_method TEXT NOT NULL,      -- fifo|weighted_average
  allow_negative BOOLEAN NOT NULL DEFAULT false,
  is_hub    BOOLEAN NOT NULL DEFAULT false,   -- المخزن الرئيسي المركزي
  is_branch BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL
);
-- واحد رئيسي (is_hub) + أربعة فروع

items (
  id, code UNIQUE, barcode, name, name_en,
  category_id, unit_id, decimals,

  cost_price           NUMERIC(18,2),
  selling_price        NUMERIC(18,2),   -- لا يُعدِّله أمين المخزن. §5
  last_purchase_price  NUMERIC(18,2),   -- يُحدَّث من سعر الفاتورة فقط
  costing_method       TEXT,            -- يغلب طريقة المخزن

  min_level, max_level, reorder_point, lead_time_days,
  track_batches  BOOLEAN,
  track_expiry   BOOLEAN,
  track_serials  BOOLEAN,

  -- هل يُحمَّل على حساب المريض عند صرفه له؟
  -- الأدوية والمستلزمات = true · المكتبية والنظافة وقطع الغيار = false
  patient_chargeable BOOLEAN NOT NULL DEFAULT false,

  inventory_account_id BIGINT REFERENCES accounts(id),
  status TEXT NOT NULL
);

-- المخازن المسموح تخزين الصنف فيها. المخزن الرئيسي مُضمَّن في كل الأصناف.
item_warehouses (item_id, warehouse_id, is_default BOOLEAN, PRIMARY KEY (item_id, warehouse_id));

-- الحركات: مصدر الحقيقة الوحيد للأرصدة. append-only.
stock_movements (
  id            BIGINT PK,
  item_id       BIGINT NOT NULL REFERENCES items(id),
  warehouse_id  BIGINT NOT NULL REFERENCES warehouses(id),
  type          TEXT NOT NULL,   -- opening|receipt|issue|transfer_in|transfer_out
                                 -- |adjustment_in|adjustment_out|return_in
  date          DATE NOT NULL,
  quantity      NUMERIC(18,3) NOT NULL CHECK (quantity > 0),
  unit_cost     NUMERIC(18,2) NOT NULL,
  total_cost    NUMERIC(18,2) NOT NULL,
  costing_method TEXT,
  reference     VARCHAR(40) NOT NULL,
  document_type TEXT NOT NULL,   -- goods_receipt|goods_issue|stock_transfer
                                 -- |requisition_dispatch|requisition_receipt|adjustment
  counter_warehouse_id BIGINT REFERENCES warehouses(id),

  -- التوريد الخارجي والمطابقة الثلاثية (§4)
  supplier_id           BIGINT REFERENCES suppliers(id),
  price_status          TEXT,        -- priced|pending_invoice
  provisional_unit_cost NUMERIC(18,2),
  invoice_unit_cost     NUMERIC(18,2),
  supplier_invoice_ref  TEXT,
  invoice_qty           NUMERIC(18,3),
  quantity_variance     NUMERIC(18,3),
  price_variance        NUMERIC(18,2),
  price_variance_pct    NUMERIC(8,2),
  variance_reason       TEXT,
  matched_at            TIMESTAMPTZ,
  matched_by            BIGINT REFERENCES users(id),

  -- الصرف للمريض (§6)
  patient_id    BIGINT REFERENCES patients(id),
  admission_id  BIGINT REFERENCES admissions(id),
  room_id       BIGINT REFERENCES rooms(id),
  dispense_target TEXT,          -- patient|department

  -- دورة النواقص (§4)
  requisition_id BIGINT REFERENCES requisitions(id),

  batch_number  TEXT,
  expiry_date   DATE,
  reason        TEXT,
  cost_center_id BIGINT,
  expense_account_id BIGINT REFERENCES accounts(id),
  performed_by  BIGINT NOT NULL REFERENCES users(id),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_mov_item_wh_date ON stock_movements (item_id, warehouse_id, date, id);
CREATE INDEX ix_mov_pending_price ON stock_movements (price_status) WHERE price_status = 'pending_invoice';

-- إسقاط للأداء فقط — يُحدَّث في نفس معاملة الحركة ولا يُعدَّل بغيرها
stock_balances (
  item_id, warehouse_id,
  on_hand   NUMERIC(18,3) NOT NULL,
  reserved  NUMERIC(18,3) NOT NULL DEFAULT 0,
  available NUMERIC(18,3) GENERATED ALWAYS AS (on_hand - reserved) STORED,
  avg_cost  NUMERIC(18,2),
  value     NUMERIC(18,2),
  PRIMARY KEY (item_id, warehouse_id)
);

batches (id, batch_number, item_id, warehouse_id, received_date, production_date,
         expiry_date, initial_quantity, quantity, unit_cost, supplier_id,
         reference, status, value);

stock_counts (id, code, warehouse_id, date, status, started_by, closed_by, ...);
stock_count_lines (id, count_id, item_id, system_qty, counted_qty, variance, ...);

-- سجل المطابقة الثلاثية (§4)
purchase_matches (
  id, movement_id BIGINT NOT NULL REFERENCES stock_movements(id),
  receipt_reference TEXT NOT NULL,
  supplier_invoice_ref TEXT NOT NULL,
  date DATE NOT NULL,
  item_id, warehouse_id, supplier_id,
  received_qty, invoice_qty, payable_qty NUMERIC(18,3),
  quantity_variance NUMERIC(18,3),
  provisional_unit_cost, invoice_unit_cost, price_variance NUMERIC(18,2),
  price_variance_pct NUMERIC(8,2),
  accrued_value, invoice_value, value_variance NUMERIC(18,2),
  exceptions JSONB NOT NULL DEFAULT '[]',
  variance_reason TEXT,
  required_review BOOLEAN NOT NULL,
  journal_entry_id BIGINT REFERENCES journal_entries(id),
  matched_by BIGINT NOT NULL REFERENCES users(id),
  matched_at TIMESTAMPTZ NOT NULL
);

-- طلبات النواقص بين الفروع (§4)
requisitions (
  id, code VARCHAR(30) UNIQUE NOT NULL,
  branch_id BIGINT NOT NULL REFERENCES warehouses(id),     -- الفرع الطالب
  item_id   BIGINT NOT NULL REFERENCES items(id),
  requested_qty NUMERIC(18,3) NOT NULL CHECK (requested_qty > 0),
  urgency TEXT NOT NULL,                  -- normal|high|urgent
  status  TEXT NOT NULL,                  -- §4.1 لدورة الحياة

  fulfillment_source TEXT,                -- hub|branch_transfer|supplier
  source_branch_id   BIGINT REFERENCES warehouses(id),
  supplier_id        BIGINT REFERENCES suppliers(id),
  po_reference       TEXT,

  dispatched_qty  NUMERIC(18,3),
  dispatched_at   TIMESTAMPTZ,
  dispatched_by   BIGINT REFERENCES users(id),
  driver_name     TEXT,
  dispatch_reference  TEXT,
  dispatch_movement_id BIGINT REFERENCES stock_movements(id),
  dispatch_unit_cost  NUMERIC(18,2),
  dispatch_total_cost NUMERIC(18,2),

  arrived_at TIMESTAMPTZ, arrived_by BIGINT REFERENCES users(id),

  received_qty       NUMERIC(18,3),
  discrepancy_count  NUMERIC(18,3),
  discrepancy_value  NUMERIC(18,2),
  discrepancy_notes  TEXT,
  receipt_movement_id BIGINT REFERENCES stock_movements(id),
  inspected_at TIMESTAMPTZ, inspected_by BIGINT REFERENCES users(id),

  hub_received_qty NUMERIC(18,3), hub_received_at TIMESTAMPTZ,
  hub_receipt_reference TEXT, hub_receipt_movement_id BIGINT,

  rejection_reason TEXT, rejected_at TIMESTAMPTZ, rejected_by BIGINT,

  created_at TIMESTAMPTZ NOT NULL,        -- ختم الخادم، غير قابل للتعديل
  created_by BIGINT NOT NULL REFERENCES users(id),
  notes TEXT
);

-- الجدول الزمني: append-only، لا UPDATE ولا DELETE أبدًا
requisition_timeline (
  id BIGSERIAL PK,
  requisition_id BIGINT NOT NULL REFERENCES requisitions(id),
  stage TEXT NOT NULL,          -- created|dispatched|branch_transfer|supplier_ordered
                                -- |hub_received|arrived|completed|inspection_discrepancy|rejected
  title TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,     -- ختم الخادم لا وقت العميل
  user_id BIGINT NOT NULL REFERENCES users(id),
  user_name TEXT NOT NULL,            -- مُثبَّت: إن تغيّر اسم المستخدم يبقى السجل صحيحًا
  notes TEXT,
  status_label TEXT,
  reference TEXT,
  movement_id BIGINT REFERENCES stock_movements(id)
);

-- مراجعة واعتماد أسعار البيع (§5)
price_reviews (
  id, item_id, receipt_reference, receipt_id, supplier_invoice_ref, date,
  old_purchase_price, new_purchase_price NUMERIC(18,2),
  change_percent NUMERIC(8,2),
  current_selling_price, current_margin_pct, suggested_selling_price,
  status TEXT NOT NULL,                 -- pending|reviewed_by_accountant|approved|kept_unchanged
  supplier_reason TEXT, accountant_notes TEXT,
  reviewed_by BIGINT, reviewed_at TIMESTAMPTZ,
  approved_price NUMERIC(18,2), approved_margin_pct NUMERIC(8,2),
  decision_notes TEXT, decided_by BIGINT, decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
```

### 2.3 المرضى والإقامة والغرف

```sql
patients (
  id, code UNIQUE, name, gender, national_id, phone, birth_date, blood_group,

  -- نوع المريض يُحدِّد شريحة تعريفته. لا يختارها الموظف عند الفوترة. §8
  patient_type TEXT NOT NULL,     -- cash|insurance|foreign|staff

  insurance_provider_id BIGINT REFERENCES insurance_providers(id),
  policy_number TEXT,
  coverage_rate NUMERIC(5,4) NOT NULL DEFAULT 0,

  -- بيانات الوافد
  is_foreign BOOLEAN NOT NULL DEFAULT false,
  nationality TEXT NOT NULL DEFAULT 'مصر',
  passport_number TEXT,
  preferred_currency CHAR(3) NOT NULL DEFAULT 'EGP',

  status TEXT NOT NULL,           -- inpatient|outpatient|discharged — مُشتق من الإقامة
  attending_doctor TEXT,
  notes TEXT
);

-- دليل الخدمات: السعر الأساسي. الشرائح في §8.
hospital_services (
  id, code UNIQUE, category TEXT, category_name TEXT, name,
  price NUMERIC(18,2) NOT NULL, unit TEXT, department TEXT
);
-- category: room|icu|surgery|consultation|radiology|lab|medication

-- أنواع وحدات الإقامة. لا تُخزّن السعر — تشاور على خدمة في الدليل.
room_types (
  id, code UNIQUE, name,
  category TEXT NOT NULL,                -- room|icu
  service_id BIGINT NOT NULL REFERENCES hospital_services(id),   -- سعر الإقامة
  nursing_service_id BIGINT REFERENCES hospital_services(id),    -- سعر التمريض
  capacity SMALLINT NOT NULL DEFAULT 1,
  department TEXT
);

-- الوحدات القابلة للحجز: غرفة كاملة أو سرير داخل وحدة عناية.
rooms (
  id, code UNIQUE NOT NULL, name NOT NULL,
  room_type_id BIGINT NOT NULL REFERENCES room_types(id),
  floor TEXT, wing TEXT,

  -- vacant فاضية · occupied مشغولة · cleaning تحت التجهيز · maintenance خارج الخدمة
  status TEXT NOT NULL DEFAULT 'vacant',

  -- تُشتق من الإقامة القائمة وتُصفَّر عند الخروج. لا تُكتب يدويًا.
  current_admission_id BIGINT REFERENCES admissions(id),
  current_patient_id   BIGINT REFERENCES patients(id),
  occupied_since DATE,
  notes TEXT
);

-- وحدة واحدة لا تُحجز لمريضين: فهرس جزئي فريد
CREATE UNIQUE INDEX uq_room_single_occupant
  ON rooms (id) WHERE status = 'occupied' AND current_admission_id IS NOT NULL;
CREATE UNIQUE INDEX uq_one_room_per_admission
  ON rooms (current_admission_id) WHERE current_admission_id IS NOT NULL;

admissions (
  id, code VARCHAR(30) UNIQUE NOT NULL,
  patient_id BIGINT NOT NULL REFERENCES patients(id),
  room_id    BIGINT NOT NULL REFERENCES rooms(id),
  room_type_id BIGINT NOT NULL REFERENCES room_types(id),
  stay_type TEXT NOT NULL,                -- room|icu

  -- التعريفة المتعاقد عليها لحظة الدخول — للعرض والمراجعة.
  -- التحميل الفعلي يأتي من admission_charges لا من هذا الحقل.
  daily_rate NUMERIC(18,2) NOT NULL,

  admission_date DATE NOT NULL,
  discharge_date DATE,
  attending_doctor TEXT, diagnosis TEXT,
  status TEXT NOT NULL,                   -- active|discharged
  discharge_notes TEXT, discharged_by BIGINT, discharged_at TIMESTAMPTZ,
  created_by BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL,

  CONSTRAINT ck_discharge_after_admission
    CHECK (discharge_date IS NULL OR discharge_date >= admission_date)
  -- ❌ لا عمود days_count ولا total_cost — مُشتقّان
);

-- مريض واحد لا يُحجز له سريران
CREATE UNIQUE INDEX uq_one_active_admission_per_patient
  ON admissions (patient_id) WHERE status = 'active';

-- دفتر استحقاق خدمات الإقامة: كل ما يُحمَّل على المريض، مهما كان مصدره.
admission_charges (
  id BIGSERIAL PK,
  admission_id BIGINT REFERENCES admissions(id),    -- NULL لمريض عيادات خارجية
  patient_id   BIGINT NOT NULL REFERENCES patients(id),
  date DATE NOT NULL,

  category TEXT NOT NULL,       -- bed_day|nursing|medication|procedure
  service_id BIGINT REFERENCES hospital_services(id),
  item_id    BIGINT REFERENCES items(id),           -- لبنود الصيدلية
  service_name TEXT NOT NULL,

  quantity   NUMERIC(18,3) NOT NULL,
  unit_price NUMERIC(18,2) NOT NULL,                -- سعر البيع المعتمد
  amount     NUMERIC(18,2) NOT NULL,

  -- التكلفة من محرك التقييم — تُحفظ ليكون هامش الربح مرئيًا لكل بند
  unit_cost  NUMERIC(18,2),
  total_cost NUMERIC(18,2),

  source TEXT NOT NULL,         -- bed_day_engine|pharmacy|manual

  -- مفتاح التفرّد: يمنع تحميل نفس الليلة مرتين. §6.2
  source_ref TEXT NOT NULL,
  movement_id BIGINT REFERENCES stock_movements(id),
  warehouse_id BIGINT REFERENCES warehouses(id),

  invoice_id BIGINT REFERENCES patient_invoices(id),
  invoiced_at TIMESTAMPTZ,
  created_by BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL,

  CONSTRAINT uq_charge_source_ref UNIQUE (source_ref)
);

CREATE INDEX ix_charges_uninvoiced
  ON admission_charges (patient_id) WHERE invoice_id IS NULL;

patient_invoices (
  id, invoice_number VARCHAR(30) UNIQUE NOT NULL,
  patient_id BIGINT NOT NULL REFERENCES patients(id),
  date DATE NOT NULL, due_date DATE NOT NULL,

  -- الشريحة والعملة (§8)
  patient_type TEXT NOT NULL,
  tier_id BIGINT NOT NULL REFERENCES tariff_tiers(id),
  currency CHAR(3) NOT NULL,

  -- سعر الصرف يوم الإصدار — مُثبَّت، لا يُعاد تقييمه أبدًا. §8.3
  exchange_rate NUMERIC(18,6) NOT NULL,
  exchange_rate_date DATE NOT NULL,
  base_currency CHAR(3) NOT NULL DEFAULT 'EGP',

  coverage_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  subtotal, discount, total_after_discount NUMERIC(18,2) NOT NULL,
  insurance_amount, patient_amount NUMERIC(18,2) NOT NULL,

  -- المقابل بالعملة الأساسية — هو ما يُرحَّل ويُجمَع في التقارير
  base_subtotal, base_total_after_discount,
  base_patient_amount, base_insurance_amount NUMERIC(18,2) NOT NULL,

  paid_amount, remaining_amount NUMERIC(18,2) NOT NULL,
  status TEXT NOT NULL,         -- unpaid|partially_paid|paid
  created_by BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL,

  CONSTRAINT ck_discount_within_total CHECK (discount <= subtotal)
);

patient_invoice_lines (
  id, invoice_id BIGINT NOT NULL REFERENCES patient_invoices(id),
  service_id BIGINT REFERENCES hospital_services(id),
  description TEXT NOT NULL,
  quantity NUMERIC(18,3) NOT NULL, unit_price NUMERIC(18,2) NOT NULL,
  total NUMERIC(18,2) NOT NULL, currency CHAR(3) NOT NULL,
  base_total NUMERIC(18,2) NOT NULL,
  price_source TEXT NOT NULL,   -- explicit|multiplier|manual
  tier_id BIGINT NOT NULL
);

patient_receipts (
  id, receipt_number VARCHAR(30) UNIQUE NOT NULL,
  patient_id BIGINT NOT NULL, invoice_id BIGINT REFERENCES patient_invoices(id),
  date DATE NOT NULL,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,

  -- سعر يوم التحصيل، والمقابل بالعملة الأساسية
  base_amount NUMERIC(18,2) NOT NULL,
  exchange_rate NUMERIC(18,6) NOT NULL, exchange_rate_date DATE NOT NULL,

  -- فرق العملة بندًا مستقلًا — لا يُدمج في الإيراد. §8.4
  fx_difference JSONB,

  type TEXT NOT NULL,           -- invoice_payment|deposit
  payment_method TEXT NOT NULL, -- cash|card|transfer
  target_account_id BIGINT REFERENCES accounts(id),
  notes TEXT, created_by BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL
);

insurance_providers (id, name, default_coverage NUMERIC(5,4), phone);
```

### 2.4 شرائح التعريفة والعملات

```sql
tariff_tiers (
  id, code UNIQUE NOT NULL, name, name_en,
  patient_types TEXT[] NOT NULL,     -- {cash} أو {insurance} ...
  multiplier NUMERIC(8,4) NOT NULL DEFAULT 1,   -- يُستخدم إن لا سعر مُعلَن
  currency CHAR(3) NOT NULL DEFAULT 'EGP',
  is_default BOOLEAN NOT NULL DEFAULT false,
  notes TEXT
);

-- شريحة افتراضية واحدة بالضبط
CREATE UNIQUE INDEX uq_one_default_tier ON tariff_tiers ((is_default)) WHERE is_default;

-- أسعار مُعلَنة صريحة لشريحة/خدمة. تغلب المعامل دائمًا.
tariff_prices (
  id, tier_id BIGINT NOT NULL REFERENCES tariff_tiers(id),
  service_id BIGINT NOT NULL REFERENCES hospital_services(id),
  price NUMERIC(18,2) NOT NULL, currency CHAR(3) NOT NULL, notes TEXT,
  CONSTRAINT uq_tier_service UNIQUE (tier_id, service_id)
);

exchange_rates (
  id, currency CHAR(3) NOT NULL, name TEXT, symbol TEXT,
  rate NUMERIC(18,6) NOT NULL CHECK (rate > 0),
  date DATE NOT NULL, source TEXT,
  -- سعران لنفس العملة في نفس اليوم يجعلان «سعر اليوم» غامضًا
  CONSTRAINT uq_currency_date UNIQUE (currency, date)
);
```

### 2.5 الإدارة والصلاحيات

```sql
users (
  id, username UNIQUE NOT NULL, name NOT NULL, password_hash NOT NULL,
  role TEXT NOT NULL REFERENCES roles(key),
  employee_id BIGINT REFERENCES employees(id),
  department_id BIGINT, job_title TEXT,
  status TEXT NOT NULL, last_login_at TIMESTAMPTZ
);

roles (key TEXT PK, label TEXT NOT NULL, permissions TEXT[] NOT NULL);
-- 9 أدوار: admin · reception · gl · fin · hr · inv · nurse · pharmacy · billing

-- نطاق المخازن: NULL = بلا قيد. وجود صفوف = قيد فعلي. §7
user_warehouses (user_id BIGINT, warehouse_id BIGINT, PRIMARY KEY (user_id, warehouse_id));

audit_logs (
  id BIGSERIAL PK, action TEXT NOT NULL, action_label TEXT,
  module TEXT, entity TEXT, entity_id BIGINT,
  details TEXT NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id), user_name TEXT NOT NULL,
  ip_address INET, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- append-only
```

### 2.6 باقي الجداول

المالية (عملاء، موردون، فواتير، تحصيلات، خزائن، بنوك، أصول، إهلاك، ضرائب)
والموارد البشرية (موظفون، أقسام، وظائف، ورديات، حضور، إجازات، سلف، مسيّرات،
قسائم) موجودة بالكامل في `frontend/js/mock/finance.mock.js` و`hr.mock.js`
بكل حقولها. **اقرأ الملفين** — كل حقل تحتاجه هناك باسمه.

---

## 3. أنواع الأحداث المُرحَّلة (SourceType)

كل حدث مالي يُرحَّل عبر `postDocument` بنوع من هذه القائمة. القاعدة التي
تترجمه إلى سطور في `frontend/js/domain/posting-rules.js`.

| النوع | الحدث | القيد |
|---|---|---|
| `customer_invoice` | فاتورة عميل | مدين العميل · دائن الإيراد + ضريبة المخرجات |
| `customer_receipt` | تحصيل | مدين النقدية · دائن العميل |
| `customer_credit_note` | إشعار دائن | مدين مردودات الإيراد · دائن العميل |
| `supplier_invoice` | فاتورة مورد | مدين المصروف/المخزون · دائن المورد |
| `supplier_payment` | دفعة لمورد | مدين المورد · دائن النقدية |
| `supplier_return` | مرتجع لمورد | مدين المورد · دائن مردودات المشتريات |
| `cash_receipt` / `cash_payment` | إيصال نقدي | مدين/دائن النقدية |
| `cash_transfer` / `bank_deposit` / `bank_withdrawal` | تحويل | نقل بين حسابي نقدية |
| `asset_acquisition` | شراء أصل | مدين الأصل · دائن النقدية/المورد |
| `asset_depreciation` | إهلاك دوري | مدين مصروف الإهلاك · دائن مجمع الإهلاك |
| `asset_disposal` | استبعاد أصل | مدين المجمع + النقدية · دائن الأصل ± الربح/الخسارة |
| `payroll_approval` | اعتماد مسيّر | مدين الرواتب والبدلات · دائن المستحقات والاستقطاعات |
| `payroll_payment` | صرف الرواتب | مدين المستحقات · دائن البنك |
| `employee_advance` | سلفة موظف | مدين سلف الموظفين · دائن النقدية |
| `inventory_receipt` | إذن إضافة | مدين المخزون · دائن «مستلم ولم يُفوتر» |
| `inventory_issue` | إذن صرف | مدين تكلفة الخدمات · دائن المخزون |
| `inventory_adjustment` | تسوية جرد | زيادة: مدين المخزون/دائن زيادة · نقص: مدين عجز/دائن المخزون |
| `inventory_transfer` | تحويل مخزني | نقل بين حسابي مخزون (بلا أثر إن كان الحساب واحدًا) |
| `inventory_return` | مرتجع مخزني | كـ `supplier_return` |
| **`inventory_dispatch`** | **شحن طلبية لفرع** | **مدين «مخزون تحت التحويل» · دائن مخزون المصدر** |
| **`inventory_transit_receipt`** | **استلام بالفرع** | **مدين مخزون الفرع · دائن «تحت التحويل»** — بالمستلم فعلًا |
| **`inventory_transit_loss`** | **عجز شحنة** | **مدين «عجز وتلف» · دائن «تحت التحويل»** |
| **`purchase_invoice_match`** | **مطابقة فاتورة مورد** | **§4.3** |
| `period_closing` / `year_closing` / `opening_balance` | إقفال وافتتاح | — |

---

## 4. دورة المخازن وسلاسل الإمداد

### 4.1 دورة حياة طلب النواقص

```
                    ┌──────────────────┐
                    │  pending_review  │ ← الفرع أنشأ الطلب
                    └────────┬─────────┘
          ┌──────────────────┼──────────────────┬─────────────┐
          ▼                  ▼                  ▼             ▼
   صرف من الرئيسي      مناقلة من فرع      أمر شراء        rejected
          │                  │            supplier_ordered  (قبل الشحن فقط)
          │                  │                  │
          │                  │                  ▼
          │                  │           hub_received  ← وصل الرئيسي بإذن إضافة
          │                  │                  │
          └────────┬─────────┴──────────────────┘
                   ▼
            in_transit  ← الكمية خرجت من المصدر وحُجزت «تحت التحويل»
                   │
                   ▼
           under_inspection  ← وصلت الفرع، بدأ العد (بلا أثر مخزني)
                   │
          ┌────────┴────────┐
          ▼                 ▼
     completed         discrepancy
   (مطابق 100%)      (عجز موثق بالثانية)
```

**حالات يصح الشحن منها:** `pending_review`, `supplier_ordered`, `hub_received`
**حالات يصح الاستلام منها:** `in_transit`, `under_inspection`
**حالات نهائية:** `completed`, `discrepancy`, `rejected`

### 4.2 لماذا حساب وسيط «مخزون تحت التحويل»؟

هذا أهم درس في هذا الموديول. الكود القديم كان يُغيّر حالة الطلب فقط بلا
حركة مخزنية، فكانت الكمية **تبقى في رصيد الرئيسي وتُضاف للفرع** → الرصيد
الكلي يتضاعف.

والحل الساذج (خصم وإضافة فورًا) أسوأ قليلًا: العجز في الطريق يختفي بلا أثر.

فالمرحلتان منفصلتان:

```
الشحن:    مخزون المصدر  ──→  مخزون تحت التحويل        (بالكمية المشحونة)
الاستلام: مخزون تحت التحويل ──→  مخزون الفرع          (بالمستلم فعلًا)
العجز:    مخزون تحت التحويل ──→  عجز وتلف المخزون     (بالفرق)
```

**العجز لا يُحمَّل على مخزون الفرع** — حماية لأمين المخزن المستلم. يُعترف به
خسارة باسم ووقت الفاحص.

**الاختبار الذي يحرس هذا:**
`tests/requisitions-workflow.test.mjs` → «الإجمالي الكلي نقص بالعجز فقط —
لا تضاعف ولا تبخّر». انقله.

### 4.3 المطابقة الثلاثية (3-Way Match)

**توزيع المسؤولية:**

| الدور | يُدخل | لا يُدخل |
|---|---|---|
| أمين المخزن | الصنف · الكمية · الحالة · التشغيلة | **السعر** |
| المحاسب | سعر الفاتورة · رقم الفاتورة · مبرر الفرق | سعر البيع |
| مدير الحسابات | سعر البيع المعتمد | — |

**المسار:**

1. `POST /inv/receipts` **بلا `unitCost`** → الاستلام يُقيَّم مؤقتًا بآخر سعر
   شراء ويُوسَم `price_status = 'pending_invoice'`.
   يُرحَّل: مدين المخزون · دائن «مستلم ولم يُفوتر».
   - آخر سعر شراء **لا يُحدَّث** من التقييم المؤقت (وإلا ثبّت القديم للأبد).
   - مراجعة سعر البيع **لا تُفتح** على التقييم المؤقت.

2. `GET /procurement/awaiting-price` → لوحة المحاسب. مرتّبة بالأقدم، وتُعلن
   عمر كل استلام والقيمة المؤقتة الكلية.

3. `POST /procurement/receipts/:id/preview-match` → معاينة بلا أثر:
   - `payableQty = min(invoiceQty, receivedQty)` — **لا تدفع إلا ما استلمت**
   - `priceVariancePct` عن التقييم المؤقت
   - `exceptions[]` نصوص عربية جاهزة للعرض

4. `POST /procurement/receipts/:id/match` → الاعتماد:
   - فرق سعر ≥ **5%** يتطلب `varianceReason` وإلا 422
   - تصحيح `unit_cost`/`total_cost` على الحركة (فيُقيَّم الصرف اللاحق صحيحًا)
   - تحديث `last_purchase_price`
   - القيد (`purchase_invoice_match`):
     ```
     مدين  «مستلم ولم يُفوتر»   = قيمة الاستحقاق المؤقتة
     مدين  المخزون              = فرق السعر (إن زاد)
       أو دائن المخزون          = فرق السعر (إن نقص)
     دائن  الموردون             = قيمة الفاتورة
     ```
     **متوازن:** الاستحقاق + الفرق = الفاتورة.
   - فتح `price_reviews` بحالة `pending` إن تغيّر سعر الشراء
   - لا مطابقة مرتين (409)

**فرق السعر يُصحَّح على المخزون لا على المصروف** ما دامت الكمية على الرف:
تكلفة الأصل هي ما دُفع فيه فعلًا.

### 4.4 اشتقاق الرصيد ومحرك التقييم

```
onHand(item, warehouse) = Σ الوارد − Σ الصادر   من stock_movements
available = onHand − reserved
```

التقييم **FIFO** أو **المتوسط المرجّح** حسب `items.costing_method` (تغلب
`warehouses.costing_method`). المنطق كامل ومُختبر في
`frontend/js/domain/valuation.js` — **انقله حرفيًا**.

تكلفة الصرف تأتي من المحرك **قبل** تسجيل الحركة ثم تُثبَّت عليها. لا من
سعر البيع ولا من آخر سعر شراء.

**الرصيد السالب مرفوض** ما لم يُسمح به صراحة
(`warehouses.allow_negative` أو `system_preferences.allow_negative_inventory`).
و**المحجوز ليس متاحًا** — صرفه يسمح ببيع نفس الكمية مرتين.

### 4.5 حد الفائض للمناقلة

```
transferableQty = max(0, available − item.reorder_point)
```

ليس رقمًا ثابتًا: الفرع لا يُطلب منه التنازل عن كمية تُنزله تحت حده الأدنى،
وإلا حلّينا نقص فرع بخلق نقص في آخر.

ويُستثنى من اقتراحات المناقلة: الفرع الطالب نفسه، والمخازن غير المسموح
بتخزين الصنف فيها.

---

## 5. دورة التسعير وحوكمة الأسعار

```
استلام بسعر فاتورة جديد
        │
        ▼
price_reviews (pending)  ← إشعار لمدير الحسابات
        │
        ├─ مراجعة المحاسب: POST /inv/price-reviews/:id/review
        │     يُدخل supplier_reason (إلزامي) → reviewed_by_accountant
        │
        ▼
قرار مدير الحسابات: POST /inv/price-reviews/:id/approve
        ├─ action=update_price → approved      (سعر بيع جديد + هامش محسوب)
        └─ action=keep_price   → kept_unchanged (تثبيت وتحمّل فارق التكلفة)
```

**القاعدة:** `items.selling_price` **لا يُعدَّل** إلا من هذا المسار. أمين
المخزن لا يملكه، والمحاسب لا يملكه. والصرف للمريض **يقرأ** السعر ولا يقرره
— ويرفض الصرف إن كان الصنف بلا سعر بيع معتمد (قبل أن تخرج الكمية).

---

## 6. ربط المخزون بحساب المريض

### 6.1 الصرف للمريض — حدث مزدوج الأثر

كان أخطر ثقب في النظام: الصيدلية تصرف الدواء فينزل من المخزون **ولا يُحمَّل
قرش على المريض**. المخزون ينقص والإيراد لا يُسجَّل.

`POST /dispensing/to-patient` في **معاملة واحدة**:

```
1. حركة مخزنية (issue) بالتكلفة من محرك التقييم
   → مدين تكلفة الخدمات · دائن المخزون
2. سطر admission_charges بسعر البيع المعتمد
   → category='medication', source='pharmacy', unit_cost محفوظة للهامش
```

**إن فشل أحدهما لا يُنفَّذ الآخر.** والترتيب مهم: السعر يُقرأ ويُتحقق **قبل**
إنشاء الحركة، فلا تخرج كمية ثم يتعذّر تحميلها.

**الأصناف غير القابلة للتحميل** (`patient_chargeable = false`): تُصرف ولا
سطر تحميل لها، والاستجابة **تُعلن** ذلك (`patientChargeable: false`) فلا
تَعِد الواجهة بإيراد لم يُسجَّل. تفرقة معيارية في صيدليات المستشفيات:
`charge items` تُحمَّل بالاسم، و`non-charge` مصروف تشغيل عام.

**مريض العيادات الخارجية:** `admission_id = NULL` و`patient_id` إلزامي.

**السلة** (`POST /dispensing/basket`): الفشل الجزئي **معلَن** — ما نجح يبقى،
وما فشل يُرجَع بسببه. محاولة التراجع عن أصناف خرجت فعلًا من الرف أسوأ.

### 6.2 محرك الاستحقاق اليومي (Bed-Day Accrual)

**هذا هو الذي يجب أن تُجدوِله (cron) بعد منتصف الليل.**

```
POST /patients/admission-charges/run-daily   { date }
```

لكل إقامة `status='active'` و`date >= admission_date`: يولّد سطرين —
رسم الإقامة (`bed_day`) ورسم التمريض (`nursing`) — من تعريفة نوع الوحدة.

**فكري الطابع (Idempotent) بالتصميم:**

```
source_ref = "{admission_code}/{date}/{category}"     UNIQUE
```

تشغيله عشر مرات في اليوم لا يُحمِّل المريض مرتين. وهذا يعني أن إعادة
التشغيل بعد فشل آمنة تمامًا — وهو شرط لأي مهمة مُجدوَلة.

الاستجابة تُعلن ما تجاهلته صريحًا:
```jsonc
{ "date": "...", "admissionsProcessed": 4, "linesCreated": 8,
  "linesSkipped": 0, "amountAccrued": 15600, "details": [ ... ] }
```

**`POST /patients/admissions/:id/backfill-charges`** يُلحق كل الليالي الناقصة
من الدخول حتى اليوم. يُستخدم عند:
- فتح إقامة بتاريخ ماضٍ (يُنادى تلقائيًا)
- تسجيل الخروج (**قبل** إخلاء السرير — انظر أدناه)
- استرجاع نظام توقف عن العمل

### 6.3 الحجز والخروج

**الحجز** (`POST /patients/admissions`):
1. تحقق: المريض غير مقيم بالفعل · الوحدة `vacant` · التاريخ غير مستقبلي
2. التعريفة **من نوع الوحدة** لا من إدخال الموظف
3. احجز الوحدة (`status='occupied'` + `current_*`)
4. حدّث حالة المريض
5. **ألحق كل ليالي الإقامة حتى اليوم** (`backfill`)

**الخروج** (`POST /patients/admissions/:id/discharge`) — **الترتيب حرج:**
1. ثبّت `discharge_date`
2. **ألحق الليالي الناقصة** ← قبل الإخلاء
3. حوّل الإقامة إلى `discharged`
4. **أخلِ الوحدة إلى `cleaning` لا `vacant`**
5. حدّث حالة المريض

> إخلاء السرير قبل تحميل ليلته يُسقط آخر يوم من الحساب نهائيًا.
> وإعلانه `vacant` فورًا يُنتج حجزًا على سرير غير مُجهَّز.

**تغيير حالة الوحدة يدويًا** (`POST /rooms/:id/status`): مسموح فقط
`cleaning` · `maintenance` · `vacant`. **`occupied` لا تُضبط يدويًا أبدًا** —
هي نتيجة حجز أو خروج. والوحدة المشغولة لا تُغيَّر حالتها قبل تسجيل الخروج.

---

## 7. الصلاحيات ونطاق المخازن

### 7.1 الأدوار التسعة

| الدور | الصلاحيات | ملاحظة حرجة |
|---|---|---|
| `admin` | `*` | — |
| `reception` | `reception.*` · `patients.{view,manage,receipt,invoice,admissions.manage,rooms.manage}` | لا مخزون ولا ترحيل ولا رواتب |
| `gl` | `gl.*` · `pricing.*` · `inv.view` | مدير الحسابات: يعتمد أسعار البيع |
| `fin` | `fin.*` | يُطابق فواتير الموردين |
| `hr` | `hr.*` | — |
| `inv` | `inv.*` | مدير المخازن — **لا** `pricing.*` |
| `nurse` | `inv.{view,dispense.patient,issue.create,requisition.create}` · `patients.view` | **لا `inv.*` كاملة** — لا استلام مورد ولا تسوية جرد |
| `pharmacy` | ما سبق + `inv.{transfer.create,requisition.inspect,count.manage}` | **لا** `inv.receipt.create` — التوريد الخارجي يدخل الرئيسي |
| `billing` | `patients.*` · `reception.*` · `pricing.*` | — |

**84 صلاحية** بالصيغة `<domain>.<entity>.<action>` مع تطابق بالبادئة
(`gl.*` يمنح `gl.journal.post`). القائمة الكاملة في
`frontend/js/core/permissions.js`.

> **حارس مطلوب في اختباراتك:** كل صلاحية في الكتالوج يحملها دور واحد على
> الأقل. صلاحية بلا دور = شاشة لا يستطيع أحد فتحها. (حدث فعلًا: صلاحيات
> `reception.*` كانت معرَّفة ولا مستخدم يحملها.)

### 7.2 نطاق المخازن

```
user_warehouses فارغ لهذا المستخدم  →  بلا قيد (مدير النظام، مدير المخازن)
صفوف موجودة                        →  قيد فعلي
```

**يُفرض عند تنفيذ العملية لا عند رسم الزر.** أمين مخزن فرع 1 قد يصل لمسار
صرف من فرع 3 بطلب مباشر أو بتبويب قديم مفتوح.

نقاط الفرض الإلزامية:
- أي حركة مخزنية (`validateMovement`) → مخزن الحركة
- التحويل → **الطرفان**. من يحوّل إلى مخزن لا يملكه ينقل عهدة لغيره بلا
  إقرار منه. المسار الصحيح لذلك طلب نواقص بفحص واستلام.
- شحن طلبية نواقص → مخزن المصدر
- الصرف للمريض → مخزن الصرف

يُرجَع `403 FORBIDDEN` برسالة عربية تذكر المخازن المسندة للمستخدم.

**تنبيه:** طبقة الصلاحيات في الواجهة **تجربة مستخدم فقط**. إخفاء زر ليس
أمانًا. التحقق الفعلي مسؤوليتك على الخادم، ودائمًا.

---

## 8. التسعير بالشرائح والعملات

### 8.1 اختيار الشريحة

الشريحة تُشتق من `patients.patient_type` — **لا يختارها الموظف عند الفوترة**.
تركها لاختياره يُنتج مريضًا واحدًا بثلاث تعريفات.

```
cash → TIER-CASH (×1, EGP) · insurance → TIER-INS (×1.1, EGP)
foreign → TIER-FOREIGN (×1.6, USD) · staff → TIER-STAFF (×0.6, EGP)
```

نوع غير معروف يسقط على الشريحة الافتراضية (`is_default`). غياب الشرائح
كلها = **خطأ صريح** لا سعر صفري صامت.

### 8.2 حساب السعر — الترتيب مُلزِم

```
1. سعر مُعلَن صريح في tariff_prices(tier, service)?  →  استخدمه
2. وإلا:  service.price × tier.multiplier
```

**السعر المُعلَن يغلب المعامل دائمًا.** الاتفاق المكتوب مع جهة بعينها أقوى
من تقدير حسابي، ولو خالفه.

شريحة بعملة أجنبية **بلا** سعر مُعلَن: النتيجة تُعلَن بـ `EGP` — لا نُسمّي
رقمًا بالجنيه «دولارًا».

### 8.3 سعر الصرف

```
rateFor(currency, date) = أحدث سعر مُعلَن لا يتجاوز date
```

- **لا سعر بعد تاريخ المستند أبدًا** — وإلا قُيّمت فاتورة الأمس بسعر الغد.
- تاريخ يسبق كل الأسعار، أو عملة بلا سعر → **خطأ صريح، لا افتراض `rate = 1`**.
- عملة واحدة للمستند: إجمالي بعملتين لا معنى له (409).

> **القاعدة المحاسبية الأهم:**
> **الفاتورة تحتفظ بسعر صرف يوم إصدارها إلى الأبد.**
> السعر الحالي يخص الحركة القادمة فقط. إعادة تقييم فاتورة قديمة تُغيّر
> إيرادًا اعتُرف به في فترة ربما تكون مُقفلة — تحريف للنتيجة لا تحديثٌ لها.

لذلك `patient_invoices` تخزّن `exchange_rate` و`exchange_rate_date`، وكل
الإجماليات لها مقابل `base_*` بالعملة الأساسية. **التقارير تجمع `base_*`
دائمًا** — جمع 1,285 دولار على 32,450 جنيهًا يُنتج رقمًا بلا معنى.

### 8.4 فرق العملة عند التحصيل

```
فرق العملة = (سعر يوم التحصيل − سعر يوم الفاتورة) × المبلغ الأجنبي
موجب = مكسب فرق عملة · سالب = خسارة
```

يُعترف به **بندًا ماليًا مستقلًا** ويُخزَّن في `patient_receipts.fx_difference`.
**لا يُعدَّل الإيراد الأصلي:** الخدمة قُدِّمت بقيمتها، والفارق ناتج عن الزمن
وسعر الصرف لا عن الخدمة. دمجهما يجعل «إيراد الكشف» يتغير لأن المريض تأخر
في الدفع — تحريف لقياس الأداء الطبي.

**تحصيل أكثر من المستحق مرفوض** (409) — سجّل الفارق تأمينًا مقدمًا.

---

## 9. المصادقة والمهام المُجدوَلة

### 9.1 المصادقة

الواجهة تتوقع:

```
POST /auth/login    { username, password }
  → { data: { token, user: { id, name, role, jobTitle, warehouseIds } } }
POST /auth/logout
GET  /auth/me       → { data: { user } }
```

`warehouseIds`: `null` = بلا قيد · مصفوفة = نطاق فعلي.
التوكن يُرسل في `Authorization: Bearer <token>`.
نقطة التبديل: `frontend/js/api/http.js`.

### 9.2 المهام المُجدوَلة

| المهمة | التوقيت | نقطة النهاية | ملاحظة |
|---|---|---|---|
| **استحقاق الإقامة اليومي** | 00:05 يوميًا | `POST /patients/admission-charges/run-daily` | **إلزامية.** تركها = أيام إقامة تضيع. فكرية الطابع فآمنة التكرار. |
| تنبيهات انتهاء الصلاحية | يوميًا | يُحسب من `batches` | — |
| تنبيهات الحد الأدنى | يوميًا | يُحسب من `stock_balances` | — |
| الإهلاك الدوري | شهريًا | `POST /fin/depreciation/run` | — |
| تنبيه استلامات بلا سعر | يوميًا | `GET /procurement/awaiting-price` | يُنبَّه المحاسب إن تجاوز العمر 7 أيام |
| جلب أسعار الصرف | يوميًا | `POST /fx/rates` | من البنك المركزي. سعر واحد لكل عملة في اليوم. |

---

## 10. ترتيب التنفيذ المقترح

ابنِ بهذا الترتيب — كل مرحلة تعمل بالكامل قبل التالية:

| # | المرحلة | لماذا هنا |
|---|---|---|
| 1 | المصادقة + المستخدمون + الأدوار + النطاق | كل شيء يحتاجها |
| 2 | دليل الحسابات + الفترات + `posting_map` + `postDocument` | **بلا هذه لا شيء يُرحَّل.** ابنِ التوازن والتفرّد كقيود قاعدة بيانات من اليوم الأول. |
| 3 | الأصناف + المخازن + الحركات + محرك التقييم | مصدر الحقيقة للأرصدة |
| 4 | المرضى + الخدمات + الغرف + الإقامة + محرك الاستحقاق | قلب التشغيل |
| 5 | الصرف للمريض (§6.1) | أكبر تسريب مالي يُسَد هنا |
| 6 | الشرائح + العملات + الفوترة + التحصيل | الإيراد |
| 7 | طلبات النواقص + المطابقة الثلاثية | سلاسل الإمداد والرقابة |
| 8 | المالية الكاملة (موردون، خزائن، بنوك، أصول، ضرائب) | — |
| 9 | الموارد البشرية | مستقلة — يمكن تأجيلها بلا أثر |
| 10 | التقارير والتصدير | تُبنى على ما سبق |

---

## 11. قائمة تحقق قبل التسليم

**المحاسبة**
- [ ] كل قيد متوازن بالقرش — مفروض بقيد قاعدة بيانات لا بالكود
- [ ] `posting_key` فريد — إعادة إرسال الطلب لا تُرحِّل مرتين
- [ ] لا ترحيل في فترة مُقفلة
- [ ] القيود append-only — التصحيح بقيد عكسي
- [ ] `posting_map` كاملة — الترحيل يفشل بخطأ صريح إن نقصت
- [ ] الأستاذ المساعد يطابق الحساب الرقابي بفرق **صفر**

**المخازن**
- [ ] كل رصيد مُشتق من الحركات — لا حقل يُحدَّث يدويًا
- [ ] تكلفة الصرف من محرك التقييم لا من سعر البيع
- [ ] الرصيد السالب مرفوض (ما لم يُسمح صراحة)
- [ ] المحجوز ليس متاحًا
- [ ] **إجمالي الكمية ثابت عبر دورة النواقص** — لا تضاعف ولا تبخّر
- [ ] العجز في الطريق خسارة مستقلة لا على مخزون الفرع
- [ ] لا شحن مرتين، ولا استلام أكثر من المشحون
- [ ] الاستلام بلا سعر مقبول وموسوم `pending_invoice`
- [ ] فرق سعر ≥ 5% لا يُعتمد بلا مبرر مكتوب
- [ ] لا مطابقة مرتين لنفس الاستلام

**المرضى والإقامة**
- [ ] وحدة لا تُحجز لمريضين (فهرس فريد)
- [ ] مريض لا يُحجز له سريران (فهرس فريد)
- [ ] تعريفة الإقامة من دليل الخدمات لا من إدخال الموظف
- [ ] **كل ليلة تُحمَّل مرة واحدة بالضبط** — `source_ref` فريد
- [ ] آخر ليلة تُحمَّل **قبل** إخلاء السرير
- [ ] السرير بعد الخروج `cleaning` لا `vacant`
- [ ] `occupied` لا تُضبط يدويًا

**التسعير والعملات**
- [ ] الشريحة من نوع المريض لا من اختيار الموظف
- [ ] السعر المُعلَن يغلب المعامل
- [ ] لا سعر صرف بعد تاريخ المستند
- [ ] عملة بلا سعر = خطأ صريح لا `rate = 1`
- [ ] الفاتورة تحتفظ بسعر يومها — لا إعادة تقييم
- [ ] فرق العملة بند مستقل لا تعديل للإيراد
- [ ] التقارير تجمع `base_*` فقط
- [ ] عملة واحدة للمستند

**الصرف للمريض**
- [ ] الصرف يُحمِّل المريض في **نفس المعاملة**
- [ ] صنف بلا سعر بيع معتمد يُرفض **قبل** خروج الكمية
- [ ] غير القابل للتحميل يُصرف ويُعلَن أنه لم يُحمَّل
- [ ] الفشل الجزئي في السلة معلَن

**الصلاحيات**
- [ ] كل صلاحية يحملها دور
- [ ] النطاق مفروض على الخادم عند التنفيذ
- [ ] التحويل يتطلب نطاقًا على الطرفين

**العقد**
- [ ] شكل الاستجابة `{ data, meta }` مطابق
- [ ] الفلترة والترتيب والترقيم على الخادم
- [ ] أشكال الأخطاء وأكوادها مطابقة، والرسائل بالعربية
- [ ] أسماء الحقول حرفيًا كما في المحاكاة

---

## 12. أين تجد ماذا

```
frontend/
├── js/
│   ├── api/
│   │   ├── http.js              ← نقطة التبديل الوحيدة
│   │   ├── mock-adapter.js      ← 228 نقطة نهاية = قائمة أعمالك
│   │   └── *.api.js             ← عقد كل نطاق بأسماء دواله
│   ├── core/
│   │   ├── money.js             ← قواعد المال — انقلها
│   │   ├── permissions.js       ← 84 صلاحية + 9 أدوار + النطاق
│   │   ├── errors.js            ← أكواد الأخطاء وأشكالها
│   │   └── config.js            ← mode / baseUrl
│   ├── domain/                  ← قواعد المجال النقية — انقلها كما هي
│   │   ├── posting.js           ← SourceType + دورة حياة القيد
│   │   ├── posting-rules.js     ← 26 قاعدة ترحيل
│   │   ├── valuation.js         ← FIFO + المتوسط المرجّح
│   │   ├── pricing.js           ← الشرائح + العملات + فرق العملة
│   │   ├── ledger.js · accounts.js · invoicing.js · aging.js
│   │   └── payroll.js · depreciation.js · attendance.js
│   └── mock/
│       ├── db.js                ← 71 مجموعة + محرك استعلام
│       ├── *.mock.js            ← شكل كل كيان + بيانات واقعية
│       └── services/            ← مواصفة سلوك خدماتك
│           ├── posting.service.js      ← نقطة الترحيل الوحيدة
│           ├── inventory.service.js    ← المخازن + دورة النواقص
│           ├── rooms.service.js        ← الغرف + محرك الاستحقاق
│           ├── dispensing.service.js   ← الصرف للمريض
│           ├── procurement.service.js  ← المطابقة الثلاثية
│           ├── pricing.service.js      ← الشرائح والعملات
│           ├── patients.service.js · finance.service.js
│           └── hr.service.js · accounting.service.js
└── tests/                       ← 459 فحصًا — انقل كل ضمانة
    ├── architecture.test.mjs
    ├── requisitions-workflow.test.mjs    (68)
    ├── rooms-admission.test.mjs          (56)
    ├── dispensing-workflow.test.mjs      (56)
    ├── pricing-tiers-fx.test.mjs         (68)
    ├── procurement-match.test.mjs        (77)
    ├── roles-scope.test.mjs              (62)
    ├── pricing-workflow.test.mjs         (19)
    └── routes.test.mjs                   (زيارة 64 مسارًا بمتصفح حقيقي)
```

**ووثائق المشروع:** `docs/` — خصوصًا
`11-FRONTEND-CONVENTIONS.md` (الاتفاقيات) و`12-BILLING-DOMAIN-MODEL.md`
(نموذج الفوترة) و`06-UI-DATA-CONTRACTS.md` (عقود البيانات).

---

## 13. خمسة دروس من أخطاء حقيقية في هذا المشروع

هذه ليست نظريات. كل واحدة كانت خطأً موجودًا في الكود واكتشفته الاختبارات.

1. **كود لا يلمس البيانات يُخفي الخطأ.** دورة النواقص كانت تُغيّر حالة الطلب
   فقط بلا حركة مخزنية. كانت «تعمل» تمامًا — وكانت تُضاعف الرصيد. أول ما
   رُبطت بحركات حقيقية، كشفت أن المخزن الرئيسي **رصيده صفر** من الأدوية
   أصلًا، فكان «الصرف الفوري من الرئيسي» مستحيلًا من الأساس.

2. **الحقل المشتق المخزَّن يكذب دائمًا.** `totalCost: 3500 * 7 + 16500`
   و`daysCount: 7` لم يطابقا سطورهما أبدًا، وكانت هناك إقامة بتاريخ دخول
   **مستقبلي** محسوب لها ثلاثة أيام وإجمالي مالي.

3. **الطرح العشري المباشر يكسر الميزان.** `433.51 - 339.31` أعطى
   `94.19999999999999`. فشل اختبار بسببه — وكان الاختبار هو المخطئ لأنه
   استخدم `-` بدل `money.subtract`.

4. **صلاحية بلا دور = شاشة ميتة.** `reception.*` كانت معرَّفة بالكامل ولا
   مستخدم واحد يحملها. الاختبار الذي يحرس هذا سطرٌ واحد — اكتبه.

5. **`let` لا تُرفَع كالدوال.** `let basketHost` معرَّفة بعد الدالة التي
   تستخدمها → `ReferenceError` قبل أن تُرسم الشاشة من أصلها. لم يلتقطه أي
   اختبار وحدة — التقطه اختبار المتصفح الذي يزور كل مسار. **احتفظ باختبار
   كهذا.**

---

> **سؤال؟** افتح الخدمة المقابلة في `frontend/js/mock/services/` — التعليقات
> فيها تشرح **لماذا** كُتب كل قيد وحارس، لا ماذا يفعل فقط. وإن تعارض هذا
> الملف مع الكود، **فالكود هو الحقيقة** — والاختبارات تحرسه.

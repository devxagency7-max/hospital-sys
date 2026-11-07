# ADVANCED ERP — حالة التسليم وما تبقّى

> آخر تحديث: 7 نوفمبر 2026 · الفرع: `main` (مدموج من `feature/advanced-erp-transformation`)

النظام تحوّل من «Hospital ERP» إلى **ADVANCED ERP — Financial & Business
Management System** على أربعة موديولات: المحاسبة العامة، المحاسبة المالية،
الموارد البشرية، المخازن.

---

## 1. ما هو مكتمل ومُتحقَّق (لا تُعِد بناءه)

### طبقة المجال — `frontend/js/domain/` (عشر وحدات، دوال خالصة)

| الملف | المسؤولية |
|---|---|
| `posting.js` | **خدمة الترحيل المركزية**: بوابة التوازن، مفاتيح التفرّد، دورة حياة القيد، العكس، الترقيم |
| `posting-rules.js` | ترجمة 21 حدث عمل إلى سطور قيد، عبر خريطة ربط قابلة للإعداد (`MAP_KEYS`) |
| `accounts.js` | هرمية الدليل، حسابات المقابلة، قاعدة «الترحيل على الأوراق فقط»، فحص سلامة الدليل |
| `ledger.js` | أرصدة مُشتقّة من القيود، كشف حساب، ميزان مراجعة، الدخل، المركز المالي، التدفقات (مباشرة)، مراكز التكلفة |
| `invoicing.js` | نموذج الفوترة محايد تجاه نوع الطرف (يخدم العملاء والموردين): محور دورة الحياة + محور التسوية |
| `aging.js` | شرائح التقادم، حدود الائتمان، صحة التحصيل |
| `valuation.js` | FIFO والمتوسط المرجّح، معاينة تكلفة الصرف، تعرُّض الصلاحية |
| `payroll.js` | شرائح ضريبية تصاعدية، حدود التأمينات، الإضافي، السلف |
| `depreciation.js` | أربع طرق إهلاك، ضمانة قيمة الخردة، نتيجة الاستبعاد |
| `attendance.js` | تقييم الورديات، أرصدة الإجازات، حراسات الاعتماد |

**قواعد ملزمة:** لا وحدة مجال تلمس DOM أو الشبكة أو `js/mock`. كل حساب مالي
يمر من `js/core/money.js` (قروش كأعداد صحيحة). ممنوع `a + b` على المبالغ.

### طبقة البيانات — `frontend/js/mock/`

- `seed.js` مفردات عامة + مولّد حتمي (`REFERENCE_DATE = 2026-11-07`)
- `accounting.mock.js` — 127 حسابًا (88 ورقة قابلة للترحيل)، 165 قيدًا، سنتان
  ماليتان، 12 فترة، خريطة ربط كاملة
- `finance.mock.js` — 15 عميلًا، 12 موردًا، فواتير/تحصيلات/مدفوعات، 4 خزائن،
  4 بنوك، 33 أصلًا، 7 ضرائب
- `hr.mock.js` — 69 موظفًا، 3,960 سجل حضور، 11 مسيّر رواتب، 716 قسيمة
- `inventory.mock.js` — 50 صنفًا، 6 مخازن، 851 حركة، 90 تشغيلة، 4 جرد
- `admin.mock.js` — منشأة، 15 مستخدمًا، 11 دورًا، 220 حدث تدقيق، تفضيلات
- `db.js` — 57 مجموعة + محرك استعلام (بحث/فلترة/ترتيب/ترقيم على «الخادم»)

**ضمانة مُتحقَّقة:** الأستاذ المساعد يُطابق الحساب الرقابي بفرق **صفر** في
خمسة حسابات مالية وخمسة حسابات مخزون. الميزان والميزانية متوازنان.

**اتجاه مصدر الحقيقة:** أرصدة العملاء/الموردين/البنوك مُشتقّة من الدفتر.
أرصدة **المخزون** هي العكس: الموديول هو المصدر، والقيد الافتتاحي في الدفتر
مُعاير عليه (الكمية على الرف واقعة، والحساب الرقابي يتبعها).

### طبقة الخدمات — `frontend/js/mock/services/` (محاكاة الباك-إند ومواصفته)

`posting.service.js` هو **نقطة الدخول الوحيدة للترحيل** بأربع ضمانات: مفتاح
تفرّد، توازن، فترة مفتوحة، سجل تدقيق. بقية الخدمات (`accounting`, `finance`,
`hr`, `inventory`, `dashboard`) تصف الحدث ولا تبني قيدًا.

### العقد — `frontend/js/api/`

- `mock-adapter.js`: **166 endpoint** (توجيه فقط، بلا منطق)
- `http.js`: نقطة التبديل الوحيدة — `API.mode = "live"` في `js/core/config.js`
- ملفات `*.api.js` لكل نطاق: الشاشات تستدعي بالاسم ولا تعرف المسار أبدًا

### الواجهة

- التنقل والمسارات: `js/config/navigation.js` + `js/config/routes.js`
- مصانع مشتركة: `pages/_shared/{list-page,cells,forms,print}.js`
- **20 شاشة مبنية**: لوحة التحكم · دليل الحسابات · قيود اليومية · إنشاء قيد ·
  دفتر الأستاذ · ميزان المراجعة · الفترات · العملاء · فواتير العملاء ·
  الموردون · الخزائن · البنوك · القوائم المالية · تقادم العملاء · تقادم
  الموردين · الموظفون · الرواتب · الحضور · تخصيص المظهر

### الاختبارات

```bash
cd frontend
node tests/architecture.test.mjs   # 55 فحصًا — كلها ناجحة
npm run build                      # بناء css/app.css (مطلوب بعد أي checkout)
npm run dev                        # خادم على :4173
```

---

## 2. ما تبقّى

### أ) الشاشات غير المبنية (تظهر الآن كصفحة «غير منفَّذة» صريحة)

كلها مسجَّلة في `navigation.js` ولها endpoints جاهزة — تحتاج ملف صفحة فقط.

**المحاسبة العامة**
- `/gl/cost-centers` → `GET /gl/cost-centers/analysis`
- `/gl/year-end` → `GET /gl/fiscal-years/:id/closing-preview`

**المحاسبة المالية**
- `/fin/customer-invoices/new` → `POST /fin/customer-invoices`
- `/fin/receipts` → `GET|POST /fin/receipts`
- `/fin/credit-notes` → `GET /fin/credit-notes`, `POST /fin/credit-notes/:id/approve`
- `/fin/supplier-invoices` → `GET /fin/supplier-invoices`
- `/fin/supplier-payments` → `GET|POST /fin/supplier-payments`
- `/fin/cash-movements` → `GET /fin/cash-movements`
- `/fin/transfers` → `POST /fin/transfers`
- `/fin/bank-reconciliation` → `GET|POST /fin/bank-reconciliations`
- `/fin/assets` → `GET /fin/assets`, `POST /fin/assets/:id/dispose`
- `/fin/depreciation` → `GET /fin/depreciation/preview`, `POST /fin/depreciation/run`
- `/fin/taxes` → `GET /fin/taxes`, `GET /fin/tax-returns`
- `/fin/reconciliation` → `GET /fin/reconciliation-summary`

**الموارد البشرية**
- `/hr/employees/new` → `POST /hr/employees`
- `/hr/org-chart` → `GET /hr/org-chart`
- `/hr/positions`, `/hr/shifts` → `GET /hr/positions`, `GET /hr/shifts`
- `/hr/leaves` → `GET|POST /hr/leave-requests` + approve/reject
- `/hr/leave-balances` → `GET /hr/leave-balances`
- `/hr/advances` → `GET|POST /hr/advances`
- `/hr/payslips` → `GET /hr/payslips`, `GET /hr/payslips/:id`
- `/hr/payroll-settings` → `GET|PUT /hr/payroll/settings`

**المخازن (كل الموديول — الـ endpoints جاهزة بالكامل)**
- `/inv/items`, `/inv/categories`, `/inv/units`, `/inv/warehouses`
- `/inv/balances`, `/inv/movements`
- `/inv/receipts`, `/inv/issues`, `/inv/transfers`, `/inv/adjustments`
- `/inv/batches`, `/inv/expiry`, `/inv/valuation`, `/inv/counts`

**التقارير** — `/reports` وستة أقسام فرعية (استخدم `pages/_shared/print.js`)

**الإدارة** — `/admin/users`, `/admin/roles`, `/admin/permissions`, `/admin/audit`

**الإعدادات** — `/settings/company`, `/settings/posting-map` (مهم: يُعطِّل
الترحيل إن كان ناقصًا), `/settings/branches`, `/settings/preferences`,
`/settings/notifications`

**شاشات التفاصيل** (مسجَّلة كـ«غير منفَّذة» حتى لا يكسر النقر على صف):
`/gl/journal/:id` · `/fin/customers/:id` · `/fin/customer-invoices/:id` ·
`/fin/suppliers/:id` · `/fin/supplier-invoices/:id` · `/fin/cash-boxes/:id` ·
`/fin/banks/:id` · `/fin/assets/:id` · `/hr/employees/:id` ·
`/hr/payroll/:id` · `/hr/payslips/:id` · `/inv/items/:id` · `/inv/counts/:id`

### ب) مشاكل معروفة

1. **مشكلة واحدة غير محلولة:** استثناء `appendChild` على `/hr/payroll` من
   `data-table.js:368`. `summaryRow` أُصلح (كان يُعيد مصفوفة حيث يتوقع
   الجدول `<tr>`)، لكن مسيّرات الرواتب **لا تُعرّف** `summaryRow` — فالسبب
   هناك مختلف ولم يُشخَّص بعد. ابدأ من: هل أحد أعمدة الجدول يُعيد `null`؟
2. `routes.test.mjs` لم يُشغَّل بعد التحويل — يحتاج تحديثًا (يشير إلى
   `/design-system` المحذوفة) ثم تشغيلًا على الـ 20 شاشة الحالية.
3. `docs/01..12` لسه بمحتوى المستشفى — تحتاج تحديثًا. `docs/12` تحديدًا
   كان عن نموذج الفوترة واسمه تغيّر إلى `12-INVOICING-DOMAIN-MODEL.md` في
   التعليقات لكن الملف لم يُنشأ.
4. `README.md` في الجذر و`backend/README.md` و`frontend/README.md` لسه
   بنص المستشفى.

### ج) الرفع إلى GitHub

`main` المحلي مدموج وجاهز. **الرفع يفشل بـ 403**: التوكن الحالي
(`AbdallahMohamedFathy`) بلا صلاحية كتابة على
`devxagency7-max/hospital-sys`. يحتاج صلاحية على الريبو أو تغيير الـ remote.

---

## 3. اتفاقيات لا تُخالَف

1. **الترحيل مركزي.** لا موديول يبني قيدًا. استخدم
   `postDocument({ sourceType, sourceId, sourceEvent, document, ... })`.
   أي حدث جديد = دالة في `posting-rules.js` + مدخل في `POSTING_RULES`.
2. **الأرصدة مُشتقّة** من القيود المُرحَّلة. لا تُضِف حقل `balance` مخزَّنًا.
3. **توقيع حسابات المقابلة**: `statementAmount` للقوائم المالية (توقيع
   النوع)، و`signedBalance` للميزان وكشوف الحساب (توقيع الطبيعة). خلطهما
   يُخرج الميزانية غير متوازنة بضعف مجمع الإهلاك.
4. **التحويل الداخلي لا يُنتج إيرادًا** — مخزنيًا أو نقديًا.
5. **المال**: كل عملية من `js/core/money.js`. ممنوع `a + b`.
6. **`onInput`/`onChange` يُمرّران الحدث لا القيمة.** استخدم
   `value(...)` / `numberValue(...)` / `checkedValue(...)` من
   `pages/_shared/forms.js`.
7. **الشاشة لا تعرف مسار API.** تستدعي دالة مسمّاة من `js/api/*.api.js`.
8. **`confirmAction` يُعيد وعدًا بقيمة منطقية** ولا يقبل `onConfirm`. استخدم
   `confirmThenRun` من `pages/_shared/list-page.js`.
9. **`summaryRow`** يمكن أن يُعيد مصفوفة أوصاف خلايا — المصنع يُغلّفها.
10. **ممنوع رسالة نجاح لعملية لم تُنفَّذ**، وممنوع خطأ يُخفى بصمت، وممنوع
    تصدير تقرير ناقص (`assertExportable`).
11. **كل شاشة جديدة**: مدخل في `navigation.js` + مسار في `routes.js`، ولا
    شيء ثالث. شغّل `node tests/architecture.test.mjs` بعدها — فيه فحص يرفض
    مسارًا يشاور على ملف غير موجود.
12. **لا مصطلح إكلينيكي** في الكود أو التعليقات — الاختبار يحرس ذلك.

## 4. قالب شاشة قائمة

```js
import { listPage, runAction, confirmThenRun } from "../_shared/list-page.js";
import { moneyColumn, dateColumn, statusColumn, nameColumn } from "../_shared/cells.js";
import { formModal, selectField, value } from "../_shared/forms.js";
import { listThings } from "../../js/api/<module>.api.js";

export default async function thingsPage() {
  return listPage({
    title: "…",
    description: "…",
    tableId: "<module>-things",      // مُعرّف ثابت — يُخزَّن به تفضيل الأعمدة
    fetch: listThings,
    filters: [{ key: "status", label: "الحالة", options: [...] }],
    columns: [nameColumn("name", "code", "الاسم"), moneyColumn("total", "الإجمالي"), statusColumn()],
    actions: (ctx) => [/* أزرار الترويسة */],
    rowActions: (row, ctx) => /* buttonGroup(...) */,
    stats: async () => [/* statTile(...) — تُحسب على كل البيانات لا على الصفحة */],
    summaryRow: (rows) => [/* أوصاف خلايا */],
  });
}
```

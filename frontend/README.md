# Hospital ERP — الواجهة الأمامية

واجهة عربية (RTL) مبنية على HTML + Tailwind + ES Modules، بدون أي مكتبة
JavaScript في المتصفح.

## التشغيل

```bash
npm install
npm run dev     # بناء CSS بالمراقبة + خادم ثابت على http://localhost:4173
```

> ES Modules محجوبة على `file://`، فلا يعمل فتح `index.html` مباشرة. لا بد من خادم.

| الأمر | الوظيفة |
|---|---|
| `npm run dev` | تطوير: مراقبة CSS + خادم |
| `npm run build` | بناء `css/app.css` للإنتاج |
| `npm run watch` | مراقبة CSS فقط |
| `npm run serve` | خادم فقط (`-- --port 4174` لتغيير المنفذ) |

`css/app.css` **مُولَّد** وغير متتبَّع في Git. شغّل `npm run build` بعد أي checkout.

## من أين تبدأ

| تريد… | افتح |
|---|---|
| رؤية كل المكوّنات تعمل | `#/design-system` داخل التطبيق |
| إضافة شاشة | `js/config/navigation.js` ثم `js/config/routes.js` |
| تغيير ألوان/خطوط الهوية | `@theme` في `css/tailwind.src.css` |
| الربط بباك-إند حقيقي | `js/core/config.js` → `API.mode = "live"` |
| فهم عقد الـ API | [`../docs/11-FRONTEND-CONVENTIONS.md`](../docs/11-FRONTEND-CONVENTIONS.md) |

## البنية

```text
index.html              نقطة التركيب الوحيدة — الإطار يُبنى في JS
css/tailwind.src.css    المصدر + كل الـ design tokens
js/
├── core/               أساسيات: dom, router, format, errors, permissions, text
├── api/                طبقة البيانات — http.js هي نقطة التبديل الوحيدة
├── mock/               بيانات تجريبية معزولة + محرك استعلام
└── config/             خريطة التنقل وجدول المسارات
components/
├── layout/             الإطار، الشريط الجانبي، الهيدر، مسار التنقل
├── common/             أزرار، شرائح، كروت، تبويبات، أيقونات
├── forms/              الحقول وأغلفتها
├── tables/             جدول البيانات
├── modals/             النوافذ والأدراج ونوافذ التأكيد
└── feedback/           إشعارات، تنبيهات، حالات تحميل/فراغ/خطأ
pages/                  شاشة واحدة لكل ملف: <اسم>.page.js
tools/                  خادم التطوير (بدون اعتماديات)
```

## قواعد لا تُكسر

1. **لا `innerHTML`** للبيانات — استخدم `el()` من `js/core/dom.js`.
2. **لا URL داخل شاشة** — الشاشات تستدعي `js/api/*.api.js` فقط.
3. **لا صلاحيات داخل شاشة** — اسأل `can('...')`.
4. **لا `toast.success` قبل نجاح فعلي** — بعد `await` الناجح فقط.
5. **لا تصدير تقرير ناقص** — مرّ من `assertExportable()`.
6. **لا حذف لسجل مالي** — `archive()` فقط.
7. **لا حالة غير مسجَّلة** في `js/core/statuses.js`.

التفاصيل والأسباب في [`../docs/11-FRONTEND-CONVENTIONS.md`](../docs/11-FRONTEND-CONVENTIONS.md)
و [`../docs/07-FRONTEND-RULES.md`](../docs/07-FRONTEND-RULES.md).

## الاعتماديات

Tailwind فقط، وكأداة بناء — **صفر مكتبات في المتصفح**. الأيقونات SVG inline،
والتواريخ والأرقام عبر `Intl`، وخادم التطوير مكتوب بـ Node الخام.

`npm audit` يُبلّغ عن ثغرة في `braces` داخل `@parcel/watcher` التابع لـ
`@tailwindcss/cli`. تخص مراقبة الملفات وقت التطوير فقط، ولا تصل إلى المتصفح
ولا إلى مخرجات البناء.

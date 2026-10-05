# Hospital ERP

نظام إدارة مستشفى / ERP صحي — واجهة عربية (RTL) حديثة.

المرحلة الحالية: **الواجهة الأمامية فقط (Frontend)**. لا يوجد باك-إند ولا قاعدة بيانات.
الواجهة تعمل على بيانات تجريبية (mock) من خلال طبقة API وسيطة، بحيث يستبدلها مطور
الباك-إند لاحقًا بطلبات HTTP حقيقية دون تعديل أي شاشة.

## البنية

```text
hospital-erp/
├── frontend/     تطبيق الواجهة (HTML + Tailwind + JavaScript ES Modules)
├── backend/      محجوز لمرحلة الباك-إند — فارغ عن قصد
├── docs/         مواصفات المشروع ومرجع الاتفاقيات
└── README.md
```

## التشغيل

```bash
cd frontend
npm install
npm run dev
```

ثم افتح <http://localhost:4173>.

> التطبيق يستخدم ES Modules، لذلك **لا يعمل بفتح `index.html` مباشرة** من نظام الملفات
> (المتصفح يحجب الـ modules على `file://`). لا بد من خادم ثابت، و`npm run dev` يوفّره.

أوامر أخرى:

| الأمر | الوظيفة |
|---|---|
| `npm run dev` | بناء الـ CSS بوضع المراقبة + تشغيل خادم ثابت |
| `npm run build` | بناء `css/app.css` للإنتاج (مُصغّر) |
| `npm run watch` | بناء الـ CSS بوضع المراقبة فقط |
| `npm run serve` | خادم ثابت فقط |

`frontend/css/app.css` ملف **مُولَّد** وغير متتبَّع في Git — لازم `npm run build` بعد أي checkout.

## التوثيق

ابدأ من [docs/01-PROJECT-OVERVIEW.md](docs/01-PROJECT-OVERVIEW.md).

الملف الأهم لمطور الباك-إند هو
[docs/11-FRONTEND-CONVENTIONS.md](docs/11-FRONTEND-CONVENTIONS.md) — فيه شكل الاستجابة،
وعقد الترقيم (pagination)، وشكل الأخطاء، ونموذج الصلاحيات.

## قواعد العمل

- لا شغل مباشر على `main` — كل مهمة على برانش `feature/*`.
- معايير اكتمال أي شاشة في [docs/09-DEFINITION-OF-DONE.md](docs/09-DEFINITION-OF-DONE.md).
- ممنوع رسائل نجاح لعمليات لم تُنفَّذ فعلًا، وممنوع تصدير تقرير ناقص.

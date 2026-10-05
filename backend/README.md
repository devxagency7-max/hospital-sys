# Backend — محجوز

هذا المجلد فارغ عن قصد. مرحلة الباك-إند (Phase 7) ليست جزءًا من العمل الحالي.

عند البدء، المدخل الصحيح هو [../docs/11-FRONTEND-CONVENTIONS.md](../docs/11-FRONTEND-CONVENTIONS.md):
فيه الاتفاقيات التي بُنيت عليها الواجهة فعلًا — شكل الاستجابة، الترقيم، شكل الأخطاء،
ونموذج الصلاحيات ومفاتيحها.

## نقطة الاستبدال

كل طلبات الواجهة تمر عبر ملف واحد: [../frontend/js/api/http.js](../frontend/js/api/http.js).

لتحويل الواجهة من البيانات التجريبية إلى API حقيقي:

1. اضبط `API.mode = 'live'` و `API.baseUrl` في
   [../frontend/js/core/config.js](../frontend/js/core/config.js).
2. نفِّذ المسارات المسجَّلة في
   [../frontend/js/api/mock-adapter.js](../frontend/js/api/mock-adapter.js) — هي قائمة
   الـ endpoints التي تتوقعها الواجهة، بنفس الأسماء والمعاملات.

لا حاجة لتعديل أي شاشة أو مكوّن.

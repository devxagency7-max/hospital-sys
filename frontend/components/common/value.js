/**
 * عرض القيم اللاتينية والرقمية داخل واجهة عربية.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  كل كود أو مرجع أو رقم مركّب يُعرض عبر هذه الدوال، لا كنص خام.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * المشكلة: في فقرة عربية، المسافات والشرطات محايدة اتجاهيًا فتتبع اتجاه
 * الفقرة. «0101 234 5678» تُعرض «5678 234 0101». الرقم يبدو سليمًا ويُقرأ
 * خطأً — وهو أسوأ من خطأ ظاهر.
 *
 * القاعدة المستخلصة من فحص فعلي في المتصفح:
 *   - مقطع واحد (P-1001، 12.5%، 1,200.50): آمن منفردًا، لكنه يصبح هشًا
 *     بمجرد مجاورته لنص عربي في نفس عقدة النص. نعزله احتياطًا.
 *   - عدة مقاطع كلها لاتينية/رقمية (هاتف، نطاق تاريخ): يُعاد ترتيبها فعليًا.
 *     العزل إلزامي.
 *   - رقم متبوع بكلمة عربية (120 علبة / 1,200.50 ج.م): انقلابه **صحيح**،
 *     ففرض LTR عليه يكسره. لا تعزله.
 *
 * نستخدم عنصر `<bdi>` لأنه مخصص لهذا الغرض في HTML ويحمل العزل أصلًا.
 */

import { el, cx } from "../../js/core/dom.js";
import { EMPTY } from "../../js/core/format.js";

/**
 * قيمة لاتينية/رقمية معزولة اتجاهيًا.
 *
 * @param {string|number} value
 * @param {object} [options]
 * @param {boolean} [options.mono]     خط ثابت العرض — للقيم التقنية
 * @param {boolean} [options.tabular]  أرقام بعرض ثابت — للمعرّفات في الجداول
 * @param {string} [options.class]
 * @param {string} [options.title]
 */
export function ltr(value, { mono = false, tabular = false, class: className, title } = {}) {
  const text = value === null || value === undefined || value === "" ? EMPTY : String(value);

  return el(
    "bdi",
    {
      class: cx("ltr-isolate", mono && "font-mono", tabular && "num", className),
      title,
    },
    text,
  );
}

/**
 * مرجع تجاري: كود مريض، رقم فاتورة، كود صنف، رقم تشغيلة، رقم إيصال.
 * أرقامه بعرض ثابت حتى تصطف المعرّفات عموديًا في الجداول.
 */
export function ref(value, options = {}) {
  return ltr(value, { tabular: true, ...options });
}

/**
 * قيمة تقنية: رمز خطأ، مفتاح صلاحية، مسار endpoint، اسم حقل.
 * بخط ثابت العرض لتمييزها بصريًا عن بيانات المستخدم.
 */
export function code(value, { class: className, ...options } = {}) {
  return ltr(value, {
    mono: true,
    class: cx("text-[11px] text-faint", className),
    ...options,
  });
}

/**
 * رقم هاتف — `format.phone` تُنسّقه، وهذه تعزله.
 * تُبقي الرقم على سطر واحد: العمود الضيق كان يكسره على ثلاثة أسطر.
 */
export function phoneValue(formatted) {
  return ltr(formatted, { tabular: true, class: "whitespace-nowrap" });
}

/**
 * نطاق رقمي («من — إلى»): تاريخان أو رقمان.
 * بلا عزل يُعاد ترتيب الطرفين فيبدو النطاق مقلوبًا.
 */
export function range(from, to, separator = "—") {
  return el(
    "bdi",
    { class: "ltr-isolate num whitespace-nowrap" },
    `${from ?? EMPTY} ${separator} ${to ?? EMPTY}`,
  );
}

/**
 * كتلة نص تقنية متعددة الأسطر (JSON، أمثلة كود).
 * تُعيد `<pre>` معزولة ومحاذاة لليسار مع تمرير أفقي عند الحاجة.
 */
export function codeBlock(text, { class: className } = {}) {
  return el(
    "pre",
    {
      class: cx(
        "ltr-isolate font-mono text-[11px] leading-relaxed overflow-x-auto",
        "bg-subtle border border-line p-3 rounded-[var(--radius-control)]",
        className,
      ),
    },
    text,
  );
}

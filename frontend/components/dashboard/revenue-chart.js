/**
 * رسم الإيرادات — SVG مرسوم يدويًا، بلا مكتبة رسوم بيانية خارجية.
 *
 * نفس منطق js/core/dom.js#svg ومكوّن الأيقونات: لا طلب شبكة إضافي، ولا حزمة
 * عشرات الكيلوبايتات لرسم خط واحد. السلسلة الزمنية هنا صغيرة بما يكفي
 * (أسبوعان) ليكون الرسم اليدوي أبسط من إدارة تبعية رسوم بيانية كاملة.
 */

import { el, svg, cx, clear } from "../../js/core/dom.js";
import * as fmt from "../../js/core/format.js";

/**
 * يوم/شهر مختصر من تاريخ ISO مباشرة — لا عبر قصّ خرج `fmt.date()`.
 * `fmt.date()` يُدرِج علامات اتجاه خفية بين المقاطع («05‏/10‏/2026»)،
 * فقصّ أول خمسة أحرف منه يقطع من منتصف علامة اتجاه لا بعد يوم/شهر فعليًا.
 */
function shortDayMonth(isoDate) {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

const WIDTH = 640;
const HEIGHT = 200;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const PAD_START = 8;
const PAD_END = 8;

/**
 * @param {object} options
 * @param {Array<{date:string, invoiced:number, collected:number}>} options.series
 * @param {boolean} [options.loading]
 */
export function revenueChart({ series = [], loading = false } = {}) {
  if (loading) return chartSkeleton();
  if (!series.length) return chartEmpty();

  const maxValue = Math.max(1, ...series.map((point) => Math.max(point.invoiced, point.collected)));
  const plotWidth = WIDTH - PAD_START - PAD_END;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = series.length > 1 ? plotWidth / (series.length - 1) : 0;

  const xAt = (index) => PAD_START + stepX * index;
  const yAt = (value) => PAD_TOP + plotHeight * (1 - value / maxValue);

  const invoicedPoints = series.map((point, index) => [xAt(index), yAt(point.invoiced)]);
  const collectedPoints = series.map((point, index) => [xAt(index), yAt(point.collected)]);

  const linePath = (points) =>
    points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  const areaPath = (points) =>
    `${linePath(points)} L${points[points.length - 1][0].toFixed(1)},${(HEIGHT - PAD_BOTTOM).toFixed(1)} ` +
    `L${points[0][0].toFixed(1)},${(HEIGHT - PAD_BOTTOM).toFixed(1)} Z`;

  /* --- خطوط إرشادية أفقية (شبكة خفيفة جدًا، للقراءة لا للزخرفة) --- */
  const gridLines = [0, 0.5, 1].map((fraction) =>
    svg("line", {
      x1: PAD_START,
      x2: WIDTH - PAD_END,
      y1: PAD_TOP + plotHeight * fraction,
      y2: PAD_TOP + plotHeight * fraction,
      stroke: "currentColor",
      class: "text-line",
      "stroke-width": 1,
      "stroke-dasharray": fraction === 1 ? "0" : "3 4",
    }),
  );

  /* --- تسميات المحور السيني: أول/أوسط/آخر تاريخ فقط، لا تاريخ تحت كل نقطة --- */
  const labelIndexes = series.length > 1 ? [0, Math.floor((series.length - 1) / 2), series.length - 1] : [0];
  const xLabels = [...new Set(labelIndexes)].map((index) =>
    svg(
      "text",
      {
        x: xAt(index),
        y: HEIGHT - 8,
        "text-anchor": index === 0 ? "start" : index === series.length - 1 ? "end" : "middle",
        class: "fill-faint text-[10px] num",
      },
      shortDayMonth(series[index].date),
    ),
  );

  /* --- نقطة تفاعلية مخفية لكل يوم + تلميح عند التحويم --- */
  const tooltip = el(
    "div",
    {
      class:
        "pointer-events-none absolute z-10 hidden min-w-[9rem] rounded-[var(--radius-control)] " +
        "border border-line bg-surface px-3 py-2 shadow-raised text-xs",
    },
  );

  const hoverDots = series.map((point, index) => {
    const [cx1, cy1] = invoicedPoints[index];
    const [, cy2] = collectedPoints[index];

    const hitArea = svg("rect", {
      x: xAt(index) - stepX / 2,
      y: 0,
      width: stepX || plotWidth,
      height: HEIGHT,
      fill: "transparent",
    });

    const dotInvoiced = svg("circle", {
      cx: cx1,
      cy: cy1,
      r: 3.5,
      class: "fill-brand-400 opacity-0 transition-opacity duration-150",
    });
    const dotCollected = svg("circle", {
      cx: cx1,
      cy: cy2,
      r: 3.5,
      class: "fill-success-300 opacity-0 transition-opacity duration-150",
    });

    hitArea.addEventListener("mouseenter", () => {
      dotInvoiced.classList.remove("opacity-0");
      dotCollected.classList.remove("opacity-0");

      tooltip.classList.remove("hidden");
      tooltip.style.insetInlineStart = `${(cx1 / WIDTH) * 100}%`;
      tooltip.style.top = "0";
      clear(tooltip);
      tooltip.appendChild(
        el(
          "div",
          {},
          el("p", { class: "font-medium text-ink mb-1" }, fmt.dateLong(point.date)),
          el(
            "div",
            { class: "flex items-center gap-1.5 text-muted" },
            el("span", { class: "size-1.5 rounded-full bg-brand-400 shrink-0" }),
            el("span", {}, "مفوتر"),
            el("span", { class: "ms-auto num text-ink" }, fmt.amount(point.invoiced)),
          ),
          el(
            "div",
            { class: "flex items-center gap-1.5 text-muted mt-0.5" },
            el("span", { class: "size-1.5 rounded-full bg-success-300 shrink-0" }),
            el("span", {}, "محصَّل"),
            el("span", { class: "ms-auto num text-ink" }, fmt.amount(point.collected)),
          ),
        ),
      );
    });

    hitArea.addEventListener("mouseleave", () => {
      dotInvoiced.classList.add("opacity-0");
      dotCollected.classList.add("opacity-0");
      tooltip.classList.add("hidden");
    });

    return { hitArea, dotInvoiced, dotCollected };
  });

  const chart = svg(
    "svg",
    {
      viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
      class: "w-full h-auto overflow-visible",
      role: "img",
      "aria-label": "رسم بياني لإجمالي الفواتير والمبالغ المحصَّلة خلال آخر أسبوعين",
    },
    svg(
      "defs",
      {},
      svg(
        "linearGradient",
        { id: "hx-revenue-fill", x1: "0", y1: "0", x2: "0", y2: "1" },
        svg("stop", { offset: "0%", "stop-color": "var(--color-brand-400)", "stop-opacity": "0.28" }),
        svg("stop", { offset: "100%", "stop-color": "var(--color-brand-400)", "stop-opacity": "0" }),
      ),
    ),
    ...gridLines,
    // منطقة الفوترة المظلَّلة أولًا (الأعمق)، ثم خط التحصيل فوقها.
    svg("path", { d: areaPath(invoicedPoints), fill: "url(#hx-revenue-fill)", stroke: "none" }),
    svg("path", {
      d: linePath(invoicedPoints),
      fill: "none",
      stroke: "var(--color-brand-400)",
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }),
    svg("path", {
      d: linePath(collectedPoints),
      fill: "none",
      stroke: "var(--color-success-300)",
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "stroke-dasharray": "5 4",
    }),
    ...xLabels,
    ...hoverDots.flatMap((d) => [d.dotInvoiced, d.dotCollected]),
    ...hoverDots.map((d) => d.hitArea),
  );

  // الرسم يدخل بتمدد أفقي خفيف عند أول ظهور — حركة واحدة بسيطة، لا تتكرر.
  chart.style.transformOrigin = "0% 100%";
  chart.animate(
    [
      { transform: "scaleY(0.85)", opacity: 0 },
      { transform: "scaleY(1)", opacity: 1 },
    ],
    { duration: 420, easing: "cubic-bezier(.16,1,.3,1)" },
  );

  return el(
    "div",
    { class: "relative" },
    el(
      "div",
      { class: "flex items-center gap-4 mb-3 text-xs" },
      legendDot("bg-brand-400", "الفواتير"),
      legendDot("bg-success-300", "المحصَّل", "border-dashed"),
    ),
    el("div", { class: "relative" }, chart, tooltip),
  );
}

function legendDot(colorClass, label, extra) {
  return el(
    "span",
    { class: "flex items-center gap-1.5 text-muted" },
    el("span", { class: cx("size-2 rounded-full shrink-0", colorClass, extra) }),
    label,
  );
}

function chartSkeleton() {
  return el(
    "div",
    { class: "space-y-3" },
    el("div", { class: "flex gap-4" }, el("div", { class: "hx-skeleton h-3 w-16" }), el("div", { class: "hx-skeleton h-3 w-16" })),
    el("div", { class: "hx-skeleton w-full", style: { height: "200px" } }),
  );
}

function chartEmpty() {
  return el(
    "div",
    { class: "flex flex-col items-center justify-center text-center py-16 text-faint" },
    el("p", { class: "text-sm" }, "لا توجد بيانات إيرادات كافية لعرض الرسم بعد."),
  );
}

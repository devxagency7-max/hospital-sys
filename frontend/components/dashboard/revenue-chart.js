/**
 * رسم الإيرادات والمصروفات والربح — SVG مرسوم يدويًا، بلا مكتبة رسوم بيانية خارجية.
 *
 * نفس منطق js/core/dom.js#svg ومكوّن الأيقونات: لا طلب شبكة إضافي، ولا حزمة
 * عشرات الكيلوبايتات لرسم خط واحد. السلسلة الزمنية هنا صغيرة بما يكفي
 * (أسابيع أو أشهر) ليكون الرسم اليدوي أبسط من إدارة تبعية رسوم بيانية كاملة.
 *
 * الخطوط عامة العدد (`lines`) — الليجند تحتها تِسييك فعلي يُخفي أو يُظهر كل
 * خط بالضغط عليه، لا نقاط زخرفية بلا أثر.
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
const HEIGHT = 128;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;
const PAD_START = 8;
const PAD_END = 8;

/**
 * @param {object} options
 * @param {Array<{date:string, [key:string]: number}>} options.series
 * @param {Array<{key:string, label:string, color:string, dash?:boolean}>} options.lines
 * @param {boolean} [options.loading]
 */
export function revenueChart({
  series = [],
  lines = [],
  loading = false,
  description = "رسم بياني لعدة سلاسل زمنية",
} = {}) {
  if (loading) return chartSkeleton();
  if (!series.length || !lines.length) return chartEmpty();

  /** الخطوط المرئية حاليًا — الكل ظاهر افتراضًا. */
  const visible = new Set(lines.map((line) => line.key));

  const host = el("div", { class: "relative" });

  function paint() {
    clear(host);
    host.appendChild(buildChart());
  }

  function buildChart() {
    const activeLines = lines.filter((line) => visible.has(line.key));
    const maxValue = Math.max(1, ...series.flatMap((row) => lines.map((line) => row[line.key] ?? 0)));
    const plotWidth = WIDTH - PAD_START - PAD_END;
    const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const stepX = series.length > 1 ? plotWidth / (series.length - 1) : 0;

    const xAt = (index) => PAD_START + stepX * index;
    const yAt = (value) => PAD_TOP + plotHeight * (1 - value / maxValue);

    const pointsByLine = new Map(
      lines.map((line) => [line.key, series.map((row, index) => [xAt(index), yAt(row[line.key] ?? 0)])]),
    );

    const linePath = (points) =>
      points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

    const areaPath = (points) =>
      `${linePath(points)} L${points[points.length - 1][0].toFixed(1)},${(HEIGHT - PAD_BOTTOM).toFixed(1)} ` +
      `L${points[0][0].toFixed(1)},${(HEIGHT - PAD_BOTTOM).toFixed(1)} Z`;

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

    const labelIndexes = series.length > 1 ? [0, Math.floor((series.length - 1) / 2), series.length - 1] : [0];
    const xLabels = [...new Set(labelIndexes)].map((index) =>
      svg(
        "text",
        {
          x: xAt(index),
          y: HEIGHT - 6,
          "text-anchor": index === 0 ? "start" : index === series.length - 1 ? "end" : "middle",
          class: "fill-faint text-[10px] num",
        },
        shortDayMonth(series[index].date),
      ),
    );

    const tooltip = el(
      "div",
      {
        class:
          "pointer-events-none absolute z-10 hidden min-w-[9rem] rounded-[var(--radius-control)] " +
          "border border-line bg-surface px-3 py-2 shadow-raised text-xs",
      },
    );

    const hoverDots = series.map((row, index) => {
      const dots = activeLines.map((line) => {
        const [x, y] = pointsByLine.get(line.key)[index];
        return svg("circle", { cx: x, cy: y, r: 3.5, class: cx(line.dotClass, "opacity-0 transition-opacity duration-150") });
      });

      const hitArea = svg("rect", {
        x: xAt(index) - stepX / 2,
        y: 0,
        width: stepX || plotWidth,
        height: HEIGHT,
        fill: "transparent",
      });

      hitArea.addEventListener("mouseenter", () => {
        dots.forEach((dot) => dot.classList.remove("opacity-0"));
        tooltip.classList.remove("hidden");
        tooltip.style.insetInlineStart = `${(xAt(index) / WIDTH) * 100}%`;
        tooltip.style.top = "0";
        clear(tooltip);
        tooltip.appendChild(
          el(
            "div",
            {},
            el("p", { class: "font-medium text-ink mb-1" }, fmt.dateLong(row.date)),
            ...activeLines.map((line) =>
              el(
                "div",
                { class: "flex items-center gap-1.5 text-muted mt-0.5 first:mt-0" },
                el("span", { class: cx("size-1.5 rounded-full shrink-0", line.dotClass) }),
                el("span", {}, line.label),
                el("span", { class: "ms-auto num text-ink" }, fmt.amount(row[line.key] ?? 0)),
              ),
            ),
          ),
        );
      });

      hitArea.addEventListener("mouseleave", () => {
        dots.forEach((dot) => dot.classList.add("opacity-0"));
        tooltip.classList.add("hidden");
      });

      return { hitArea, dots };
    });

    const chart = svg(
      "svg",
      {
        viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
        class: "w-full h-auto overflow-visible",
        role: "img",
        "aria-label": description,
      },
      svg(
        "defs",
        {},
        ...lines.map((line) =>
          svg(
            "linearGradient",
            { id: `hx-revenue-fill-${line.key}`, x1: "0", y1: "0", x2: "0", y2: "1" },
            svg("stop", { offset: "0%", "stop-color": line.strokeColor, "stop-opacity": "0.22" }),
            svg("stop", { offset: "100%", "stop-color": line.strokeColor, "stop-opacity": "0" }),
          ),
        ),
      ),
      ...gridLines,
      ...activeLines.flatMap((line, order) => {
        const points = pointsByLine.get(line.key);
        const parts = [];
        // تعبئة الأعمق (أول خط ظاهر) فقط — خطوط متعددة مملوءة تتزاحم بصريًا.
        if (order === 0) parts.push(svg("path", { d: areaPath(points), fill: `url(#hx-revenue-fill-${line.key})`, stroke: "none" }));
        parts.push(
          svg("path", {
            d: linePath(points),
            fill: "none",
            stroke: line.strokeColor,
            "stroke-width": 2,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            "stroke-dasharray": line.dash ? "5 4" : undefined,
          }),
        );
        return parts;
      }),
      ...xLabels,
      ...hoverDots.flatMap((d) => d.dots),
      ...hoverDots.map((d) => d.hitArea),
    );

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
      { class: "space-y-2.5" },
      legend(),
      el("div", { class: "relative" }, chart, tooltip),
    );
  }

  function legend() {
    return el(
      "div",
      { class: "flex flex-wrap items-center gap-2 text-xs", role: "group", "aria-label": "إظهار أو إخفاء خطوط الرسم" },
      ...lines.map((line) => {
        const checked = visible.has(line.key);
        return el(
          "button",
          {
            type: "button",
            role: "checkbox",
            "aria-checked": String(checked),
            class: cx(
              "hx-press flex items-center gap-1.5 px-2 py-1 rounded-full border transition-colors",
              checked ? "border-line bg-subtle text-ink" : "border-line text-faint opacity-60",
            ),
            onClick: () => {
              if (checked && visible.size === 1) return; // لا تُخفِ آخر خط ظاهر
              if (checked) visible.delete(line.key);
              else visible.add(line.key);
              paint();
            },
          },
          el(
            "span",
            {
              class: cx(
                "grid place-items-center size-3.5 rounded-sm border shrink-0 transition-colors",
                checked ? [line.dotClass, "border-transparent"] : "border-line-strong",
              ),
            },
            checked
              ? svg(
                  "svg",
                  { viewBox: "0 0 24 24", class: "size-2.5 text-white", fill: "none", stroke: "currentColor", "stroke-width": 3 },
                  svg("path", { d: "M20 6L9 17l-5-5", "stroke-linecap": "round", "stroke-linejoin": "round" }),
                )
              : null,
          ),
          line.label,
        );
      }),
    );
  }

  paint();
  return host;
}

function chartSkeleton() {
  return el(
    "div",
    { class: "space-y-3" },
    el("div", { class: "flex gap-4" }, el("div", { class: "hx-skeleton h-3 w-16" }), el("div", { class: "hx-skeleton h-3 w-16" })),
    el("div", { class: "hx-skeleton w-full", style: { height: `${HEIGHT}px` } }),
  );
}

function chartEmpty() {
  return el(
    "div",
    { class: "flex flex-col items-center justify-center text-center py-10 text-faint" },
    el("p", { class: "text-sm" }, "لا توجد بيانات كافية لعرض الرسم بعد."),
  );
}

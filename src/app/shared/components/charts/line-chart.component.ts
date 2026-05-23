import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * LineChartComponent — minimal SVG line chart for trends.
 *
 * Design choices (per Module 8 refinements):
 *   - No grid lines, no axes, no tick marks by default. Just the line.
 *   - Optional faint baseline at the min value for orientation.
 *   - Optional start/end labels (e.g. "76kg → 74kg") instead of a y-axis.
 *   - Optional x-axis labels at the ends (oldest, newest dates).
 *   - Highlight dot on the most recent point.
 *
 * Usage:
 *   <app-line-chart [data]="points" [yLabel]="'kg'" />
 *
 * Where `points` is `{ x: string; y: number }[]` sorted by x ascending.
 */
@Component({
  selector: 'app-line-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data().length < 2) {
      <div class="text-center py-8 text-sm text-subtle font-medium">
        Not enough data to chart yet.
      </div>
    } @else {
      <div class="relative">
        <svg
          [attr.viewBox]="'0 0 ' + width + ' ' + height"
          class="w-full block"
          [attr.aria-label]="ariaLabel()"
        >
          <!-- Faint area fill below the line -->
          <path
            [attr.d]="areaPath()"
            [attr.fill]="'rgb(' + colorVarRef() + ' / 0.08)'"
          />

          <!-- The line -->
          <path
            [attr.d]="linePath()"
            [attr.stroke]="'rgb(' + colorVarRef() + ')'"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />

          <!-- Most-recent dot -->
          <circle
            [attr.cx]="lastX()"
            [attr.cy]="lastY()"
            r="4"
            [attr.fill]="'rgb(' + colorVarRef() + ')'"
          />
          <circle
            [attr.cx]="lastX()"
            [attr.cy]="lastY()"
            r="8"
            [attr.fill]="'rgb(' + colorVarRef() + ' / 0.2)'"
          />
        </svg>

        <!-- Endpoint labels (replace y-axis): show first + last y values -->
        @if (showEndpointLabels()) {
          <div class="flex justify-between text-[10px] text-subtle font-semibold num mt-1 px-1">
            <span>{{ formatY(firstY()) }}{{ yLabel() }}</span>
            <span>{{ formatY(lastYVal()) }}{{ yLabel() }}</span>
          </div>
        }

        <!-- X endpoint dates -->
        @if (showXLabels()) {
          <div class="flex justify-between text-[10px] text-subtle font-medium num mt-0.5 px-1">
            <span>{{ firstX() }}</span>
            <span>{{ lastXLabel() }}</span>
          </div>
        }
      </div>
    }
  `,
})
export class LineChartComponent {
  /** Sorted ascending by x. */
  readonly data = input<ChartPoint[]>([]);
  /** Y-axis label suffix (e.g. "kg"). Inline; no axis drawn. */
  readonly yLabel = input<string>('');
  /** CSS variable name (without `--`) for line color. */
  readonly colorVar = input<string>('primary');
  /** Show "76kg / 74kg" endpoint labels under the chart. */
  readonly showEndpointLabels = input<boolean>(true);
  /** Show first/last x value labels under the chart. */
  readonly showXLabels = input<boolean>(false);
  /** Decimal places for y values in labels. */
  readonly yDecimals = input<number>(1);
  /** Accessible label override. */
  readonly ariaLabel = input<string>('Trend chart');

  // ---- viewBox is fixed; SVG scales via width:100% --------------
  protected readonly width = 320;
  protected readonly height = 100;
  private readonly pad = { top: 8, right: 8, bottom: 8, left: 8 };

  protected colorVarRef = computed(() => `var(--${this.colorVar()})`);

  // Domain derived from data.
  private readonly minY = computed(() => Math.min(...this.data().map((p) => p.y)));
  private readonly maxY = computed(() => Math.max(...this.data().map((p) => p.y)));

  private xFor(i: number): number {
    const n = this.data().length;
    const w = this.width - this.pad.left - this.pad.right;
    if (n <= 1) return this.pad.left;
    return this.pad.left + (i / (n - 1)) * w;
  }

  private yFor(value: number): number {
    const min = this.minY();
    const max = this.maxY();
    const range = max - min || 1;  // avoid div-by-zero on flat data
    const h = this.height - this.pad.top - this.pad.bottom;
    // Invert: SVG y grows downward, but charts read low → bottom.
    return this.pad.top + h - ((value - min) / range) * h;
  }

  protected linePath = computed(() => {
    const pts = this.data();
    if (pts.length === 0) return '';
    let d = `M ${this.xFor(0)} ${this.yFor(pts[0].y)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${this.xFor(i)} ${this.yFor(pts[i].y)}`;
    }
    return d;
  });

  protected areaPath = computed(() => {
    const pts = this.data();
    if (pts.length === 0) return '';
    const bottom = this.height - this.pad.bottom;
    let d = `M ${this.xFor(0)} ${bottom}`;
    for (let i = 0; i < pts.length; i++) {
      d += ` L ${this.xFor(i)} ${this.yFor(pts[i].y)}`;
    }
    d += ` L ${this.xFor(pts.length - 1)} ${bottom} Z`;
    return d;
  });

  protected lastX = computed(() => this.xFor(this.data().length - 1));
  protected lastY = computed(() => this.yFor(this.data()[this.data().length - 1]?.y ?? 0));

  protected firstY = computed(() => this.data()[0]?.y ?? 0);
  protected lastYVal = computed(() => this.data()[this.data().length - 1]?.y ?? 0);

  protected firstX = computed(() => this.data()[0]?.x ?? '');
  protected lastXLabel = computed(() => this.data()[this.data().length - 1]?.x ?? '');

  protected formatY(value: number): string {
    const decimals = this.yDecimals();
    return decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString();
  }
}

export interface ChartPoint {
  x: string;     // label or ISO date
  y: number;
}

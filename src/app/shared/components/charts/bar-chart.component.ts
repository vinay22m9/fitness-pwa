import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * BarChartComponent — minimal SVG bar chart for counts.
 *
 * Design (per Module 8 refinements):
 *   - Flat color bars with rounded tops, no gridlines, no y-axis.
 *   - Optional value label above each bar (small, num).
 *   - Optional x-axis labels under each bar (short — weeks, days).
 *   - Most recent bar gets a brighter fill to anchor attention.
 *
 * Usage:
 *   <app-bar-chart [data]="weeks" />
 *
 * Where `weeks` is `{ x: string; y: number }[]`.
 */
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data().length === 0) {
      <div class="text-center py-8 text-sm text-subtle font-medium">
        No data yet.
      </div>
    } @else {
      <div class="relative">
        <svg
          [attr.viewBox]="'0 0 ' + width + ' ' + height"
          class="w-full block"
          [attr.aria-label]="ariaLabel()"
        >
          @for (bar of bars(); track bar.x) {
            <!-- Bar -->
            <rect
              [attr.x]="bar.barX"
              [attr.y]="bar.barY"
              [attr.width]="bar.barW"
              [attr.height]="bar.barH"
              [attr.rx]="3"
              [attr.fill]="bar.isLast
                ? 'rgb(' + colorVarRef() + ')'
                : 'rgb(' + colorVarRef() + ' / 0.45)'"
            />
            <!-- Value above -->
            @if (showValues() && bar.y > 0) {
              <text
                [attr.x]="bar.labelX"
                [attr.y]="bar.labelY"
                text-anchor="middle"
                [attr.fill]="'rgb(var(--text))'"
                font-size="9"
                font-weight="700"
              >{{ bar.y }}</text>
            }
          }
        </svg>

        <!-- X labels (under each bar) -->
        @if (showXLabels()) {
          <div class="grid gap-1 px-1 mt-1" [style.grid-template-columns]="gridCols()">
            @for (bar of bars(); track bar.x) {
              <span class="text-[9px] text-subtle font-medium text-center truncate">
                {{ bar.x }}
              </span>
            }
          </div>
        }
      </div>
    }
  `,
})
export class BarChartComponent {
  readonly data = input<{ x: string; y: number }[]>([]);
  readonly colorVar = input<string>('accent');
  readonly showValues = input<boolean>(true);
  readonly showXLabels = input<boolean>(true);
  readonly ariaLabel = input<string>('Count chart');

  protected readonly width = 320;
  protected readonly height = 110;
  private readonly pad = { top: 16, right: 8, bottom: 8, left: 8 };

  protected colorVarRef = computed(() => `var(--${this.colorVar()})`);

  protected bars = computed(() => {
    const pts = this.data();
    const n = pts.length;
    if (n === 0) return [];
    const maxY = Math.max(1, ...pts.map((p) => p.y));
    const innerW = this.width - this.pad.left - this.pad.right;
    const innerH = this.height - this.pad.top - this.pad.bottom;
    // Bars take ~70% of their slot, the rest is gap.
    const slot = innerW / n;
    const barW = slot * 0.7;

    return pts.map((p, i) => {
      const slotX = this.pad.left + i * slot;
      const barX = slotX + (slot - barW) / 2;
      const barH = (p.y / maxY) * innerH;
      const barY = this.pad.top + innerH - barH;
      return {
        x: p.x,
        y: p.y,
        barX,
        barY,
        barW,
        barH: Math.max(barH, p.y > 0 ? 2 : 0),  // min 2px so small counts visible
        labelX: slotX + slot / 2,
        labelY: barY - 4,
        isLast: i === n - 1,
      };
    });
  });

  protected gridCols = computed(() => `repeat(${this.data().length}, minmax(0, 1fr))`);
}

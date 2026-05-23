import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * SVG progress ring. Smooth animated fill.
 *
 * Usage:
 *   <app-progress-ring [value]="65" [max]="100" colorVar="--primary" />
 *
 * Inputs:
 *   value     — current progress
 *   max       — target value (e.g. 3000 for 3L water goal)
 *   size      — diameter in px (default 96)
 *   stroke    — ring thickness in px (default 8)
 *   colorVar  — CSS variable name (with leading --) for ring color
 *               defaults to --primary (lime)
 *
 * The ring fills from 12 o'clock, clockwise. The progress is clamped to [0, 1]
 * so values past `max` show a full ring rather than overshooting.
 */
@Component({
  selector: 'app-progress-ring',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative inline-flex items-center justify-center">
      <svg
        [attr.width]="size()"
        [attr.height]="size()"
        [attr.viewBox]="'0 0 ' + size() + ' ' + size()"
        class="-rotate-90"
      >
        <!-- track -->
        <circle
          [attr.cx]="center()"
          [attr.cy]="center()"
          [attr.r]="radius()"
          fill="none"
          stroke="rgb(var(--border))"
          [attr.stroke-width]="stroke()"
        />
        <!-- progress -->
        <circle
          [attr.cx]="center()"
          [attr.cy]="center()"
          [attr.r]="radius()"
          fill="none"
          [attr.stroke]="'rgb(var(' + colorVar() + '))'"
          [attr.stroke-width]="stroke()"
          stroke-linecap="round"
          [attr.stroke-dasharray]="circumference()"
          [attr.stroke-dashoffset]="dashOffset()"
          style="transition: stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1);"
        />
      </svg>
      <div class="absolute inset-0 flex items-center justify-center">
        <ng-content />
      </div>
    </div>
  `,
})
export class ProgressRingComponent {
  readonly value = input.required<number>();
  readonly max = input.required<number>();
  readonly size = input<number>(96);
  readonly stroke = input<number>(8);
  readonly colorVar = input<string>('--primary');

  protected readonly center = computed(() => this.size() / 2);
  protected readonly radius = computed(() => this.center() - this.stroke() / 2);
  protected readonly circumference = computed(() => 2 * Math.PI * this.radius());

  protected readonly dashOffset = computed(() => {
    const pct = Math.max(0, Math.min(1, this.value() / this.max()));
    return this.circumference() * (1 - pct);
  });
}

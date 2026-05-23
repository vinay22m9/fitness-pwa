import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgClass } from '@angular/common';

/**
 * Icon registry — all icons in one place.
 *
 * Why not lucide-angular?
 *   - Adds ~80kb even with tree-shaking due to how it ships.
 *   - We only need ~20 icons for the whole app.
 *   - Inline SVG strings give us perfect control over stroke-width and size.
 *
 * Adding an icon: paste the SVG path data from https://lucide.dev or similar
 * (any 24×24 stroke icon library) into the ICONS map below.
 */

type IconPath = { d: string } | { paths: string[] };

const ICONS: Record<string, IconPath> = {
  // Nav
  home:      { d: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10' },
  dumbbell:  { paths: ['M6.5 6.5h11M6.5 17.5h11M3 12h18M5 9v6M19 9v6'] },
  fork:      { paths: ['M4 3v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3', 'M6 11v10', 'M18 3v18', 'M15 7h6'] },
  droplet:   { d: 'M12 2.69l5.66 5.66a8 8 0 11-11.31 0z' },
  activity:  { d: 'M22 12h-4l-3 9L9 3l-3 9H2' },

  // Actions
  plus:      { paths: ['M12 5v14', 'M5 12h14'] },
  check:     { d: 'M20 6L9 17l-5-5' },
  x:         { paths: ['M18 6L6 18', 'M6 6l12 12'] },
  chevron_right: { d: 'M9 18l6-6-6-6' },
  chevron_left:  { d: 'M15 18l-9-6 9-6' },

  // Profile
  user:      { paths: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'] },
  settings:  { paths: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'] },

  // State
  flame:     { d: 'M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z' },
  trophy:    { paths: ['M6 9H4.5a2.5 2.5 0 0 1 0-5H6', 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18', 'M4 22h16', 'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22', 'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22', 'M18 2H6v7a6 6 0 0 0 12 0V2Z'] },
  zap:       { d: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
  refresh:   { paths: ['M3 12a9 9 0 0 1 15-6.7L21 8', 'M21 3v5h-5', 'M21 12a9 9 0 0 1-15 6.7L3 16', 'M3 21v-5h5'] },
  bed:       { paths: ['M2 4v16', 'M22 4v16', 'M2 8h20', 'M2 12h20', 'M6 8v4'] },
  bell:      { paths: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'] },
  trending_up: { paths: ['M22 7l-8.5 8.5-5-5L2 17', 'M16 7h6v6'] },
};

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      [ngClass]="cssClass()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @if (singlePath(); as p) {
        <path [attr.d]="p" />
      }
      @for (p of multiPaths(); track $index) {
        <path [attr.d]="p" />
      }
    </svg>
  `,
})
export class IconComponent {
  /** Icon key from the ICONS registry. */
  readonly name = input.required<keyof typeof ICONS>();
  readonly size = input<number>(22);
  readonly strokeWidth = input<number>(2);
  readonly cssClass = input<string>('');

  /** Resolves to a single `d` string if the icon has one. */
  protected readonly singlePath = computed<string | null>(() => {
    const def = ICONS[this.name()];
    return def && 'd' in def ? def.d : null;
  });

  /** Resolves to an array of `d` strings if the icon has multiple paths. */
  protected readonly multiPaths = computed<string[]>(() => {
    const def = ICONS[this.name()];
    return def && 'paths' in def ? def.paths : [];
  });
}

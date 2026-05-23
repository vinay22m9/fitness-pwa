import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '@shared/components/icon/icon.component';

/**
 * Floating bottom nav — 5 tabs, Hevy/Fitbod inspired.
 *
 * Layout choices:
 *  - Floats above content with 16px side margin + safe-area bottom inset
 *  - "Workout" gets the centre slot (most-used)
 *  - Active tab shows lime accent + thicker stroke
 *  - Inactive tabs use --subtle for icon and --muted for label
 *  - No labels for the centre Workout button — icon is large enough on its own
 *
 * Future enhancements:
 *  - long-press shortcuts on Workout (start last routine) and Water (+250ml)
 *    these will be added via a directive in the hydration / workout modules
 */
type Tab = {
  path: string;
  label: string;
  icon: 'home' | 'dumbbell' | 'fork' | 'droplet' | 'trending_up';
};

const TABS: Tab[] = [
  { path: '/home',      label: 'Home',     icon: 'home' },
  { path: '/workout',   label: 'Workout',  icon: 'dumbbell' },
  { path: '/diet',      label: 'Diet',     icon: 'fork' },
  { path: '/hydration', label: 'Water',    icon: 'droplet' },
  { path: '/progress',  label: 'Progress', icon: 'trending_up' },
];

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav
      class="fixed left-4 right-4 z-40 rounded-3xl bg-elevated/95 backdrop-blur
             border border-border/60 shadow-lift"
      [style.bottom]="'calc(env(safe-area-inset-bottom, 0px) + 12px)'"
    >
      <ul class="flex items-center justify-between px-2 py-2">
        @for (tab of tabs; track tab.path) {
          <li class="flex-1">
            <a
              [routerLink]="tab.path"
              routerLinkActive="text-primary"
              #rla="routerLinkActive"
              class="flex flex-col items-center gap-1 py-1.5 rounded-2xl
                     transition-colors"
              [class.text-subtle]="!rla.isActive"
            >
              <app-icon
                [name]="tab.icon"
                [size]="22"
                [strokeWidth]="rla.isActive ? 2.3 : 2"
              />
              <span
                class="text-[10px] font-bold tracking-wide"
                [class.text-muted]="!rla.isActive"
              >
                {{ tab.label }}
              </span>
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class BottomNavComponent {
  protected readonly tabs = TABS;
}

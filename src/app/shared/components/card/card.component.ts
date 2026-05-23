import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Generic surface card. Use this everywhere a "section block" is needed.
 *
 * Variants:
 *   default — flat surface, p-5
 *   hero    — slightly larger radius and padding, used for the day's top card
 *   subtle  — uses `bg-elevated` instead of `bg-surface` (for nested cards)
 */
@Component({
  selector: 'app-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: {
    '[class]': 'classes()',
  },
})
export class CardComponent {
  readonly variant = input<'default' | 'hero' | 'subtle'>('default');

  protected classes(): string {
    switch (this.variant()) {
      case 'hero':   return 'block bg-surface rounded-3xl p-5';
      case 'subtle': return 'block bg-elevated rounded-2xl p-4';
      default:       return 'block bg-surface rounded-2xl p-5';
    }
  }
}

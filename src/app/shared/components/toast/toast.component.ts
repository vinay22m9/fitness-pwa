import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ToastService } from '@shared/services/toast.service';

/**
 * Toast renderer. Mount once at the app shell level; reads ToastService
 * for the currently active toast.
 */
@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed left-1/2 -translate-x-1/2 z-50 px-4"
      style="bottom: calc(env(safe-area-inset-bottom, 0) + 96px); pointer-events: none;"
    >
      @if (current(); as t) {
        <div
          class="px-4 py-3 rounded-2xl flex items-center gap-2.5 shadow-lg backdrop-blur-sm"
          [style.background]="bgFor(t.tone)"
          [style.color]="'rgb(var(--bg))'"
          style="pointer-events: auto;"
          role="status"
          aria-live="polite"
        >
          <app-icon [name]="iconFor(t.tone)" [size]="16" />
          <span class="text-sm font-bold">{{ t.text }}</span>
        </div>
      }
    </div>
  `,
})
export class ToastComponent {
  private readonly toast = inject(ToastService);
  protected readonly current = this.toast.current;

  protected bgFor(tone: string): string {
    switch (tone) {
      case 'success': return 'rgb(var(--primary))';
      case 'warning': return 'rgb(var(--warning))';
      default:        return 'rgb(var(--accent))';
    }
  }

  protected iconFor(tone: string): 'check' | 'zap' | 'bell' {
    switch (tone) {
      case 'success': return 'check';
      case 'warning': return 'bell';
      default:        return 'zap';
    }
  }
}

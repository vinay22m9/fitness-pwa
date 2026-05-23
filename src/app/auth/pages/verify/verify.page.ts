import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AuthService } from '@auth/services/auth.service';

@Component({
  selector: 'app-verify-page',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex-1 flex flex-col items-center justify-center px-6 pb-8">
      <div
        class="w-20 h-20 rounded-3xl grid place-items-center mb-6"
        style="background: rgb(var(--accent) / 0.12); color: rgb(var(--accent));"
      >
        <app-icon name="bell" [size]="36" />
      </div>

      <h1 class="text-2xl font-extrabold tracking-tight text-center">Check your inbox</h1>

      <p class="text-muted text-center mt-3 max-w-xs">
        We sent a confirmation link to
        @if (email()) {
          <span class="text-text font-semibold">{{ email() }}</span>
        } @else {
          <span class="text-text font-semibold">your email</span>
        }.
        Click it to activate your account.
      </p>

      @if (resent()) {
        <p
          class="text-sm font-semibold mt-4"
          style="color: rgb(var(--primary));"
        >
          New email sent. Check your inbox.
        </p>
      }
      @if (error(); as e) {
        <p
          class="text-sm font-medium mt-4 text-center max-w-xs"
          style="color: rgb(var(--danger));"
        >
          {{ e }}
        </p>
      }

      <button
        class="btn-ghost mt-8 w-full max-w-xs"
        (click)="onResend()"
        [disabled]="resending() || !email()"
      >
        @if (resending()) {
          <span class="animate-pulse-soft">Sending…</span>
        } @else {
          <span>Resend confirmation email</span>
        }
      </button>

      <a routerLink="/auth/login" class="text-sm text-muted mt-6">
        Back to sign in
      </a>
    </div>
  `,
})
export default class VerifyPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  protected readonly email = signal<string | null>(
    this.route.snapshot.queryParamMap.get('email'),
  );
  protected readonly resending = signal(false);
  protected readonly resent = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async onResend(): Promise<void> {
    const e = this.email();
    if (!e) return;
    this.resending.set(true);
    this.error.set(null);
    this.resent.set(false);
    const result = await this.auth.resendConfirmation(e);
    this.resending.set(false);
    if (!result.ok) {
      this.error.set(result.error);
      return;
    }
    this.resent.set(true);
  }
}

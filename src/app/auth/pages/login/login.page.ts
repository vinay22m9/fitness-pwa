import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AuthService } from '@auth/services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex-1 flex flex-col px-6 pt-12 pb-8">
      <!-- Brand -->
      <div class="flex flex-col items-center mb-10">
        <div
          class="w-20 h-20 rounded-3xl grid place-items-center mb-5 text-primary"
          style="background: rgb(var(--primary) / 0.12);"
        >
          <app-icon name="dumbbell" [size]="40" />
        </div>
        <h1 class="text-3xl font-extrabold tracking-tight">Fitness Coach</h1>
        <p class="text-muted text-center mt-2 text-sm">Welcome back</p>
      </div>

      <!-- Form -->
      <form
        [formGroup]="form"
        (ngSubmit)="onSubmit()"
        class="flex flex-col gap-3 w-full max-w-sm mx-auto"
        autocomplete="on"
      >
        <label class="flex flex-col gap-1.5">
          <span class="text-xs font-semibold text-muted uppercase tracking-wider">Email</span>
          <input
            type="email"
            formControlName="email"
            inputmode="email"
            autocomplete="email"
            placeholder="you@example.com"
            class="bg-surface text-text rounded-2xl px-4 py-3.5 outline-none
                   border border-border focus:border-primary
                   placeholder:text-subtle transition-colors"
          />
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="text-xs font-semibold text-muted uppercase tracking-wider">Password</span>
          <div class="relative">
            <input
              [type]="showPassword() ? 'text' : 'password'"
              formControlName="password"
              autocomplete="current-password"
              placeholder="••••••••"
              class="w-full bg-surface text-text rounded-2xl px-4 py-3.5 pr-12 outline-none
                     border border-border focus:border-primary
                     placeholder:text-subtle transition-colors"
            />
            <button
              type="button"
              (click)="toggleShowPassword()"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-muted p-1"
              [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
            >
              <app-icon [name]="showPassword() ? 'x' : 'check'" [size]="18" />
            </button>
          </div>
        </label>

        @if (error(); as e) {
          <div
            class="rounded-2xl px-4 py-3 text-sm font-medium"
            style="background: rgb(var(--danger) / 0.12); color: rgb(var(--danger));"
            role="alert"
          >
            {{ e }}
          </div>
        }

        <button
          type="submit"
          class="btn-primary mt-2 flex items-center justify-center gap-2"
          [disabled]="form.invalid || submitting()"
        >
          @if (submitting()) {
            <span class="animate-pulse-soft">Signing in…</span>
          } @else {
            <span>Sign In</span>
          }
        </button>

        <button
          type="button"
          (click)="onForgotPassword()"
          class="text-sm text-muted hover:text-text py-2 self-center"
          [disabled]="submitting()"
        >
          Forgot password?
        </button>

        @if (resetSent()) {
          <p
            class="text-xs text-center font-medium"
            style="color: rgb(var(--primary));"
          >
            Password reset email sent. Check your inbox.
          </p>
        }
      </form>

      <p class="text-center text-sm text-muted mt-auto pt-8">
        Don't have an account?
        <a routerLink="/auth/signup" class="text-primary font-semibold ml-1">
          Sign up
        </a>
      </p>
    </div>
  `,
})
export default class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected readonly submitting = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly resetSent = signal(false);

  protected toggleShowPassword(): void {
    this.showPassword.update((v) => !v);
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    this.error.set(null);
    this.resetSent.set(false);
    this.submitting.set(true);

    const { email, password } = this.form.getRawValue();
    const result = await this.auth.signInWithPassword(email, password);

    this.submitting.set(false);

    if (!result.ok) {
      this.error.set(result.error);
      return;
    }
    // On success, AuthService.onAuthStateChange handles the navigation to /home
  }

  protected async onForgotPassword(): Promise<void> {
    const email = this.form.controls.email.value.trim();
    if (!email) {
      this.error.set('Enter your email first, then tap Forgot password.');
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    const result = await this.auth.sendPasswordReset(email);
    this.submitting.set(false);
    if (!result.ok) {
      this.error.set(result.error);
      return;
    }
    this.resetSent.set(true);
  }
}

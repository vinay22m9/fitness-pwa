/**
 * DEVELOPMENT environment.
 *
 * Fill these with your Supabase project + Gemini + PostHog dev keys.
 * Do NOT commit real production keys here — those go in environment.prod.ts
 * and are typically overridden via Vercel env vars at build time.
 */
export const environment = {
  production: false,
  appName: 'Fitness Coach',
  appVersion: '0.1.0-dev',

  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_ANON_KEY',

  geminiApiKey: '',           // leave blank until AI Coach module
  geminiModel: 'gemini-1.5-flash',

  posthogKey: '',             // leave blank to disable analytics in dev
  posthogHost: 'https://us.i.posthog.com',

  // Feature flags
  features: {
    aiCoach: false,
    notifications: false,
    customMealPlans: true,
  },
};

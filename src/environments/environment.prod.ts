/**
 * PRODUCTION environment.
 *
 * In Vercel, set these as env vars and inject at build time, OR
 * keep this file in .gitignore and write it on CI before `ng build --prod`.
 */
export const environment = {
  production: true,
  appName: 'Fitness Coach',
  appVersion: '0.1.0',

  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_ANON_KEY',

  geminiApiKey: '',
  geminiModel: 'gemini-1.5-flash',

  posthogKey: '',
  posthogHost: 'https://us.i.posthog.com',

  features: {
    aiCoach: false,
    notifications: false,
    customMealPlans: true,
  },
};

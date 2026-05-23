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

supabaseUrl: 'https://mcegbfqhodeenlcunuab.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZWdiZnFob2RlZW5sY3VudWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MTkwMDksImV4cCI6MjA5NTA5NTAwOX0.3EVUowQC3ijcVRldI0zd7LpIVLdtrYrgGNEiL1eWni4',
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

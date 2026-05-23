# Fitness Coach PWA

A personal fitness, diet, and hydration tracker. Angular 19 PWA, dark-themed,
offline-first, built to run on any phone via a browser install.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Angular 19 (standalone components, signals) |
| Styling | Tailwind CSS 3 with CSS-variable theme tokens |
| PWA | `@angular/service-worker` + manifest |
| Local DB | Dexie (IndexedDB) |
| Backend | Supabase (Auth + Postgres + RLS) |
| AI Coach | Google Gemini API (later phase) |
| Analytics | PostHog (lazy-loaded, optional) |
| Deployment | Vercel |

## Project Structure

```
src/app
├── core/         singletons (services, DB, tokens, guards)
├── shared/       reusable components, utils, pipes, directives
├── models/       interfaces & types (one barrel export)
├── layout/       main-shell (with bottom nav), auth-shell
├── auth/         login (Module 2)
├── dashboard/    home screen
├── workout/      routines, today's workout, exercise logging
├── diet/         targets calculator + meal plan tracker
├── hydration/    water intake
├── progress/     weight log, history, streaks
├── settings/     profile, preferences, about
└── ai-coach/     Gemini-powered suggestions (later)
```

Path aliases: `@core/*`, `@shared/*`, `@models/*`, `@env/*`.

## Getting Started

### 1. Install dependencies

```bash
cd D:\PWA\fitness-pwa
npm install
```

### 2. Configure Supabase

1. Create a project at https://supabase.com (free tier is plenty).
2. Open the SQL editor → run `supabase/migrations/0001_init.sql`.
3. Settings → API → copy:
   - `Project URL` → `supabaseUrl` in `src/environments/environment.ts`
   - `anon public` key → `supabaseAnonKey`
4. Authentication → Providers → enable Google (configure OAuth credentials).

> Production keys go in `environment.prod.ts`. Both files are gitignored by
> default in real workflows — for local dev they're fine to commit.

### 3. Run the app

```bash
npm start
# open http://localhost:4200
```

Bottom nav should appear and all 5 tabs (Home, Workout, Diet, Water, Progress)
should navigate. The dashboard renders a static mock — real data lands in
later modules.

### 4. Build for production

```bash
npm run build:prod
```

Output goes to `dist/fitness-pwa/browser`. Service worker is registered
automatically in prod builds (disabled in dev to avoid caching headaches).

## Deployment (Vercel)

1. Push to GitHub.
2. In Vercel: New Project → import repo.
3. Build settings are auto-detected from `vercel.json`:
   - Build command: `npm run build:prod`
   - Output: `dist/fitness-pwa/browser`
4. Add env vars in Vercel dashboard if you switch to runtime injection.
5. Push to `main` → production; PRs get preview deploys.

## PWA Icons

Place PNG icons in `public/icons/` at the sizes listed in
`public/icons/README.md`. Until you do, the home-screen icon will be blank
but installation will still work.

## Design System

Dark only. Premium fitness aesthetic.

| Token | Value | Role |
|---|---|---|
| `bg` | `#0B0F14` | Page background |
| `surface` | `#111827` | Cards |
| `elevated` | `#1A2332` | Nav, raised surfaces |
| `primary` | `#A3E635` | Lime — workout, protein, primary CTA |
| `accent` | `#22D3EE` | Cyan — diet, carbs |
| `electric` | `#3B82F6` | Blue — water |
| `warning` | `#FBBF24` | Amber — fats |
| `text` | `#F3F4F6` | Off-white |
| `muted` | `#9CA3AF` | Secondary text |

Use Tailwind class names: `bg-bg`, `bg-surface`, `text-primary`, etc.

## Module Roadmap

- [x] **1. Foundation** — shell, nav, theme, PWA setup, models, Dexie schema
- [ ] **2. Auth** — Google sign-in, guard, session restore
- [ ] **3. Sync Engine** — outbox pattern, Dexie ↔ Supabase
- [ ] **4. Profile + Diet Calculator** — BMR/TDEE/macros
- [ ] **5. Workout Module** — routines, today's pick, exercise logging
- [ ] **6. Hydration** — quick-add, daily reset, history
- [ ] **7. Dashboard wire-up** — replace mock with real facades
- [ ] **8. Progress Module** — weight log, charts
- [ ] **9. AI Coach** — Gemini integration
- [ ] **10. Polish** — animations, PostHog events, install prompt

## License

Private — personal use only for now.

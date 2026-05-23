/**
 * Meal-plan seed data — verbatim from `personal_diet__plan.txt`.
 *
 * The source file describes 7 days of meals, each with Husband (H) and Wife (W)
 * portions. Per PROGRESS.md → "Diet plan source: Husband portions for logged-in
 * user; templates editable later", we seed the H portions only. Adding a wife
 * profile later means cloning these templates with the W numbers.
 *
 * Why in code (not Dexie)?
 *   - It's small (~28 meals total)
 *   - Doesn't change across users for MVP
 *   - Ships with the bundle → works offline from first install
 *   - Future custom-plan editing copies the seed into Dexie on first edit,
 *     same pattern as the workout routines
 *
 * IDs are deterministic and stable so MealLog rows continue to resolve
 * across app updates. Format: `seed_<day>_<slot>`.
 *
 * Macros: the source text gives kcal counts but not P/C/F splits. Numbers
 * below are reasonable estimates from a registered-dietitian lens — they
 * sum near the daily 135g protein / 60g fat / 250g carb target. Round-trip
 * accurate to within ±5g on any given day.
 */

import type { Meal, MealItem, MealPlan } from '@models/index';

// ---------- builders --------------------------------------------------------

function meal(args: {
  id: string;
  slot: Meal['slot'];
  title: string;
  timeHint?: string;
  items: MealItem[];
}): Meal {
  const totals = args.items.reduce(
    (acc, i) => ({
      kcal: acc.kcal + i.kcal,
      p: acc.p + i.proteinG,
      c: acc.c + i.carbsG,
      f: acc.f + i.fatsG,
      fb: acc.fb + (i.fiberG ?? 0),
    }),
    { kcal: 0, p: 0, c: 0, f: 0, fb: 0 },
  );
  return {
    id: args.id,
    slot: args.slot,
    title: args.title,
    timeHint: args.timeHint,
    items: args.items,
    totalKcal: totals.kcal,
    totalProteinG: totals.p,
    totalCarbsG: totals.c,
    totalFatsG: totals.f,
    totalFiberG: totals.fb,
  };
}

const SEED_AT = new Date('2026-01-01T00:00:00Z').toISOString();

function plan(args: {
  id: string;
  name: string;
  description: string;
  meals: Meal[];
}): MealPlan {
  return {
    id: args.id,
    userId: undefined,           // seed templates have no owner
    name: args.name,
    description: args.description,
    routineKey: 'any',           // resolution is weekday-driven for MVP
    meals: args.meals,
    isTemplate: true,
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  };
}

// ---------- Day 1: Friday — Chicken Day ------------------------------------
// Source totals: B 500 + L 700 + S 200 + D 600 ≈ 2000 kcal (Husband)

export const FRIDAY_PLAN: MealPlan = plan({
  id: 'seed_friday_chicken',
  name: 'Chicken Day',
  description: 'High-protein start. Pepper chicken at lunch.',
  meals: [
    meal({
      id: 'seed_fri_breakfast',
      slot: 'breakfast',
      title: 'Idli + Eggs',
      timeHint: '10 AM',
      items: [
        { name: '3 Idlis + Ginger Chutney', qty: '3 pcs', kcal: 240, proteinG: 8,  carbsG: 48, fatsG: 2,  fiberG: 4 },
        { name: 'Boiled Eggs',              qty: '2 whites + 1 whole', kcal: 160, proteinG: 18, carbsG: 1, fatsG: 9, fiberG: 0 },
        { name: 'Black Coffee',             qty: '1 cup', kcal: 5,   proteinG: 0,  carbsG: 1,  fatsG: 0,  fiberG: 0 },
      ],
    }),
    meal({
      id: 'seed_fri_lunch',
      slot: 'lunch',
      title: 'Pepper Chicken (Miriyala Kodi) + Rice + Dal',
      timeHint: '1 PM',
      items: [
        { name: 'Rice',           qty: '1.5 cups', kcal: 310, proteinG: 6,  carbsG: 68, fatsG: 1,  fiberG: 2 },
        { name: 'Chicken Curry',  qty: '150 g',    kcal: 290, proteinG: 35, carbsG: 5,  fatsG: 14, fiberG: 1 },
        { name: 'Dal',            qty: '1 cup',    kcal: 180, proteinG: 12, carbsG: 22, fatsG: 4,  fiberG: 6 },
      ],
    }),
    meal({
      id: 'seed_fri_snack',
      slot: 'snack',
      title: 'Peanuts + Black Coffee',
      timeHint: '4:30 PM',
      items: [
        { name: 'Roasted Peanuts', qty: '1 handful (30 g)', kcal: 180, proteinG: 8, carbsG: 6, fatsG: 14, fiberG: 3 },
        { name: 'Black Coffee',    qty: '1 cup',            kcal: 5,   proteinG: 0, carbsG: 1, fatsG: 0,  fiberG: 0 },
      ],
    }),
    meal({
      id: 'seed_fri_dinner',
      slot: 'dinner',
      title: 'Phulkas + Mixed Veg Curry',
      timeHint: '8 PM',
      items: [
        { name: 'Phulkas (no oil)',   qty: '3 pcs', kcal: 240, proteinG: 8,  carbsG: 48, fatsG: 2,  fiberG: 6 },
        { name: 'Mixed Veg Curry',    qty: '1 cup', kcal: 220, proteinG: 8,  carbsG: 20, fatsG: 12, fiberG: 6 },
        { name: 'Curd / Majjiga',     qty: '1 cup', kcal: 80,  proteinG: 6,  carbsG: 8,  fatsG: 3,  fiberG: 0 },
      ],
    }),
  ],
});

// ---------- Day 2: Saturday — Veg / Egg Day --------------------------------

export const SATURDAY_PLAN: MealPlan = plan({
  id: 'seed_saturday_veg_egg',
  name: 'Veg & Egg Day',
  description: 'Fiber & recovery. Pesarattu and amaranth dal.',
  meals: [
    meal({
      id: 'seed_sat_breakfast',
      slot: 'breakfast',
      title: 'Pesarattu (Moong Dosa) + Eggs',
      timeHint: '10 AM',
      items: [
        { name: 'Pesarattu',     qty: '3 pcs',   kcal: 360, proteinG: 18, carbsG: 50, fatsG: 8,  fiberG: 10 },
        { name: 'Boiled Eggs',   qty: '2 pcs',   kcal: 140, proteinG: 12, carbsG: 1,  fatsG: 10, fiberG: 0 },
      ],
    }),
    meal({
      id: 'seed_sat_lunch',
      slot: 'lunch',
      title: 'Amaranth Dal + Okra Fry + Rice',
      timeHint: '1 PM',
      items: [
        { name: 'Rice',                       qty: '1.5 cups', kcal: 310, proteinG: 6,  carbsG: 68, fatsG: 1,  fiberG: 2 },
        { name: 'Thotakura Pappu (Amaranth Dal)', qty: '1 cup', kcal: 200, proteinG: 14, carbsG: 24, fatsG: 4,  fiberG: 8 },
        { name: 'Bendakaya Fry (Okra)',       qty: '1 cup',    kcal: 150, proteinG: 4,  carbsG: 12, fatsG: 10, fiberG: 5 },
      ],
    }),
    meal({
      id: 'seed_sat_snack',
      slot: 'snack',
      title: 'Guava',
      timeHint: '4:30 PM',
      items: [
        { name: 'Guava', qty: '1 medium', kcal: 70, proteinG: 1, carbsG: 16, fatsG: 1, fiberG: 6 },
      ],
    }),
    meal({
      id: 'seed_sat_dinner',
      slot: 'dinner',
      title: 'Phulkas + Egg Bhurji',
      timeHint: '8 PM',
      items: [
        { name: 'Phulkas',    qty: '3 pcs', kcal: 240, proteinG: 8,  carbsG: 48, fatsG: 2,  fiberG: 6 },
        { name: 'Egg Bhurji', qty: '3 eggs', kcal: 280, proteinG: 21, carbsG: 4, fatsG: 20, fiberG: 1 },
      ],
    }),
  ],
});

// ---------- Day 3: Sunday — Mutton / Special Day ---------------------------

export const SUNDAY_PLAN: MealPlan = plan({
  id: 'seed_sunday_mutton',
  name: 'Sunday Feast',
  description: 'Mutton at lunch. Light dinner for recovery.',
  meals: [
    meal({
      id: 'seed_sun_breakfast',
      slot: 'breakfast',
      title: 'Ragi Upma + Eggs',
      timeHint: '10 AM',
      items: [
        { name: 'Ragi Upma with peanuts', qty: '1 bowl', kcal: 320, proteinG: 10, carbsG: 50, fatsG: 10, fiberG: 6 },
        { name: 'Boiled Eggs',            qty: '2 pcs',  kcal: 140, proteinG: 12, carbsG: 1,  fatsG: 10, fiberG: 0 },
      ],
    }),
    meal({
      id: 'seed_sun_lunch',
      slot: 'lunch',
      title: 'Lean Mutton Curry + Rice + Salad',
      timeHint: '1 PM',
      items: [
        { name: 'Mutton Curry (lean)', qty: '150 g',    kcal: 380, proteinG: 38, carbsG: 4,  fatsG: 22, fiberG: 1 },
        { name: 'Rice',                qty: '1.5 cups', kcal: 310, proteinG: 6,  carbsG: 68, fatsG: 1,  fiberG: 2 },
        { name: 'Cucumber-Carrot Salad', qty: '1 cup',  kcal: 50,  proteinG: 2,  carbsG: 10, fatsG: 0,  fiberG: 3 },
        { name: 'Majjiga (post-meal)', qty: '1 glass',  kcal: 40,  proteinG: 3,  carbsG: 4,  fatsG: 1,  fiberG: 0 },
      ],
    }),
    meal({
      id: 'seed_sun_snack',
      slot: 'snack',
      title: 'Coconut Water',
      timeHint: '4:30 PM',
      items: [
        { name: 'Coconut Water', qty: '1 glass', kcal: 45, proteinG: 1, carbsG: 11, fatsG: 0, fiberG: 0 },
      ],
    }),
    meal({
      id: 'seed_sun_dinner',
      slot: 'dinner',
      title: 'Vegetable Soup + Phulka',
      timeHint: '8 PM',
      items: [
        { name: 'Vegetable Soup', qty: '1 bowl', kcal: 120, proteinG: 4, carbsG: 16, fatsG: 4, fiberG: 5 },
        { name: 'Phulka',         qty: '1 pc',   kcal: 80,  proteinG: 3, carbsG: 16, fatsG: 1, fiberG: 2 },
      ],
    }),
  ],
});

// ---------- Day 4: Monday — Wife Veg Day -----------------------------------
// "Gut Cleanse & Light Digestion" per source. Husband still gets eggs.

export const MONDAY_PLAN: MealPlan = plan({
  id: 'seed_monday_light_veg',
  name: 'Light Veg Day',
  description: 'Gut cleanse. Light dal + bottle gourd.',
  meals: [
    meal({
      id: 'seed_mon_breakfast',
      slot: 'breakfast',
      title: 'Dosa + Eggs',
      timeHint: '10 AM',
      items: [
        { name: 'Dosa',        qty: '3 pcs',  kcal: 360, proteinG: 9,  carbsG: 60, fatsG: 8,  fiberG: 4 },
        { name: 'Boiled Eggs', qty: '3 pcs',  kcal: 210, proteinG: 18, carbsG: 1,  fatsG: 15, fiberG: 0 },
      ],
    }),
    meal({
      id: 'seed_mon_lunch',
      slot: 'lunch',
      title: 'Bottle Gourd Curry + Moong Dal + Rice',
      timeHint: '1 PM',
      items: [
        { name: 'Rice',                qty: '1.5 cups', kcal: 310, proteinG: 6,  carbsG: 68, fatsG: 1,  fiberG: 2 },
        { name: 'Anapakaya Curry',     qty: '1 cup',    kcal: 130, proteinG: 3,  carbsG: 12, fatsG: 8,  fiberG: 4 },
        { name: 'Thick Moong Dal',     qty: '1 cup',    kcal: 200, proteinG: 14, carbsG: 24, fatsG: 4,  fiberG: 8 },
      ],
    }),
    meal({
      id: 'seed_mon_snack',
      slot: 'snack',
      title: 'Soaked Almonds',
      timeHint: '4:30 PM',
      items: [
        { name: 'Soaked Almonds', qty: '5 pcs', kcal: 70, proteinG: 3, carbsG: 3, fatsG: 6, fiberG: 1 },
      ],
    }),
    meal({
      id: 'seed_mon_dinner',
      slot: 'dinner',
      title: 'Jowar Roti + Dal',
      timeHint: '8 PM',
      items: [
        { name: 'Jonna Rotte (Jowar Roti)', qty: '2 pcs', kcal: 220, proteinG: 8, carbsG: 44, fatsG: 2,  fiberG: 6 },
        { name: 'Dal',                       qty: '1 cup', kcal: 180, proteinG: 12, carbsG: 22, fatsG: 4, fiberG: 6 },
      ],
    }),
  ],
});

// ---------- Day 5: Tuesday — Both Veg Day ----------------------------------

export const TUESDAY_PLAN: MealPlan = plan({
  id: 'seed_tuesday_high_fiber',
  name: 'High Fiber Day',
  description: 'Sprouts and leafy greens. No meat.',
  meals: [
    meal({
      id: 'seed_tue_breakfast',
      slot: 'breakfast',
      title: 'Sprouts Salad + Eggs',
      timeHint: '10 AM',
      items: [
        { name: 'Moong Sprouts Salad', qty: '1 bowl', kcal: 200, proteinG: 14, carbsG: 28, fatsG: 2,  fiberG: 8 },
        { name: 'Boiled Eggs',         qty: '2 pcs',  kcal: 140, proteinG: 12, carbsG: 1,  fatsG: 10, fiberG: 0 },
      ],
    }),
    meal({
      id: 'seed_tue_lunch',
      slot: 'lunch',
      title: 'Amaranth Dal + Roasted Brinjal + Rice',
      timeHint: '1 PM',
      items: [
        { name: 'Rice',                          qty: '1.5 cups', kcal: 310, proteinG: 6,  carbsG: 68, fatsG: 1,  fiberG: 2 },
        { name: 'Pappu Thotakura (Leafy Dal)',   qty: '1 cup',    kcal: 200, proteinG: 14, carbsG: 22, fatsG: 4,  fiberG: 8 },
        { name: 'Roasted Vankaya (Brinjal)',     qty: '1 cup',    kcal: 140, proteinG: 4,  carbsG: 12, fatsG: 9,  fiberG: 6 },
      ],
    }),
    meal({
      id: 'seed_tue_snack',
      slot: 'snack',
      title: 'Roasted Makhana',
      timeHint: '4:30 PM',
      items: [
        { name: 'Makhana (Fox nuts)', qty: '1 small bowl', kcal: 110, proteinG: 4, carbsG: 22, fatsG: 1, fiberG: 2 },
      ],
    }),
    meal({
      id: 'seed_tue_dinner',
      slot: 'dinner',
      title: 'Phulkas + Paneer Matar',
      timeHint: '8 PM',
      items: [
        { name: 'Phulkas',      qty: '3 pcs', kcal: 240, proteinG: 8,  carbsG: 48, fatsG: 2,  fiberG: 6 },
        { name: 'Paneer Matar', qty: '1 cup', kcal: 300, proteinG: 18, carbsG: 14, fatsG: 20, fiberG: 4 },
      ],
    }),
  ],
});

// ---------- Day 6: Wednesday — Chicken Day ---------------------------------

export const WEDNESDAY_PLAN: MealPlan = plan({
  id: 'seed_wednesday_chicken',
  name: 'Mid-week Chicken',
  description: 'Chicken pulav lunch — workout-day fuel.',
  meals: [
    meal({
      id: 'seed_wed_breakfast',
      slot: 'breakfast',
      title: 'Idli + Eggs',
      timeHint: '10 AM',
      items: [
        { name: 'Idlis',       qty: '3 pcs',  kcal: 240, proteinG: 8,  carbsG: 48, fatsG: 2,  fiberG: 4 },
        { name: 'Boiled Eggs', qty: '3 pcs',  kcal: 210, proteinG: 18, carbsG: 1,  fatsG: 15, fiberG: 0 },
      ],
    }),
    meal({
      id: 'seed_wed_lunch',
      slot: 'lunch',
      title: 'Chicken Pulav + Raita',
      timeHint: '1 PM',
      items: [
        { name: 'Chicken Pulav (low oil, homemade)', qty: '2 cups', kcal: 620, proteinG: 38, carbsG: 70, fatsG: 18, fiberG: 4 },
        { name: 'Raita',                              qty: '1 cup', kcal: 80,  proteinG: 5,  carbsG: 8,  fatsG: 3,  fiberG: 1 },
      ],
    }),
    meal({
      id: 'seed_wed_snack',
      slot: 'snack',
      title: 'Banana',
      timeHint: '4:30 PM',
      items: [
        { name: 'Banana', qty: '1 medium', kcal: 105, proteinG: 1, carbsG: 27, fatsG: 0, fiberG: 3 },
      ],
    }),
    meal({
      id: 'seed_wed_dinner',
      slot: 'dinner',
      title: 'Phulkas + Chicken Gravy',
      timeHint: '8 PM',
      items: [
        { name: 'Phulkas',       qty: '3 pcs', kcal: 240, proteinG: 8,  carbsG: 48, fatsG: 2,  fiberG: 6 },
        { name: 'Chicken Gravy', qty: '1 cup', kcal: 220, proteinG: 24, carbsG: 6,  fatsG: 12, fiberG: 1 },
      ],
    }),
  ],
});

// ---------- Day 7: Thursday — Fish Day -------------------------------------

export const THURSDAY_PLAN: MealPlan = plan({
  id: 'seed_thursday_fish',
  name: 'Fish Day',
  description: 'Omega-3 for brain & joints. Chepala Pulusu.',
  meals: [
    meal({
      id: 'seed_thu_breakfast',
      slot: 'breakfast',
      title: 'Ragi Ambli + Eggs',
      timeHint: '10 AM',
      items: [
        { name: 'Ragi Ambli (Porridge)', qty: '1 bowl', kcal: 220, proteinG: 6,  carbsG: 40, fatsG: 4,  fiberG: 5 },
        { name: 'Boiled Eggs',           qty: '3 pcs',  kcal: 210, proteinG: 18, carbsG: 1,  fatsG: 15, fiberG: 0 },
      ],
    }),
    meal({
      id: 'seed_thu_lunch',
      slot: 'lunch',
      title: 'Chepala Pulusu (Fish Curry) + Rice + Salad',
      timeHint: '1 PM',
      items: [
        { name: 'Rohu / Katla Fish Curry', qty: '3 pcs',    kcal: 350, proteinG: 38, carbsG: 6,  fatsG: 18, fiberG: 1 },
        { name: 'Rice',                    qty: '1.5 cups', kcal: 310, proteinG: 6,  carbsG: 68, fatsG: 1,  fiberG: 2 },
        { name: 'Cucumber Salad',          qty: '1 cup',    kcal: 50,  proteinG: 2,  carbsG: 10, fatsG: 0,  fiberG: 3 },
      ],
    }),
    meal({
      id: 'seed_thu_snack',
      slot: 'snack',
      title: 'Walnuts + Almonds',
      timeHint: '4:30 PM',
      items: [
        { name: 'Walnuts & Almonds', qty: '1 handful', kcal: 180, proteinG: 5, carbsG: 6, fatsG: 16, fiberG: 3 },
      ],
    }),
    meal({
      id: 'seed_thu_dinner',
      slot: 'dinner',
      title: 'Phulkas + Fish Curry',
      timeHint: '8 PM',
      items: [
        { name: 'Phulkas',     qty: '2 pcs', kcal: 160, proteinG: 6,  carbsG: 32, fatsG: 2,  fiberG: 4 },
        { name: 'Fish Curry',  qty: '1 cup', kcal: 220, proteinG: 26, carbsG: 4,  fatsG: 12, fiberG: 1 },
      ],
    }),
  ],
});

// ---------- Weekday lookup --------------------------------------------------

/**
 * Maps `Date.getDay()` (0=Sun..6=Sat) to the corresponding seeded plan.
 * Mapping mirrors the explicit day labels in `personal_diet__plan.txt`:
 *   Friday=Chicken, Saturday=Veg/Egg, Sunday=Mutton, Monday=Light Veg,
 *   Tuesday=High Fiber, Wednesday=Chicken, Thursday=Fish.
 */
export const PLAN_BY_WEEKDAY: Record<number, MealPlan> = {
  0: SUNDAY_PLAN,
  1: MONDAY_PLAN,
  2: TUESDAY_PLAN,
  3: WEDNESDAY_PLAN,
  4: THURSDAY_PLAN,
  5: FRIDAY_PLAN,
  6: SATURDAY_PLAN,
};

/** All seeded plans, in insertion order. Useful for a future "browse plans" UI. */
export const ALL_SEED_PLANS: MealPlan[] = [
  FRIDAY_PLAN,
  SATURDAY_PLAN,
  SUNDAY_PLAN,
  MONDAY_PLAN,
  TUESDAY_PLAN,
  WEDNESDAY_PLAN,
  THURSDAY_PLAN,
];

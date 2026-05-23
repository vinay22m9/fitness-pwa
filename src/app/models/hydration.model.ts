export interface HydrationEntry {
  ml: number;
  at: string;               // ISO timestamp
}

export interface HydrationLog {
  id: string;               // `${userId}_${date}`
  userId: string;
  date: string;             // YYYY-MM-DD (local)
  goalMl: number;           // snapshot of goal at start of day (may differ on workout days)
  totalMl: number;
  entries: HydrationEntry[];
  syncedAt?: string;
}

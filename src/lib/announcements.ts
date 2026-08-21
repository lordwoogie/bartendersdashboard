// Dashboard announcement pop-up ("Trivia is cancelled…"), managed from
// /admin instead of code so posting one needs no deploy. One announcement at
// a time — that's all the venue has ever needed.

export interface Announcement {
  // Snooze keys on this id, so the server issues a fresh id whenever the
  // message text changes — everyone sees the new message even if they
  // dismissed the old one.
  id: string;
  message: string;
  lastDay: string; // YYYY-MM-DD, venue time — hidden after this day ends
  enabled: boolean;
  updatedAt: string;
}

export function isValidDay(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

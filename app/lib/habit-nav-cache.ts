import type { Habit } from '@/lib/habits';

let cached: Habit | null = null;

export function setNavHabit(h: Habit): void {
  cached = h;
}

export function consumeNavHabit(): Habit | null {
  const h = cached;
  cached = null;
  return h;
}

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import {
  buildRrule,
  parseRrule,
  type RecurrenceState,
} from './recurrence';
import type {
  FlexPeriod,
  Habit,
  HabitInsert,
  Visibility,
} from './habits';

export type HabitDraft = {
  title: string;
  description: string;
  kind: 'scheduled' | 'flex';
  recurrence: RecurrenceState;
  startsOn: Date;
  endsOn: Date | null;
  targetCount: number;
  targetPeriod: FlexPeriod;
  color: string;
  icon: string;
  visibility: Visibility;
};

export function defaultDraft(defaultVisibility: Visibility = 'public'): HabitDraft {
  return {
    title: '',
    description: '',
    kind: 'scheduled',
    recurrence: { pattern: 'daily', byDays: ['MO', 'WE', 'FR'], interval: 2 },
    startsOn: new Date(),
    endsOn: null,
    targetCount: 3,
    targetPeriod: 'week',
    color: '#7c3aed',
    icon: '✨',
    visibility: defaultVisibility,
  };
}

export function habitToDraft(habit: Habit): HabitDraft {
  if (habit.kind === 'scheduled') {
    const dtstart = habit.dtstart ? new Date(habit.dtstart) : new Date();
    return {
      title: habit.title,
      description: habit.description ?? '',
      kind: 'scheduled',
      recurrence: parseRrule(habit.rrule ?? 'FREQ=DAILY'),
      startsOn: dtstart,
      endsOn: habit.until ? new Date(habit.until) : null,
      targetCount: 3,
      targetPeriod: 'week',
      color: habit.color ?? '#7c3aed',
      icon: habit.icon ?? '✨',
      visibility: habit.visibility,
    };
  }
  return {
    title: habit.title,
    description: habit.description ?? '',
    kind: 'flex',
    recurrence: { pattern: 'daily', byDays: [], interval: 1 },
    startsOn: new Date(),
    endsOn: null,
    targetCount: habit.target_count ?? 3,
    targetPeriod: habit.target_period ?? 'week',
    color: habit.color ?? '#7c3aed',
    icon: habit.icon ?? '✨',
    visibility: habit.visibility,
  };
}

// Convert a draft into the DB row shape. The caller decides whether to use
// this for INSERT (new habit) or UPDATE (edit-all scope).
export function draftToInsert(draft: HabitDraft): HabitInsert {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const description = draft.description.trim() || null;
  if (draft.kind === 'scheduled') {
    // No user-facing time-of-day; dtstart is the start date at local midnight.
    const dtstart = new Date(draft.startsOn);
    dtstart.setHours(0, 0, 0, 0);
    return {
      title: draft.title.trim(),
      description,
      kind: 'scheduled',
      icon: draft.icon,
      color: draft.color,
      visibility: draft.visibility,
      timezone: tz,
      dtstart: dtstart.toISOString(),
      rrule: buildRrule(draft.recurrence),
      until: draft.endsOn?.toISOString() ?? null,
    };
  }
  return {
    title: draft.title.trim(),
    description,
    kind: 'flex',
    icon: draft.icon,
    color: draft.color,
    visibility: draft.visibility,
    timezone: tz,
    target_count: draft.targetCount,
    target_period: draft.targetPeriod,
  };
}

type Ctx = {
  draft: HabitDraft;
  update: (patch: Partial<HabitDraft>) => void;
  reset: () => void;
  seedFromHabit: (habit: Habit) => void;
};

const HabitFormContext = createContext<Ctx | null>(null);

export function HabitFormProvider({
  children,
  defaultVisibility = 'public',
}: {
  children: ReactNode;
  defaultVisibility?: Visibility;
}) {
  const [draft, setDraft] = useState<HabitDraft>(() => defaultDraft(defaultVisibility));
  const defaultVisRef = useRef(defaultVisibility);

  useEffect(() => {
    defaultVisRef.current = defaultVisibility;
    // Apply to a fresh (untitled) draft when the profile preference loads.
    setDraft((prev) =>
      prev.title === '' ? { ...prev, visibility: defaultVisibility } : prev,
    );
  }, [defaultVisibility]);

  return (
    <HabitFormContext.Provider
      value={{
        draft,
        update: (patch) => setDraft((s) => ({ ...s, ...patch })),
        reset: () => setDraft(defaultDraft(defaultVisRef.current)),
        seedFromHabit: (habit) => setDraft(habitToDraft(habit)),
      }}>
      {children}
    </HabitFormContext.Provider>
  );
}

export function useHabitForm() {
  const ctx = useContext(HabitFormContext);
  if (!ctx) throw new Error('useHabitForm must be used inside HabitFormProvider');
  return ctx;
}

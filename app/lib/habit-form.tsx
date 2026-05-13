import { createContext, useContext, useState, type ReactNode } from 'react';

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
  kind: 'scheduled' | 'flex';
  time: Date;
  recurrence: RecurrenceState;
  startsOn: Date;
  endsOn: Date | null;
  targetCount: number;
  targetPeriod: FlexPeriod;
  color: string;
  icon: string;
  visibility: Visibility;
};

function defaultTime(): Date {
  const t = new Date();
  t.setSeconds(0, 0);
  const minutes = t.getMinutes();
  t.setMinutes(minutes - (minutes % 15) + 15);
  return t;
}

function defaultDraft(): HabitDraft {
  return {
    title: '',
    kind: 'scheduled',
    time: defaultTime(),
    recurrence: { pattern: 'daily', byDays: ['MO', 'WE', 'FR'], interval: 2 },
    startsOn: new Date(),
    endsOn: null,
    targetCount: 3,
    targetPeriod: 'week',
    color: '#7c3aed',
    icon: '✨',
    visibility: 'private',
  };
}

export function habitToDraft(habit: Habit): HabitDraft {
  if (habit.kind === 'scheduled') {
    const dtstart = habit.dtstart ? new Date(habit.dtstart) : new Date();
    return {
      title: habit.title,
      kind: 'scheduled',
      time: dtstart,
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
    kind: 'flex',
    time: defaultTime(),
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
  if (draft.kind === 'scheduled') {
    const dtstart = new Date(draft.startsOn);
    dtstart.setHours(draft.time.getHours(), draft.time.getMinutes(), 0, 0);
    return {
      title: draft.title.trim(),
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

export function HabitFormProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<HabitDraft>(defaultDraft);

  const update = (patch: Partial<HabitDraft>) =>
    setDraft((s) => ({ ...s, ...patch }));

  return (
    <HabitFormContext.Provider
      value={{
        draft,
        update,
        reset: () => setDraft(defaultDraft()),
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

import { createContext, useContext, useState, type ReactNode } from 'react';

import { Palette } from '@/constants/colors';

import { normalizeAlertTimes } from './alerts';
import {
  buildRrule,
  describeRrule,
  parseRrule,
  type RecurrenceState,
} from './recurrence';
import type {
  FlexPeriod,
  Habit,
  HabitInsert,
  HabitUnit,
  TimeDisplayUnit,
  Visibility,
} from './habits';
import { secondsFromInput, inputFromSeconds } from './time-format';
import { describeAmount, normalizeCountUnit, type CountUnit } from './units';

export type HabitDraft = {
  title: string;
  description: string;
  kind: 'scheduled' | 'flex';
  recurrence: RecurrenceState;
  startsOn: Date;
  endsOn: Date | null;
  targetCount: number;
  targetPeriod: FlexPeriod;
  unit: HabitUnit;
  countUnit: CountUnit;
  targetValue: number;
  displayUnit: TimeDisplayUnit;
  color: string;
  icon: string;
  visibility: Visibility;
  // Reminder notification times ("HH:MM" 24h, device-local). See lib/alerts.ts.
  alertTimes: string[];
  adoptedFromUserId: string | null;
  // Active group (membership lives in habit_group_members, not on the habit row).
  // null = ungrouped. On edit, seeded by the screen from the active membership;
  // reconciled to a membership write on save (see planGroupChange).
  groupId: string | null;
};

function defaultDraft(): HabitDraft {
  return {
    title: '',
    description: '',
    kind: 'scheduled',
    recurrence: { pattern: 'daily', byDays: ['MO', 'WE', 'FR'], interval: 2 },
    startsOn: new Date(),
    endsOn: null,
    targetCount: 1,
    targetPeriod: 'week',
    unit: 'count',
    countUnit: 'count',
    targetValue: 1,
    displayUnit: 'minutes',
    color: Palette.primary,
    icon: '',
    visibility: 'private',
    alertTimes: [],
    adoptedFromUserId: null,
    groupId: null,
  };
}

export function habitToDraft(habit: Habit): HabitDraft {
  const unitFields = {
    unit: habit.unit ?? 'count' as HabitUnit,
    countUnit: normalizeCountUnit(habit.count_unit),
    targetValue: habit.target_seconds
      ? inputFromSeconds(habit.target_seconds, habit.display_unit ?? 'minutes')
      : 1,
    displayUnit: habit.display_unit ?? 'minutes' as TimeDisplayUnit,
  };

  if (habit.kind === 'scheduled') {
    const dtstart = habit.dtstart ? new Date(habit.dtstart) : new Date();
    return {
      title: habit.title,
      description: habit.description ?? '',
      kind: 'scheduled',
      recurrence: parseRrule(habit.rrule ?? 'FREQ=DAILY'),
      startsOn: dtstart,
      endsOn: habit.until ? new Date(habit.until) : null,
      targetCount: 1,
      targetPeriod: 'week',
      ...unitFields,
      color: habit.color ?? Palette.primary,
      icon: habit.icon ?? '',
      visibility: habit.visibility,
      alertTimes: habit.alert_times ?? [],
      adoptedFromUserId: null,
      groupId: null,
    };
  }
  return {
    title: habit.title,
    description: habit.description ?? '',
    kind: 'flex',
    recurrence: { pattern: 'daily', byDays: [], interval: 1 },
    startsOn: new Date(),
    endsOn: null,
    targetCount: habit.target_count ?? 1,
    targetPeriod: habit.target_period ?? 'week',
    ...unitFields,
    color: habit.color ?? Palette.primary,
    icon: habit.icon ?? '✨',
    visibility: habit.visibility,
    alertTimes: habit.alert_times ?? [],
    adoptedFromUserId: null,
    groupId: null,
  };
}

// Convert a draft into the DB row shape. The caller decides whether to use
// this for INSERT (new habit) or UPDATE (edit-all scope).
export function draftToInsert(draft: HabitDraft): HabitInsert {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const description = draft.description.trim() || null;

  const timeFields = draft.unit === 'time'
    ? {
        unit: 'time' as const,
        target_seconds: secondsFromInput(draft.targetValue, draft.displayUnit),
        display_unit: draft.displayUnit,
      }
    : { unit: 'count' as const, count_unit: draft.countUnit };

  const adoptionFields = draft.adoptedFromUserId
    ? { adopted_from_user_id: draft.adoptedFromUserId }
    : {};

  if (draft.kind === 'scheduled') {
    const dtstart = new Date(draft.startsOn);
    dtstart.setHours(0, 0, 0, 0);
    return {
      title: draft.title.trim(),
      description,
      kind: 'scheduled',
      icon: draft.icon,
      color: draft.color,
      visibility: draft.visibility,
      alert_times: normalizeAlertTimes(draft.alertTimes),
      timezone: tz,
      dtstart: dtstart.toISOString(),
      rrule: buildRrule(draft.recurrence),
      until: draft.endsOn?.toISOString() ?? null,
      ...timeFields,
      ...adoptionFields,
    };
  }
  return {
    title: draft.title.trim(),
    description,
    kind: 'flex',
    icon: draft.icon,
    color: draft.color,
    visibility: draft.visibility,
    alert_times: normalizeAlertTimes(draft.alertTimes),
    timezone: tz,
    target_count: draft.targetCount,
    target_period: draft.targetPeriod,
    ...timeFields,
    ...adoptionFields,
  };
}

// Short summaries for the iOS-style menu rows on the habit form.

export function describeGoal(draft: HabitDraft): string {
  if (draft.unit === 'time') {
    const n = draft.targetValue;
    const singular = draft.displayUnit.slice(0, -1); // 'minute' | 'hour' | 'second'
    return `${n} ${n === 1 ? singular : draft.displayUnit}`;
  }
  return describeAmount(draft.targetCount, draft.countUnit);
}

export function describeRepeat(draft: HabitDraft): string {
  if (draft.kind === 'flex') return `Per ${draft.targetPeriod}`;
  return describeRrule(draft.recurrence);
}

export function describeVisibility(v: Visibility): string {
  return v === 'public' ? 'Public' : v === 'friends' ? 'Friends' : 'Private';
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

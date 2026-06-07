import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Habit } from './habits';
import {
  checkAndAutoComplete,
  fetchTimeEntries,
  startTimeEntry,
  stopTimeEntry,
  sumDurationSeconds,
} from './time-entries';

export type StopwatchStatus = 'idle' | 'running' | 'complete';

export type StopwatchState = {
  status: StopwatchStatus;
  elapsedSeconds: number;
  totalSeconds: number;
  targetSeconds: number;
  progressFraction: number;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

type PersistedTimer = { entryId: string; startedAt: string };

function timerKey(habitId: string, date: string): string {
  return `timer:${habitId}:${date}`;
}

export function useStopwatch(
  habitId: string,
  ownerId: string,
  habit: Habit,
  occurrenceDate: string | null,
  periodStart: string | null,
  isAlreadyComplete: boolean,
): StopwatchState {
  const targetSeconds = habit.target_seconds ?? 0;
  const dateKey = occurrenceDate ?? periodStart ?? '';

  const [status, setStatus] = useState<StopwatchStatus>(
    isAlreadyComplete ? 'complete' : 'idle',
  );
  const [elapsedSeconds, setElapsed] = useState(0);
  const [totalSeconds, setTotal] = useState(0);

  const timerRef = useRef<PersistedTimer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTick = useCallback((startedAt: string) => {
    clearTick();
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const started = new Date(startedAt).getTime();
      setElapsed(Math.floor((now - started) / 1000));
    }, 1000);
  }, [clearTick]);

  useEffect(() => {
    let mounted = true;
    async function restore() {
      const key = timerKey(habitId, dateKey);
      const stored = await AsyncStorage.getItem(key);
      if (!mounted) return;

      const entries = await fetchTimeEntries(habitId, occurrenceDate, periodStart);
      if (!mounted) return;

      const priorTotal = sumDurationSeconds(
        entries.filter((e) => e.ended_at != null),
      );
      setTotal(priorTotal);

      if (stored) {
        const persisted: PersistedTimer = JSON.parse(stored);
        timerRef.current = persisted;
        const now = Date.now();
        const started = new Date(persisted.startedAt).getTime();
        setElapsed(Math.floor((now - started) / 1000));
        setStatus('running');
        startTick(persisted.startedAt);
      } else if (isAlreadyComplete || priorTotal >= targetSeconds) {
        setStatus('complete');
      }
    }
    restore();
    return () => { mounted = false; clearTick(); };
  }, [habitId, dateKey, occurrenceDate, periodStart, targetSeconds, isAlreadyComplete, startTick, clearTick]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && timerRef.current) {
        const now = Date.now();
        const started = new Date(timerRef.current.startedAt).getTime();
        setElapsed(Math.floor((now - started) / 1000));
      }
    });
    return () => sub.remove();
  }, []);

  const start = useCallback(async () => {
    const { id, startedAt } = await startTimeEntry(
      habitId, ownerId, occurrenceDate, periodStart,
    );
    const persisted: PersistedTimer = { entryId: id, startedAt };
    timerRef.current = persisted;
    await AsyncStorage.setItem(timerKey(habitId, dateKey), JSON.stringify(persisted));
    setElapsed(0);
    setStatus('running');
    startTick(startedAt);
  }, [habitId, ownerId, occurrenceDate, periodStart, dateKey, startTick]);

  const stop = useCallback(async () => {
    clearTick();
    const persisted = timerRef.current;
    if (!persisted) return;

    const duration = await stopTimeEntry(persisted.entryId, persisted.startedAt);
    timerRef.current = null;
    await AsyncStorage.removeItem(timerKey(habitId, dateKey));

    const newTotal = totalSeconds + duration;
    setTotal(newTotal);
    setElapsed(0);

    const completed = await checkAndAutoComplete(
      habitId, ownerId, habit, occurrenceDate, periodStart,
    );
    setStatus(completed || newTotal >= targetSeconds ? 'complete' : 'idle');
  }, [habitId, ownerId, habit, occurrenceDate, periodStart, dateKey, totalSeconds, targetSeconds, clearTick]);

  const combinedTotal = status === 'running' ? totalSeconds + elapsedSeconds : totalSeconds;
  const fraction = targetSeconds > 0 ? Math.min(1, combinedTotal / targetSeconds) : 0;

  return {
    status,
    elapsedSeconds,
    totalSeconds: combinedTotal,
    targetSeconds,
    progressFraction: fraction,
    start,
    stop,
  };
}

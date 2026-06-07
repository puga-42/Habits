import type { TimeDisplayUnit } from './habits';

const MULTIPLIERS: Record<TimeDisplayUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
};

export function secondsFromInput(value: number, displayUnit: TimeDisplayUnit): number {
  return Math.round(value * MULTIPLIERS[displayUnit]);
}

export function inputFromSeconds(seconds: number, displayUnit: TimeDisplayUnit): number {
  return seconds / MULTIPLIERS[displayUnit];
}

export function formatElapsed(totalSeconds: number, displayUnit: TimeDisplayUnit): string {
  const s = Math.floor(totalSeconds);
  if (displayUnit === 'hours') {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${pad(m)}:${pad(sec)}`;
  }
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${pad(sec)}`;
}

export function formatTarget(targetSeconds: number, displayUnit: TimeDisplayUnit): string {
  const value = targetSeconds / MULTIPLIERS[displayUnit];
  const label = displayUnit === 'seconds' ? 'sec' : displayUnit === 'minutes' ? 'min' : 'hr';
  const display = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  return `${display} ${label}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

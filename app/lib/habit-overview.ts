import { supabase } from './supabase';
import { isoDate, weekStart, type FlexPeriod } from './habits';
import type { AttachmentDetail, ValidationError } from './completions';

// ─── Types ──────────────────────────────────────────────────────────────────

export type OverviewCompletion = {
  id: string;
  habit_id: string;
  owner_id: string;
  occurrence_date: string | null;
  period_start: string | null;
  completed_at: string;
  note: string | null;
  visibility_override: string | null;
  attachments: AttachmentDetail[];
};

// ─── Pure helpers ───────────────────────────────────────────────────────────

export function currentPeriodStart(
  dateIso: string,
  period: FlexPeriod,
): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  switch (period) {
    case 'day':
      return dateIso;
    case 'week':
      return isoDate(weekStart(date));
    case 'month':
      return `${y}-${String(m).padStart(2, '0')}-01`;
  }
}

export function resolveEffectiveNote(
  pendingNotes: Map<string, string | null>,
  completion: { id: string; note: string | null },
): string | null {
  if (pendingNotes.has(completion.id)) {
    return pendingNotes.get(completion.id) ?? null;
  }
  return completion.note;
}

// ─── Queries ────────────────────────────────────────────────────────────────

export async function fetchHabitCompletions(
  habitId: string,
  occurrenceDate: string | null,
  periodStart: string | null,
): Promise<OverviewCompletion[]> {
  let query = supabase
    .from('habit_completions')
    .select('*')
    .eq('habit_id', habitId)
    .order('completed_at', { ascending: false });

  if (occurrenceDate) {
    query = query.eq('occurrence_date', occurrenceDate);
  } else if (periodStart) {
    query = query.eq('period_start', periodStart);
  } else {
    return [];
  }

  const { data, error } = await query;
  if (error) throw error;

  const completionIds = (data ?? []).map((c: { id: string }) => c.id);
  if (completionIds.length === 0) return [];

  const { data: attachments, error: aErr } = await supabase
    .from('completion_attachments')
    .select('*')
    .in('completion_id', completionIds)
    .order('sort_order', { ascending: true });
  if (aErr) throw aErr;

  type AttachmentRow = AttachmentDetail & { completion_id: string };
  const attachmentsByCompletion = new Map<string, AttachmentDetail[]>();
  for (const row of (attachments ?? []) as AttachmentRow[]) {
    const list = attachmentsByCompletion.get(row.completion_id) ?? [];
    list.push(row);
    attachmentsByCompletion.set(row.completion_id, list);
  }

  return (data ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    habit_id: c.habit_id as string,
    owner_id: c.owner_id as string,
    occurrence_date: c.occurrence_date as string | null,
    period_start: c.period_start as string | null,
    completed_at: c.completed_at as string,
    note: c.note as string | null,
    visibility_override: c.visibility_override as string | null,
    attachments: attachmentsByCompletion.get(c.id as string) ?? [],
  }));
}

// ─── Validation message (shared by view.tsx and completion/[id].tsx) ────────

export function validationMessage(error: ValidationError): string {
  switch (error.kind) {
    case 'cap_reached':
      return `Maximum ${error.max} attachments per completion.`;
    case 'too_large':
      return `File is too large (${error.actualMb.toFixed(1)} MB). Maximum is ${error.maxMb} MB.`;
    case 'too_long':
      return `Video is too long (${error.actualSeconds.toFixed(0)}s). Maximum is ${error.maxSeconds}s.`;
    case 'unsupported_type':
      return `Unsupported file type: ${error.mime}`;
  }
}

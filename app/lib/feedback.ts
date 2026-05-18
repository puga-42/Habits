import { supabase } from './supabase';

export const MAX_FEEDBACK_LENGTH = 2000;

export type FeedbackValidationError =
  | { kind: 'empty' }
  | { kind: 'too_long'; max: number; actual: number };

export function validateFeedback(body: string): FeedbackValidationError | null {
  const trimmed = (body ?? '').trim();
  if (trimmed.length === 0) return { kind: 'empty' };
  if (trimmed.length > MAX_FEEDBACK_LENGTH)
    return { kind: 'too_long', max: MAX_FEEDBACK_LENGTH, actual: trimmed.length };
  return null;
}

export async function submitFeedback(body: string): Promise<void> {
  const validationError = validateFeedback(body);
  if (validationError) {
    throw new Error(
      validationError.kind === 'empty' ? 'Feedback cannot be empty.' : 'Feedback is too long.',
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('feedback')
    .insert({ user_id: user.id, body: body.trim() });
  if (error) {
    if (error.message?.includes('rate limit'))
      throw new Error('You can submit up to 5 feedback items per day.');
    throw error;
  }
}

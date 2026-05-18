import * as Crypto from 'expo-crypto';
import { File as ExpoFile } from 'expo-file-system';

import { ALLOWED_PHOTO_MIMES, MAX_PHOTO_BYTES } from './completions';
import { supabase } from './supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

export type FeedbackCategory = 'bug' | 'feature';

export type FeedbackDraft = {
  category: FeedbackCategory | null;
  desiredBehavior: string;
  currentBehavior: string;
  screenshotUri: string | null;
  screenshotMime: string | null;
  screenshotBytes: number | null;
};

// ─── Constants ──────────────────────────────────────────────────────────────

export const MAX_FEEDBACK_LENGTH = 2000;

// ─── Validation (pure) ──────────────────────────────────────────────────────

export type FeedbackValidationError =
  | { kind: 'no_category' }
  | { kind: 'desired_empty' }
  | { kind: 'desired_too_long'; max: number; actual: number }
  | { kind: 'current_empty_for_bug' }
  | { kind: 'current_too_long'; max: number; actual: number }
  | { kind: 'screenshot_too_large'; maxMb: number; actualMb: number }
  | { kind: 'screenshot_bad_type'; mime: string };

export function validateFeedbackDraft(
  draft: FeedbackDraft,
): FeedbackValidationError | null {
  if (!draft.category) return { kind: 'no_category' };

  const desired = draft.desiredBehavior.trim();
  if (desired.length === 0) return { kind: 'desired_empty' };
  if (desired.length > MAX_FEEDBACK_LENGTH) {
    return {
      kind: 'desired_too_long',
      max: MAX_FEEDBACK_LENGTH,
      actual: desired.length,
    };
  }

  const current = draft.currentBehavior.trim();
  if (draft.category === 'bug' && current.length === 0) {
    return { kind: 'current_empty_for_bug' };
  }
  if (current.length > MAX_FEEDBACK_LENGTH) {
    return {
      kind: 'current_too_long',
      max: MAX_FEEDBACK_LENGTH,
      actual: current.length,
    };
  }

  if (draft.screenshotUri) {
    const mime = draft.screenshotMime ?? '';
    if (!ALLOWED_PHOTO_MIMES.includes(mime)) {
      return { kind: 'screenshot_bad_type', mime };
    }
    const bytes = draft.screenshotBytes ?? 0;
    if (bytes > MAX_PHOTO_BYTES) {
      return {
        kind: 'screenshot_too_large',
        maxMb: MAX_PHOTO_BYTES / (1024 * 1024),
        actualMb: bytes / (1024 * 1024),
      };
    }
  }

  return null;
}

// ─── Submission ─────────────────────────────────────────────────────────────

export async function submitFeedback(draft: FeedbackDraft): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('feedback')
    .insert({
      user_id: user.id,
      category: draft.category,
      desired_behavior: draft.desiredBehavior.trim(),
      current_behavior: draft.currentBehavior.trim() || null,
    })
    .select('id')
    .single();
  if (error) {
    if (error.message?.includes('rate limit'))
      throw new Error('You can submit up to 5 feedback items per day.');
    throw error;
  }

  if (draft.screenshotUri) {
    const screenshotPath = await uploadFeedbackScreenshot(
      data.id,
      user.id,
      draft.screenshotUri,
      draft.screenshotMime ?? 'image/jpeg',
    );
    const { error: updateErr } = await supabase
      .from('feedback')
      .update({ screenshot_path: screenshotPath })
      .eq('id', data.id);
    if (updateErr) throw updateErr;
  }
}

async function uploadFeedbackScreenshot(
  feedbackId: string,
  userId: string,
  uri: string,
  mimeType: string,
): Promise<string> {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const uuid = Crypto.randomUUID();
  const storagePath = `${userId}/${feedbackId}/${uuid}.${ext}`;

  const expoFile = new ExpoFile(uri);
  if (!expoFile.exists) throw new Error('Screenshot file not found');

  const bytes = await expoFile.bytes();
  const { error } = await supabase.storage
    .from('feedback-media')
    .upload(storagePath, bytes, { contentType: mimeType });
  if (error) throw error;

  return storagePath;
}

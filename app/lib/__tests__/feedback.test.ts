import {
  validateFeedbackDraft,
  MAX_FEEDBACK_LENGTH,
  type FeedbackDraft,
} from '../feedback';

function bugDraft(overrides: Partial<FeedbackDraft> = {}): FeedbackDraft {
  return {
    category: 'bug',
    desiredBehavior: 'It should work',
    currentBehavior: 'It crashes',
    screenshotUri: null,
    screenshotMime: null,
    screenshotBytes: null,
    ...overrides,
  };
}

function featureDraft(overrides: Partial<FeedbackDraft> = {}): FeedbackDraft {
  return {
    category: 'feature',
    desiredBehavior: 'I want dark mode',
    currentBehavior: '',
    screenshotUri: null,
    screenshotMime: null,
    screenshotBytes: null,
    ...overrides,
  };
}

describe('validateFeedbackDraft', () => {
  it('returns null for a valid bug draft', () => {
    expect(validateFeedbackDraft(bugDraft())).toBeNull();
  });

  it('returns null for a valid feature draft', () => {
    expect(validateFeedbackDraft(featureDraft())).toBeNull();
  });

  it('returns no_category when category is null', () => {
    expect(validateFeedbackDraft(bugDraft({ category: null }))).toEqual({
      kind: 'no_category',
    });
  });

  it('returns desired_empty for blank desired behavior', () => {
    expect(
      validateFeedbackDraft(bugDraft({ desiredBehavior: '   ' })),
    ).toEqual({ kind: 'desired_empty' });
  });

  it('returns desired_too_long when desired behavior exceeds max', () => {
    const long = 'a'.repeat(MAX_FEEDBACK_LENGTH + 1);
    expect(validateFeedbackDraft(bugDraft({ desiredBehavior: long }))).toEqual({
      kind: 'desired_too_long',
      max: MAX_FEEDBACK_LENGTH,
      actual: MAX_FEEDBACK_LENGTH + 1,
    });
  });

  it('allows desired behavior at exactly max length', () => {
    const exact = 'a'.repeat(MAX_FEEDBACK_LENGTH);
    expect(validateFeedbackDraft(bugDraft({ desiredBehavior: exact }))).toBeNull();
  });

  it('returns current_empty_for_bug when bug has blank current behavior', () => {
    expect(
      validateFeedbackDraft(bugDraft({ currentBehavior: '' })),
    ).toEqual({ kind: 'current_empty_for_bug' });
  });

  it('allows empty current behavior for feature requests', () => {
    expect(
      validateFeedbackDraft(featureDraft({ currentBehavior: '' })),
    ).toBeNull();
  });

  it('returns current_too_long when current behavior exceeds max', () => {
    const long = 'a'.repeat(MAX_FEEDBACK_LENGTH + 1);
    expect(
      validateFeedbackDraft(bugDraft({ currentBehavior: long })),
    ).toEqual({
      kind: 'current_too_long',
      max: MAX_FEEDBACK_LENGTH,
      actual: MAX_FEEDBACK_LENGTH + 1,
    });
  });

  it('returns screenshot_bad_type for unsupported mime', () => {
    expect(
      validateFeedbackDraft(
        bugDraft({
          screenshotUri: 'file://photo.gif',
          screenshotMime: 'image/gif',
          screenshotBytes: 1000,
        }),
      ),
    ).toEqual({ kind: 'screenshot_bad_type', mime: 'image/gif' });
  });

  it('returns screenshot_too_large for oversized photo', () => {
    const oversized = 11 * 1024 * 1024;
    expect(
      validateFeedbackDraft(
        bugDraft({
          screenshotUri: 'file://photo.jpg',
          screenshotMime: 'image/jpeg',
          screenshotBytes: oversized,
        }),
      ),
    ).toEqual({
      kind: 'screenshot_too_large',
      maxMb: 10,
      actualMb: oversized / (1024 * 1024),
    });
  });

  it('returns null for valid screenshot', () => {
    expect(
      validateFeedbackDraft(
        bugDraft({
          screenshotUri: 'file://photo.jpg',
          screenshotMime: 'image/jpeg',
          screenshotBytes: 5 * 1024 * 1024,
        }),
      ),
    ).toBeNull();
  });

  it('trims whitespace before checking desired behavior length', () => {
    const padded = ' ' + 'a'.repeat(MAX_FEEDBACK_LENGTH) + ' ';
    expect(validateFeedbackDraft(bugDraft({ desiredBehavior: padded }))).toBeNull();
  });
});

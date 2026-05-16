import { validateFeedback, MAX_FEEDBACK_LENGTH } from '../feedback';

describe('validateFeedback', () => {
  it('returns empty error for empty string', () => {
    expect(validateFeedback('')).toEqual({ kind: 'empty' });
  });

  it('returns empty error for whitespace-only string', () => {
    expect(validateFeedback('   \n\t  ')).toEqual({ kind: 'empty' });
  });

  it('returns null for valid input', () => {
    expect(validateFeedback('Great app!')).toBeNull();
  });

  it('returns null for exactly MAX_FEEDBACK_LENGTH chars', () => {
    const body = 'a'.repeat(MAX_FEEDBACK_LENGTH);
    expect(validateFeedback(body)).toBeNull();
  });

  it('returns too_long error for MAX_FEEDBACK_LENGTH + 1 chars', () => {
    const body = 'a'.repeat(MAX_FEEDBACK_LENGTH + 1);
    expect(validateFeedback(body)).toEqual({
      kind: 'too_long',
      max: MAX_FEEDBACK_LENGTH,
      actual: MAX_FEEDBACK_LENGTH + 1,
    });
  });

  it('trims whitespace before checking length', () => {
    const body = ' ' + 'a'.repeat(MAX_FEEDBACK_LENGTH) + ' ';
    expect(validateFeedback(body)).toBeNull();
  });
});

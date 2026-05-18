// ---------------------------------------------------------------------------
// Mocks — set up before importing the module under test
// ---------------------------------------------------------------------------

const mockInsert = jest.fn();
const mockFrom = jest.fn((_table: string) => ({ insert: mockInsert }));
const mockGetUser = jest.fn();

jest.mock('../supabase', () => ({
  supabase: {
    auth: { getUser: () => mockGetUser() },
    from: (table: string) => mockFrom(table),
  },
}));

import { validateFeedback, submitFeedback, MAX_FEEDBACK_LENGTH } from '../feedback';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// validateFeedback
// ---------------------------------------------------------------------------

describe('validateFeedback', () => {
  it('returns empty error for empty string', () => {
    expect(validateFeedback('')).toEqual({ kind: 'empty' });
  });

  it('returns empty error for whitespace-only string', () => {
    expect(validateFeedback('   \n\t  ')).toEqual({ kind: 'empty' });
  });

  it('returns empty error for null input (runtime guard)', () => {
    expect(validateFeedback(null as unknown as string)).toEqual({ kind: 'empty' });
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

// ---------------------------------------------------------------------------
// submitFeedback
// ---------------------------------------------------------------------------

describe('submitFeedback', () => {
  it('throws when body is empty', async () => {
    await expect(submitFeedback('')).rejects.toThrow('Feedback cannot be empty.');
  });

  it('throws when body is whitespace-only', async () => {
    await expect(submitFeedback('   ')).rejects.toThrow('Feedback cannot be empty.');
  });

  it('throws when body exceeds max length', async () => {
    const long = 'a'.repeat(MAX_FEEDBACK_LENGTH + 1);
    await expect(submitFeedback(long)).rejects.toThrow('Feedback is too long.');
  });

  it('throws when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(submitFeedback('some feedback')).rejects.toThrow('Not authenticated');
  });

  it('inserts trimmed body when input is valid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockInsert.mockResolvedValue({ error: null });
    await submitFeedback('  Great app!  ');
    expect(mockFrom).toHaveBeenCalledWith('feedback');
    expect(mockInsert).toHaveBeenCalledWith({ user_id: 'user-1', body: 'Great app!' });
  });

  it('throws rate limit message when Supabase returns a rate limit error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockInsert.mockResolvedValue({ error: { message: 'rate limit exceeded' } });
    await expect(submitFeedback('feedback')).rejects.toThrow(
      'You can submit up to 5 feedback items per day.',
    );
  });
});

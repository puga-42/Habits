import { errorMessage } from '../error-message';

describe('errorMessage', () => {
  it('unwraps real Error instances', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('unwraps message-bearing plain objects (Supabase PostgrestError)', () => {
    // Supabase errors are NOT Error instances — String(err) renders
    // "[object Object]", which is what users saw. The .message must win.
    const pg = {
      message: 'duplicate key value violates unique constraint',
      code: '23505',
      details: null,
    };
    expect(errorMessage(pg)).toBe('duplicate key value violates unique constraint');
  });

  it('falls back to String() for primitives and messageless values', () => {
    expect(errorMessage('plain string')).toBe('plain string');
    expect(errorMessage(42)).toBe('42');
    expect(errorMessage(null)).toBe('null');
    expect(errorMessage({ code: 'x' })).toBe('[object Object]');
  });
});

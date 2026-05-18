import { validateHandle, type HandleValidation } from '../profile';

describe('validateHandle', () => {
  it('accepts a valid lowercase handle', () => {
    const result = validateHandle('alice');
    expect(result).toEqual<HandleValidation>({ ok: true });
  });

  it('accepts a valid handle with numbers and underscore', () => {
    expect(validateHandle('cool_user_42')).toEqual({ ok: true });
  });

  it('accepts exactly 3 characters', () => {
    expect(validateHandle('abc')).toEqual({ ok: true });
  });

  it('accepts exactly 30 characters', () => {
    expect(validateHandle('a'.repeat(30))).toEqual({ ok: true });
  });

  it('rejects a 2-character handle', () => {
    const result = validateHandle('ab');
    expect(result).toMatchObject({ ok: false });
    expect((result as { ok: false; message: string }).message).toMatch(/at least 3/);
  });

  it('rejects a 31-character handle', () => {
    const result = validateHandle('a'.repeat(31));
    expect(result).toMatchObject({ ok: false });
    expect((result as { ok: false; message: string }).message).toMatch(/30 characters/);
  });

  it('rejects a handle with a hyphen', () => {
    const result = validateHandle('hello-world');
    expect(result).toMatchObject({ ok: false });
    expect((result as { ok: false; message: string }).message).toMatch(/letters, numbers/);
  });

  it('rejects a handle with a space', () => {
    const result = validateHandle('hello world');
    expect(result).toMatchObject({ ok: false });
  });

  it('rejects an empty string', () => {
    const result = validateHandle('');
    expect(result).toMatchObject({ ok: false });
  });

  it('trims whitespace before validating', () => {
    // '  abc  ' trimmed is 'abc' — valid
    expect(validateHandle('  abc  ')).toEqual({ ok: true });
  });

  it('rejects whitespace-only input', () => {
    const result = validateHandle('   ');
    expect(result).toMatchObject({ ok: false });
  });

  it('accepts uppercase letters', () => {
    expect(validateHandle('Alice123')).toEqual({ ok: true });
  });
});


// ---------------------------------------------------------------------------
// Mocks — set up before importing the module under test
// ---------------------------------------------------------------------------

const mockSignInAsync = jest.fn();
const mockDigestStringAsync = jest.fn();
const mockRandomUUID = jest.fn();

jest.mock('expo-apple-authentication', () => ({
  signInAsync: (...args: unknown[]) => mockSignInAsync(...args),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => mockRandomUUID(),
  digestStringAsync: (...args: unknown[]) => mockDigestStringAsync(...args),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));

const mockSignInWithIdToken = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      signInWithIdToken: (...args: unknown[]) => mockSignInWithIdToken(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
  },
}));

const { signInWithApple, signInWithEmail, signUpWithEmail, keyboardAvoidingBehavior } =
  require('../sign-in') as typeof import('../sign-in');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockRandomUUID.mockReturnValue('raw-nonce-123');
  mockDigestStringAsync.mockResolvedValue('hashed-nonce-abc');
});

// ---------------------------------------------------------------------------
// Apple Sign-In
// ---------------------------------------------------------------------------

describe('signInWithApple', () => {
  it('returns ok:true on successful sign-in', async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: 'apple-token' });
    mockSignInWithIdToken.mockResolvedValue({ error: null });

    const result = await signInWithApple();

    expect(result).toEqual({ ok: true });
    expect(mockSignInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'apple-token',
      nonce: 'raw-nonce-123',
    });
  });

  it('returns cancelled when user cancels', async () => {
    mockSignInAsync.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });

    const result = await signInWithApple();

    expect(result).toEqual({ ok: false, cancelled: true });
  });

  it('returns error when no identity token', async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: null });

    const result = await signInWithApple();

    expect(result).toEqual({
      ok: false,
      cancelled: false,
      message: 'No identity token returned from Apple',
    });
  });

  it('returns error when Supabase rejects token', async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: 'apple-token' });
    mockSignInWithIdToken.mockResolvedValue({
      error: { message: 'Invalid token' },
    });

    const result = await signInWithApple();

    expect(result).toEqual({
      ok: false,
      cancelled: false,
      message: 'Invalid token',
    });
  });

  it('returns error message for unexpected errors', async () => {
    mockSignInAsync.mockRejectedValue(new Error('Network failure'));

    const result = await signInWithApple();

    expect(result).toEqual({
      ok: false,
      cancelled: false,
      message: 'Network failure',
    });
  });
});

// ---------------------------------------------------------------------------
// Email Sign-In
// ---------------------------------------------------------------------------

describe('signInWithEmail', () => {
  it('returns ok:true on successful sign-in', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });

    const result = await signInWithEmail('user@test.com', 'password123');

    expect(result).toEqual({ ok: true });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'user@test.com',
      password: 'password123',
    });
  });

  it('returns error when credentials are invalid', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });

    const result = await signInWithEmail('user@test.com', 'wrong');

    expect(result).toEqual({
      ok: false,
      cancelled: false,
      message: 'Invalid login credentials',
    });
  });
});

// ---------------------------------------------------------------------------
// Email Sign-Up
// ---------------------------------------------------------------------------

describe('signUpWithEmail', () => {
  it('returns ok:true on successful sign-up', async () => {
    mockSignUp.mockResolvedValue({ error: null });

    const result = await signUpWithEmail('new@test.com', 'password123');

    expect(result).toEqual({ ok: true });
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'new@test.com',
      password: 'password123',
    });
  });

  it('returns error when email is already taken', async () => {
    mockSignUp.mockResolvedValue({
      error: { message: 'User already registered' },
    });

    const result = await signUpWithEmail('existing@test.com', 'password123');

    expect(result).toEqual({
      ok: false,
      cancelled: false,
      message: 'User already registered',
    });
  });

  it('returns error when password is too short', async () => {
    mockSignUp.mockResolvedValue({
      error: { message: 'Password should be at least 6 characters' },
    });

    const result = await signUpWithEmail('new@test.com', '123');

    expect(result).toEqual({
      ok: false,
      cancelled: false,
      message: 'Password should be at least 6 characters',
    });
  });
});

// ---------------------------------------------------------------------------
// keyboardAvoidingBehavior
// ---------------------------------------------------------------------------

describe('keyboardAvoidingBehavior', () => {
  it('returns "padding" for ios', () => {
    expect(keyboardAvoidingBehavior('ios')).toBe('padding');
  });

  it('returns "height" for android', () => {
    expect(keyboardAvoidingBehavior('android')).toBe('height');
  });

  it('returns undefined for other platforms', () => {
    expect(keyboardAvoidingBehavior('web')).toBeUndefined();
    expect(keyboardAvoidingBehavior('')).toBeUndefined();
  });
});

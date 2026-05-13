/* eslint-env jest */

// Native modules transitively imported by our lib/ code that need shims in
// the Jest environment.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Supabase client constructs at module load; give it dummy creds so the
// import doesn't throw. Pure-function tests never make network calls.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

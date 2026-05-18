import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { supabase } from './supabase';

export function keyboardAvoidingBehavior(
  os: string,
): 'padding' | 'height' | undefined {
  if (os === 'ios') return 'padding';
  if (os === 'android') return 'height';
  return undefined;
}

export type SignInResult =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; message: string };

export async function signInWithApple(): Promise<SignInResult> {
  try {
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return { ok: false, cancelled: false, message: 'No identity token returned from Apple' };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) return { ok: false, cancelled: false, message: error.message };
    return { ok: true };
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'ERR_REQUEST_CANCELED'
    ) {
      return { ok: false, cancelled: true };
    }
    return {
      ok: false,
      cancelled: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<SignInResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, cancelled: false, message: error.message };
  return { ok: true };
}

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<SignInResult> {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { ok: false, cancelled: false, message: error.message };
  return { ok: true };
}

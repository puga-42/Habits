// Email/password auth form, extracted from the sign-in screen so the landing
// stays under the 200-line cap. Owns its field state; the parent owns the
// shared `busy` flag so email and Apple auth can't run concurrently.

import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTokens } from '@/hooks/use-tokens';
import { signInWithEmail, signUpWithEmail } from '@/lib/sign-in';

type Props = {
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
};

export function EmailAuthForm({ busy, onBusyChange }: Props) {
  const t = useTokens();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  async function handleSubmit() {
    if (busy) return;
    const trimmed = email.trim();
    if (!trimmed || !password) {
      Alert.alert('Missing fields', 'Please enter both email and password.');
      return;
    }
    onBusyChange(true);
    const result = isSignUp
      ? await signUpWithEmail(trimmed, password)
      : await signInWithEmail(trimmed, password);
    if (!result.ok && !result.cancelled) {
      Alert.alert(isSignUp ? 'Sign-up failed' : 'Sign-in failed', result.message);
    }
    onBusyChange(false);
  }

  const fieldStyle = [
    styles.input,
    { color: t.ink, backgroundColor: t.surface, borderColor: t.hairlineStrong },
  ];

  return (
    <>
      <TextInput
        style={fieldStyle}
        placeholder="Email"
        placeholderTextColor={t.ink45}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={fieldStyle}
        placeholder="Password"
        placeholderTextColor={t.ink45}
        autoCapitalize="none"
        autoComplete={isSignUp ? 'new-password' : 'current-password'}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable
        style={[styles.submit, { backgroundColor: t.accent }, busy && styles.disabled]}
        onPress={handleSubmit}
        disabled={busy}
        accessibilityRole="button">
        <ThemedText style={[styles.submitText, { color: t.onAccent }]}>
          {isSignUp ? 'Create account' : 'Sign in'}
        </ThemedText>
      </Pressable>
      <Pressable onPress={() => setIsSignUp((v) => !v)} hitSlop={8}>
        <ThemedText style={styles.toggleText}>
          {isSignUp
            ? 'Already have an account? Sign in'
            : "Don't have an account? Create one"}
        </ThemedText>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  submit: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: { fontSize: 17, fontWeight: '600' },
  toggleText: { textAlign: 'center', opacity: 0.6, fontSize: 14 },
  disabled: { opacity: 0.6 },
});

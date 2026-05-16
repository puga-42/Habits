import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  signInWithApple,
  signInWithEmail,
  signUpWithEmail,
} from '@/lib/sign-in';

export default function SignInScreen() {
  const textColor = useThemeColor({}, 'text');
  const inputBg = useThemeColor({ light: '#fff', dark: 'rgba(255,255,255,0.08)' }, 'background');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  async function handleEmailAuth() {
    if (busy) return;
    const trimmed = email.trim();
    if (!trimmed || !password) {
      Alert.alert('Missing fields', 'Please enter both email and password.');
      return;
    }
    setBusy(true);
    const result = isSignUp
      ? await signUpWithEmail(trimmed, password)
      : await signInWithEmail(trimmed, password);
    if (!result.ok && !result.cancelled) {
      Alert.alert(isSignUp ? 'Sign-up failed' : 'Sign-in failed', result.message);
    }
    setBusy(false);
  }

  async function handleApple() {
    if (busy) return;
    setBusy(true);
    const result = await signInWithApple();
    if (!result.ok && !result.cancelled) {
      Alert.alert('Sign-in failed', result.message);
    }
    setBusy(false);
  }

  return (
    <ThemedView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.hero}>
              <ThemedText type="title" style={styles.title}>
                Habits
              </ThemedText>
              <ThemedText style={styles.subtitle}>
                A calmer habit tracker, with friends.
              </ThemedText>
            </View>
            <View style={styles.buttonContainer}>
              <TextInput
                style={[styles.input, { color: textColor, backgroundColor: inputBg }]}
                placeholder="Email"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={[styles.input, { color: textColor, backgroundColor: inputBg }]}
                placeholder="Password"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <Pressable
                style={styles.emailButton}
                onPress={handleEmailAuth}
                disabled={busy}
              >
                <ThemedText style={styles.emailButtonText}>
                  {isSignUp ? 'Create account' : 'Sign in'}
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => setIsSignUp((v) => !v)}>
                <ThemedText style={styles.toggleText}>
                  {isSignUp
                    ? 'Already have an account? Sign in'
                    : "Don't have an account? Create one"}
                </ThemedText>
              </Pressable>
              {Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={
                    AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                  }
                  buttonStyle={
                    AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  }
                  cornerRadius={8}
                  style={styles.appleButton}
                  onPress={handleApple}
                />
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  hero: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  title: { fontSize: 48, lineHeight: 56, marginBottom: 4 },
  subtitle: { opacity: 0.6, textAlign: 'center' },
  buttonContainer: { paddingBottom: 16, gap: 12 },
  input: {
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 16,
    fontSize: 16,
  },
  emailButton: {
    height: 50,
    borderRadius: 8,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emailButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  toggleText: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: 14,
  },
  appleButton: { width: '100%', height: 50 },
});

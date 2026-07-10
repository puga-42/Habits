// Signed-out landing — the first interactive screen (AuthGate routes here).
// Welcome-first: placeholder brand + tagline + value props (WelcomeHero),
// with Sign in with Apple as the always-visible primary CTA and the email
// form tucked behind "Continue with email". Brand is a placeholder — see
// components/brand-mark.tsx for the single point of replacement.

import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EmailAuthForm } from '@/components/email-auth-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WelcomeHero } from '@/components/welcome-hero';
import { useTokens } from '@/hooks/use-tokens';
import { keyboardAvoidingBehavior, signInWithApple } from '@/lib/sign-in';

export default function SignInScreen() {
  const t = useTokens();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<'landing' | 'email'>('landing');

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
      <KeyboardAvoidingView style={styles.root} behavior={keyboardAvoidingBehavior(Platform.OS)}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.hero}>
              <WelcomeHero />
            </View>

            <View style={styles.actions}>
              {stage === 'email' ? (
                <Animated.View entering={FadeInDown.duration(250)} style={styles.emailForm}>
                  <EmailAuthForm busy={busy} onBusyChange={setBusy} />
                </Animated.View>
              ) : null}

              {Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={12}
                  style={styles.appleButton}
                  onPress={handleApple}
                />
              )}

              {stage === 'landing' ? (
                // On iOS the Apple button is primary and this is a quiet
                // secondary link; on Android (no Apple auth) email IS the
                // primary path, so it gets the filled-CTA treatment.
                Platform.OS === 'ios' ? (
                  <Pressable onPress={() => setStage('email')} hitSlop={8} accessibilityRole="button">
                    <ThemedText style={[styles.stageLink, { color: t.accent }]}>
                      Continue with email
                    </ThemedText>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => setStage('email')}
                    style={[styles.primaryButton, { backgroundColor: t.accent }]}
                    accessibilityRole="button">
                    <ThemedText style={[styles.primaryButtonText, { color: t.onAccent }]}>
                      Continue with email
                    </ThemedText>
                  </Pressable>
                )
              ) : (
                <Pressable onPress={() => setStage('landing')} hitSlop={8} accessibilityRole="button">
                  <ThemedText style={[styles.stageLink, { color: t.ink52 }]}>
                    ‹ Back to welcome
                  </ThemedText>
                </Pressable>
              )}

              {/* Placeholder until the real documents exist (App Store needs a
                  privacy policy URL at submission). */}
              <ThemedText style={[styles.footnote, { color: t.ink45 }]}>
                By continuing you agree to the Terms &amp; Privacy Policy.
              </ThemedText>
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
  hero: { flexGrow: 1, justifyContent: 'center', paddingTop: 24 },
  actions: { paddingBottom: 8, gap: 12 },
  emailForm: { gap: 12 },
  appleButton: { width: '100%', height: 50 },
  primaryButton: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: { fontSize: 17, fontWeight: '600' },
  stageLink: { textAlign: 'center', fontSize: 15, fontWeight: '600', paddingVertical: 4 },
  footnote: { textAlign: 'center', fontSize: 12, lineHeight: 16, paddingTop: 4 },
});

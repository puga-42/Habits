import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MAX_FEEDBACK_LENGTH, submitFeedback, validateFeedback } from '@/lib/feedback';

export default function FeedbackScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const charCount = body.trim().length;
  const showCharCount = charCount > 1800;
  const validationError = validateFeedback(body);
  const canSubmit = !validationError && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await submitFeedback(body);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  }, [body, canSubmit, router]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <ThemedText style={styles.cancelText}>Cancel</ThemedText>
          </Pressable>
          <ThemedText style={styles.title}>Send Feedback</ThemedText>
          <Pressable onPress={handleSubmit} disabled={!canSubmit} hitSlop={8}>
            {submitting ? (
              <ActivityIndicator size="small" />
            ) : (
              <ThemedText
                style={[styles.submitText, !canSubmit && styles.submitDisabled]}
              >
                Submit
              </ThemedText>
            )}
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TextInput
            style={[
              styles.input,
              { color: isDark ? '#ECEDEE' : '#11181C' },
            ]}
            placeholder="What's on your mind?"
            placeholderTextColor={isDark ? '#9BA1A6' : '#687076'}
            multiline
            maxLength={MAX_FEEDBACK_LENGTH}
            value={body}
            onChangeText={setBody}
            autoFocus
            textAlignVertical="top"
          />
          {showCharCount && (
            <ThemedText style={styles.charCount}>
              {charCount}/{MAX_FEEDBACK_LENGTH}
            </ThemedText>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
  },
  cancelText: { fontSize: 16 },
  title: { fontSize: 17, fontWeight: '600' },
  submitText: { fontSize: 16, fontWeight: '600', color: '#7c3aed' },
  submitDisabled: { opacity: 0.4 },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    padding: 16,
  },
  charCount: {
    fontSize: 12,
    color: '#687076',
    textAlign: 'right',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});

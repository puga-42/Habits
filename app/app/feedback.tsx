import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  MAX_FEEDBACK_LENGTH,
  submitFeedback,
  validateFeedbackDraft,
  type FeedbackCategory,
  type FeedbackDraft,
} from '@/lib/feedback';

const CHAR_COUNT_THRESHOLD = 1800;

export default function FeedbackScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [desiredBehavior, setDesiredBehavior] = useState('');
  const [currentBehavior, setCurrentBehavior] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [screenshotMime, setScreenshotMime] = useState<string | null>(null);
  const [screenshotBytes, setScreenshotBytes] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const draft: FeedbackDraft = {
    category,
    desiredBehavior,
    currentBehavior,
    screenshotUri,
    screenshotMime,
    screenshotBytes,
  };

  const validationError = validateFeedbackDraft(draft);
  const canSubmit = !validationError && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await submitFeedback(draft);
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to submit feedback';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  }, [draft, canSubmit, router]);

  const handlePickScreenshot = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    setScreenshotUri(asset.uri);
    setScreenshotMime(asset.mimeType ?? 'image/jpeg');
    setScreenshotBytes(asset.fileSize ?? 0);
  }, []);

  const handleRemoveScreenshot = useCallback(() => {
    setScreenshotUri(null);
    setScreenshotMime(null);
    setScreenshotBytes(null);
  }, []);

  const textColor = isDark ? '#ECEDEE' : '#11181C';
  const placeholderColor = isDark ? '#9BA1A6' : '#687076';
  const fieldBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';

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
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <CategoryPicker
              value={category}
              onChange={setCategory}
              isDark={isDark}
            />

            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>
                {category === 'bug'
                  ? 'What should happen?'
                  : 'What feature would you like?'}
              </ThemedText>
              <TextInput
                style={[styles.input, { color: textColor, backgroundColor: fieldBg }]}
                placeholder={
                  category === 'bug'
                    ? 'Describe the expected behavior'
                    : 'Describe the feature you\'d like'
                }
                placeholderTextColor={placeholderColor}
                multiline
                maxLength={MAX_FEEDBACK_LENGTH}
                value={desiredBehavior}
                onChangeText={setDesiredBehavior}
                textAlignVertical="top"
              />
              <CharCount value={desiredBehavior} />
            </View>

            {category === 'bug' && (
              <View style={styles.fieldGroup}>
                <ThemedText style={styles.fieldLabel}>
                  What is currently happening?
                </ThemedText>
                <TextInput
                  style={[styles.input, { color: textColor, backgroundColor: fieldBg }]}
                  placeholder="Describe what's happening instead"
                  placeholderTextColor={placeholderColor}
                  multiline
                  maxLength={MAX_FEEDBACK_LENGTH}
                  value={currentBehavior}
                  onChangeText={setCurrentBehavior}
                  textAlignVertical="top"
                />
                <CharCount value={currentBehavior} />
              </View>
            )}

            {category === 'bug' && (
              <View style={styles.fieldGroup}>
                <ThemedText style={styles.fieldLabel}>
                  Screenshot (optional)
                </ThemedText>
                {screenshotUri ? (
                  <View style={styles.screenshotRow}>
                    <Image
                      source={{ uri: screenshotUri }}
                      style={styles.thumbnail}
                      contentFit="cover"
                    />
                    <Pressable
                      onPress={handleRemoveScreenshot}
                      style={styles.removeButton}
                      hitSlop={8}
                    >
                      <ThemedText style={styles.removeText}>Remove</ThemedText>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={handlePickScreenshot}
                    style={[styles.addScreenshot, { borderColor: placeholderColor }]}
                  >
                    <ThemedText style={[styles.addScreenshotText, { color: placeholderColor }]}>
                      + Add screenshot
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ─── Category picker ────────────────────────────────────────────────────────

function CategoryPicker({
  value,
  onChange,
  isDark,
}: {
  value: FeedbackCategory | null;
  onChange: (c: FeedbackCategory) => void;
  isDark: boolean;
}) {
  const inactiveBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

  return (
    <View style={styles.categoryRow}>
      {(['bug', 'feature'] as const).map((cat) => {
        const active = value === cat;
        return (
          <Pressable
            key={cat}
            onPress={() => onChange(cat)}
            style={[
              styles.categoryButton,
              { backgroundColor: active ? '#7c3aed' : inactiveBg },
            ]}
          >
            <ThemedText
              style={[
                styles.categoryText,
                active && styles.categoryTextActive,
              ]}
            >
              {cat === 'bug' ? 'Bug Report' : 'Feature Request'}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Character counter ──────────────────────────────────────────────────────

function CharCount({ value }: { value: string }) {
  const count = value.trim().length;
  if (count <= CHAR_COUNT_THRESHOLD) return null;

  return (
    <ThemedText style={styles.charCount}>
      {count}/{MAX_FEEDBACK_LENGTH}
    </ThemedText>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
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

  categoryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  categoryButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  categoryText: { fontSize: 14, fontWeight: '600' },
  categoryTextActive: { color: '#fff' },

  fieldGroup: { paddingHorizontal: 16, marginTop: 16 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.6,
    marginBottom: 6,
  },
  input: {
    fontSize: 16,
    lineHeight: 22,
    padding: 12,
    borderRadius: 8,
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: '#687076',
    textAlign: 'right',
    marginTop: 4,
  },

  screenshotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  removeText: { fontSize: 14, color: '#ef4444' },

  addScreenshot: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 20,
    alignItems: 'center',
  },
  addScreenshotText: { fontSize: 14 },
});

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AttachmentGrid } from '@/components/attachment-grid';
import { CompletionNoteEditor } from '@/components/completion-note-editor';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VisibilityPicker } from '@/components/visibility-picker';
import { useTokens } from '@/hooks/use-tokens';
import { useAuth } from '@/lib/auth';
import {
  deleteAttachment,
  fetchCompletionDetail,
  reorderAttachments,
  updateNote,
  updateVisibilityOverride,
  uploadAttachment,
  validateAttachment,
  type AttachmentDetail,
  type CompletionDetail,
} from '@/lib/completions';
import { signedUrlsForPaths } from '@/lib/feed';
import { Palette } from '@/constants/colors';
import type { Visibility } from '@/lib/habits';
import { errorMessage } from '@/lib/error-message';
import { pickMediaAsset } from '@/lib/media-picker';

export default function CompletionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const viewerId = session?.user.id;
  const t = useTokens();

  const [completion, setCompletion] = useState<CompletionDetail | null>(null);
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const editable = completion != null && completion.owner_id === viewerId;

  const load = useCallback(async () => {
    if (!id) return;
    const detail = await fetchCompletionDetail(id);
    setCompletion(detail);
    if (detail.attachments.length > 0) {
      const paths = detail.attachments.map((a) => a.storage_path);
      const urls = await signedUrlsForPaths(paths);
      setSignedUrls(urls);
    }
  }, [id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const handleNoteSave = useCallback(
    async (note: string | null) => {
      if (!completion) return;
      await updateNote(completion.id, note);
    },
    [completion],
  );

  const handleVisibilityChange = useCallback(
    async (override: Visibility | null) => {
      if (!completion) return;
      await updateVisibilityOverride(completion.id, override);
      setCompletion((c) => (c ? { ...c, visibility_override: override } : c));
    },
    [completion],
  );

  const handleReorder = useCallback(
    async (orderedIds: string[]) => {
      if (!completion) return;
      const reordered = orderedIds
        .map((oid) => completion.attachments.find((a) => a.id === oid))
        .filter(Boolean) as AttachmentDetail[];
      setCompletion((c) =>
        c
          ? { ...c, attachments: reordered.map((a, i) => ({ ...a, sort_order: i })) }
          : c,
      );
      await reorderAttachments(orderedIds);
    },
    [completion],
  );

  const handleDelete = useCallback(
    async (attachmentId: string) => {
      if (!completion) return;
      setCompletion((c) =>
        c
          ? { ...c, attachments: c.attachments.filter((a) => a.id !== attachmentId) }
          : c,
      );
      await deleteAttachment(attachmentId);
    },
    [completion],
  );

  const handleAdd = useCallback(async () => {
    if (!completion || !viewerId) return;

    // Picker INSIDE the try: the iCloud fetch/export can reject (this was the
    // uncaught PHPhotosErrorDomain rejection). Shared picker: no permission
    // prompt, no transcode — see lib/media-picker.ts.
    setUploading(true);
    try {
      const picked = await pickMediaAsset();
      if (!picked) return;

      const error = validateAttachment(picked, completion.attachments.length);
      if (error) {
        Alert.alert('Cannot add attachment', validationMessage(error));
        return;
      }

      const attachment = await uploadAttachment(completion.id, viewerId, {
        uri: picked.uri,
        mimeType: picked.mimeType,
        width: picked.width,
        height: picked.height,
        duration: picked.durationSeconds,
      });
      setCompletion((c) =>
        c ? { ...c, attachments: [...c.attachments, attachment] } : c,
      );
      const urls = await signedUrlsForPaths([attachment.storage_path]);
      setSignedUrls((prev) => {
        const next = new Map(prev);
        for (const [k, v] of urls) next.set(k, v);
        return next;
      });
    } catch (err) {
      const msg = errorMessage(err);
      console.error('Upload error:', msg);
      Alert.alert('Upload failed', msg);
    } finally {
      setUploading(false);
    }
  }, [completion, viewerId]);

  if (loading) {
    return (
      <ThemedView style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.centered}>
          <ActivityIndicator />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!completion) {
    return (
      <ThemedView style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.centered}>
          <ThemedText>Completion not found.</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const completedTime = new Date(completion.completed_at).toLocaleTimeString(
    'en-US',
    { hour: 'numeric', minute: '2-digit' },
  );

  const habitColor = completion.habit.color ?? Palette.habitColors[0];

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={styles.backBtn}>‹</ThemedText>
          </Pressable>
          <View style={styles.headerCenter}>
            <ThemedText style={styles.headerTitle} numberOfLines={1}>
              {completion.habit.icon ? `${completion.habit.icon} ` : ''}
              {completion.habit.title}
            </ThemedText>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={[styles.doneBtn, { color: habitColor }]}>
              Done
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Completed time */}
          <ThemedText style={styles.timestamp}>
            Completed {completedTime}
          </ThemedText>

          {/* Attachments */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionLabel}>Attachments</ThemedText>
            <AttachmentGrid
              attachments={completion.attachments}
              signedUrls={signedUrls}
              editable={editable}
              onReorder={handleReorder}
              onDelete={handleDelete}
              onAdd={handleAdd}
            />
            {uploading && (
              <View style={styles.uploadingIndicator}>
                <ActivityIndicator size="small" />
                <ThemedText style={styles.uploadingText}>Uploading...</ThemedText>
              </View>
            )}
          </View>

          {/* Action buttons */}
          {editable && (
            <View style={styles.actionRow}>
              <Pressable
                onPress={handleAdd}
                style={({ pressed }) => [styles.actionBtn, { backgroundColor: t.surfaceRaised }, pressed && styles.actionBtnPressed]}
              >
                <ThemedText style={styles.actionBtnText}>+ photo</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleAdd}
                style={({ pressed }) => [styles.actionBtn, { backgroundColor: t.surfaceRaised }, pressed && styles.actionBtnPressed]}
              >
                <ThemedText style={styles.actionBtnText}>+ video</ThemedText>
              </Pressable>
            </View>
          )}

          {/* Note */}
          <CompletionNoteEditor
            initialNote={completion.note}
            editable={editable}
            onSave={handleNoteSave}
          />

          {/* Visibility */}
          {editable && (
            <VisibilityPicker
              habitVisibility={completion.habit.visibility}
              currentOverride={completion.visibility_override}
              onChange={handleVisibilityChange}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function validationMessage(
  error: Exclude<ReturnType<typeof validateAttachment>, null>,
): string {
  switch (error.kind) {
    case 'cap_reached':
      return `Maximum ${error.max} attachments per completion.`;
    case 'too_large':
      return `File is too large (${error.actualMb.toFixed(1)} MB). Maximum is ${error.maxMb} MB.`;
    case 'too_long':
      return `Video is too long (${error.actualSeconds.toFixed(0)}s). Maximum is ${error.maxSeconds}s.`;
    case 'unsupported_type':
      return `Unsupported file type: ${error.mime}`;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: { fontSize: 28, opacity: 0.7 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  doneBtn: { fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  timestamp: {
    fontSize: 14,
    opacity: 0.6,
    paddingHorizontal: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  section: { marginBottom: 12 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.6,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  uploadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  uploadingText: { fontSize: 13, opacity: 0.6 },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  actionBtnPressed: { opacity: 0.6 },
  actionBtnText: { fontSize: 14, fontWeight: '500' },
});

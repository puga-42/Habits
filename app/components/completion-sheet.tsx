// Post-completion quick-entry sheet — slides up the moment a habit is
// completed (replaces the old bottom toast). One glanceable surface to type a
// note and attach photos/videos while the moment is fresh; ✓ (or the
// backdrop) commits and dismisses — typed notes are never dropped. Deeper
// edits (reorder/delete) live on the completion page, reachable from the
// habit overview. No emoji scale, by design.

import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AttachmentTile } from '@/components/attachment-tile';
import { CompletionSheetActions } from '@/components/completion-sheet-actions';
import { ThemedText } from '@/components/themed-text';
import {
  updateNote,
  uploadAttachment,
  validateAttachment,
  type AttachmentDetail,
} from '@/lib/completions';
import { errorMessage } from '@/lib/error-message';
import { signedUrlsForPaths } from '@/lib/feed';
import { validationMessage } from '@/lib/habit-overview';
import { pickMediaAsset } from '@/lib/media-picker';
import { keyboardAvoidingBehavior } from '@/lib/sign-in';
import { Radii } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

export type CompletionSheetTarget = {
  completionId: string;
  habitTitle: string;
  userId: string;
};

type Props = {
  target: CompletionSheetTarget | null;
  onClose: () => void;
};

export function CompletionSheet({ target, onClose }: Props) {
  const t = useTokens();
  const [note, setNote] = useState('');
  const [attachments, setAttachments] = useState<AttachmentDetail[]>([]);
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState(false);

  // Fresh state per completion.
  useEffect(() => {
    setNote('');
    setAttachments([]);
    setSignedUrls(new Map());
    setBusy(false);
  }, [target?.completionId]);

  if (!target) return null;

  async function addMedia() {
    if (!target || busy) return;
    setBusy(true);
    try {
      const picked = await pickMediaAsset();
      if (!picked) return;
      const invalid = validateAttachment(picked, attachments.length);
      if (invalid) {
        Alert.alert('Cannot add attachment', validationMessage(invalid));
        return;
      }
      const attachment = await uploadAttachment(target.completionId, target.userId, {
        uri: picked.uri,
        mimeType: picked.mimeType,
        width: picked.width,
        height: picked.height,
        duration: picked.durationSeconds,
      });
      setAttachments((prev) => [...prev, attachment]);
      const urls = await signedUrlsForPaths([attachment.storage_path]);
      setSignedUrls((prev) => new Map([...prev, ...urls]));
    } catch (err) {
      Alert.alert('Upload failed', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Commit-and-close: a typed note is saved best-effort, never dropped.
  function confirm() {
    const trimmed = note.trim();
    if (trimmed) {
      updateNote(target!.completionId, trimmed).catch((err) => {
        Alert.alert('Could not save note', errorMessage(err));
      });
    }
    onClose();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={confirm}>
      <Pressable style={styles.backdrop} onPress={confirm} accessibilityLabel="Dismiss" />
      <KeyboardAvoidingView
        behavior={keyboardAvoidingBehavior(Platform.OS)}
        pointerEvents="box-none"
        style={styles.avoider}>
        <View style={[styles.sheet, { backgroundColor: t.surface }]}>
          <View style={[styles.grabber, { backgroundColor: t.ink45 }]} />

          <View style={styles.headerRow}>
            <ThemedText type="displaySemiBold" style={styles.title} numberOfLines={1}>
              {target.habitTitle}
            </ThemedText>
            <ThemedText style={[styles.done, { color: t.success }]}>✓ Completed</ThemedText>
          </View>

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a note…"
            placeholderTextColor={t.ink45}
            style={[styles.note, { color: t.ink, backgroundColor: t.surfaceRaised }]}
            multiline
            autoFocus
            maxLength={2000}
          />

          {attachments.length > 0 ? (
            <View style={styles.thumbs}>
              {attachments.map((a) => (
                <AttachmentTile
                  key={a.id}
                  attachment={a}
                  signedUrl={signedUrls.get(a.storage_path)}
                />
              ))}
            </View>
          ) : null}

          <CompletionSheetActions busy={busy} onAddMedia={addMedia} onConfirm={confirm} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  avoider: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radii.card,
    borderTopRightRadius: Radii.card,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 17 },
  done: { fontSize: 13, fontWeight: '700' },
  note: {
    marginTop: 12,
    minHeight: 76,
    maxHeight: 160,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
});

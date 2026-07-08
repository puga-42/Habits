import { Pressable, StyleSheet, View } from 'react-native';

import { AttachmentGrid } from '@/components/attachment-grid';
import { CompletionNoteEditor } from '@/components/completion-note-editor';
import { ThemedText } from '@/components/themed-text';
import { useTokens } from '@/hooks/use-tokens';
import type { OverviewCompletion } from '@/lib/habit-overview';

type Props = {
  completion: OverviewCompletion;
  signedUrls: Map<string, string>;
  editable: boolean;
  expanded: boolean;
  onToggle: () => void;
  onNoteSave: (completionId: string, note: string | null) => void;
  onAttachmentAdd: (completionId: string) => void;
  onAttachmentDelete: (completionId: string, attachmentId: string) => void;
  onAttachmentReorder: (completionId: string, orderedIds: string[]) => void;
};

export function CompletionInlineEditor({
  completion,
  signedUrls,
  editable,
  expanded,
  onToggle,
  onNoteSave,
  onAttachmentAdd,
  onAttachmentDelete,
  onAttachmentReorder,
}: Props) {
  const t = useTokens();
  if (!expanded) {
    return (
      <CollapsedRow
        completion={completion}
        onToggle={onToggle}
      />
    );
  }

  const hasMedia = completion.attachments.length > 0;
  // Nothing to show for a viewer when the completion has no note or media.
  if (!editable && !completion.note && !hasMedia) {
    return null;
  }

  return (
    <View style={styles.expanded}>
      <CompletionNoteEditor
        initialNote={completion.note}
        editable={editable}
        onSave={(note) => onNoteSave(completion.id, note)}
      />

      {(editable || hasMedia) && (
        <View style={styles.attachmentSection}>
          <AttachmentGrid
            attachments={completion.attachments}
            signedUrls={signedUrls}
            editable={editable}
            onReorder={(ids) => onAttachmentReorder(completion.id, ids)}
            onDelete={(id) => onAttachmentDelete(completion.id, id)}
            onAdd={() => onAttachmentAdd(completion.id)}
          />
        </View>
      )}

      {editable && (
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => onAttachmentAdd(completion.id)}
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: t.surfaceRaised }, pressed && styles.pressed]}
          >
            <ThemedText style={styles.actionBtnText}>+ photo / video</ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function CollapsedRow({
  completion,
  onToggle,
}: {
  completion: OverviewCompletion;
  onToggle: () => void;
}) {
  const t = useTokens();
  const time = new Date(completion.completed_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const notePreview = completion.note
    ? completion.note.length > 40
      ? `${completion.note.slice(0, 40)}…`
      : completion.note
    : null;
  const mediaCount = completion.attachments.length;

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.collapsedRow, pressed && styles.pressed]}
    >
      <ThemedText style={styles.chevron}>▸</ThemedText>
      <View style={styles.collapsedContent}>
        <ThemedText style={styles.collapsedTime}>{time}</ThemedText>
        {notePreview && (
          <ThemedText style={styles.collapsedNote} numberOfLines={1}>
            {notePreview}
          </ThemedText>
        )}
      </View>
      {mediaCount > 0 && (
        <ThemedText style={[styles.mediaBadge, { backgroundColor: t.surfaceRaised }]}>
          {mediaCount} {mediaCount === 1 ? 'file' : 'files'}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function DisabledEditorPlaceholder() {
  const t = useTokens();
  return (
    <View style={styles.placeholder}>
      <ThemedText style={styles.placeholderLabel}>Note</ThemedText>
      <View style={[styles.placeholderInput, { backgroundColor: t.surfaceRaised }]}>
        <ThemedText style={styles.placeholderText}>
          Complete this habit to add a note
        </ThemedText>
      </View>
      <View style={[styles.placeholderInput, { backgroundColor: t.surfaceRaised, marginTop: 16 }]}>
        <ThemedText style={styles.placeholderText}>
          Complete this habit to add photos or videos
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  expanded: { gap: 4 },
  attachmentSection: { paddingHorizontal: 14, marginTop: 12 },
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
  actionBtnText: { fontSize: 14, fontWeight: '500' },
  pressed: { opacity: 0.6 },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  chevron: { fontSize: 14, opacity: 0.4 },
  collapsedContent: { flex: 1, gap: 2 },
  collapsedTime: { fontSize: 14, fontWeight: '500' },
  collapsedNote: { fontSize: 13, opacity: 0.5 },
  mediaBadge: {
    fontSize: 12,
    opacity: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  placeholder: { paddingHorizontal: 14, marginTop: 16, opacity: 0.4 },
  placeholderLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  placeholderInput: {
    padding: 12,
    borderRadius: 10,
  },
  placeholderText: { fontSize: 14 },
});

import { Pressable, StyleSheet, View } from 'react-native';

import { AttachmentGrid } from '@/components/attachment-grid';
import { CompletionNoteEditor } from '@/components/completion-note-editor';
import { ThemedText } from '@/components/themed-text';
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
  if (!expanded) {
    return (
      <CollapsedRow
        completion={completion}
        onToggle={onToggle}
      />
    );
  }

  return (
    <View style={styles.expanded}>
      <CompletionNoteEditor
        initialNote={completion.note}
        editable={editable}
        onSave={(note) => onNoteSave(completion.id, note)}
      />

      <View style={styles.attachmentSection}>
        <ThemedText style={styles.sectionLabel}>Attachments</ThemedText>
        <AttachmentGrid
          attachments={completion.attachments}
          signedUrls={signedUrls}
          editable={editable}
          onReorder={(ids) => onAttachmentReorder(completion.id, ids)}
          onDelete={(id) => onAttachmentDelete(completion.id, id)}
          onAdd={() => onAttachmentAdd(completion.id)}
        />
      </View>

      {editable && (
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => onAttachmentAdd(completion.id)}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
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
        <ThemedText style={styles.mediaBadge}>
          {mediaCount} {mediaCount === 1 ? 'file' : 'files'}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function DisabledEditorPlaceholder() {
  return (
    <View style={styles.placeholder}>
      <ThemedText style={styles.placeholderLabel}>Note</ThemedText>
      <View style={styles.placeholderInput}>
        <ThemedText style={styles.placeholderText}>
          Complete this habit to add a note
        </ThemedText>
      </View>
      <ThemedText style={[styles.placeholderLabel, { marginTop: 16 }]}>
        Attachments
      </ThemedText>
      <View style={styles.placeholderInput}>
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
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.6,
    marginBottom: 10,
  },
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
    backgroundColor: 'rgba(127,127,127,0.1)',
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
    backgroundColor: 'rgba(127,127,127,0.1)',
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
    backgroundColor: 'rgba(127,127,127,0.06)',
  },
  placeholderText: { fontSize: 14 },
});

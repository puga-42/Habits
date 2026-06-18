// Resting panel on the habit overview page. Shown only while the habit has an
// active rest covering the viewed date: the "resting until" line plus the rest's
// note and media. Editable for the owner, read-only for anyone else.

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AttachmentGrid } from '@/components/attachment-grid';
import { CompletionNoteEditor } from '@/components/completion-note-editor';
import { ThemedText } from '@/components/themed-text';
import {
  fetchActiveRestForHabit,
  updateRestNote,
  type ActiveRest,
} from '@/lib/rests';
import { useRestMedia } from '@/lib/use-rest-media';

type Props = {
  habitId: string;
  userId: string;
  isOwner: boolean;
  dateIso: string;
};

function formatUntil(endIso: string): string {
  const [y, m, d] = endIso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function HabitRestPanel({ habitId, userId, isOwner, dateIso }: Props) {
  const [rest, setRest] = useState<ActiveRest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchActiveRestForHabit(habitId, dateIso)
      .then((r) => {
        if (!cancelled) setRest(r);
      })
      .catch(() => {
        if (!cancelled) setRest(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [habitId, dateIso]);

  const { attachments, signedUrls, add, remove, reorder } = useRestMedia(
    rest?.id ?? null,
    userId,
  );

  if (loading || !rest) return null;

  return (
    <View style={styles.panel}>
      <ThemedText style={styles.title}>
        Resting until {formatUntil(rest.end_date)} zᶻᶻ
      </ThemedText>
      <CompletionNoteEditor
        initialNote={rest.note}
        editable={isOwner}
        onSave={(note) => {
          updateRestNote(rest.id, note);
          setRest((prev) => (prev ? { ...prev, note } : prev));
        }}
      />
      <View style={styles.mediaWrap}>
        <AttachmentGrid
          attachments={attachments}
          signedUrls={signedUrls}
          editable={isOwner}
          onReorder={reorder}
          onDelete={remove}
          onAdd={add}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.2)',
    paddingVertical: 12,
    marginBottom: 14,
  },
  title: { fontSize: 15, fontWeight: '600', paddingHorizontal: 14 },
  mediaWrap: { marginTop: 4 },
});

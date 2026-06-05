import { useCallback, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  type ViewToken,
  View,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';

import { AttachmentGrid } from '@/components/attachment-grid';
import { CompletionNoteEditor } from '@/components/completion-note-editor';
import { ThemedText } from '@/components/themed-text';
import { Palette, solidTint } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { OverviewCompletion } from '@/lib/habit-overview';

type Props = {
  completions: OverviewCompletion[];
  signedUrls: Map<string, string>;
  editable: boolean;
  activeIndex: number;
  onChangeIndex: (index: number) => void;
  effectiveNote: (c: OverviewCompletion) => string | null;
  onNoteSave: (completionId: string, note: string | null) => void;
  onAttachmentAdd: (completionId: string) => void;
  onAttachmentDelete: (completionId: string, attachmentId: string) => void;
  onAttachmentReorder: (completionId: string, ids: string[]) => void;
};

export function CompletionCardStack({
  completions,
  signedUrls,
  editable,
  activeIndex,
  onChangeIndex,
  effectiveNote,
  onNoteSave,
  onAttachmentAdd,
  onAttachmentDelete,
  onAttachmentReorder,
}: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const cardBg = solidTint(Palette.primary, 0.25, isDark);
  const borderColor = solidTint(Palette.primary, 0.4, isDark);
  const lavenderBg = solidTint(Palette.lavender, 0.15, isDark);

  const listRef = useRef<FlatList<OverviewCompletion>>(null);
  const [pageWidth, setPageWidth] = useState(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setPageWidth(e.nativeEvent.layout.width);
  }, []);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: pageWidth,
      offset: pageWidth * index,
      index,
    }),
    [pageWidth],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        onChangeIndex(viewableItems[0].index);
      }
    },
  );

  const renderItem = useCallback(
    ({ item: c }: { item: OverviewCompletion }) => (
      <View style={[styles.page, pageWidth > 0 && { width: pageWidth }]}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <CompletionCard
            completion={c}
            signedUrls={signedUrls}
            editable={editable}
            effectiveNote={effectiveNote}
            onNoteSave={onNoteSave}
            onAttachmentAdd={onAttachmentAdd}
            onAttachmentDelete={onAttachmentDelete}
            onAttachmentReorder={onAttachmentReorder}
            lavenderBg={lavenderBg}
          />
        </View>
      </View>
    ),
    [pageWidth, cardBg, borderColor, signedUrls, editable, effectiveNote, onNoteSave, onAttachmentAdd, onAttachmentDelete, onAttachmentReorder, lavenderBg],
  );

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {pageWidth > 0 && (
        <FlatList
          ref={listRef}
          data={completions}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          keyboardDismissMode="on-drag"
          getItemLayout={getItemLayout}
          initialScrollIndex={activeIndex}
          viewabilityConfig={viewabilityConfig.current}
          onViewableItemsChanged={onViewableItemsChanged.current}
          keyboardShouldPersistTaps="handled"
        />
      )}
      {completions.length > 1 && (
        <DotIndicators count={completions.length} activeIndex={activeIndex} />
      )}
    </View>
  );
}

function CompletionCard({
  completion,
  signedUrls,
  editable,
  effectiveNote,
  onNoteSave,
  onAttachmentAdd,
  onAttachmentDelete,
  onAttachmentReorder,
  lavenderBg,
}: {
  completion: OverviewCompletion;
  signedUrls: Map<string, string>;
  editable: boolean;
  effectiveNote: (c: OverviewCompletion) => string | null;
  onNoteSave: (completionId: string, note: string | null) => void;
  onAttachmentAdd: (completionId: string) => void;
  onAttachmentDelete: (completionId: string, attachmentId: string) => void;
  onAttachmentReorder: (completionId: string, ids: string[]) => void;
  lavenderBg: string;
}) {
  const time = new Date(completion.completed_at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <View style={styles.cardContent}>
      <ThemedText style={styles.cardTime}>{time}</ThemedText>
      <CompletionNoteEditor
        initialNote={effectiveNote(completion)}
        editable={editable}
        onSave={(note) => onNoteSave(completion.id, note)}
        inputBackgroundColor={lavenderBg}
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
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: lavenderBg },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText style={styles.actionBtnText}>
              + photo / video
            </ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function DotIndicators({
  count,
  activeIndex,
}: {
  count: number;
  activeIndex: number;
}) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, i === activeIndex && styles.dotActive]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 8 },
  page: { paddingHorizontal: 8 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardContent: { paddingVertical: 12, gap: 4 },
  cardTime: { fontSize: 13, opacity: 0.5, paddingHorizontal: 14 },
  attachmentSection: { paddingHorizontal: 14, marginTop: 8 },
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
  },
  actionBtnText: { fontSize: 14, fontWeight: '500' },
  pressed: { opacity: 0.6 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(127,127,127,0.25)',
  },
  dotActive: {
    backgroundColor: 'rgba(127,127,127,0.7)',
  },
});

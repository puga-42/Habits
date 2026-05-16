import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';

import { AddTile, AttachmentTile } from '@/components/attachment-tile';
import type { AttachmentDetail } from '@/lib/completions';
import { MAX_ATTACHMENTS } from '@/lib/completions';

type Props = {
  attachments: AttachmentDetail[];
  signedUrls: Map<string, string>;
  editable: boolean;
  onReorder: (orderedIds: string[]) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
};

export function AttachmentGrid({
  attachments,
  signedUrls,
  editable,
  onReorder,
  onDelete,
  onAdd,
}: Props) {
  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<AttachmentDetail>) => (
      <View style={styles.item}>
        <AttachmentTile
          attachment={item}
          signedUrl={signedUrls.get(item.storage_path)}
          onDelete={editable ? () => onDelete(item.id) : undefined}
          isActive={isActive}
        />
      </View>
    ),
    [signedUrls, editable, onDelete],
  );

  const renderFooter = useCallback(() => {
    if (!editable || attachments.length >= MAX_ATTACHMENTS) return null;
    return (
      <View style={styles.item}>
        <AddTile onPress={onAdd} />
      </View>
    );
  }, [editable, attachments.length, onAdd]);

  if (attachments.length === 0 && !editable) return null;

  if (!editable) {
    return (
      <View style={styles.readOnlyRow}>
        {attachments.map((a) => (
          <View key={a.id} style={styles.item}>
            <AttachmentTile
              attachment={a}
              signedUrl={signedUrls.get(a.storage_path)}
            />
          </View>
        ))}
      </View>
    );
  }

  return (
    <DraggableFlatList
      data={attachments}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      horizontal
      onDragEnd={({ data }) => onReorder(data.map((d) => d.id))}
      ListFooterComponent={renderFooter}
      contentContainerStyle={styles.list}
      showsHorizontalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 14, gap: 10 },
  item: { marginRight: 10 },
  readOnlyRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 10,
    flexWrap: 'wrap',
  },
});

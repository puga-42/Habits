// Bottom action row of the post-completion sheet: media add on the left, the
// accent ✓ commit button alone at the bottom right. Presentational — the
// sheet owns upload/note state.

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTokens } from '@/hooks/use-tokens';

type Props = {
  busy: boolean;
  onAddMedia: () => void;
  onConfirm: () => void;
};

export function CompletionSheetActions({ busy, onAddMedia, onConfirm }: Props) {
  const t = useTokens();
  return (
    <View style={styles.actions}>
      <Pressable
        onPress={onAddMedia}
        disabled={busy}
        accessibilityRole="button"
        style={[styles.mediaBtn, { backgroundColor: t.surfaceRaised }, busy && styles.dim]}>
        <ThemedText style={[styles.mediaText, { color: t.ink70 }]}>
          {busy ? 'Uploading…' : '+ photo / video'}
        </ThemedText>
      </Pressable>
      <View style={styles.spacer} />
      <Pressable
        onPress={onConfirm}
        accessibilityRole="button"
        accessibilityLabel="Done"
        style={[styles.confirm, { backgroundColor: t.accent }]}>
        <ThemedText style={[styles.confirmText, { color: t.onAccent }]}>✓</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  spacer: { flex: 1 },
  mediaBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999 },
  mediaText: { fontSize: 14, fontWeight: '600' },
  dim: { opacity: 0.6 },
  confirm: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { fontSize: 20, fontWeight: '800' },
});

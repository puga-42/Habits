import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTokens } from '@/hooks/use-tokens';
import { WEEKDAY_NAMES, validateHandle } from '@/lib/profile';

export function WeekStartPicker({
  visible,
  value,
  onPick,
  onClose,
}: {
  visible: boolean;
  value: number;
  onPick: (v: number) => void;
  onClose: () => void;
}) {
  const t = useTokens();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ThemedView style={s.root}>
        <SafeAreaView edges={['top']} style={s.root}>
          <View style={[s.header, { borderBottomColor: t.hairlineStrong }]}>
            <View style={s.headerSide} />
            <ThemedText type="defaultSemiBold">Week starts on</ThemedText>
            <Pressable onPress={onClose} hitSlop={12} style={s.headerSide}>
              <ThemedText style={s.done}>Done</ThemedText>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.list}>
            {WEEKDAY_NAMES.map((name, i) => (
              <Pressable
                key={i}
                onPress={() => onPick(i)}
                style={({ pressed }) => [s.option, pressed && s.optionPressed]}>
                <ThemedText style={s.radio}>{value === i ? '●' : '○'}</ThemedText>
                <ThemedText style={s.optionLabel}>{name}</ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

export function HandleEditor({
  visible,
  currentHandle,
  onSave,
  onClose,
}: {
  visible: boolean;
  currentHandle: string;
  onSave: (handle: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(currentHandle);
  const [error, setError] = useState<string | null>(null);
  const t = useTokens();

  function handleOpen() {
    setDraft(currentHandle);
    setError(null);
  }

  function handleSave() {
    const validation = validateHandle(draft);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    setError(null);
    onSave(draft.trim());
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} onShow={handleOpen}>
      <ThemedView style={s.root}>
        <SafeAreaView edges={['top']} style={s.root}>
          <View style={[s.header, { borderBottomColor: t.hairlineStrong }]}>
            <Pressable onPress={onClose} hitSlop={12} style={s.headerSide}>
              <ThemedText style={e.cancel}>Cancel</ThemedText>
            </Pressable>
            <ThemedText type="defaultSemiBold">Edit handle</ThemedText>
            <Pressable onPress={handleSave} hitSlop={12} style={s.headerSide}>
              <ThemedText style={e.save}>Save</ThemedText>
            </Pressable>
          </View>
          <View style={e.body}>
            <TextInput
              style={[e.input, { borderBottomColor: t.ink45, color: t.ink }]}
              value={draft}
              onChangeText={(t) => { setDraft(t); setError(null); }}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
              placeholder="your_handle"
              placeholderTextColor={t.ink45}
            />
            {error && <ThemedText style={e.error}>{error}</ThemedText>}
            <ThemedText style={e.hint}>3–30 characters: letters, numbers, and underscores only.</ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: { width: 60 },
  done: { fontSize: 16, fontWeight: '600', textAlign: 'right' },
  list: { paddingVertical: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  optionPressed: { opacity: 0.5 },
  radio: { fontSize: 18, width: 24 },
  optionLabel: { fontSize: 16 },
});

const e = StyleSheet.create({
  cancel: { fontSize: 16 },
  save: { fontSize: 16, fontWeight: '600', textAlign: 'right' },
  body: { paddingHorizontal: 20, paddingTop: 24, gap: 8 },
  input: {
    fontSize: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  error: { fontSize: 13, color: '#c0392b' },
  hint: { fontSize: 12, opacity: 0.5 },
});

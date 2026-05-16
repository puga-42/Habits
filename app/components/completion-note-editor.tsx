import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

const MAX_NOTE_LENGTH = 2000;
const CHAR_WARNING_THRESHOLD = 1800;

type Props = {
  initialNote: string | null;
  editable: boolean;
  onSave: (note: string | null) => void;
};

export function CompletionNoteEditor({ initialNote, editable, onSave }: Props) {
  const [text, setText] = useState(initialNote ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textColor = useThemeColor({}, 'text');
  const savedRef = useRef(initialNote ?? '');

  useEffect(() => {
    setText(initialNote ?? '');
    savedRef.current = initialNote ?? '';
  }, [initialNote]);

  const handleBlur = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = text.trim();
    if (trimmed !== savedRef.current) {
      savedRef.current = trimmed;
      onSave(trimmed || null);
    }
  }, [text, onSave]);

  const handleChange = useCallback(
    (value: string) => {
      const clamped = value.slice(0, MAX_NOTE_LENGTH);
      setText(clamped);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const trimmed = clamped.trim();
        if (trimmed !== savedRef.current) {
          savedRef.current = trimmed;
          onSave(trimmed || null);
        }
      }, 500);
    },
    [onSave],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!editable) {
    if (!text) return null;
    return (
      <View style={styles.container}>
        <ThemedText style={styles.label}>Note</ThemedText>
        <ThemedText style={styles.readOnly}>{text}</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>Note</ThemedText>
      <TextInput
        style={[styles.input, { color: textColor }]}
        value={text}
        onChangeText={handleChange}
        onBlur={handleBlur}
        placeholder="Add a note..."
        placeholderTextColor="rgba(127,127,127,0.5)"
        multiline
        maxLength={MAX_NOTE_LENGTH}
        scrollEnabled={false}
      />
      {text.length > CHAR_WARNING_THRESHOLD && (
        <ThemedText style={styles.charCount}>
          {text.length}/{MAX_NOTE_LENGTH}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 14, marginTop: 16 },
  label: { fontSize: 13, fontWeight: '600', opacity: 0.6, marginBottom: 6 },
  input: {
    fontSize: 15,
    lineHeight: 21,
    minHeight: 60,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(127,127,127,0.08)',
  },
  readOnly: { fontSize: 15, lineHeight: 21 },
  charCount: {
    fontSize: 11,
    opacity: 0.5,
    textAlign: 'right',
    marginTop: 4,
  },
});

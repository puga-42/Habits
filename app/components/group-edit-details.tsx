// Name + description fields for the single-group editor. Presentational — the
// screen owns the values and the save mutation. Limits mirror the DB checks:
// name 1–100, description ≤1000 (see 20260625000000 / 20260626000000).

import { StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTokens } from '@/hooks/use-tokens';

type Props = {
  name: string;
  description: string;
  textColor: string;
  onChangeName: (s: string) => void;
  onChangeDescription: (s: string) => void;
};

export function GroupEditDetails({
  name,
  description,
  textColor,
  onChangeName,
  onChangeDescription,
}: Props) {
  const t = useTokens();
  return (
    <>
      <ThemedText style={styles.label}>Name</ThemedText>
      <TextInput
        value={name}
        onChangeText={onChangeName}
        style={[styles.input, { backgroundColor: t.surfaceRaised, color: textColor }]}
        maxLength={100}
        returnKeyType="done"
      />

      <ThemedText style={styles.label}>Description</ThemedText>
      <TextInput
        value={description}
        onChangeText={onChangeDescription}
        placeholder="Who does this group help you become?"
        placeholderTextColor={t.ink45}
        style={[styles.input, styles.multiline, { backgroundColor: t.surfaceRaised, color: textColor }]}
        maxLength={1000}
        multiline
      />
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    opacity: 0.55,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 6,
  },
  input: {
    fontSize: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
});

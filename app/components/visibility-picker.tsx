import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { Visibility } from '@/lib/habits';

type Props = {
  habitVisibility: Visibility;
  currentOverride: Visibility | null;
  onChange: (override: Visibility | null) => void;
};

type Option = {
  label: string;
  value: Visibility | null;
};

export function VisibilityPicker({ habitVisibility, currentOverride, onChange }: Props) {
  if (habitVisibility === 'private') return null;

  const options = buildOptions(habitVisibility);

  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>Visibility</ThemedText>
      {options.map((opt) => {
        const selected = currentOverride === opt.value;
        return (
          <Pressable
            key={opt.label}
            onPress={() => onChange(opt.value)}
            style={styles.row}
          >
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected && <View style={styles.radioInner} />}
            </View>
            <ThemedText style={styles.optionLabel}>{opt.label}</ThemedText>
          </Pressable>
        );
      })}
      <ThemedText style={styles.hint}>Override can only narrow.</ThemedText>
    </View>
  );
}

function buildOptions(habitVisibility: Visibility): Option[] {
  if (habitVisibility === 'public') {
    return [
      { label: 'Same as habit (public)', value: null },
      { label: 'Friends only', value: 'friends' },
      { label: 'Only me', value: 'private' },
    ];
  }
  // friends
  return [
    { label: 'Same as habit (friends)', value: null },
    { label: 'Only me', value: 'private' },
  ];
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 14, marginTop: 20 },
  label: { fontSize: 13, fontWeight: '600', opacity: 0.6, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(127,127,127,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioSelected: { borderColor: '#7c3aed' },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7c3aed',
  },
  optionLabel: { fontSize: 15 },
  hint: { fontSize: 12, opacity: 0.5, marginTop: 8, fontStyle: 'italic' },
});

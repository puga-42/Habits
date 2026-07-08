// Small iOS-style segmented control: a track holding N equal segments, the
// selected one raised on an elevated pill. Generic over the option value.

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTokens } from '@/hooks/use-tokens';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: Props<T>) {
  const t = useTokens();

  return (
    <View style={styles.track}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, selected && { backgroundColor: t.surface }]}>
            <ThemedText style={[styles.label, selected && styles.labelSelected]}>
              {opt.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: 'rgba(120,120,128,0.16)',
    borderRadius: 9,
    padding: 2,
    gap: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 14, opacity: 0.7 },
  labelSelected: { opacity: 1, fontWeight: '600' },
});

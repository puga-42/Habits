import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTokens } from '@/hooks/use-tokens';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
};

export function FriendSearchBar({ value, onChangeText, onClear }: Props) {
  const t = useTokens();

  return (
    <View style={[styles.container, { backgroundColor: t.surfaceRaised }]}>
      <IconSymbol name="magnifyingglass" size={16} color={t.ink52} />
      <TextInput
        style={[styles.input, { color: t.ink }]}
        value={value}
        onChangeText={onChangeText}
        placeholder="Search by handle"
        placeholderTextColor={t.ink45}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable onPress={onClear} hitSlop={8}>
          <IconSymbol name="xmark.circle.fill" size={18} color={t.ink45} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginHorizontal: 14,
    marginVertical: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
});

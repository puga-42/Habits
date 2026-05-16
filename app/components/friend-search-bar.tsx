import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
};

export function FriendSearchBar({ value, onChangeText, onClear }: Props) {
  const textColor = useThemeColor({}, 'text');

  return (
    <View style={styles.container}>
      <IconSymbol name="magnifyingglass" size={16} color="rgba(127,127,127,0.6)" />
      <TextInput
        style={[styles.input, { color: textColor }]}
        value={value}
        onChangeText={onChangeText}
        placeholder="Search by handle"
        placeholderTextColor="rgba(127,127,127,0.5)"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable onPress={onClear} hitSlop={8}>
          <IconSymbol name="xmark.circle.fill" size={18} color="rgba(127,127,127,0.5)" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(127,127,127,0.12)',
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

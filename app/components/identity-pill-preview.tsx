// Pinned, read-only preview of how the identity card will look on the day
// view — mirrors GroupCardHeader's collapsed-pill visual language (tinted
// surface, rounded pill, display-voice name) and updates live as the user
// edits title / description / color below. The identity analogue of
// HabitPillPreview; purely presentational.

import { StyleSheet, View, useColorScheme } from 'react-native';

import { groupCardSurface } from '@/components/group-card-header';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Radii } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

type Props = {
  name: string;
  description: string;
  color: string | null;
};

export function IdentityPillPreview({ name, description, color }: Props) {
  const t = useTokens();
  const isDark = useColorScheme() !== 'light';
  const hasName = name.trim().length > 0;
  const hasDescription = description.trim().length > 0;

  return (
    <View style={[styles.wrap, { borderBottomColor: t.hairlineStrong }]}>
      <View
        style={[
          styles.pill,
          { backgroundColor: groupCardSurface(color, isDark, t.surface) },
        ]}>
        <IconSymbol name="chevron.right" size={14} weight="semibold" color={t.ink52} />
        <View style={styles.body}>
          <ThemedText
            type="displaySemiBold"
            style={[styles.name, !hasName && { color: t.ink45 }]}
            numberOfLines={1}>
            {hasName ? name : 'Identity name'}
          </ThemedText>
          {hasDescription ? (
            <ThemedText style={[styles.description, { color: t.ink52 }]} numberOfLines={2}>
              {description}
            </ThemedText>
          ) : null}
        </View>
        <IconSymbol name="info.circle" size={18} color={t.accent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: Radii.card,
  },
  body: { flex: 1 },
  name: { fontSize: 17 },
  description: { fontSize: 13, marginTop: 2 },
});

// iOS-style grouped form card: a rounded, slightly-elevated container that sits
// against the page background, with an optional uppercase section header above
// it. `CardList` renders inset hairline dividers between its (truthy) children,
// so rows sit flush inside the card with separators between — but not above the
// first or below the last. Used by the habit create/edit form groups.

import { Children, Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTokens } from '@/hooks/use-tokens';

export function FormCard({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const t = useTokens();
  return (
    <View style={styles.group}>
      {title ? <ThemedText style={styles.header}>{title}</ThemedText> : null}
      <View style={[styles.card, { backgroundColor: t.surface }]}>{children}</View>
    </View>
  );
}

export function CardList({ children }: { children: React.ReactNode }) {
  const items = Children.toArray(children); // drops null/false/undefined
  const t = useTokens();
  return (
    <>
      {items.map((child, i) => (
        <Fragment key={i}>
          {i > 0 && <View style={[styles.divider, { backgroundColor: t.hairlineStrong }]} />}
          {child}
        </Fragment>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  header: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.5,
    marginLeft: 4,
  },
  card: { borderRadius: 14, overflow: 'hidden' },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
});

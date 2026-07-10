// Instagram-style expandable text: long content collapses to a word-boundary
// excerpt ending in "… more"; expanded text ends in "Show less". Tapping
// ANYWHERE on the text toggles it — Text press handling naturally wins over
// an enclosing Pressable, so the surrounding card's own onPress (open habit)
// keeps working for every tap OUTSIDE the description. Short text carries no
// handler at all, so it stays part of the card's tap surface.

import { useState } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTokens } from '@/hooks/use-tokens';
import { truncateAtWord } from '@/lib/truncate-text';

type Props = {
  text: string;
  limit?: number;
  style?: StyleProp<TextStyle>;
};

export function ExpandableText({ text, limit = 80, style }: Props) {
  const t = useTokens();
  const [expanded, setExpanded] = useState(false);
  const { text: excerpt, truncated } = truncateAtWord(text, limit);

  if (!truncated) {
    return <ThemedText style={style}>{text}</ThemedText>;
  }

  return (
    <ThemedText
      style={style}
      onPress={() => setExpanded((v) => !v)}
      accessibilityRole="button"
      accessibilityLabel={expanded ? 'Show less' : 'Show more'}
      suppressHighlighting>
      {expanded ? text : excerpt}
      <ThemedText style={[style, { color: t.accent }]} suppressHighlighting>
        {expanded ? '  Show less' : '… more'}
      </ThemedText>
    </ThemedText>
  );
}

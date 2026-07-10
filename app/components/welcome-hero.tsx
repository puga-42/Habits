// Signed-out landing hero: placeholder brand lockup, identity-framed tagline,
// and three value-prop rows. One-shot entrance cascade (the same FadeInDown
// language the day-view cards use). Presentational — the sign-in screen owns
// all auth state and actions.

import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BrandMark } from '@/components/brand-mark';
import { StreakFlameIcon } from '@/components/streak-flame-icon';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Palette } from '@/constants/colors';
import { useTokens } from '@/hooks/use-tokens';

const STAGGER = 80;

export function WelcomeHero() {
  const t = useTokens();
  return (
    <View style={styles.root}>
      <Animated.View entering={FadeInDown.duration(300)}>
        <BrandMark />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(STAGGER).duration(300)}>
        <ThemedText style={[styles.tagline, { color: t.ink70 }]}>
          Small habits, for who you&apos;re becoming.
        </ThemedText>
      </Animated.View>

      <View style={styles.props}>
        <ValueProp
          delay={STAGGER * 2}
          icon={<IconSymbol name="person.crop.circle.fill" size={22} color={Palette.periwinkle} />}
          text="Group habits into identities — who you want to become"
        />
        <ValueProp
          delay={STAGGER * 3}
          icon={<StreakFlameIcon size={22} />}
          text="Streaks that fit your cadence, kind to rest days"
        />
        <ValueProp
          delay={STAGGER * 4}
          icon={<IconSymbol name="person.2.fill" size={22} color={Palette.rose} />}
          text="Share wins with friends and cheer each other on"
        />
      </View>
    </View>
  );
}

function ValueProp({
  delay,
  icon,
  text,
}: {
  delay: number;
  icon: React.ReactNode;
  text: string;
}) {
  const t = useTokens();
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(300)}
      style={styles.propRow}>
      <View style={[styles.propIcon, { backgroundColor: t.surfaceRaised }]}>{icon}</View>
      <ThemedText style={[styles.propText, { color: t.ink70 }]}>{text}</ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 12 },
  tagline: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
  props: { gap: 14, marginTop: 24, alignSelf: 'stretch' },
  propRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  propIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propText: { flex: 1, fontSize: 14.5, lineHeight: 20 },
});

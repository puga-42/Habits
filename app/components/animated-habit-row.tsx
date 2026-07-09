import type { ReactNode } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';

type Props = {
  entering?: boolean;
  // Delay before the enter animation starts. Day-change entrances keep the
  // default (past the 300ms layout transition); an expanding identity card
  // staggers this per row so the pills cascade downward as the card opens.
  enterDelay?: number;
  children: ReactNode;
};

export function AnimatedHabitRow({ entering, enterDelay = 300, children }: Props) {
  return (
    <Animated.View
      entering={
        entering ? FadeInDown.delay(enterDelay).duration(220) : undefined
      }
    >
      {children}
    </Animated.View>
  );
}

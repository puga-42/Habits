import type { ReactNode } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';

type Props = {
  entering?: boolean;
  children: ReactNode;
};

export function AnimatedHabitRow({ entering, children }: Props) {
  return (
    <Animated.View
      entering={entering ? FadeIn.delay(300).duration(250) : undefined}
    >
      {children}
    </Animated.View>
  );
}

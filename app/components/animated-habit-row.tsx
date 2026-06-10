import type { ReactNode } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';

type Props = {
  entering?: boolean;
  children: ReactNode;
};

export function AnimatedHabitRow({ entering, children }: Props) {
  return (
    <Animated.View entering={entering ? FadeIn.duration(350) : undefined}>
      {children}
    </Animated.View>
  );
}

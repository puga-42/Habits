import { useEffect, useRef } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export function useContentTransition(key: string, duration = 200) {
  const prevKey = useRef(key);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (key !== prevKey.current) {
      prevKey.current = key;
      opacity.value = withSequence(
        withTiming(0, { duration: duration / 2 }),
        withTiming(1, { duration: duration / 2 }),
      );
    }
  }, [key, opacity, duration]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
}

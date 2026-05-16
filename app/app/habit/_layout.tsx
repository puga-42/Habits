import { Stack } from 'expo-router';

import { HabitFormProvider } from '@/lib/habit-form';

export default function HabitLayout() {
  return (
    <HabitFormProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="view" />
        <Stack.Screen name="new" />
        <Stack.Screen name="recurrence" />
      </Stack>
    </HabitFormProvider>
  );
}

import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { HabitFormProvider } from '@/lib/habit-form';
import type { Visibility } from '@/lib/habits';
import { fetchProfile } from '@/lib/profile';

export default function HabitLayout() {
  const { session } = useAuth();
  const [defaultVisibility, setDefaultVisibility] = useState<Visibility>('public');

  useEffect(() => {
    if (!session?.user.id) return;
    fetchProfile(session.user.id)
      .then((p) => setDefaultVisibility(p.default_visibility))
      .catch(() => {});
  }, [session?.user.id]);

  return (
    <HabitFormProvider defaultVisibility={defaultVisibility}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="view" />
        <Stack.Screen name="new" />
        <Stack.Screen name="recurrence" />
      </Stack>
    </HabitFormProvider>
  );
}

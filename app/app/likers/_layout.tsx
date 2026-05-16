import { Stack } from 'expo-router';

export default function LikersLayout() {
  return <Stack screenOptions={{ headerShown: true, headerBackTitle: 'Back' }} />;
}

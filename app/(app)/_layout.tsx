import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

const HEADER_THEME = {
  headerStyle:      { backgroundColor: '#0a0a0f' },
  headerTintColor:  '#FFD700',
  headerTitleStyle: { color: '#ffffff' },
} as const;

export default function AppLayout() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/(auth)/login');
    }
  }, [session, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' }}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  if (!session) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="drone/[id]"
        options={{ presentation: 'modal', headerShown: true, title: 'Drone Detail', ...HEADER_THEME }}
      />
      <Stack.Screen
        name="mission/[id]"
        options={{ headerShown: true, title: 'Mission', ...HEADER_THEME }}
      />
      <Stack.Screen
        name="mission/new"
        options={{ headerShown: true, title: 'New Mission', ...HEADER_THEME }}
      />
    </Stack>
  );
}

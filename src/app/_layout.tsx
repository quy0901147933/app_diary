import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthSession } from '@/hooks/use-auth-session';
import { useUserPersona } from '@/hooks/use-persona';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <AuthGate />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AuthGate() {
  const session = useAuthSession();
  const personaQuery = useUserPersona(session?.user.id);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const top = segments[0];
    const inAuth = top === 'auth';
    const inOnboarding = top === 'onboarding';

    if (!session) {
      if (!inAuth) router.replace('/auth');
      return;
    }
    if (personaQuery.isLoading) return;
    const needsOnboarding = !personaQuery.data?.completed_at;
    if (needsOnboarding && !inOnboarding) {
      router.replace('/onboarding');
    } else if (!needsOnboarding && inAuth) {
      // First-time complete → home. But if user manually navigated to /onboarding
      // to redo persona, leave them be.
      router.replace('/');
    }
  }, [router, segments, session, personaQuery.isLoading, personaQuery.data?.completed_at]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
      <Stack.Screen
        name="capture"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="chat"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="journal-editor"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="onboarding"
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <Stack.Screen
        name="profile"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="privacy"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="mood"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="settings"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_right' }}
      />
    </Stack>
  );
}

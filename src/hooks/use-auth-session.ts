import { useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/services/supabase';
import { pingLastSeen, registerPushTokenForUser } from '@/services/push';
import { pingBackend } from '@/services/ai-api';
import { useAuthStore } from '@/stores/auth-store';
import { usePrivacyStore } from '@/stores/privacy-store';

export function useAuthSession() {
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'SIGNED_OUT') usePrivacyStore.getState().lockAll();
    });
    return () => data.subscription.unsubscribe();
  }, [setSession]);

  // Register push token + ping presence on auth, foreground, and every 5 minutes.
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;

    void registerPushTokenForUser(userId);
    void pingLastSeen(userId);
    // Wake the AI backend dyno asap so feature screens don't pay the
    // ~30s Render free-tier cold start when the user opens them.
    void pingBackend();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void pingLastSeen(userId);
        void pingBackend();
      }
    });
    const interval = setInterval(() => void pingLastSeen(userId), 5 * 60 * 1000);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [session?.user.id]);

  return session;
}

import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

type AuthStore = {
  session: Session | null;
  setSession: (session: Session | null) => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}));

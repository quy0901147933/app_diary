import { create } from 'zustand';
import type { LockKey } from '@/services/privacy-lock';

type PrivacyStore = {
  unlocked: Record<LockKey, boolean>;
  enabled: Record<LockKey, boolean>;
  setEnabled: (key: LockKey, value: boolean) => void;
  unlock: (key: LockKey) => void;
  lockAll: () => void;
};

export const usePrivacyStore = create<PrivacyStore>((set) => ({
  unlocked: { lumina: false, archive: false },
  enabled: { lumina: false, archive: false },
  setEnabled: (key, value) =>
    set((s) => ({
      enabled: { ...s.enabled, [key]: value },
      unlocked: { ...s.unlocked, [key]: value ? false : true },
    })),
  unlock: (key) =>
    set((s) => ({ unlocked: { ...s.unlocked, [key]: true } })),
  lockAll: () =>
    set({ unlocked: { lumina: false, archive: false } }),
}));

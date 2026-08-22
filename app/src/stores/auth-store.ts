import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

type AuthState = {
  isHydrated: boolean;
  session: Session | null;
  setSession: (session: Session | null) => void;
  setHydrated: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  isHydrated: false,
  session: null,
  setSession: (session) => set({ session }),
  setHydrated: () => set({ isHydrated: true }),
}));

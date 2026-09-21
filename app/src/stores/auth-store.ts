import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

type AuthState = {
  isHydrated: boolean;
  session: Session | null;
  sessionEpoch: number;
  setSession: (session: Session | null) => void;
  setHydrated: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  isHydrated: false,
  session: null,
  sessionEpoch: 0,
  setSession: (session) =>
    set((state) => ({
      session,
      sessionEpoch: state.sessionEpoch + (state.session?.user.id !== session?.user.id ? 1 : 0),
    })),
  setHydrated: () => set({ isHydrated: true }),
}));

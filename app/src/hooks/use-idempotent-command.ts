import { useMemo } from 'react';
import * as Crypto from 'expo-crypto';
import { createCommandExecutor } from '@/lib/command-executor';
import { sessionStorage } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';

export function useIdempotentCommand() {
  return useMemo(
    () =>
      createCommandExecutor({
        storage: sessionStorage,
        hash: (value) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
        uuid: () => Crypto.randomUUID(),
        identity: () => {
          const state = useAuthStore.getState();
          return state.session
            ? { userId: state.session.user.id, epoch: state.sessionEpoch }
            : null;
        },
      }),
    [],
  );
}

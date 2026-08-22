import { create } from 'zustand';

type UiState = {
  isOfflineNoticeVisible: boolean;
  setOfflineNoticeVisible: (isVisible: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  isOfflineNoticeVisible: false,
  setOfflineNoticeVisible: (isOfflineNoticeVisible) => set({ isOfflineNoticeVisible }),
}));

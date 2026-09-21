// Web only. Metro resolves session-storage.native.ts on Android/iOS.
export const sessionStorage = {
  async getItem(key: string) {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    window.localStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
  },
};

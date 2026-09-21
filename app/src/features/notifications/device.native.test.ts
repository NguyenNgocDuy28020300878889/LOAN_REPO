import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  state: { session: { user: { id: 'user-a' }, access_token: 'jwt-a' }, sessionEpoch: 1 },
  permission: vi.fn(),
  requestPermission: vi.fn(),
  token: vi.fn(),
  channel: vi.fn(),
  rpc: vi.fn(),
  headers: [] as string[],
  storage: new Map<string, string>(),
  push: true,
}));
vi.mock('expo-notifications', () => ({
  getPermissionsAsync: mocks.permission,
  requestPermissionsAsync: mocks.requestPermission,
  getExpoPushTokenAsync: mocks.token,
  getNotificationChannelAsync: mocks.channel,
  setNotificationChannelAsync: vi.fn(),
  dismissAllNotificationsAsync: vi.fn(),
  clearLastNotificationResponseAsync: vi.fn(),
  AndroidImportance: { DEFAULT: 3, NONE: 0 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mocks.storage.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mocks.storage.set(key, value);
  },
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'a4000000-0000-4000-8000-000000000001' }));
vi.mock('expo-constants', () => ({ default: { easConfig: { projectId: 'project-id' } } }));
vi.mock('expo-localization', () => ({ getCalendars: () => [{ timeZone: 'Asia/Ho_Chi_Minh' }] }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('@/lib/env', () => ({ env: { pushReady: true, appEnv: 'development' } }));
vi.mock('@/stores/auth-store', () => ({ useAuthStore: { getState: () => mocks.state } }));
vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    rpc: (name: string, args: unknown) => ({
      setHeader: (_name: string, value: string) => {
        mocks.headers.push(value);
        return mocks.rpc(name, args);
      },
    }),
  }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.storage.clear();
  mocks.headers.length = 0;
  mocks.push = true;
  mocks.state = { session: { user: { id: 'user-a' }, access_token: 'jwt-a' }, sessionEpoch: 1 };
  mocks.permission.mockResolvedValue({ granted: true, canAskAgain: true });
  mocks.requestPermission.mockResolvedValue({ granted: true, canAskAgain: true });
  mocks.channel.mockResolvedValue({ importance: 3 });
  mocks.token.mockResolvedValue({ data: 'ExpoPushToken[test]' });
  mocks.rpc.mockImplementation(async (name: string) => ({
    error: null,
    data:
      name === 'get_my_notification_preferences'
        ? { push_enabled: mocks.push }
        : name === 'ensure_my_profile'
          ? { locale: 'vi' }
          : null,
  }));
});

describe('native push registration', () => {
  it('registers only granted devices with a pinned JWT, locale and timezone', async () => {
    const { syncPushDevice } = await import('./device.native');
    expect(await syncPushDevice()).toBe('ready');
    expect(mocks.rpc).toHaveBeenCalledWith(
      'register_push_device',
      expect.objectContaining({
        timezone_input: 'Asia/Ho_Chi_Minh',
        locale_input: 'vi',
        token_input: 'ExpoPushToken[test]',
      }),
    );
    expect(mocks.headers.every((value) => value === 'Bearer jwt-a')).toBe(true);
    expect(mocks.requestPermission).not.toHaveBeenCalled();
  });
  it('does not prompt automatically', async () => {
    mocks.permission.mockResolvedValue({ granted: false, canAskAgain: true });
    const { syncPushDevice } = await import('./device.native');
    expect(await syncPushDevice()).toBe('permissionNeeded');
    expect(mocks.requestPermission).not.toHaveBeenCalled();
    expect(mocks.token).not.toHaveBeenCalled();
  });
  it('requests permission only after the user action', async () => {
    mocks.permission.mockResolvedValue({ granted: false, canAskAgain: true });
    const { syncPushDevice } = await import('./device.native');
    expect(await syncPushDevice(true)).toBe('ready');
    expect(mocks.requestPermission).toHaveBeenCalledOnce();
  });
  it('reports blocked channels and never registers a token', async () => {
    mocks.channel.mockResolvedValue({ importance: 0 });
    const { syncPushDevice } = await import('./device.native');
    expect(await syncPushDevice()).toBe('blocked');
    expect(mocks.token).not.toHaveBeenCalled();
  });
  it('does not register after an account switch while awaiting the push token', async () => {
    mocks.token.mockImplementation(async () => {
      mocks.state = { session: { user: { id: 'user-b' }, access_token: 'jwt-b' }, sessionEpoch: 2 };
      return { data: 'ExpoPushToken[test]' };
    });
    const { syncPushDevice } = await import('./device.native');
    await expect(syncPushDevice()).rejects.toThrow('SESSION_CHANGED');
    expect(mocks.rpc.mock.calls.some(([name]) => name === 'register_push_device')).toBe(false);
  });
  it('disables the registered device when preference is switched off', async () => {
    const { syncPushDevice } = await import('./device.native');
    await syncPushDevice();
    mocks.push = false;
    expect(await syncPushDevice()).toBe('disabled');
    expect(mocks.rpc).toHaveBeenCalledWith('unregister_push_device', expect.any(Object));
  });
  it('serializes registration and logout revocation', async () => {
    const { syncPushDevice, unregisterPushDevice } = await import('./device.native');
    await Promise.all([syncPushDevice(), unregisterPushDevice()]);
    expect(mocks.rpc.mock.calls.map(([name]) => name).slice(-2)).toEqual([
      'register_push_device',
      'unregister_push_device',
    ]);
  });
});

// Web never registers a native push token.
export type DevicePushState = 'unavailable' | 'permissionNeeded' | 'blocked' | 'disabled' | 'ready';
export async function syncPushDevice(_requestPermission = false): Promise<DevicePushState> {
  return 'unavailable';
}
export async function unregisterPushDevice(): Promise<void> {}
export async function clearPushTray(): Promise<void> {}

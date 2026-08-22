import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from './ui-store';

describe('ui store', () => {
  beforeEach(() => {
    useUiStore.setState({ isOfflineNoticeVisible: false });
  });

  it('sets the offline-notice visibility', () => {
    useUiStore.getState().setOfflineNoticeVisible(true);

    expect(useUiStore.getState().isOfflineNoticeVisible).toBe(true);
  });
});

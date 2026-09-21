import { afterEach, describe, expect, it, vi } from 'vitest';
import { Alert } from './alert.web';
import { shareInviteLink } from './share-invite.web';

afterEach(() => vi.unstubAllGlobals());
describe('browser confirmation and sharing', () => {
  it('never submits a financial action after cancel', () => {
    vi.stubGlobal('window', { confirm: () => false });
    const submit = vi.fn();
    Alert.alert('Confirm', 'Change balance?', [{ style: 'cancel' }, { onPress: submit }]);
    expect(submit).not.toHaveBeenCalled();
  });
  it('submits once after explicit confirmation', () => {
    vi.stubGlobal('window', { confirm: () => true });
    const submit = vi.fn();
    Alert.alert('Confirm', 'Change balance?', [{ style: 'cancel' }, { onPress: submit }]);
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it('acknowledges a result before running navigation', () => {
    const calls: string[] = [];
    vi.stubGlobal('window', { alert: () => calls.push('acknowledged') });
    Alert.alert('Saved', '', [{ onPress: () => calls.push('navigate') }]);
    expect(calls).toEqual(['acknowledged', 'navigate']);
  });
  it('offers a selectable link without clipboard or Web Share', async () => {
    const prompt = vi.fn();
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('window', { prompt });
    await shareInviteLink('https://example.invalid/invite/test', 'Share invite');
    expect(prompt).toHaveBeenCalledWith('Share invite', 'https://example.invalid/invite/test');
  });
  it('respects share cancellation and offers manual copying when activation is lost', async () => {
    const share = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'))
      .mockRejectedValueOnce(new Error('Unavailable'));
    vi.stubGlobal('navigator', { share });
    const prompt = vi.fn();
    vi.stubGlobal('window', { prompt });
    await expect(shareInviteLink('https://example.invalid', 'Share')).resolves.toBeUndefined();
    expect(prompt).not.toHaveBeenCalled();
    await shareInviteLink('https://example.invalid', 'Share');
    expect(prompt).toHaveBeenCalledWith('Share', 'https://example.invalid');
  });
});

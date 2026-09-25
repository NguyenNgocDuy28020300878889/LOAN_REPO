import { describe, expect, it, vi, beforeEach } from 'vitest';
import { copyToClipboard } from './clipboard';

describe('copyToClipboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses navigator.clipboard.writeText when available on web', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', {
      clipboard: { writeText },
    });

    const result = await copyToClipboard('https://example.com/invite/123');
    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://example.com/invite/123');
  });

  it('falls back to document.execCommand when clipboard API throws', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
      },
    });

    const execCommand = vi.fn().mockReturnValue(true);
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue({
        style: {},
        focus: vi.fn(),
        select: vi.fn(),
      }),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      execCommand,
    });

    const result = await copyToClipboard('https://example.com/invite/fallback');
    expect(result).toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
  });
});

import { describe, expect, it } from 'vitest';
import links from './generate-assetlinks.cjs';
import guards from './build-environment.cjs';

const fingerprint = Array.from({ length: 32 }, (_, index) =>
  index.toString(16).padStart(2, '0'),
).join(':');

describe('Android Digital Asset Links generator', () => {
  it('generates an exact production package association with normalized fingerprints', () => {
    expect(links.createAssetLinks('production', `${fingerprint}, ${fingerprint}`)).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.loanappmobiles.loanapp',
          sha256_cert_fingerprints: [fingerprint.toUpperCase()],
        },
      },
    ]);
  });
  it('keeps staging package associations separate', () => {
    expect(links.createAssetLinks('staging', fingerprint)[0].target.package_name).toBe(
      'com.loanappmobiles.loanapp.staging',
    );
  });
  it('rejects placeholders, malformed fingerprints and development packages', () => {
    for (const value of ['', 'SHA256', 'AA:BB', `${fingerprint},not-a-fingerprint`]) {
      expect(() => links.normalizeFingerprints(value)).toThrow();
    }
    expect(() => links.createAssetLinks('development', fingerprint)).toThrow();
    for (const origin of [
      'http://loan.example.com',
      'https://user@loan.example.com',
      'https://loan.example.com:8443',
      'https://loan.example.com/path',
      'https://localhost',
    ]) {
      expect(guards.validPublicOrigin(origin)).toBe(false);
    }
  });
});

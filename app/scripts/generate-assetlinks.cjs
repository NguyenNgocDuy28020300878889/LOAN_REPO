const fs = require('node:fs');
const path = require('node:path');
const { validPublicOrigin } = require('./build-environment.cjs');

const fingerprintPattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

function normalizeFingerprints(value) {
  const fingerprints = String(value ?? '')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  if (!fingerprints.length || fingerprints.some((item) => !fingerprintPattern.test(item))) {
    throw new Error('ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS must contain SHA-256 fingerprints.');
  }
  return [...new Set(fingerprints)];
}

function packageForEnvironment(environment) {
  if (environment === 'production') return 'com.loanappmobiles.loanapp';
  if (environment === 'staging') return 'com.loanappmobiles.loanapp.staging';
  throw new Error('App Links may be generated only for staging or production.');
}

function createAssetLinks(environment, fingerprints) {
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: packageForEnvironment(environment),
        sha256_cert_fingerprints: normalizeFingerprints(fingerprints),
      },
    },
  ];
}

module.exports = { createAssetLinks, normalizeFingerprints, packageForEnvironment };

if (require.main === module) {
  const environment = process.env.EXPO_PUBLIC_APP_ENV;
  const originValue = process.env.EXPO_PUBLIC_APP_LINK_ORIGIN ?? '';
  if (!validPublicOrigin(originValue)) {
    throw new Error('EXPO_PUBLIC_APP_LINK_ORIGIN must be a clean HTTPS origin.');
  }
  const origin = new URL(originValue);
  const document = createAssetLinks(
    environment,
    process.env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS,
  );
  const output = path.resolve(
    process.argv[2] ?? `.local/app-links/${environment}/.well-known/assetlinks.json`,
  );
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`, { flag: 'w' });
  console.log(
    `Created ${output} for ${origin.origin} and ${document[0].target.package_name}. Deploy it as /.well-known/assetlinks.json.`,
  );
}

const { assertBuildEnvironment } = require('./scripts/build-environment.cjs');

module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE || process.env.EAS_BUILD === 'true') {
    assertBuildEnvironment(process.env);
  }
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
  if (!['development', 'staging', 'production'].includes(appEnv)) {
    throw new Error('EXPO_PUBLIC_APP_ENV must be development, staging, or production.');
  }
  const suffix = appEnv === 'production' ? '' : appEnv === 'staging' ? '.staging' : '.dev';
  // Validate on the build worker, where EAS file variables are materialized.
  if (
    process.env.EAS_BUILD === 'true' &&
    process.env.EAS_BUILD_PLATFORM === 'android' &&
    process.env.EXPO_PUBLIC_PUSH_READY === 'true'
  ) {
    const file = process.env.GOOGLE_SERVICES_JSON;
    if (!file) throw new Error('GOOGLE_SERVICES_JSON is required when Android push is enabled.');
    const firebase = JSON.parse(require('node:fs').readFileSync(file, 'utf8'));
    if (firebase.type === 'service_account' || firebase.private_key)
      throw new Error('Expected Firebase client config, not a service account key.');
    if (
      !firebase.client?.some(
        (client) =>
          client.client_info?.android_client_info?.package_name ===
          `com.loanappmobiles.loanapp${suffix}`,
      )
    ) {
      throw new Error('Firebase Android package does not match the selected environment.');
    }
  }
  return {
    ...config,
    name: appEnv === 'production' ? 'Loan' : `Loan (${appEnv})`,
    scheme: appEnv === 'production' ? 'loan' : `loan-${appEnv}`,
    android: {
      ...config.android,
      package: `com.loanappmobiles.loanapp${suffix}`,
      allowBackup: false,
      ...(process.env.GOOGLE_SERVICES_JSON
        ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
        : {}),
      blockedPermissions: [
        ...new Set([
          ...(config.android?.blockedPermissions ?? []),
          'android.permission.SYSTEM_ALERT_WINDOW',
          'android.permission.READ_EXTERNAL_STORAGE',
          'android.permission.WRITE_EXTERNAL_STORAGE',
        ]),
      ],
    },
    ios: { ...config.ios, bundleIdentifier: `com.loanappmobiles.loanapp${suffix}` },
    extra: { ...config.extra, appEnv },
    plugins: [
      ...(config.plugins ?? []),
      ['expo-notifications', { defaultChannel: 'loan-updates' }],
      ['expo-dev-client', { addGeneratedScheme: appEnv === 'development' }],
      ['expo-secure-store', { configureAndroidBackup: true }],
    ],
  };
};

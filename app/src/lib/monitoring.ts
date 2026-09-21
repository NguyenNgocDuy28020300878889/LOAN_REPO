import * as Sentry from '@sentry/react-native';

import { env } from '@/lib/env';
import { privateErrorEvent } from '@/lib/telemetry-privacy';

Sentry.init({
  dsn: env.sentryDsn || undefined,
  enabled: Boolean(env.sentryDsn),
  environment: env.appEnv,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  enableAutoSessionTracking: false,
  // Native crash envelopes bypass the JS sanitizer. Enable only after a
  // separately verified native privacy configuration is in place.
  enableNative: false,
  beforeBreadcrumb: () => null,
  beforeSend: privateErrorEvent,
  beforeSendTransaction: () => null,
});

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!env.sentryDsn) return;

  Sentry.captureException(error, { extra: context });
}

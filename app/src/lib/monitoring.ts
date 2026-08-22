import * as Sentry from '@sentry/react-native';

import { env } from '@/lib/env';

Sentry.init({
  dsn: env.sentryDsn || undefined,
  enabled: Boolean(env.sentryDsn),
  environment: env.appEnv,
  sendDefaultPii: false,
  tracesSampleRate: env.appEnv === 'production' ? 0.1 : 0,
});

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!env.sentryDsn) return;

  Sentry.captureException(error, { extra: context });
}

import type { ErrorEvent } from '@sentry/react-native';

const safeErrors = new Set([
  'AUTHENTICATION_REQUIRED',
  'SESSION_CHANGED',
  'AUTH_FLOW_MISSING',
  'AUTH_FLOW_EXPIRED',
  'INVALID_AUTH_CALLBACK',
  'INVALID_AUTH_CODE',
  'AUTH_CALLBACK_FAILED',
  'AUTH_SESSION_MISSING',
  'LOAN_ACCESS_DENIED',
  'IDEMPOTENCY_PAYLOAD_MISMATCH',
  'SESSION_STORAGE_LIMIT',
  'PASSWORD_RECOVERY_REQUIRED',
  'COMMAND_STORAGE_INVALID',
  'ACCOUNT_DELETION_BLOCKED',
  'REAUTHENTICATION_REQUIRED',
  'ACCOUNT_DELETION_FAILED',
  'DELETION_ALREADY_PROCESSING',
  'DELETION_REQUEST_REQUIRED',
]);
// Financial text, invite URLs, tokens and email addresses may appear anywhere
// in third-party errors. Build an allowlisted event; do not recursively redact
// arbitrary payloads, where new fields could silently leak sensitive data.
export function privateErrorEvent(event: ErrorEvent): ErrorEvent {
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    release: event.release,
    dist: event.dist,
    environment: event.environment,
    exception: {
      values: event.exception?.values?.map((exception) => ({
        type: 'Error',
        value: safeErrors.has(exception.value ?? '')
          ? exception.value
          : 'Unexpected application error',
        stacktrace: exception.stacktrace
          ? {
              frames: exception.stacktrace.frames?.map((frame) => ({
                // Retain only build bundle locations, never navigation/network URLs.
                filename:
                  frame.filename &&
                  /^(?:app:\/\/\/)?(?:index\.android\.bundle|index\.bundle)$/.test(frame.filename)
                    ? frame.filename
                    : undefined,
                lineno: frame.lineno,
                colno: frame.colno,
                in_app: frame.in_app,
              })),
            }
          : undefined,
      })),
    },
  };
}

import { getSupabaseClient } from '@/lib/supabase';

export const EMAIL_OTP_RESEND_SECONDS = 60;
export const EMAIL_OTP_LENGTH = 8;

export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('INVALID_EMAIL');
  return email;
}

export async function requestEmailOtp(value: string) {
  const email = normalizeEmail(value);
  const { error } = await getSupabaseClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
  return email;
}

export async function verifyEmailOtp(email: string, value: string) {
  const token = value.trim();
  if (!new RegExp(`^\\d{${EMAIL_OTP_LENGTH}}$`).test(token)) throw new Error('INVALID_OTP');
  const { data, error } = await getSupabaseClient().auth.verifyOtp({
    email: normalizeEmail(email),
    token,
    type: 'email',
  });
  if (error) throw error;
  if (!data.session) throw new Error('AUTH_SESSION_MISSING');
  return data.session;
}

export function emailOtpErrorKey(error: unknown, verifying = false) {
  const candidate = error as { status?: number; code?: string; message?: string } | null;
  if (candidate?.status === 429 || candidate?.code === 'over_email_send_rate_limit')
    return 'auth.otpRateLimited';
  if (candidate?.message === 'INVALID_EMAIL') return 'auth.enterEmail';
  if (candidate?.message === 'INVALID_OTP') return 'auth.otpInvalidFormat';
  if (verifying && candidate?.code === 'otp_expired') return 'auth.otpInvalid';
  return 'auth.unavailable';
}

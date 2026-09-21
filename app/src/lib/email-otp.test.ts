import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emailOtpErrorKey, normalizeEmail, requestEmailOtp, verifyEmailOtp } from './email-otp';

const auth = vi.hoisted(() => ({ signInWithOtp: vi.fn(), verifyOtp: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ getSupabaseClient: () => ({ auth }) }));
beforeEach(() => vi.resetAllMocks());

describe('email code authentication', () => {
  it('requests registration or sign-in without supplying a password', async () => {
    auth.signInWithOtp.mockResolvedValue({ error: null });
    await expect(requestEmailOtp(' User@Gmail.com ')).resolves.toBe('user@gmail.com');
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'user@gmail.com',
      options: { shouldCreateUser: true },
    });
  });
  it('rejects malformed input before contacting Auth', async () => {
    expect(() => normalizeEmail('not an email')).toThrow('INVALID_EMAIL');
    await expect(verifyEmailOtp('user@gmail.com', '123456')).rejects.toThrow('INVALID_OTP');
    await expect(verifyEmailOtp('user@gmail.com', '12a45678')).rejects.toThrow('INVALID_OTP');
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
  it('verifies against the exact email and requires a server session', async () => {
    auth.verifyOtp.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(verifyEmailOtp(' User@Gmail.com ', '01234567')).rejects.toThrow(
      'AUTH_SESSION_MISSING',
    );
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'user@gmail.com',
      token: '01234567',
      type: 'email',
    });
    const session = { user: { id: 'synthetic' } };
    auth.verifyOtp.mockResolvedValueOnce({ data: { session }, error: null });
    await expect(verifyEmailOtp('user@gmail.com', '01234567')).resolves.toEqual(session);
  });
  it('propagates failed sends without claiming a code was sent', async () => {
    const error = { status: 429, code: 'over_email_send_rate_limit' };
    auth.signInWithOtp.mockResolvedValue({ error });
    await expect(requestEmailOtp('user@gmail.com')).rejects.toEqual(error);
    expect(emailOtpErrorKey(error)).toBe('auth.otpRateLimited');
  });
  it('shows safe errors without exposing backend messages or account existence', () => {
    expect(emailOtpErrorKey({ code: 'otp_expired' }, true)).toBe('auth.otpInvalid');
    expect(emailOtpErrorKey({ message: 'internal secret', code: 'user_not_found' })).toBe(
      'auth.unavailable',
    );
  });
});

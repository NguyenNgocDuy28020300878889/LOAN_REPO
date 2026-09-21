import { useEffect, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { safeReturnPath } from '@/lib/auth-callback';
import {
  EMAIL_OTP_RESEND_SECONDS,
  EMAIL_OTP_LENGTH,
  emailOtpErrorKey,
  requestEmailOtp,
  verifyEmailOtp,
} from '@/lib/email-otp';
import { env } from '@/lib/env';
import { signInWithGoogle } from '@/lib/google-sign-in';
import { useAuthStore } from '@/stores/auth-store';
import {
  base,
  Brand,
  Button,
  Card,
  Field,
  Label,
  Notice,
  Screen,
  usePalette,
} from '@/components/loan-ui';

const localEmail = /^http:\/\/(127\.0\.0\.1|localhost):/.test(env.supabase.url);

export default function AuthScreen() {
  const p = usePalette();
  const { t } = useTranslation();
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const session = useAuthStore((state) => state.session);
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [errorKey, setErrorKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const busy = useRef(false);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));

  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= retryAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);

  const sendCode = async () => {
    if (!env.emailOtpReady) return;
    if (busy.current || Date.now() < retryAt) return;
    busy.current = true;
    setLoading(true);
    setErrorKey('');
    try {
      const recipient = await requestEmailOtp(sentTo || email);
      setSentTo(recipient);
      setCode('');
      setNow(Date.now());
      setRetryAt(Date.now() + EMAIL_OTP_RESEND_SECONDS * 1000);
    } catch (error) {
      const key = emailOtpErrorKey(error);
      setErrorKey(key);
      if (key === 'auth.otpRateLimited') {
        setNow(Date.now());
        setRetryAt(Date.now() + EMAIL_OTP_RESEND_SECONDS * 1000);
      }
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  const confirmCode = async () => {
    if (busy.current || !sentTo) return;
    busy.current = true;
    setLoading(true);
    setErrorKey('');
    try {
      await verifyEmailOtp(sentTo, code);
      setCode('');
      router.replace(safeReturnPath(returnTo) as never);
    } catch (error) {
      setErrorKey(emailOtpErrorKey(error, true));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  const continueWithGoogle = async () => {
    if (!env.googleAuthReady || busy.current) return;
    busy.current = true;
    setGoogleLoading(true);
    setErrorKey('');
    try {
      const target = await signInWithGoogle(safeReturnPath(returnTo));
      if (target) router.replace(target as never);
    } catch {
      setErrorKey('auth.googleFailed');
    } finally {
      busy.current = false;
      setGoogleLoading(false);
    }
  };

  if (session) return <Redirect href={safeReturnPath(returnTo) as never} />;

  return (
    <Screen>
      <Brand />
      <View style={{ gap: 12, paddingVertical: 8 }}>
        <Text accessibilityRole="header" style={[base.amount, { color: p.text }]}>
          {t(sentTo ? 'auth.otpTitle' : 'auth.signIn')}
        </Text>
        <Label muted>
          {t(sentTo ? 'auth.otpSentTo' : 'auth.googleSubtitle', { email: sentTo })}
        </Label>
      </View>
      {returnTo && <Notice>{t('ui.invitePrivate')}</Notice>}
      {!sentTo && (
        <Card>
          <Button
            label={t('auth.continueWithGoogle')}
            loading={googleLoading}
            disabled={!env.googleAuthReady || loading}
            onPress={() => void continueWithGoogle()}
          />
          {!env.googleAuthReady && <Label muted>{t('auth.googleSetupPending')}</Label>}
        </Card>
      )}
      {errorKey ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Notice tone="danger">{t(errorKey)}</Notice>
        </View>
      ) : null}
      <Card>
        {!sentTo && <Label>{t('auth.emailFallback')}</Label>}
        {!sentTo && <Label muted>{t('auth.emailFallbackHelp')}</Label>}
        {localEmail && <Notice>{t('auth.otpLocalNotice')}</Notice>}
        {!env.emailOtpReady && <Notice tone="warning">{t('auth.otpSetupPending')}</Notice>}
        {!sentTo ? (
          <>
            <Field
              label={t('auth.email')}
              placeholder="you@gmail.com"
              value={email}
              onChangeText={setEmail}
              editable={!loading && !googleLoading}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              maxLength={254}
              onSubmitEditing={() => void sendCode()}
            />
            <Label muted>{t('auth.otpNewAccount')}</Label>
          </>
        ) : (
          <Field
            label={t('auth.otpCode')}
            value={code}
            onChangeText={setCode}
            editable={!loading}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={EMAIL_OTP_LENGTH}
            autoFocus
            hint={t('auth.otpHelp')}
            style={{ fontSize: 28, letterSpacing: 8, fontVariant: ['tabular-nums'] }}
            onSubmitEditing={() => void confirmCode()}
          />
        )}
        <Button
          kind={sentTo ? 'primary' : 'secondary'}
          label={t(sentTo ? 'auth.otpVerify' : 'auth.otpSend')}
          icon="forward"
          loading={loading}
          disabled={!env.emailOtpReady || googleLoading || (!sentTo && remaining > 0)}
          onPress={() => void (sentTo ? confirmCode() : sendCode())}
        />
        {remaining > 0 && <Label muted>{t('auth.otpRetryIn', { count: remaining })}</Label>}
        {sentTo && (
          <>
            <Button
              kind="secondary"
              label={t('auth.otpResend')}
              disabled={loading || remaining > 0}
              onPress={() => void sendCode()}
            />
            <Button
              kind="quiet"
              label={t('auth.otpChangeEmail')}
              disabled={loading}
              onPress={() => {
                setEmail(sentTo);
                setSentTo('');
                setCode('');
                setErrorKey('');
              }}
            />
          </>
        )}
      </Card>
      {!sentTo && (
        <>
          <Label muted>{t('auth.googleRecoveryHelp')}</Label>
          <Button
            kind="quiet"
            label={t('auth.googleRecovery')}
            onPress={() => {
              void Linking.openURL('https://accounts.google.com/signin/recovery').catch(() =>
                setErrorKey('auth.unavailable'),
              );
            }}
          />
        </>
      )}
    </Screen>
  );
}

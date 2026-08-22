import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import {
  completeGoogleSignIn,
  signInWithEmail,
  signUpWithEmail,
  startGoogleSignIn,
} from '@/lib/auth';

export default function AuthScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const finish = () => router.replace(returnTo?.startsWith('/') ? (returnTo as never) : '/');

  const submitEmail = async () => {
    setIsLoading(true);
    try {
      if (isSignUp) await signUpWithEmail(email.trim(), password);
      else await signInWithEmail(email.trim(), password);
      finish();
    } catch {
      Alert.alert(t('appName'), t('auth.unavailable'));
    } finally {
      setIsLoading(false);
    }
  };

  const submitGoogle = async () => {
    setIsLoading(true);
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const authorizationUrl = await startGoogleSignIn(redirectTo);
      const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, redirectTo);
      if (result.type !== 'success') return;
      await completeGoogleSignIn(result.url);
      finish();
    } catch {
      Alert.alert(t('appName'), t('auth.unavailable'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>{t('appName')}</Text>
        <Text style={styles.title}>{isSignUp ? t('auth.createAccount') : t('auth.signIn')}</Text>
        <TextInput
          accessibilityLabel={t('auth.email')}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder={t('auth.email')}
          placeholderTextColor="#667085"
          style={styles.input}
          value={email}
        />
        <TextInput
          accessibilityLabel={t('auth.password')}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          onChangeText={setPassword}
          placeholder={t('auth.password')}
          placeholderTextColor="#667085"
          secureTextEntry
          style={styles.input}
          value={password}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isSignUp ? t('auth.signUp') : t('auth.signIn')}
          disabled={isLoading}
          onPress={() => void submitEmail()}
          style={({ pressed }) => [styles.primaryButton, (pressed || isLoading) && styles.pressed]}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryText}>{isSignUp ? t('auth.signUp') : t('auth.signIn')}</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isLoading}
          onPress={() => void submitGoogle()}
          style={({ pressed }) => [
            styles.secondaryButton,
            (pressed || isLoading) && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryText}>{t('auth.continueWithGoogle')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isLoading}
          onPress={() => setIsSignUp((value) => !value)}
          style={styles.switchButton}
        >
          <Text style={styles.switchText}>
            {isSignUp ? t('auth.switchToSignIn') : t('auth.switchToSignUp')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9FC' },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  eyebrow: { color: '#1D4ED8', fontSize: 14, fontWeight: '700' },
  title: { color: '#101828', fontSize: 30, fontWeight: '700', marginBottom: 8 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    color: '#101828',
    fontSize: 16,
    paddingHorizontal: 14,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D4ED8',
  },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  secondaryText: { color: '#1D4ED8', fontSize: 16, fontWeight: '700' },
  switchButton: { alignItems: 'center', padding: 8 },
  switchText: { color: '#475467', fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});

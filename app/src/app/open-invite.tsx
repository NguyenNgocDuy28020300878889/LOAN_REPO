import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Field, Notice, PageHeader, Screen } from '@/components/loan-ui';
import { parseInviteMessage } from '@/features/loans/invite';
import { env } from '@/lib/env';

export default function OpenInviteScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [invalid, setInvalid] = useState(false);
  const open = () => {
    const token = parseInviteMessage(message, env.appEnv, env.appLinkOrigin);
    if (!token) return setInvalid(true);
    setMessage('');
    router.replace({ pathname: '/invite/[token]', params: { token } });
  };
  return (
    <Screen
      footer={<Button label={t('loan.reviewInvite')} disabled={!message.trim()} onPress={open} />}
    >
      <PageHeader title={t('loan.openInvite')} subtitle={t('loan.pasteInviteHelp')} />
      <Field
        label={t('loan.inviteMessage')}
        value={message}
        onChangeText={(value) => {
          setMessage(value);
          setInvalid(false);
        }}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={4096}
      />
      {invalid && <Notice tone="warning">{t('loan.pasteInviteInvalid')}</Notice>}
    </Screen>
  );
}

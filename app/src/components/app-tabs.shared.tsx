import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon, usePalette } from '@/components/loan-ui';

export default function AppTabs() {
  const colors = usePalette();
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 14, fontWeight: '700' },
        tabBarItemStyle: { paddingVertical: 8 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          minHeight: 72,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('ui.loansTab'),
          tabBarIcon: ({ color }) => <Icon name="wallet" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings.title'),
          tabBarIcon: ({ color }) => <Icon name="settings" color={color} />,
        }}
      />
      <Tabs.Screen name="auth/index" options={{ href: null }} />
      <Tabs.Screen name="auth/callback" options={{ href: null }} />
      <Tabs.Screen name="auth/reset" options={{ href: null }} />
      <Tabs.Screen name="create" options={{ href: null }} />
      <Tabs.Screen name="open-invite" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="invite/[token]" options={{ href: null }} />
      <Tabs.Screen name="pending-invite/[id]" options={{ href: null }} />
      <Tabs.Screen name="loan/[id]/repayment" options={{ href: null }} />
      <Tabs.Screen name="loan/[id]" options={{ href: null }} />
    </Tabs>
  );
}

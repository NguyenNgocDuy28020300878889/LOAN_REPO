import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { AppProviders } from '@/providers/app-providers';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <AppProviders>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AppTabs />
      </ThemeProvider>
    </AppProviders>
  );
}

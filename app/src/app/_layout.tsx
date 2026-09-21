import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import '@/global.css';

import AppTabs from '@/components/app-tabs';
import { AppProviders } from '@/providers/app-providers';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <AppProviders>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <AppTabs />
      </ThemeProvider>
    </AppProviders>
  );
}

import { getLocales } from 'expo-localization';
import * as i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { en } from './locales/en';
import { vi } from './locales/vi';

const fallbackLng = 'en';
const deviceLanguage = getLocales()[0]?.languageCode ?? fallbackLng;
const supportedLanguage = deviceLanguage === 'vi' ? 'vi' : fallbackLng;

void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  fallbackLng,
  lng: supportedLanguage,
  interpolation: { escapeValue: false },
  resources: {
    en: { translation: en },
    vi: { translation: vi },
  },
});

export default i18n;

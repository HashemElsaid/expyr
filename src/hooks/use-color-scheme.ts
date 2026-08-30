import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useSettings } from '@/store/settings';

/** The system scheme, unless the user has forced light or dark in Settings. */
export function useColorScheme(): 'light' | 'dark' {
  const system = useSystemColorScheme();
  const { settings } = useSettings();

  if (settings.themePreference === 'light') return 'light';
  if (settings.themePreference === 'dark') return 'dark';
  return system === 'dark' ? 'dark' : 'light';
}

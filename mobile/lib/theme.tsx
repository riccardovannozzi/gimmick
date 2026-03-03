import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useSettingsStore } from '@/store/settingsStore';
import { darkTheme, lightTheme, type ThemeColors } from '@/constants/colors';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkTheme,
  isDark: true,
  mode: 'dark',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeSetting = useSettingsStore((state) => state.theme);
  const systemColorScheme = useColorScheme();

  const mode: ThemeMode = useMemo(() => {
    if (themeSetting === 'system') {
      return systemColorScheme === 'light' ? 'light' : 'dark';
    }
    return themeSetting;
  }, [themeSetting, systemColorScheme]);

  const value: ThemeContextValue = useMemo(() => ({
    colors: mode === 'dark' ? darkTheme : lightTheme,
    isDark: mode === 'dark',
    mode,
  }), [mode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeColors(): ThemeColors {
  return useContext(ThemeContext).colors;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { Platform } from 'react-native';

// ── Persistent storage helper ─────────────────────────────────────────────────
// Uses localStorage on web; tries AsyncStorage on native (graceful fallback).

const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    try {
      const AS = await import('@react-native-async-storage/async-storage');
      return AS.default.getItem(key);
    } catch { return null; }
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.setItem(key, value); } catch { /* ignore */ }
      return;
    }
    try {
      const AS = await import('@react-native-async-storage/async-storage');
      await AS.default.setItem(key, value);
    } catch { /* ignore */ }
  },
};

// ── Accent palette ────────────────────────────────────────────────────────────

export const ACCENT_OPTIONS = [
  { label: 'Gold',   value: '#FFD700' },
  { label: 'Red',    value: '#ff4444' },
  { label: 'Blue',   value: '#00bfff' },
  { label: 'Green',  value: '#00e676' },
  { label: 'Purple', value: '#a020f0' },
  { label: 'Orange', value: '#ff8c00' },
] as const;

export type AccentColor = typeof ACCENT_OPTIONS[number]['value'];

// ── Context types ─────────────────────────────────────────────────────────────

interface ThemeContextValue {
  accentColor:    AccentColor;
  isDarkMode:     boolean;
  setAccentColor: (c: AccentColor) => void;
  setDarkMode:    (v: boolean)     => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  accentColor:    '#FFD700',
  isDarkMode:     true,
  setAccentColor: () => {},
  setDarkMode:    () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accentColor, setAccentColorState] = useState<AccentColor>('#FFD700');
  const [isDarkMode,  setDarkModeState]    = useState(true);
  const [hydrated,    setHydrated]         = useState(false);

  // Load persisted values once on mount
  useEffect(() => {
    (async () => {
      const [savedAccent, savedDark] = await Promise.all([
        storage.get('theme_accent'),
        storage.get('theme_dark'),
      ]);
      if (savedAccent) setAccentColorState(savedAccent as AccentColor);
      if (savedDark !== null) setDarkModeState(savedDark === 'true');
      setHydrated(true);
    })();
  }, []);

  const setAccentColor = useCallback((c: AccentColor) => {
    setAccentColorState(c);
    storage.set('theme_accent', c);
  }, []);

  const setDarkMode = useCallback((v: boolean) => {
    setDarkModeState(v);
    storage.set('theme_dark', String(v));
  }, []);

  // Don't flash default colors before hydration
  if (!hydrated) return null;

  return (
    <ThemeContext.Provider value={{ accentColor, isDarkMode, setAccentColor, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

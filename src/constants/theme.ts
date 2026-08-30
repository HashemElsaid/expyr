/**
 * Renewly's visual language: warm paper rather than clinical white, ink rather
 * than pure black, and colour reserved for genuine urgency. Everything that is
 * fine is deliberately quiet.
 */

export const Colors = {
  light: {
    background: '#F7F4EF',
    backgroundElement: '#FFFDFA',
    backgroundSelected: '#EDE8DF',
    text: '#191713',
    textSecondary: '#5B564C',
    textTertiary: '#918B7E',
    border: '#E2DCD0',
    accent: '#1D4B39',
    accentContrast: '#FFFDFA',
    urgentStrong: '#9E2B20',
    urgentSoft: '#87591A',
  },
  dark: {
    background: '#100F0E',
    backgroundElement: '#191816',
    backgroundSelected: '#24221E',
    text: '#F3F1EC',
    textSecondary: '#A19B8F',
    textTertiary: '#6F695E',
    border: '#2A2723',
    accent: '#8ED6B2',
    accentContrast: '#0E241B',
    urgentStrong: '#F09A8C',
    urgentSoft: '#DFAF66',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Font families, keyed to the files loaded in the root layout. */
export const Fonts = {
  /** Editorial serif — headlines and big numbers only. */
  display: 'InstrumentSerif',
  body: 'DMSans',
  bodyMedium: 'DMSansMedium',
  bodyBold: 'DMSansBold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 10,
  medium: 16,
  large: 22,
  pill: 999,
} as const;

export const MaxContentWidth = 800;

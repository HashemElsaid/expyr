/**
 * Expyr's visual language: warm paper rather than clinical white, ink rather
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
  /**
   * Not an inversion of the light theme — a candle-lit study. The paper goes
   * warm brown-black, hairlines turn umber, and amber urgency glows the way it
   * cannot in daylight.
   */
  dark: {
    background: '#15100A',
    backgroundElement: '#1E1811',
    backgroundSelected: '#332A1E',
    text: '#F3EFE7',
    textSecondary: '#A79E8F',
    textTertiary: '#7A7264',
    border: '#2E261C',
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

/**
 * A hex colour at a given opacity.
 *
 * Needed because the shadow props React Native removed carried colour and
 * opacity separately, and `boxShadow` takes one colour that already has its
 * alpha in it. Accepts the three and six digit forms the palette uses; hands
 * back anything else untouched rather than guessing, so a mistake shows up as
 * a shadow that is too dark instead of one that is invisible.
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim().replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return color;

  const value = parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * A drop shadow, in the one form React Native still supports.
 *
 * shadowColor, shadowOffset, shadowOpacity and shadowRadius were removed in
 * 0.86 in favour of boxShadow, which is a single string. Everything in the app
 * casts straight down, so only the vertical offset is a parameter.
 */
export function shadow(color: string, y: number, blur: number, opacity: number): string {
  return `0px ${y}px ${blur}px ${withAlpha(color, opacity)}`;
}

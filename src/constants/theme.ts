import type { TextStyle } from 'react-native';

/**
 * iOS's own surfaces, and mint for the one thing that is ours.
 *
 * This was warm paper: #F7F4EF in daylight and a candle-lit brown-black at
 * night, with hairlines in umber and greys mixed to match. It was the most
 * distinctive thing about the app and it is gone on purpose.
 *
 * The reason is what the first outside readers said, which was that the
 * screens looked machine-made. Paper was a large part of why. An app that
 * invents its own surface colour is an app that has decided not to sit beside
 * Settings and Reminders, and the moment a person notices the background is
 * not the background every other app uses, they start looking for the other
 * places it was invented, and finding them.
 *
 * So: systemGroupedBackground behind a list in daylight, near-black at night,
 * secondarySystemGroupedBackground for the cards that sit on it, and Apple's
 * separator for every hairline. These are the literal values from Human
 * Interface Guidelines rather than PlatformColor, which would be the real
 * semantic colour but resolves to nothing on web and cannot take an alpha.
 *
 * What is still ours is the mint, and it is now the only thing that is: the
 * tint on anything interactive and the fill behind the one primary button on a
 * screen. Character has to come from what the app knows rather than from the
 * colour of the paper.
 */

export const Colors = {
  light: {
    /** systemGroupedBackground: what a list of cards sits on. */
    background: '#F2F2F7',
    /** secondarySystemGroupedBackground: the card itself. */
    backgroundElement: '#FFFFFF',
    /** systemGray5, for a row under the finger. */
    backgroundSelected: '#E5E5EA',
    /** label. */
    text: '#000000',
    /*
     * iOS's own secondary and tertiary label colours rather than browns mixed
     * to match the paper.
     *
     * They are neutral on purpose, and read very slightly cool against warm
     * paper, which is exactly how a native app looks: Apple tints the surface
     * and leaves the greys alone. Mixing a warm grey to harmonise with the
     * background is a decision Apple never makes, and making it everywhere is
     * part of what read as invented.
     *
     * Written as rgba rather than PlatformColor, which would be the real
     * semantic colour but resolves to nothing on web and cannot be given an
     * alpha, and this app renders on web in its own tests.
     */
    textSecondary: 'rgba(60, 60, 67, 0.6)',
    textTertiary: 'rgba(60, 60, 67, 0.35)',
    /** separator, which is the hairline between rows in a card. */
    border: 'rgba(60, 60, 67, 0.29)',
    /*
     * Ours, and now the only thing that is. Dark enough to carry white text on
     * a filled button and to read as deliberate rather than decorative.
     */
    accent: '#1D4B39',
    accentContrast: '#FFFFFF',
    /** systemRed and systemOrange: urgency in the colours iOS uses for it. */
    urgentStrong: '#FF3B30',
    urgentSoft: '#FF9500',
  },
  /**
   * The same surfaces at night, which on iOS means black.
   *
   * Not an inversion of anything: iOS uses true black behind a grouped list on
   * OLED, with the cards a shade above it, and that is what an iPhone owner's
   * eye expects after dark.
   */
  dark: {
    /** systemGroupedBackground, dark. */
    background: '#000000',
    /** secondarySystemGroupedBackground, dark. */
    backgroundElement: '#1C1C1E',
    /** systemGray5, dark. */
    backgroundSelected: '#2C2C2E',
    text: '#FFFFFF',
    /** The dark-mode pair of the same two, again Apple's own. */
    textSecondary: 'rgba(235, 235, 245, 0.6)',
    textTertiary: 'rgba(235, 235, 245, 0.35)',
    /** separator, dark. */
    border: 'rgba(84, 84, 88, 0.65)',
    accent: '#8ED6B2',
    accentContrast: '#0E241B',
    /** systemRed and systemOrange, dark. */
    urgentStrong: '#FF453A',
    urgentSoft: '#FF9F0A',
  },
} as const;

/**
 * Apple's system colours, for the tile behind a category's symbol.
 *
 * Settings is legible at a glance because every row carries a colour, and the
 * colour means something: the same blue every time for the things that are
 * about you, the same grey for the things that are about the phone. A list of
 * fifteen identical grey tiles is a list nobody scans.
 *
 * Only Apple's own hues, in both modes, because these sit next to the system's
 * own symbols and a hand-mixed orange beside systemOrange looks like a
 * mistake rather than a choice.
 */
export const SystemColors = {
  light: {
    blue: '#007AFF',
    green: '#34C759',
    orange: '#FF9500',
    purple: '#AF52DE',
    teal: '#30B0C7',
    indigo: '#5856D6',
    brown: '#A2845E',
    red: '#FF3B30',
    gray: '#8E8E93',
  },
  dark: {
    blue: '#0A84FF',
    green: '#30D158',
    orange: '#FF9F0A',
    purple: '#BF5AF2',
    teal: '#40C8E0',
    indigo: '#5E5CE6',
    brown: '#AC8E68',
    red: '#FF453A',
    gray: '#8E8E93',
  },
} as const;

export type SystemColor = keyof typeof SystemColors.light;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Type, which is the phone's own font and nothing else.
 *
 * It used to be Instrument Serif over DM Sans, two faces downloaded and
 * registered at launch. The first person to read the timeline who had not
 * built it said it looked machine-made and named the pairing as the reason,
 * which is the one piece of evidence worth more than a preference: a serif
 * headline over a geometric sans is what a template looks like, and every
 * app on the phone that a person trusts with a passport is set in San
 * Francisco.
 *
 * So these carry weight rather than a family name. Leaving `fontFamily`
 * unset is deliberate: iOS then resolves the system font itself, which means
 * the right optical size for the point size, real semibold and bold cuts
 * rather than a synthesised slant, and whatever Apple changes next. Naming a
 * family would opt out of all three.
 *
 * Spread them, do not assign them: `...Fonts.body`, not
 * `fontFamily: Fonts.body`.
 */
export const Fonts = {
  /** Body text and anything long enough to read. */
  body: { fontWeight: '400' },
  /** A shade heavier: buttons, section labels, a row's name. */
  bodyMedium: { fontWeight: '500' },
  /**
   * Titles and figures. Semibold rather than bold because these sit in lists,
   * several to a screen, and 700 at 22 points turns a ledger into shouting.
   */
  strong: { fontWeight: '600' },
  /**
   * The large statements: the app's own name, a screen's opening line, the
   * masthead's verdict. Apple sets its large titles in bold with the tracking
   * pulled slightly tight, and the tracking lives with each size rather than
   * here, because how tight depends on how big.
   */
  display: { fontWeight: '700' },
} as const satisfies Record<string, TextStyle>;

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

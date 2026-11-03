import type { TextStyle } from 'react-native';

/**
 * Quiet, native surfaces around one luxurious object: the card.
 *
 * The redesign (approved 3 November 2026) puts every subscription and the
 * year's total on a card in the language of a passport cover: deep emerald,
 * fine security-print lines, and an engraved number. Everything around the
 * cards stays plain so the cards carry the character, which is the lesson of
 * the warm-paper era: a surface the app invents everywhere reads as invented
 * everywhere.
 *
 * So the page is a grouped background with the faintest lean towards the
 * emerald, the greys share that lean, and the cards sit on it like objects.
 * Written as literal values rather than PlatformColor, which resolves to
 * nothing on web and cannot take an alpha, and this app renders on web in its
 * own tests.
 */

export const Colors = {
  light: {
    /** What a list of rows sits on. */
    background: '#F1F4F2',
    /** A row group or a notice, one step up from the page. */
    backgroundElement: '#FFFFFF',
    /** A row under the finger, and the quiet button beside a primary one. */
    backgroundSelected: '#E6ECE8',
    text: '#0E1A15',
    textSecondary: '#4A5952',
    textTertiary: '#86938C',
    /** The hairline between rows in a group. */
    border: 'rgba(14, 26, 21, 0.14)',
    /*
     * Brand green: anything interactive, and the fill behind the one primary
     * button on a screen. Dark enough to carry white text.
     */
    accent: '#1D4B39',
    accentContrast: '#FFFFFF',
    /** The square behind a symbol in a row, in the accent at a whisper. */
    tile: 'rgba(29, 75, 57, 0.08)',
    /** Overdue: kept for late things and nothing else. */
    urgentStrong: '#D93B41',
    urgentStrongWash: 'rgba(217, 59, 65, 0.10)',
    /** A free trial about to charge, and anything else merely soon. */
    urgentSoft: '#A85F00',
    urgentSoftWash: 'rgba(214, 138, 24, 0.13)',
    /** Frosted chrome that floats over content: the tab bar, a toast. */
    glass: 'rgba(255, 255, 255, 0.74)',
    glassEdge: 'rgba(255, 255, 255, 0.7)',
  },
  /**
   * Near-black with the same lean, and the cards a shade above it. Not an
   * inversion: the accent turns to mint so it still reads on the dark.
   */
  dark: {
    background: '#080C0A',
    backgroundElement: '#111815',
    backgroundSelected: '#1B241F',
    text: '#EAF1ED',
    textSecondary: '#A3B1AA',
    textTertiary: '#69776F',
    border: 'rgba(234, 241, 237, 0.14)',
    accent: '#8ED6B2',
    accentContrast: '#0E241B',
    tile: 'rgba(142, 214, 178, 0.12)',
    urgentStrong: '#FF6B6F',
    urgentStrongWash: 'rgba(255, 107, 111, 0.14)',
    urgentSoft: '#F2B24A',
    urgentSoftWash: 'rgba(242, 178, 74, 0.14)',
    glass: 'rgba(24, 32, 28, 0.70)',
    glassEdge: 'rgba(255, 255, 255, 0.08)',
  },
} as const;

/**
 * The card's own colours, the same by day and by night.
 *
 * A passport cover does not change colour with the room, and a card that went
 * pale in light mode would stop being the object the screen is arranged
 * around. Only the highlight lifts a little at night, so the card still shows
 * its edge against a near-black page.
 */
export const Card = {
  emerald: '#123D2E',
  emeraldHigh: { light: '#1F5C46', dark: '#23674F' },
  emeraldLow: '#0A291F',
  /** The security-print lines and the one peak in a chart. */
  mint: '#A8E6C6',
  /** Expyr Pro, which is foil rather than ink. */
  brass: '#D9C08A',
  ink: '#EAF6EF',
  inkSecondary: 'rgba(234, 246, 239, 0.78)',
  inkTertiary: 'rgba(234, 246, 239, 0.64)',
  /** A figure that is late, in a red that still reads on emerald. */
  late: '#FFB9B4',
  rule: 'rgba(168, 230, 198, 0.16)',
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
 * Type, which is the phone's own fonts and nothing else: San Francisco for
 * every word, and New York for the big figures on a card.
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
  /**
   * The one exception to the system font: the big number on a card.
   *
   * New York, Apple's own serif, reached through the system's serif design
   * rather than by name, so it is still the phone's font and still gets the
   * right optical size. It is drawn for screens, which is why it stays
   * elegant at 66 points without going thin the way a print didone does.
   * Lining, equal-width figures so a count that rolls does not jitter.
   */
  figure: { fontFamily: 'ui-serif', fontWeight: '500', fontVariant: ['lining-nums', 'tabular-nums'] },
  /** The word beside a figure: "days to go", "a year". */
  figureUnit: { fontFamily: 'ui-serif', fontWeight: '400', fontStyle: 'italic' },
  /** Prices in a column, so the amounts line up without a second font. */
  amount: { fontWeight: '400', fontVariant: ['tabular-nums'] },
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

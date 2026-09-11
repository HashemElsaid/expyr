import { StyleSheet, Text, type TextProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Apple's text styles, at Apple's sizes and weights, and nothing else.
 *
 * The first outside reader said the screens looked machine-made and named the
 * fonts. Moving to the system font was the easy half. This is the other half:
 * the sizes, the weights and the habits. A 30 point heading with negative
 * tracking, an 11 point uppercase eyebrow with 1.1 of letterspacing above
 * every section, and a 30 point figure beside a shrunken unit are not Apple's
 * scale. They are what a designer invents when working from a blank page, and
 * a person who has spent ten years in Settings and Reminders reads them as an
 * imitation without being able to say why.
 *
 * So these are the real ones, from Human Interface Guidelines:
 *
 *   Large Title  34 / 41  bold        the name of the screen
 *   Title 2      22 / 28  bold        a heading inside a screen
 *   Headline     17 / 22  semibold    a row's own name
 *   Body         17 / 22  regular     everything a person reads
 *   Subheadline  15 / 20  regular     the line under a row title
 *   Footnote     13 / 18  regular     captions, secondary facts
 *   Caption      12 / 16  regular     the smallest thing worth setting
 *
 * Three rules hold across all of them.
 *
 * No letterSpacing, anywhere. San Francisco ships with optical tracking per
 * size and adjusting it by hand is how type stops looking like the system's.
 *
 * No uppercase, except `sectionHeader`, which is the grouped-list header
 * Settings uses. Everything else that shouted is now Footnote in grey.
 *
 * Figures keep the unit at the same size as the number. "10 credits" is one
 * phrase, and setting the 10 at 30 points beside a shrunken "credits" is a
 * decoration that makes a number harder to read, not easier.
 */

export type ThemedTextProps = TextProps & {
  type?:
    | 'largeTitle'
    | 'title2'
    | 'headline'
    | 'body'
    | 'subheadline'
    | 'footnote'
    | 'footnoteStrong'
    | 'caption'
    | 'sectionHeader'
    | 'figure';
  themeColor?: ThemeColor;
};

/**
 * How far each style may grow with the reader's text-size setting.
 *
 * Dynamic Type is on: nothing here is a fixed size. Headings are capped
 * tighter than body text, because a Large Title free to treble pushes the
 * content it names off the screen, and the content is the point.
 */
const MAX_SCALE: Record<NonNullable<ThemedTextProps['type']>, number> = {
  largeTitle: 1.4,
  title2: 1.5,
  headline: 1.7,
  body: 1.8,
  subheadline: 1.8,
  footnote: 1.8,
  footnoteStrong: 1.8,
  caption: 1.8,
  sectionHeader: 1.6,
  figure: 1.6,
};

export function ThemedText({ style, type = 'body', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      maxFontSizeMultiplier={MAX_SCALE[type]}
      style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  /** The name of the screen. One per screen, at the top, never a sentence. */
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  /** A heading inside a screen, where a screen needs one. */
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  /** A row's own name. Apple's Headline is 17 semibold, not a big heading. */
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  /** The line under a row's title, carrying the one fact it needs. */
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  /** Footnote, emphasized. Apple has an emphasized cut of every style. */
  footnoteStrong: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  /**
   * The one place uppercase survives: the header over a group in an inset
   * list, exactly as Settings sets it. Footnote, grey, and no added tracking,
   * because the tracking is what made the old eyebrows look invented.
   */
  sectionHeader: { fontSize: 13, lineHeight: 18, fontWeight: '400', textTransform: 'uppercase' },
  /**
   * A number and its unit, in one size.
   *
   * Tabular figures so a column of amounts lines up and a countdown ticking
   * from 10 to 9 does not shuffle sideways.
   */
  figure: { fontSize: 17, lineHeight: 22, fontWeight: '400', fontVariant: ['tabular-nums'] },
});

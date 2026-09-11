import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'display'
    | 'headline'
    | 'title'
    | 'body'
    | 'bodyMedium'
    | 'small'
    | 'smallBold'
    | 'label'
    | 'numeral'
    | 'ledgerTitle'
    | 'ledgerFigure'
    | 'verdict'
    | 'fieldValue';
  themeColor?: ThemeColor;
};

/**
 * Text scales with the reader's iOS text-size setting. Display styles are
 * capped tighter than body text so headings cannot push everything else off
 * screen at the largest accessibility sizes.
 */
const MAX_SCALE: Record<NonNullable<ThemedTextProps['type']>, number> = {
  display: 1.3,
  headline: 1.4,
  title: 1.6,
  body: 1.8,
  bodyMedium: 1.8,
  small: 1.8,
  smallBold: 1.8,
  label: 1.5,
  numeral: 1.3,
  ledgerTitle: 1.4,
  ledgerFigure: 1.4,
  verdict: 1.25,
  fieldValue: 1.6,
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

/*
 * Sizes and line heights are unchanged from the two downloaded faces they
 * replace. What changed is how weight and tracking are set.
 *
 * Tracking tightens as the size grows, which is what Apple's own scale does
 * and what the eye needs: letters set at 44 points look loosely spaced at the
 * spacing that suits 15. Below about 20 points it is left alone.
 *
 * Figures that sit in a column get tabular-nums, so a list of amounts and a
 * countdown that ticks from 10 to 9 do not shuffle sideways. Only figures:
 * proportional numerals read better inside a sentence, which is everywhere
 * else.
 */
const styles = StyleSheet.create({
  /** Reserved for the app name and hero moments. */
  display: {
    ...Fonts.display,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
  },
  headline: {
    ...Fonts.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  title: {
    ...Fonts.bodyMedium,
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: -0.2,
  },
  body: {
    ...Fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  bodyMedium: {
    ...Fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
  },
  small: {
    ...Fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  smallBold: {
    ...Fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
  },
  /** Small caps section markers — the editorial signature. */
  label: {
    ...Fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  /** A tracked document's name in the ledger. */
  ledgerTitle: {
    ...Fonts.strong,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  /** The time remaining, set beside the title. */
  ledgerFigure: {
    ...Fonts.strong,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  /** The masthead's answer to "do I need to worry?". */
  verdict: {
    ...Fonts.display,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.7,
  },
  /** The value sitting on a ruled form line. */
  fieldValue: {
    ...Fonts.body,
    fontSize: 17,
    lineHeight: 24,
  },
  /** Large countdown figures, and the prices on the paywall. */
  numeral: {
    ...Fonts.strong,
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
});

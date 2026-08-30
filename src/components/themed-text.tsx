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
    | 'numeral';
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
  /** Reserved for the app name and hero moments. */
  display: {
    fontFamily: Fonts.display,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -0.5,
  },
  headline: {
    fontFamily: Fonts.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  title: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  bodyMedium: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
  },
  small: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  smallBold: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
  },
  /** Small caps section markers — the editorial signature. */
  label: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  /** Large countdown figures. */
  numeral: {
    fontFamily: Fonts.display,
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
});

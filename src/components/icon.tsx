import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

export type { SFSymbol };

/**
 * An SF Symbol, which is the iOS icon set.
 *
 * Called Icon rather than Symbol because Symbol is a JavaScript global. A file
 * that forgot the import did not fail with "cannot find name"; it resolved to
 * the built-in and reported that a SymbolConstructor is not a valid JSX
 * element, which is four lines of TypeScript for a missing import.
 *
 * Every icon in the app was MaterialCommunityIcons, which is Google's. It is a
 * good set and it is the wrong one: it sits beside Apple's own symbols in the
 * tab bar of every other app on the phone, drawn on a different grid, with
 * different stroke weights and a different idea of what a house looks like. A
 * person cannot name the difference and does see it.
 *
 * Two things this wrapper is for.
 *
 * A symbol name is checked at compile time. `SFSymbol` is the whole catalogue
 * as a union of string literals, so a name that does not exist fails the
 * typecheck rather than drawing nothing on a phone, which is what a wrong name
 * does at runtime.
 *
 * And weight is tied to the text beside it. Apple's symbols have the same
 * weights as the font, and an icon in a row of Body text wants Regular while
 * one beside a Headline wants Semibold. Having one place to say so stops that
 * being decided nine times.
 */
export function Icon({
  name,
  size = 22,
  color,
  weight = 'regular',
  style,
}: {
  name: SFSymbol;
  size?: number;
  /**
   * Defaults to the symbol's own colour, which is rarely what is wanted.
   *
   * ColorValue rather than string, because the tab bar hands its icons a
   * colour that may be a platform colour rather than a hex string.
   */
  color?: ColorValue;
  weight?: 'ultraLight' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
      /*
       * Nothing, deliberately, where symbols do not exist: Android, the web,
       * and an iOS too old for a particular name. An icon is never the only
       * way anything in this app is labelled, so its absence costs decoration
       * rather than meaning, and a substitute drawn from another set would be
       * the very thing this replaced.
       */
      fallback={null}
      style={style}
    />
  );
}

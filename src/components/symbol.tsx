import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { StyleProp, ViewStyle } from 'react-native';

export type { SFSymbol };

/**
 * An SF Symbol, which is the iOS icon set.
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
export function Symbol({
  name,
  size = 22,
  color,
  weight = 'regular',
  style,
}: {
  name: SFSymbol;
  size?: number;
  /** Defaults to the symbol's own colour, which is rarely what is wanted. */
  color?: string;
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

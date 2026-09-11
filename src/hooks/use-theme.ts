import { Colors, SystemColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  return Colors[useColorScheme()];
}

/**
 * Apple's system colours for the current mode, for the tiles in a list.
 *
 * Separate from the palette rather than folded into it, because these are not
 * roles the app assigns meaning to. They are a wheel to pick from, and mixing
 * them in would make every one of them a valid colour for a piece of text.
 */
export function useSystemColors() {
  return SystemColors[useColorScheme()];
}

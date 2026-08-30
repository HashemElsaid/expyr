import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { urgencyFor, type Urgency } from '@/lib/dates';

type Palette = Record<ThemeColor, string>;

/**
 * Colour is reserved for things that need action. Anything comfortably in the
 * future stays in the quiet tertiary ink.
 */
export function urgencyColor(urgency: Urgency, theme: Palette): string {
  switch (urgency) {
    case 'expired':
    case 'critical':
      return theme.urgentStrong;
    case 'soon':
      return theme.urgentSoft;
    default:
      return theme.textTertiary;
  }
}

export function useUrgency(days: number): { urgency: Urgency; color: string } {
  const theme = useTheme();
  const urgency = urgencyFor(days);
  return { urgency, color: urgencyColor(urgency, theme) };
}

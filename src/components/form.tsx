import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The pieces every form in Expyr is built from.
 *
 * They lived at the bottom of the add screen, which meant the only other screen
 * that wanted a chip row or a pair of buttons had to write its own — and did,
 * slightly differently. Here they are one thing, and a change to how a chip
 * looks is a change to how every chip looks.
 */

/** A label above whatever it labels. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="label" themeColor="textTertiary">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

/** One of a set of choices, filled when it is the chosen one. */
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <View
        style={[
          styles.chip,
          {
            backgroundColor: active ? theme.accent : 'transparent',
            borderColor: active ? theme.accent : theme.border,
          },
        ]}>
        <ThemedText type="smallBold" style={active ? { color: theme.accentContrast } : undefined}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/** Something the app noticed and thought worth saying. */
export function Note({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.note, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="small">{text}</ThemedText>
    </View>
  );
}

/** The same shape, in the colour that means something went wrong. */
export function ErrorNote({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.note, { backgroundColor: theme.backgroundSelected }]}
      accessibilityLiveRegion="polite">
      <ThemedText type="small" style={{ color: theme.urgentStrong }}>
        {message}
      </ThemedText>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}>
      {({ pressed }) => (
        <View
          style={[
            styles.primary,
            { backgroundColor: theme.accent },
            (pressed || disabled) && styles.dim,
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.accentContrast }}>
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  icon,
}: {
  label: string;
  onPress: () => void;
  icon?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <View style={[styles.secondary, { borderColor: theme.border }, pressed && styles.dim]}>
          {icon && (
            <MaterialCommunityIcons name={icon as never} size={17} color={theme.textSecondary} />
          )}
          <ThemedText type="smallBold">{label}</ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: 9,
  },
  note: { borderRadius: 12, paddingHorizontal: Spacing.three, paddingVertical: 12 },
  primary: { borderRadius: Radius.pill, paddingVertical: Spacing.three, alignItems: 'center' },
  secondary: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.three,
  },
  dim: { opacity: 0.6 },
});

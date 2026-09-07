import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

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

/**
 * One of a set of choices, filled when it is the chosen one.
 *
 * `style` sizes the chip from outside, for the callers that want a grid rather
 * than a row that wraps wherever it happens to run out. The label is centred
 * either way, which costs an intrinsically sized chip nothing and is the whole
 * point of a grown one.
 */
export function Chip({
  label,
  active,
  onPress,
  style,
  tight = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  /** Sizes the chip from outside, for a grid rather than a wrapping row. */
  style?: StyleProp<ViewStyle>;
  /** Set when `style` fixes the width, so the label gets the space instead. */
  tight?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={style}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}>
      <View
        style={[
          styles.chip,
          tight && styles.chipTight,
          {
            backgroundColor: active ? theme.accent : 'transparent',
            borderColor: active ? theme.accent : theme.border,
          },
        ]}>
        <ThemedText
          type="smallBold"
          numberOfLines={1}
          style={active ? { color: theme.accentContrast } : undefined}>
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
  /*
   * A chip whose width comes from a grid has no use for wide side padding: the
   * label is centred in a fixed pill either way, so the padding only steals
   * room from the text and ellipsised "2 months" into "2 month…".
   */
  chipTight: { paddingHorizontal: Spacing.one },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: 9,
    alignItems: 'center',
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

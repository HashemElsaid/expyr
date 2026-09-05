import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The one thing the screen most wants you to do, in the accent. */
export function PrimaryAction({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <View style={[styles.primary, { backgroundColor: theme.accent }, pressed && styles.dim]}>
          <MaterialCommunityIcons name={icon as never} size={17} color={theme.accentContrast} />
          <ThemedText type="smallBold" style={{ color: theme.accentContrast }}>
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

/** Everything else worth offering, in ink. */
export function SecondaryAction({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <View style={[styles.secondary, pressed && styles.dim]}>
          <MaterialCommunityIcons name={icon as never} size={17} color={theme.textSecondary} />
          <ThemedText type="smallBold" themeColor="textSecondary">
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

export type MenuAction = {
  label: string;
  icon: string;
  run: () => void;
  destructive?: boolean;
};

/**
 * The menu behind the ⋯, opening under the button that was pressed.
 *
 * This used to hand the job to ActionSheetIOS, which iOS now floats in the
 * middle of the screen rather than sliding up from the bottom — a long way from
 * the corner the finger is in, and nothing to do with the thing it acts on. A
 * small card in the corner is the whole of what was wanted.
 */
export function ActionMenu({
  open,
  onClose,
  actions,
  anchor,
}: {
  open: boolean;
  onClose: () => void;
  actions: MenuAction[];
  /**
   * Where on the screen the button that opened this sits, when it is not the
   * one in the navigation bar.
   *
   * Without it the card lands under the header, which is right for the ⋯ that
   * lives there and wrong for every other ⋯ in the app — a menu that opens
   * three inches from the finger that asked for it is the thing this component
   * was written to stop doing.
   */
  anchor?: { top: number; right: number };
}) {
  const theme = useTheme();
  // The card hangs below the navigation bar, whose height starts at the notch.
  const insets = useSafeAreaInsets();

  /*
   * Gone the instant the screen behind it is.
   *
   * Every action here can navigate, and the screen this menu belongs to stays
   * mounted when it does — a tab always, a pushed screen until you come back.
   * Closing the menu starts a fade, the push interrupts it, and the fade never
   * finishes: a full-screen dim sat on top of the newly opened page and would
   * not go away until you navigated back to the screen that owned it.
   *
   * Unmounting on blur rather than animating out. There is no exit animation to
   * be interrupted if there is nothing left to animate.
   */
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  if (!focused) return null;

  const placement = anchor
    ? { paddingTop: anchor.top, paddingRight: anchor.right }
    : { paddingTop: insets.top + 46 };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, placement]} onPress={onClose}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              shadowColor: theme.text,
            },
          ]}>
          {actions.map((action, index) => (
            <Pressable
              key={action.label}
              onPress={() => {
                onClose();
                // After the card is gone, so an alert of its own has room.
                setTimeout(action.run, 60);
              }}
              accessibilityRole="button">
              {({ pressed }) => (
                <View
                  style={[
                    styles.item,
                    index > 0 && {
                      borderTopColor: theme.border,
                      borderTopWidth: StyleSheet.hairlineWidth,
                    },
                    pressed && styles.dim,
                  ]}>
                  <ThemedText
                    type="body"
                    style={action.destructive ? { color: theme.urgentStrong } : undefined}>
                    {action.label}
                  </ThemedText>
                  <MaterialCommunityIcons
                    name={action.icon as never}
                    size={18}
                    color={action.destructive ? theme.urgentStrong : theme.textTertiary}
                  />
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

/**
 * The ⋯ itself. Boxed and centred, because the glyph alone sat left of the
 * middle of the round button iOS draws around it when it is pressed.
 */
export function MenuButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="More actions">
      <View style={styles.menuButton}>
        <MaterialCommunityIcons name="dots-horizontal" size={22} color={theme.textSecondary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dim: { opacity: 0.6 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: 14,
  },
  menuButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  backdrop: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  card: {
    minWidth: 224,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
});

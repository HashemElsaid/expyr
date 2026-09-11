import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { successFeedback } from '@/lib/haptics';

/**
 * One fact about a document: a label on the left, the value on the right.
 *
 * The copyable ones matter more than they look. An Emirates ID number is
 * fifteen digits with no grouping, and the thing people actually do with it is
 * paste it into a form on a government portal — which, before this, meant
 * reading it off the screen and typing it in, digit by digit, correctly.
 */
export function DataRow({
  label,
  value,
  bordered,
  copyable,
  onEdit,
}: {
  label: string;
  value: string;
  bordered?: boolean;
  copyable?: boolean;
  /**
   * Given where the value came off a document and can therefore be wrong.
   *
   * When both this and `copyable` are set the row edits and the icon copies,
   * each with its own hit area. Tapping the row is the discoverable gesture
   * and correcting a misread number matters more than saving a tap on the
   * copy, which the icon still gives.
   */
  onEdit?: () => void;
}) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Leaving a timer running against a screen that has gone is how a warning
  // about setting state on an unmounted component starts.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    if (!copyable) return;
    await Clipboard.setStringAsync(value);
    successFeedback();
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }

  const editable = onEdit !== undefined;

  return (
    <Pressable
      onPress={editable ? onEdit : copy}
      disabled={!editable && !copyable}
      accessibilityRole={editable || copyable ? 'button' : undefined}
      accessibilityLabel={editable ? `Edit ${label}` : copyable ? `Copy ${label}` : undefined}>
      <View
        style={[
          styles.row,
          bordered && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
        ]}>
        <ThemedText type="small" themeColor="textTertiary" style={styles.label}>
          {copied ? 'Copied' : label}
        </ThemedText>
        <ThemedText type="body" style={styles.value}>
          {value}
        </ThemedText>
        {copyable ? (
          /*
           * Its own target once the row belongs to editing, so both actions
           * survive on a row that wants both.
           */
          <Pressable
            onPress={copy}
            hitSlop={12}
            disabled={!editable}
            accessibilityRole="button"
            accessibilityLabel={`Copy ${label}`}>
            <MaterialCommunityIcons
              name={copied ? 'check' : 'content-copy'}
              size={15}
              color={copied ? theme.accent : theme.textTertiary}
              style={styles.mark}
            />
          </Pressable>
        ) : (
          editable && (
            <MaterialCommunityIcons
              name="pencil-outline"
              size={14}
              color={theme.textTertiary}
              style={styles.mark}
            />
          )
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: 12,
  },
  label: { flexShrink: 0 },
  value: { flex: 1, textAlign: 'right' },
  mark: { marginLeft: 8 },
});

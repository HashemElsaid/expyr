import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { formatTime } from '@/lib/dates';
import { tapFeedback } from '@/lib/haptics';

/** Five-minute steps: finer than that is a setting nobody wants to make. */
const MINUTE_STEP = 5;

/** Half-hour choices for the platforms with no wheel of their own. */
const FALLBACK_TIMES = Array.from({ length: 48 }, (_, i) => ({
  hour: Math.floor(i / 2),
  minute: (i % 2) * 30,
}));

function dateFor(hour: number, minute: number): Date {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

/**
 * The same shape as the country field: the answer sits on the row, and the
 * picker only exists while it is being changed. On iOS that picker is the
 * system wheel, which is the control everyone already knows from setting an
 * alarm — no reason to invent a different one for the same job.
 */
export function TimeSelect({
  hour,
  minute,
  onChange,
}: {
  hour: number;
  minute: number;
  onChange: (next: { hour: number; minute: number }) => void;
}) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const [open, setOpen] = useState(false);
  /*
   * The wheel reports every tick as you spin it, and every tick would mean
   * rebooking every reminder on the phone. So spinning only moves this, and
   * the answer is handed over once, on the way out.
   */
  const [draft, setDraft] = useState({ hour, minute });

  function show() {
    setDraft({ hour, minute });
    setOpen(true);
  }

  function commit(next: { hour: number; minute: number }) {
    setOpen(false);
    if (next.hour !== hour || next.minute !== minute) onChange(next);
  }

  /** The list has no Done to wait for: a tap is the whole decision. */
  function pick(nextHour: number, nextMinute: number) {
    tapFeedback();
    commit({ hour: nextHour, minute: nextMinute });
  }

  return (
    <>
      <Pressable
        onPress={show}
        accessibilityRole="button"
        accessibilityLabel={`Reminder time: ${formatTime(hour, minute)}`}>
        {({ pressed }) => (
          <View style={[styles.row, pressed && styles.dim]}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={20}
              color={theme.textSecondary}
            />
            <ThemedText type="bodyMedium" style={styles.flex}>
              Every reminder at {formatTime(hour, minute)}
            </ThemedText>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textTertiary} />
          </View>
        )}
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => commit(draft)}>
        <Pressable
          style={styles.backdrop}
          onPress={() => commit(draft)}
          accessibilityLabel="Close"
        />
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={[styles.head, { borderBottomColor: theme.border }]}>
            <ThemedText type="label" themeColor="textTertiary" style={styles.flex}>
              Reminder time
            </ThemedText>
            <Pressable onPress={() => commit(draft)} hitSlop={12} accessibilityRole="button">
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                Done
              </ThemedText>
            </Pressable>
          </View>

          {Platform.OS === 'ios' || Platform.OS === 'android' ? (
            <View style={styles.wheel}>
              <DateTimePicker
                value={dateFor(draft.hour, draft.minute)}
                mode="time"
                display="spinner"
                minuteInterval={MINUTE_STEP}
                themeVariant={scheme}
                textColor={theme.text}
                onChange={(_, date) =>
                  date && setDraft({ hour: date.getHours(), minute: date.getMinutes() })
                }
              />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {FALLBACK_TIMES.map((option) => {
                const on = option.hour === hour && option.minute === minute;
                return (
                  <Pressable
                    key={`${option.hour}:${option.minute}`}
                    onPress={() => pick(option.hour, option.minute)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}>
                    {({ pressed }) => (
                      <View
                        style={[
                          styles.option,
                          { borderBottomColor: theme.border },
                          pressed && styles.dim,
                        ]}>
                        <ThemedText type={on ? 'bodyMedium' : 'body'} style={styles.flex}>
                          {formatTime(option.hour, option.minute)}
                        </ThemedText>
                        {on && (
                          <MaterialCommunityIcons name="check" size={20} color={theme.accent} />
                        )}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  sheet: {
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    paddingBottom: Spacing.four,
    maxHeight: '72%',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  wheel: { paddingVertical: Spacing.two },
  list: { paddingHorizontal: Spacing.four },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dim: { opacity: 0.6 },
});

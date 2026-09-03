import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { COUNTRIES, countryLabel, type Country } from '@/data/countries';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';

/**
 * Twenty-two countries is too many to lay out as chips — it turns whichever
 * screen it lands on into a wall of pills. So the field shows the answer and
 * the list only exists while it is being changed.
 */
export function CountrySelect({
  value,
  onChange,
}: {
  value: Country | null;
  onChange: (country: Country) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  function choose(country: Country) {
    tapFeedback();
    onChange(country);
    setOpen(false);
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={value ? `Country: ${countryLabel(value)}` : 'Choose your country'}>
        {({ pressed }) => (
          <View
            style={[
              styles.field,
              { borderColor: theme.border, backgroundColor: theme.backgroundElement },
              pressed && styles.dim,
            ]}>
            <ThemedText
              type="fieldValue"
              themeColor={value ? 'text' : 'textTertiary'}
              style={styles.flex}>
              {value ? countryLabel(value) : 'Choose your country'}
            </ThemedText>
            <MaterialCommunityIcons name="chevron-down" size={22} color={theme.textTertiary} />
          </View>
        )}
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}>
        {/* Tapping the dimmed part is how a sheet is dismissed on iOS. */}
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={[styles.sheetHead, { borderBottomColor: theme.border }]}>
            <ThemedText type="label" themeColor="textTertiary" style={styles.flex}>
              Country
            </ThemedText>
            <Pressable onPress={() => setOpen(false)} hitSlop={12} accessibilityRole="button">
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                Done
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.list}>
            {COUNTRIES.map((option) => {
              const on = value === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => choose(option.value)}
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
                        {option.label}
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
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  sheet: {
    maxHeight: '72%',
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    paddingBottom: Spacing.four,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
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

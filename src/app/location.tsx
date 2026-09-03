import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { COUNTRIES, usesEmirates } from '@/data/countries';
import { EMIRATES } from '@/data/regions';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';
import { useSettings } from '@/store/settings';

/**
 * Where you live decides whether Expyr gives renewal guidance at all, and
 * which authority it names. It is also answered once and then forgotten, so it
 * lives here rather than taking up a third of Settings for the rest of time.
 */
export default function LocationScreen() {
  const theme = useTheme();
  const { settings, update } = useSettings();

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText type="label" themeColor="textTertiary">
          Country
        </ThemedText>
        <View style={styles.chipRow}>
          {COUNTRIES.map((option) => {
            const on = settings.country === option.value;
            return (
              <Chip
                key={option.value}
                label={option.label}
                on={on}
                onPress={() => {
                  tapFeedback();
                  // Leaving the UAE makes any emirate meaningless, so it goes.
                  update(
                    option.value === 'ae'
                      ? { country: option.value }
                      : { country: option.value, emirate: null }
                  );
                }}
              />
            );
          })}
        </View>

        {usesEmirates(settings.country) && (
          <>
            <ThemedText type="label" themeColor="textTertiary" style={styles.heading}>
              Emirate
            </ThemedText>
            <View style={styles.chipRow}>
              {EMIRATES.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  on={settings.emirate === option.value}
                  onPress={() => {
                    tapFeedback();
                    update({ emirate: option.value });
                  }}
                />
              ))}
            </View>
          </>
        )}

        <ThemedText type="small" themeColor="textTertiary" style={styles.note}>
          {usesEmirates(settings.country)
            ? settings.emirate
              ? 'Renewal steps and portals follow your emirate. Vehicles and licences are run locally, not federally.'
              : 'Pick your emirate and Expyr will point you at the right authority.'
            : settings.country
              ? 'Expyr tracks your dates anywhere. Renewal steps, costs and fines are verified for the UAE only, so they stay hidden rather than being guessed.'
              : 'Set this so Expyr knows whether it can tell you how to renew things where you are.'}
        </ThemedText>

        <View style={[styles.footnote, { borderTopColor: theme.border }]}>
          <ThemedText type="small" themeColor="textTertiary">
            Nothing leaves the phone. This only decides which guidance Expyr is confident enough to
            show you.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}>
      {({ pressed }) => (
        <View
          style={[
            styles.chip,
            {
              backgroundColor: on ? theme.accent : 'transparent',
              borderColor: on ? theme.accent : theme.border,
            },
            pressed && styles.dim,
          ]}>
          <ThemedText type="smallBold" style={on ? { color: theme.accentContrast } : undefined}>
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  heading: { paddingTop: Spacing.three },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  note: { paddingTop: Spacing.two },
  footnote: { marginTop: Spacing.four, paddingTop: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  dim: { opacity: 0.6 },
});

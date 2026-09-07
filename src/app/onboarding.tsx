import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { CountrySelect } from '@/components/country-select';
import { tapFeedback } from '@/lib/haptics';
import { countryLabel, hasGuidance, usesEmirates, type Country } from '@/data/countries';
import { EMIRATES, type Emirate } from '@/data/regions';
import { useTheme } from '@/hooks/use-theme';
import { ensureNotificationPermission } from '@/lib/notifications';
import { useSettings } from '@/store/settings';

type Step = 'welcome' | 'location' | 'reminders';

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings, update } = useSettings();
  const [step, setStep] = useState<Step>('welcome');
  const [country, setCountry] = useState<Country | null>(settings.country);
  const [emirate, setEmirate] = useState<Emirate | null>(settings.emirate);
  const [asking, setAsking] = useState(false);

  /*
   * The country is the one answer the app cannot sensibly default. Guessing UAE
   * would hand wrong procedures to everyone else; guessing "unsupported" would
   * strip the guides from the users we built them for. So this step is the only
   * one that will not let you past without an answer.
   */
  /** Held here so the primary button can open the picker it is waiting on. */
  const [pickingCountry, setPickingCountry] = useState(false);
  /** Briefly outlines the emirate list when the button is waiting on it. */
  const [nudgeEmirate, setNudgeEmirate] = useState(false);

  const needsCountry = step === 'location' && country === null;

  /**
   * The emirate is not a nicety in the UAE.
   *
   * Without it `portalFor` returns nothing, so the "Renew at TAMM" button — the
   * primary action on a driving licence, a Mulkiya and a residence visa —
   * simply is not there, and the "Where" row falls back to something generic.
   * Skipping this step quietly removed the most useful thing the app does, and
   * nothing on screen said so.
   *
   * It is also one tap, from a list already visible. So it is asked for rather
   * than assumed: guessing somebody's emirate would send them to the wrong
   * authority, which is worse than asking.
   */
  const needsEmirate = step === 'location' && usesEmirates(country) && emirate === null;

  function finish() {
    update({ onboarded: true, country, emirate });
    router.replace('/');
  }

  async function askForReminders() {
    setAsking(true);
    try {
      await ensureNotificationPermission();
    } finally {
      setAsking(false);
      finish();
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {step === 'welcome' && (
            <View style={styles.pane}>
              <ThemedText type="display" style={styles.centered}>
                Expyr
              </ThemedText>
              <ThemedText type="headline" style={styles.centered}>
                Nothing expires unnoticed.
              </ThemedText>
              {/*
                * Nothing here names a country. This is the first screen of the
                * app and it runs before the next one asks where somebody
                * lives, so "an Emirates ID" was the second example shown to
                * everyone on earth. Everything named here exists everywhere.
                *
                * Two triads rather than one, because the app tracks two kinds
                * of thing and this sentence only ever admitted to the first.
                */}
              <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
                A passport, a tenancy contract, the car insurance. The gym, the internet bill, a
                streaming plan. Expyr remembers the date so you do not have to.
              </ThemedText>

              <View style={styles.points}>
                <Point icon="line-scan" text="Point your camera at it, no typing" />
                <Point icon="bell-outline" text="Reminders long before the deadline" />
                <Point icon="cellphone-lock" text="Everything stays on your phone" />
              </View>
            </View>
          )}

          {step === 'location' && (
            <View style={styles.pane}>
              <ThemedText type="headline" style={styles.centered}>
                Where do you live?
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
                Renewal rules are national, so this decides what Expyr can tell you about
                renewing.
              </ThemedText>

              <CountrySelect
                open={pickingCountry}
                onOpenChange={setPickingCountry}
                value={country}
                onChange={(next) => {
                  setCountry(next);
                  // An emirate means nothing once you have left the UAE.
                  if (next !== 'ae') setEmirate(null);
                }}
              />

              {usesEmirates(country) && (
                <View style={styles.options}>
                  <ThemedText type="label" themeColor="textTertiary">
                    Which emirate
                  </ThemedText>
                  {EMIRATES.map((option) => {
                    const selected = emirate === option.value;
                    return (
                      <Pressable key={option.value} onPress={() => setEmirate(option.value)}>
                        <View
                          style={[
                            styles.option,
                            {
                              borderColor: selected
                                ? theme.accent
                                : nudgeEmirate
                                  ? theme.urgentSoft
                                  : theme.border,
                              backgroundColor: selected
                                ? theme.backgroundSelected
                                : theme.backgroundElement,
                            },
                          ]}>
                          <ThemedText type="bodyMedium" style={styles.flex}>
                            {option.label}
                          </ThemedText>
                          {selected && (
                            <MaterialCommunityIcons name="check" size={20} color={theme.accent} />
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                  <ThemedText
                    type="small"
                    themeColor={nudgeEmirate ? 'urgentSoft' : 'textTertiary'}>
                    Vehicles and licences are run by each emirate, not federally, so Expyr needs
                    this to send you to the right one.
                  </ThemedText>
                </View>
              )}

              {country !== null && !hasGuidance(country) && (
                <View style={[styles.note, { borderColor: theme.border }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Expyr tracks your dates and reminds you wherever you are. Renewal steps, costs
                    and fines have only been checked for the UAE, so{' '}
                    {country === 'other'
                      ? 'you will not see them'
                      : `there are none for ${countryLabel(country)} yet`}{' '}
                    . We would rather show you nothing than guess about your documents.
                  </ThemedText>
                </View>
              )}
            </View>
          )}

          {step === 'reminders' && (
            <View style={styles.pane}>
              <MaterialCommunityIcons
                name="bell-ring-outline"
                size={40}
                color={theme.textTertiary}
                style={styles.centered}
              />
              <ThemedText type="headline" style={styles.centered}>
                One last thing
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
                Your iPhone will ask you to confirm on the next screen.
              </ThemedText>
              <ThemedText type="small" themeColor="textTertiary" style={styles.centered}>
                Your iPhone will ask you to confirm on the next screen.
              </ThemedText>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {/*
            * The button is never dead.
            *
            * It used to be disabled until a country was chosen, and the only
            * sign of that was sixty percent opacity — which on a dark green
            * button reads as *pressed*, not as unavailable. So somebody who had
            * not noticed the dropdown tapped Continue, nothing happened, and
            * nothing said why. That is the first screen of the app behaving
            * like a broken one.
            *
            * Now it says what it needs instead of refusing silently, and
            * tapping it opens the very thing it is waiting for.
            */}
          <Pressable
            onPress={() => {
              if (needsCountry) {
                tapFeedback();
                setPickingCountry(true);
                return;
              }
              if (needsEmirate) {
                /*
                 * Nothing to open — the list is already on screen — so the
                 * button points at it instead. A label that names what is
                 * missing and a moment of colour where it lives beats a button
                 * that goes quiet, which is what this screen used to do.
                 */
                tapFeedback();
                setNudgeEmirate(true);
                setTimeout(() => setNudgeEmirate(false), 1600);
                return;
              }
              if (step === 'welcome') setStep('location');
              else if (step === 'location') setStep('reminders');
              else askForReminders();
            }}
            disabled={asking}>
            {({ pressed }) => (
              <View
                style={[
                  styles.primary,
                  { backgroundColor: theme.accent },
                  (pressed || asking) && styles.dim,
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.accentContrast }}>
                  {needsCountry
                    ? 'Choose your country'
                    : needsEmirate
                      ? 'Choose your emirate'
                      : step === 'reminders'
                        ? 'Allow reminders'
                        : 'Continue'}
                </ThemedText>
              </View>
            )}
          </Pressable>

          {step === 'reminders' && (
            <Pressable onPress={finish} style={styles.skip}>
              <ThemedText type="small" themeColor="textTertiary">
                Not now
              </ThemedText>
            </Pressable>
          )}

          <View style={styles.dots}>
            {(['welcome', 'location', 'reminders'] as Step[]).map((s) => (
              <View
                key={s}
                style={[
                  styles.dot,
                  { backgroundColor: s === step ? theme.accent : theme.border },
                ]}
              />
            ))}
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function Point({ icon, text }: { icon: string; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.point}>
      <MaterialCommunityIcons name={icon as never} size={20} color={theme.accent} />
      <ThemedText type="body" style={styles.flex}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: { flexGrow: 1, justifyContent: 'center', padding: Spacing.four },
  pane: { gap: Spacing.three },
  centered: { textAlign: 'center', alignSelf: 'center' },
  flex: { flex: 1 },
  points: { gap: Spacing.three, paddingTop: Spacing.four },
  point: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingTop: Spacing.three },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  note: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    marginTop: Spacing.two,
  },
  options: { gap: Spacing.two, paddingTop: Spacing.three },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  footer: { padding: Spacing.four, gap: Spacing.three },
  primary: { borderRadius: Radius.pill, paddingVertical: Spacing.three, alignItems: 'center' },
  skip: { alignItems: 'center' },
  dim: { opacity: 0.6 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  dot: { width: 6, height: 6, borderRadius: 3 },
});

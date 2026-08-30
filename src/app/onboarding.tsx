import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { PERSONA_OPTIONS } from '@/data/personas';
import { useTheme } from '@/hooks/use-theme';
import { ensureNotificationPermission } from '@/lib/notifications';
import { useSettings, type Persona } from '@/store/settings';

type Step = 'welcome' | 'persona' | 'reminders';

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings, update } = useSettings();
  const [step, setStep] = useState<Step>('welcome');
  const [persona, setPersona] = useState<Persona>(settings.persona);
  const [asking, setAsking] = useState(false);

  function finish() {
    update({ onboarded: true, persona });
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
                Renewly
              </ThemedText>
              <ThemedText type="headline" style={styles.centered}>
                Nothing expires unnoticed.
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
                Visas, licences, insurance, tenancy contracts, coursework deadlines — even the milk
                in your fridge. Photograph it once and Renewly remembers the date, warns you in
                time, and tells you exactly how to renew it.
              </ThemedText>

              <View style={styles.points}>
                <Point icon="line-scan" text="Point your camera at it — no typing" />
                <Point icon="bell-outline" text="Reminders long before the deadline" />
                <Point icon="cellphone-lock" text="Everything stays on your phone" />
              </View>
            </View>
          )}

          {step === 'persona' && (
            <View style={styles.pane}>
              <ThemedText type="headline" style={styles.centered}>
                What brings you here?
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
                This only decides what Renewly offers you first. You can track anything either way.
              </ThemedText>

              <View style={styles.options}>
                {PERSONA_OPTIONS.map((option) => {
                  const selected = persona === option.value;
                  return (
                    <Pressable key={option.value} onPress={() => setPersona(option.value)}>
                      <View
                        style={[
                          styles.option,
                          {
                            borderColor: selected ? theme.accent : theme.border,
                            backgroundColor: selected
                              ? theme.backgroundSelected
                              : theme.backgroundElement,
                          },
                        ]}>
                        <MaterialCommunityIcons
                          name={option.icon as never}
                          size={22}
                          color={selected ? theme.accent : theme.textSecondary}
                        />
                        <View style={styles.optionBody}>
                          <ThemedText type="bodyMedium">{option.title}</ThemedText>
                          <ThemedText type="small" themeColor="textTertiary">
                            {option.blurb}
                          </ThemedText>
                        </View>
                        {selected && (
                          <MaterialCommunityIcons name="check" size={20} color={theme.accent} />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
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
                Renewly is only useful if it can reach you. Reminders are scheduled on this phone —
                no server ever sees your dates — and you choose how far ahead they arrive.
              </ThemedText>
              <ThemedText type="small" themeColor="textTertiary" style={styles.centered}>
                Your iPhone will ask you to confirm on the next screen.
              </ThemedText>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={() => {
              if (step === 'welcome') setStep('persona');
              else if (step === 'persona') setStep('reminders');
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
                  {step === 'reminders' ? 'Allow reminders' : 'Continue'}
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
            {(['welcome', 'persona', 'reminders'] as Step[]).map((s) => (
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
  options: { gap: Spacing.two, paddingTop: Spacing.three },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  optionBody: { flex: 1, gap: 2 },
  footer: { padding: Spacing.four, gap: Spacing.three },
  primary: { borderRadius: Radius.pill, paddingVertical: Spacing.three, alignItems: 'center' },
  skip: { alignItems: 'center' },
  dim: { opacity: 0.6 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  dot: { width: 6, height: 6, borderRadius: 3 },
});

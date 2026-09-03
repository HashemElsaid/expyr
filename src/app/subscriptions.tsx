import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ensureBrandIcon } from '@/lib/brand-icons';
import { longDate } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { pickImage } from '@/lib/scan';
import {
  leadDaysFor,
  noteFor,
  readSubscriptionScreenshot,
  titleFor,
  type FoundSubscription,
} from '@/lib/subscriptions';
import { useDocuments } from '@/store/documents';
import { FREE_SCAN_LIMIT, useSettings } from '@/store/settings';
import type { Recurrence } from '@/types';

/**
 * Every subscription, from one screenshot.
 *
 * Nobody types their subscriptions in. They half remember three of the seven
 * they pay for, which is the reason the money keeps leaving. iOS already lists
 * them with their renewal dates, so the shortest honest path is to read that
 * list rather than to ask the person to copy it out.
 */
export default function SubscriptionsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { documents, addDocument } = useDocuments();
  const { settings, update } = useSettings();

  const [found, setFound] = useState<FoundSubscription[] | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const outOfScans = !settings.premium && settings.scansUsed >= FREE_SCAN_LIMIT;

  async function readScreenshot() {
    setError(null);
    if (outOfScans) {
      router.push('/paywall');
      return;
    }
    try {
      const picked = await pickImage('library');
      if (!picked) return;
      setBusy(true);
      const scan = await readSubscriptionScreenshot(picked);
      if (!settings.premium) update({ scansUsed: settings.scansUsed + 1 });

      if (scan.subscriptions.length === 0) {
        setError(
          scan.note
            ? `Nothing to add from that. ${scan.note}`
            : 'No subscriptions on that screen. Try the Subscriptions page in Settings.'
        );
        return;
      }
      setFound(scan.subscriptions);
      // Live ones are ticked; the lapsed are shown but left alone.
      setChosen(
        new Set(
          scan.subscriptions
            .map((sub, index) => (sub.status === 'active' && sub.renewsOn ? index : -1))
            .filter((index) => index >= 0)
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function addChosen() {
    if (!found || chosen.size === 0) return;
    setSaving(true);
    try {
      for (const index of [...chosen].sort((a, b) => a - b)) {
        const sub = found[index];
        if (!sub.renewsOn) continue;
        const period: Recurrence = sub.period === 'unknown' ? 'monthly' : sub.period;
        await addDocument({
          typeId: 'membership',
          title: titleFor(sub),
          expiryDate: sub.renewsOn,
          notes: noteFor(sub),
          files: [],
          leadDays: leadDaysFor(sub.period),
          renewsEvery: period,
          iconDomain: sub.domain || undefined,
        });
        /*
         * Pulled down now rather than when the row is first drawn, so the list
         * is already wearing the right faces when it appears. Failing is fine:
         * the row falls back to the same tile everything else uses.
         */
        void ensureBrandIcon(sub.domain);
      }
      successFeedback();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Those could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  function toggle(index: number) {
    tapFeedback();
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  /** Already tracked, so it is offered without being ticked by default. */
  function alreadyTracked(sub: FoundSubscription): boolean {
    const name = titleFor(sub).toLowerCase();
    return documents.some((doc) => doc.title.trim().toLowerCase() === name);
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!found ? (
          <>
            <ThemedText type="headline">Every subscription, in one go</ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              iPhone already keeps the list. Screenshot it and Expyr will read the names, the
              prices and the dates they charge you, then remind you before each one does.
            </ThemedText>

            <View style={[styles.steps, { borderColor: theme.border }]}>
              <Step n="1" text="Open Settings and tap your name at the top." />
              <Step n="2" text="Tap Subscriptions." />
              <Step n="3" text="Screenshot that screen, then come back here." />
            </View>

            <Pressable onPress={readScreenshot} disabled={busy} accessibilityRole="button">
              {({ pressed }) => (
                <View
                  style={[
                    styles.primary,
                    { backgroundColor: theme.accent },
                    (pressed || busy) && styles.dim,
                  ]}>
                  {busy ? (
                    <ActivityIndicator color={theme.accentContrast} />
                  ) : (
                    <ThemedText type="smallBold" style={{ color: theme.accentContrast }}>
                      Choose the screenshot
                    </ThemedText>
                  )}
                </View>
              )}
            </Pressable>

            <ThemedText type="small" themeColor="textTertiary">
              It also reads Google Play&apos;s list, or a card statement. The screenshot is read
              once and never stored anywhere but this phone.
            </ThemedText>
          </>
        ) : (
          <>
            <ThemedText type="headline">
              {found.length} found. Track which?
            </ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              Each one you keep becomes an item that rolls forward on its own, and warns you a few
              days before the money leaves.
            </ThemedText>

            {found.map((sub, index) => {
              const on = chosen.has(index);
              const tracked = alreadyTracked(sub);
              const undated = !sub.renewsOn;
              return (
                <Pressable
                  key={`${sub.name}-${index}`}
                  onPress={() => !undated && toggle(index)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: undated }}>
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.row,
                        {
                          borderColor: on ? theme.accent : theme.border,
                          backgroundColor: on ? theme.backgroundSelected : 'transparent',
                        },
                        (pressed || undated) && styles.dim,
                      ]}>
                      <MaterialCommunityIcons
                        name={on ? 'checkbox-marked' : 'checkbox-blank-outline'}
                        size={22}
                        color={on ? theme.accent : theme.textTertiary}
                      />
                      <View style={styles.flex}>
                        <ThemedText type="bodyMedium">{titleFor(sub)}</ThemedText>
                        <ThemedText type="small" themeColor="textTertiary">
                          {[
                            noteFor(sub),
                            sub.renewsOn
                              ? `${sub.status === 'active' ? 'Charges' : 'Ended'} ${longDate(sub.renewsOn)}`
                              : 'No date on the screen',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </ThemedText>
                        {tracked && (
                          <ThemedText type="small" style={{ color: theme.urgentSoft }}>
                            You already track something with this name.
                          </ThemedText>
                        )}
                      </View>
                    </View>
                  )}
                </Pressable>
              );
            })}

            <Pressable
              onPress={addChosen}
              disabled={chosen.size === 0 || saving}
              accessibilityRole="button">
              {({ pressed }) => (
                <View
                  style={[
                    styles.primary,
                    { backgroundColor: chosen.size === 0 ? theme.backgroundSelected : theme.accent },
                    (pressed || saving) && styles.dim,
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={{
                      color: chosen.size === 0 ? theme.textTertiary : theme.accentContrast,
                    }}>
                    {saving
                      ? 'Adding…'
                      : chosen.size === 0
                        ? 'Nothing selected'
                        : `Track ${chosen.size} subscription${chosen.size === 1 ? '' : 's'}`}
                  </ThemedText>
                </View>
              )}
            </Pressable>
          </>
        )}

        {error && (
          <ThemedText type="small" style={{ color: theme.urgentStrong }}>
            {error}
          </ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.step}>
      <ThemedText type="label" themeColor="textTertiary">
        {n}
      </ThemedText>
      <ThemedText type="small" style={styles.flex}>
        {text}
      </ThemedText>
      <View style={[styles.stepRule, { backgroundColor: theme.border }]} />
    </View>
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
  steps: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 6 },
  stepRule: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 0 },
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  primary: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  dim: { opacity: 0.6 },
});

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DocIcon } from '@/components/doc-icon';
import { PrimaryButton } from '@/components/form';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { isSubscription } from '@/domain/documents';
import {
  importLabel,
  importSummary,
  initiallyChosen,
  planImport,
  type ImportRow,
} from '@/domain/import-plan';
import { parseMoney } from '@/domain/money';
import { useTheme } from '@/hooks/use-theme';
import { ensureBrandIcon } from '@/lib/brand-icons';
import { dayMonthOf, longDate } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { recurrenceWord } from '@/lib/recurrence';
import { pickImage } from '@/lib/scan';
import { leadDaysFor, noteFor, readSubscriptionScreenshot, titleFor } from '@/lib/subscriptions';
import { useDocuments } from '@/store/documents';
import { FREE_SCAN_LIMIT, FREE_SUBSCRIPTION_REMINDERS, useSettings } from '@/store/settings';
import type { Recurrence } from '@/types';

/**
 * Add from a screenshot: the only way a subscription gets into Expyr.
 *
 * Nobody types their subscriptions in. They half remember three of the seven
 * they pay for, which is the reason the money keeps leaving. iOS already keeps
 * the list with its dates, and every service sends a receipt, so the shortest
 * honest path is to read one of those rather than ask anybody to copy it out.
 *
 * Three stages, the prototype's: which kind of screenshot, the screenshot
 * itself being read, then what was found, sorted into what is new, what is in
 * a free trial, what has ended and what is already tracked.
 */
export default function AddFromScreenshot() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { documents, addDocument, setArchived } = useDocuments();
  const { settings, update } = useSettings();

  /*
   * An image the document scanner handed over: the person chose a photo on
   * the document path and it turned out to be their Subscriptions screen. They
   * are not supposed to know there are two readers, so it arrives here rather
   * than them being told to start again.
   */
  const params = useLocalSearchParams<{ image?: string }>();
  const handedOver = typeof params.image === 'string' ? params.image : undefined;

  const [reading, setReading] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const outOfScans = !settings.premium && settings.scansUsed >= FREE_SCAN_LIMIT;

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  /** Reads a picture already in hand, chosen here or handed over. */
  async function read(uri: string) {
    setError(null);
    setReading(uri);
    try {
      const scan = await readSubscriptionScreenshot({ uri, type: 'image' });
      if (!settings.premium) update({ scansUsed: settings.scansUsed + 1 });
      if (scan.subscriptions.length === 0) {
        // The reader's own sentence about what it saw says why, which helps the next try.
        setError(
          scan.note ||
            'Nothing to add from that. Try the Subscriptions page in Settings, or a receipt from the service.'
        );
        return;
      }
      const planned = planImport(scan.subscriptions, documents.filter(isSubscription));
      setRows(planned);
      setChosen(initiallyChosen(planned));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.');
    } finally {
      setReading(null);
    }
  }

  async function choose() {
    tapFeedback();
    setError(null);
    if (outOfScans) {
      router.push('/paywall');
      return;
    }
    try {
      const picked = await pickImage('library');
      if (picked) await read(picked.uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.');
    }
  }

  /* Once, on arrival, for an image the scanner passed through. */
  const started = useRef(false);
  useEffect(() => {
    if (!handedOver || started.current) return;
    started.current = true;
    void read(handedOver);
    // Reading it is the whole reason this screen was opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handedOver]);

  /**
   * Adds what is new, archives what has ended, and leaves the rest alone.
   *
   * Every chosen subscription is added, on any plan, so the yearly total is
   * the real one; the free plan holds back reminders instead (see
   * FREE_SUBSCRIPTION_REMINDERS). So the moment the real figure exists is the
   * moment the paywall says what Pro does about it, and closing it lands on
   * the list with every subscription on it.
   */
  async function apply() {
    if (!rows) return;
    const before = documents.filter(isSubscription).length;
    let added = 0;
    setSaving(true);
    try {
      for (const [index, row] of rows.entries()) {
        if (!chosen.has(index)) continue;
        if (row.kind === 'ended' && row.match) {
          await setArchived(row.match.id, true);
          continue;
        }
        if (row.kind !== 'new' && row.kind !== 'trial') continue;
        const sub = row.found;
        const period: Recurrence = sub.period === 'unknown' ? 'monthly' : sub.period;
        /*
         * The price as a figure, beside the price as printed. Absent rather
         * than guessed when the screenshot did not say a currency: a price with
         * no currency would be added to the total as whatever the total was.
         */
        const price = parseMoney(sub.price);
        await addDocument({
          typeId: 'membership',
          title: titleFor(sub),
          expiryDate: sub.renewsOn,
          notes: noteFor(sub),
          files: [],
          // A trial is warned two days before it turns into the first charge.
          leadDays: row.kind === 'trial' ? [2] : leadDaysFor(sub.period),
          renewsEvery: period,
          ...(price ? { price: { ...price, every: period } } : {}),
          ...(row.kind === 'trial' ? { trial: true } : {}),
          ...(sub.plan.trim()
            ? { fields: [{ label: 'Plan', value: sub.plan.trim(), kind: 'other' as const }] }
            : {}),
          iconDomain: sub.domain || undefined,
        });
        // Fetched now so the list is already wearing the right faces when it appears.
        void ensureBrandIcon(sub.domain);
        added += 1;
      }
      successFeedback();
      if (added > 0 && !settings.premium && before + added > FREE_SUBSCRIPTION_REMINDERS) {
        router.replace('/paywall');
        return;
      }
      close();
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

  const single = rows?.length === 1 ? rows[0] : null;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="title2" style={styles.flex}>
            {reading
              ? 'Reading your screenshot'
              : single
                ? single.kind === 'tracked'
                  ? `${titleFor(single.found)} is already tracked`
                  : `Found ${titleFor(single.found)}`
                : rows
                  ? `Found ${rows.length} subscriptions`
                  : 'Add from a screenshot'}
          </ThemedText>
          <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            {({ pressed }) => (
              <View
                style={[
                  styles.close,
                  { backgroundColor: theme.backgroundSelected },
                  pressed && styles.dim,
                ]}>
                <Icon name="xmark" size={15} weight="semibold" color={theme.textSecondary} />
              </View>
            )}
          </Pressable>
        </View>

        {reading ? (
          <ReadingShot uri={reading} />
        ) : rows ? (
          <>
            {!single && (
              <ThemedText type="body" themeColor="textSecondary">
                {importSummary(rows)}
              </ThemedText>
            )}
            <View style={[styles.group, { backgroundColor: theme.backgroundElement }]}>
              {rows.map((row, index) => (
                <Animated.View key={`${row.found.name}-${index}`} entering={rise(index)}>
                  <FoundRow
                    row={row}
                    on={chosen.has(index)}
                    onToggle={single ? undefined : () => toggle(index)}
                    last={index === rows.length - 1}
                  />
                </Animated.View>
              ))}
            </View>
            {single && (single.kind === 'new' || single.kind === 'trial') && (
              <WhatWasRead row={single} />
            )}
            <PrimaryButton
              label={
                saving
                  ? 'Adding'
                  : single && (single.kind === 'new' || single.kind === 'trial')
                    ? `Track ${titleFor(single.found)}`
                    : importLabel(rows, chosen)
              }
              disabled={saving}
              onPress={apply}
            />
          </>
        ) : (
          <>
            <ThemedText type="body" themeColor="textSecondary">
              Expyr reads the name, the price, how often it charges and the next date. There is
              nothing to type.
            </ThemedText>
            <View style={styles.picks}>
              <Pick
                sketch={<SettingsSketch />}
                title="iPhone Settings"
                detail="Your name, then Subscriptions"
                onPress={choose}
              />
              <Pick
                sketch={<ReceiptSketch />}
                title="A receipt email"
                detail="From Apple, or from the company"
                onPress={choose}
              />
            </View>
            <ThemedText type="footnote" themeColor="textTertiary">
              Google Play&apos;s list and card statements work too. The screenshot is read once and
              kept nowhere but this phone.
            </ThemedText>
          </>
        )}

        {error && (
          <ThemedText type="footnote" style={{ color: theme.urgentStrong }}>
            {error}
          </ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}

/** The rows arrive one after another, on the settle spring. */
function rise(index: number) {
  return FadeInDown.delay(index * 60).springify().stiffness(300).damping(32);
}

/** One of the two kinds of screenshot, drawn as a small sketch of itself. */
function Pick({
  sketch,
  title,
  detail,
  onPress,
}: {
  sketch: ReactNode;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      style={styles.pickSlot}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}>
      {({ pressed }) => (
        <View
          style={[
            styles.pick,
            { backgroundColor: theme.backgroundElement },
            pressed && { backgroundColor: theme.backgroundSelected },
          ]}>
          {sketch}
          <ThemedText type="headline" style={styles.pickTitle}>
            {title}
          </ThemedText>
          <ThemedText type="footnote" themeColor="textSecondary">
            {detail}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

/*
 * The sketches are screenshots, so they stay paper-white in dark mode: that is
 * what the person will be looking for in their photos.
 */
const PAPER = '#FFFFFF';
const BAR = '#E3E8E5';
const INK = '#141414';

function SettingsSketch() {
  return (
    <View style={styles.sketch} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={styles.sketchHead}>Subscriptions</Text>
      {[
        ['#111111', 80],
        ['#3D7BD9', 60],
        ['#1A1A1A', 70],
        ['#3C8CF0', 86],
      ].map(([colour, width], i) => (
        <View key={i} style={[styles.sketchRow, i > 0 && styles.sketchRule]}>
          <View style={[styles.sketchIcon, { backgroundColor: colour as string }]} />
          <View style={styles.flex}>
            <View style={[styles.sketchBar, { width: `${width as number}%` }]} />
            <View style={[styles.sketchBar, styles.sketchBarShort]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function ReceiptSketch() {
  return (
    <View style={styles.sketch} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={styles.sketchHead}>Your receipt</Text>
      <View style={[styles.sketchBar, { width: '72%' }]} />
      <View style={[styles.sketchBar, { width: '48%' }]} />
      <View style={styles.sketchLine} />
      <View style={styles.sketchRow}>
        <View style={[styles.sketchIcon, { backgroundColor: '#113CCF' }]} />
        <View style={[styles.sketchBar, styles.flex]} />
        <Text style={styles.sketchPrice}>15.99</Text>
      </View>
      <View style={styles.sketchLine} />
      <View style={[styles.sketchBar, { width: '62%' }]} />
    </View>
  );
}

/** The person's own screenshot, with a line of light reading down it. */
function ReadingShot({ uri }: { uri: string }) {
  const reduced = useReducedMotion();
  const sweep = useSharedValue(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (reduced) return;
    sweep.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [reduced, sweep]);

  const band = useAnimatedStyle(() => ({
    transform: [{ translateY: -60 + sweep.value * (height + 60) }],
  }));

  return (
    <View style={styles.reading}>
      <View
        style={styles.shot}
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        accessibilityLabel="Your screenshot, being read">
        <Image source={{ uri }} style={styles.shotImage} resizeMode="cover" />
        {!reduced && <Animated.View style={[styles.sweep, band]} />}
      </View>
      <ThemedText type="footnote" themeColor="textSecondary" style={styles.center}>
        Names, prices and dates, read off the screen
      </ThemedText>
    </View>
  );
}

/** One subscription the screenshot showed, and what will happen to it. */
function FoundRow({
  row,
  on,
  onToggle,
  last,
}: {
  row: ImportRow;
  on: boolean;
  onToggle?: () => void;
  last: boolean;
}) {
  const theme = useTheme();
  const sub = row.found;
  const acts = row.kind === 'new' || row.kind === 'trial' || row.kind === 'ended';
  const tag = tagFor(row);
  const tone =
    row.kind === 'new'
      ? { color: theme.accent, backgroundColor: theme.tile }
      : row.kind === 'trial'
        ? { color: theme.urgentSoft, backgroundColor: theme.urgentSoftWash }
        : row.kind === 'ended'
          ? { color: theme.urgentStrong, backgroundColor: theme.urgentStrongWash }
          : { color: theme.textTertiary, backgroundColor: theme.backgroundSelected };

  return (
    <View style={styles.found}>
      <DocIcon typeId="membership" iconDomain={sub.domain || undefined} size={38} />
      <View style={styles.foundWords}>
        <ThemedText type="headline" numberOfLines={1}>
          {titleFor(sub)}
        </ThemedText>
        <Text style={[styles.tag, tone]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {tag}
        </Text>
      </View>
      {acts && onToggle ? (
        <Pressable
          onPress={onToggle}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: on }}
          accessibilityLabel={`${row.kind === 'ended' ? 'Archive' : 'Add'} ${titleFor(sub)}`}>
          <View
            style={[
              styles.check,
              on
                ? { backgroundColor: theme.accent, borderColor: theme.accent }
                : { borderColor: theme.border },
            ]}>
            {on && <Icon name="checkmark" size={13} weight="bold" color={theme.accentContrast} />}
          </View>
        </Pressable>
      ) : null}
      {!last && <View style={[styles.rule, { backgroundColor: theme.border }]} />}
    </View>
  );
}

function tagFor(row: ImportRow): string {
  const sub = row.found;
  switch (row.kind) {
    case 'new': {
      const every = sub.period === 'unknown' ? '' : ` ${recurrenceWord(sub.period).toLowerCase()}`;
      return sub.price ? `New, ${sub.price}${every}` : 'New';
    }
    case 'trial':
      return `Free trial until ${dayMonthOf(sub.renewsOn)}`;
    case 'ended':
      return `${sub.status === 'cancelled' ? 'Cancelled' : 'Expired'}, so it will be archived`;
    case 'tracked':
      return 'Already tracked';
    case 'gone':
      return sub.status === 'cancelled' ? 'Cancelled' : 'Expired';
    case 'undated':
      return 'No date on the screen';
  }
}

/** For a single receipt: everything that was read off it, so it can be checked. */
function WhatWasRead({ row }: { row: ImportRow }) {
  const theme = useTheme();
  const sub = row.found;
  const facts: [string, string][] = [
    ...(sub.plan.trim() ? ([['Plan', sub.plan.trim()]] as [string, string][]) : []),
    ...(sub.price ? ([['Price', sub.price]] as [string, string][]) : []),
    ...(sub.period !== 'unknown' ? ([['Charges', recurrenceWord(sub.period)]] as [string, string][]) : []),
    [row.kind === 'trial' ? 'First charge' : 'Next charge', longDate(sub.renewsOn)],
  ];
  return (
    <View style={styles.read}>
      <ThemedText type="sectionHeader" themeColor="textSecondary" style={styles.readHeader}>
        What Expyr read
      </ThemedText>
      <View style={[styles.group, { backgroundColor: theme.backgroundElement }]}>
        {facts.map(([label, value], i) => (
          <View key={label} style={styles.fact}>
            <View style={styles.flex}>
              <ThemedText type="footnote" themeColor="textTertiary">
                {label}
              </ThemedText>
              <ThemedText type="body">{value}</ThemedText>
            </View>
            <Icon name="checkmark" size={14} weight="semibold" color={theme.accent} />
            {i < facts.length - 1 && (
              <View style={[styles.rule, styles.factRule, { backgroundColor: theme.border }]} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  dim: { opacity: 0.6 },
  center: { textAlign: 'center' },
  picks: { flexDirection: 'row', gap: 12 },
  pickSlot: { flex: 1 },
  pick: { borderRadius: 18, padding: 12, gap: 2 },
  pickTitle: { marginTop: 10, fontSize: 15 },
  sketch: {
    backgroundColor: PAPER,
    borderRadius: 12,
    padding: 10,
    gap: 6,
    height: 132,
    overflow: 'hidden',
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.12)',
  },
  sketchHead: { ...Fonts.strong, fontSize: 10, color: INK, marginBottom: 2 },
  sketchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  sketchRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BAR },
  sketchIcon: { width: 14, height: 14, borderRadius: 4 },
  sketchBar: { height: 5, borderRadius: 3, backgroundColor: BAR },
  sketchBarShort: { width: '40%', marginTop: 3 },
  sketchLine: { height: StyleSheet.hairlineWidth, backgroundColor: BAR, marginVertical: 2 },
  sketchPrice: { ...Fonts.strong, fontSize: 9, color: INK },
  reading: { gap: Spacing.three },
  shot: { borderRadius: 18, overflow: 'hidden', height: 380, backgroundColor: PAPER },
  shotImage: { width: '100%', height: '100%' },
  sweep: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 60,
    backgroundImage:
      'linear-gradient(180deg, rgba(168, 230, 198, 0) 0%, rgba(168, 230, 198, 0.55) 50%, rgba(168, 230, 198, 0) 100%)',
  },
  group: { borderRadius: 18, overflow: 'hidden' },
  found: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  foundWords: { flex: 1, minWidth: 0, gap: 4, alignItems: 'flex-start' },
  tag: {
    ...Fonts.strong,
    fontSize: 11.5,
    lineHeight: 16,
    paddingHorizontal: 7,
    borderRadius: 6,
    overflow: 'hidden',
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rule: { position: 'absolute', left: 64, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  read: { gap: Spacing.two },
  readHeader: { marginLeft: 4 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14 },
  factRule: { left: 14 },
});

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';
import {
  askDocuments,
  hasReading,
  loadTurns,
  readable,
  saveTurns,
  type Turn,
} from '@/lib/reading';
import { labelForId } from '@/data/document-types';
import { longDate } from '@/lib/dates';
import { useDocuments } from '@/store/documents';
import {
  canAfford,
  chargeForQuestion,
  CREDITS_PER_QUESTION,
  formatCredits,
} from '@/domain/credits';
import { askAllowance, useSettings } from '@/store/settings';

/**
 * People open a chat box and cannot think of a question. These are the ones
 * worth asking of almost any paperwork, and they double as a demonstration of
 * what the thing can do.
 */
/**
 * What it is doing, said in order. A question takes ten seconds or so against a
 * warm service, and a screen that shows nothing for ten seconds looks broken —
 * so it says which part of the work it has reached rather than spinning.
 */
const WORKING = ['Reading your papers', 'Looking for the clause', 'Checking the wording'];

const STARTERS = [
  'What will cost me money?',
  'What am I not allowed to do?',
  'How much notice do I have to give?',
  'When does anything renew itself?',
];

export default function AskScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { documents, archived } = useDocuments();
  const { settings, update } = useSettings();
  const allowance = askAllowance(settings);
  const scroller = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  /*
   * The keyboard covers the tab bar, so lifting the composer by the whole
   * keyboard leaves a band of empty page exactly the height of the bar. Lift by
   * the difference instead. KeyboardAvoidingView cannot know about the bar,
   * which is why it left that gap.
   */
  /*
   * The bar's own height plus whatever the home indicator takes. Measured
   * rather than asked for: expo-router 57 dropped React Navigation, and the
   * hook that used to answer this now lives inside the package's build folder,
   * which is not an address worth depending on.
   */
  const tabBarHeight = 49 + insets.bottom;
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    const shown = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => setKeyboard(event.endCoordinates.height)
    );
    const hidden = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboard(0)
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  const lift = Math.max(0, keyboard - tabBarHeight);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  /** The question already sent, held until its answer arrives. */
  const [pending, setPending] = useState<string | null>(null);
  const [working, setWorking] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Moves through the stages while the answer is being formed.
  useEffect(() => {
    if (!busy) {
      setWorking(0);
      return;
    }
    const timer = setInterval(() => setWorking((n) => (n + 1) % WORKING.length), 2600);
    return () => clearInterval(timer);
  }, [busy]);

  /*
   * Everything Expyr has read, or one document when the question was started
   * from that document's own screen. Archived items count: a tenancy that ended
   * is exactly the paper somebody argues about afterwards.
   */
  const pool = useMemo(() => readable([...documents, ...archived]), [documents, archived]);
  const scoped = id ? pool.find((doc) => doc.id === id) : undefined;
  const asking = useMemo(
    () => (scoped ? [scoped] : pool).map((doc) => ({ id: doc.id, title: doc.title })),
    [scoped, pool]
  );

  /*
   * Expyr's own file, one line per item, whether or not it has been read. The
   * app knew the tenancy expires in March and had no way to say so, because the
   * only thing it sent was the text of documents it had transcribed.
   */
  const records = useMemo(
    () =>
      [...documents, ...archived].map((doc) => {
        const parts = [
          labelForId(doc.typeId, settings.country),
          `expires ${longDate(doc.expiryDate)}`,
          doc.owner ? `belongs to ${doc.owner}` : 'the phone owner’s',
          doc.documentNumber ? `number ${doc.documentNumber}` : '',
          hasReading(doc.id) ? 'read in full' : 'not read yet, so its wording is not available',
          doc.archivedAt ? 'archived' : '',
        ].filter(Boolean);
        return `${doc.title}: ${parts.join(', ')}`;
      }),
    [documents, archived, settings.country]
  );

  /*
    * A different set of documents is a different conversation, so each is
    * stored under its own scope and read back here rather than started empty.
    */
  const scope = id ?? 'all';

  useEffect(() => {
    setTurns(loadTurns(scope));
    setError(null);
  }, [scope]);

  async function ask(text: string) {
    const trimmed = text.trim();
    // A file with no readings in it can still answer when something expires.
    if (!trimmed || busy || (asking.length === 0 && records.length === 0)) return;
    /*
     * The balance is asked before the question is sent, not after it is
     * answered. An answer that arrives and is then refused has already cost us
     * the money it was refused for.
     */
    if (!canAfford(settings.credits, CREDITS_PER_QUESTION)) {
      setError(
        `Each question costs ${CREDITS_PER_QUESTION} credits and you have ${formatCredits(settings.credits.balance)}. Top up in Settings to keep asking.`
      );
      return;
    }
    if (allowance.left === 0) {
      setError(
        `That is ${allowance.limit} questions today. Every one of them reads your documents afresh, so the count starts again tomorrow.`
      );
      return;
    }
    tapFeedback();
    setQuestion('');
    setError(null);
    // On screen before the request leaves, where the person put it.
    setPending(trimmed);
    setBusy(true);
    requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
    try {
      const answer = await askDocuments(asking, trimmed, turns, records);
      setTurns((current) => {
        const next = [...current, { question: trimmed, answer }];
        saveTurns(scope, next);
        return next;
      });
      // Only an answer is counted: a failure delivered nothing, and is not charged for.
      update({
        ...allowance.spend(),
        credits: chargeForQuestion(settings.credits, trimmed, new Date(), `${Date.now()}`),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.');
    } finally {
      setPending(null);
      setBusy(false);
      requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
    }
  }

  /*
   * Nothing to go on at all — not one item tracked. Having items but no
   * readings is a perfectly good place to ask from: the dates are answerable
   * even when the wording is not.
   */
  const nothingRead = records.length === 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.flex, { paddingBottom: lift }]}>
          <View style={styles.header}>
            <ThemedText type="display">Expyr AI</ThemedText>
            {scoped ? (
              <Pressable
                onPress={() => router.setParams({ id: '' })}
                accessibilityRole="button"
                accessibilityLabel="Ask across everything instead">
                {({ pressed }) => (
                  <View
                    style={[
                      styles.scope,
                      { borderColor: theme.border, backgroundColor: theme.backgroundSelected },
                      pressed && styles.dim,
                    ]}>
                    <ThemedText type="small" numberOfLines={1} style={styles.scopeLabel}>
                      {scoped.title}
                    </ThemedText>
                    <MaterialCommunityIcons name="close" size={14} color={theme.textTertiary} />
                  </View>
                )}
              </Pressable>
            ) : (
              !nothingRead && (
                <ThemedText type="label" themeColor="textTertiary">
                  {/*
                    * "0 of 6 read" was a status report on the app's own
                    * plumbing. What a person wants to know is what they can ask
                    * about, and being told a contract is readable is only worth
                    * saying when one actually is.
                    */}
                  {allowance.left <= 5
                    ? `${allowance.left} question${allowance.left === 1 ? '' : 's'} left today`
                    : pool.length > 0
                      ? `${records.length} tracked · ${pool.length} read in full`
                      : `${records.length} item${records.length === 1 ? '' : 's'} tracked`}
                </ThemedText>
              )
            )}
          </View>

          <ScrollView
            ref={scroller}
            contentContainerStyle={styles.thread}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {nothingRead ? (
              <View style={styles.blank}>
                <MaterialCommunityIcons
                  name="text-box-search-outline"
                  size={28}
                  color={theme.textTertiary}
                />
                {/*
                  * This appears when there is nothing tracked at all, not when
                  * nothing has been read — the condition is the count of items.
                  * It used to say "Nothing read yet" and tell people to attach a
                  * contract, which reads as a broken feature to somebody who has
                  * simply not added anything, and is wrong twice over: dates can
                  * be answered from what Expyr already knows, with nothing read.
                  */}
                <ThemedText type="headline" style={styles.centered}>
                  Nothing to ask about yet
                </ThemedText>
                <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
                  Add something and you can ask about it here — when it expires, what it cost,
                  who it belongs to. Attach a contract and Expyr reads it too, so you can ask what
                  it actually says and get the clause back.
                </ThemedText>
                <Pressable onPress={() => router.push('/add')} accessibilityRole="button">
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.primary,
                        { backgroundColor: theme.accent },
                        pressed && styles.dim,
                      ]}>
                      <ThemedText type="smallBold" style={{ color: theme.accentContrast }}>
                        Add a document
                      </ThemedText>
                    </View>
                  )}
                </Pressable>
              </View>
            ) : turns.length === 0 ? (
              <View style={styles.intro}>
                <ThemedText type="body" themeColor="textTertiary" style={styles.centered}>
                  {scoped
                    ? `Ask ${scoped.title} anything.`
                    : 'Ask your own paperwork anything.'}
                </ThemedText>
                <ThemedText type="small" themeColor="textTertiary" style={styles.centered}>
                  Every answer quotes the clause it came from.
                </ThemedText>
              </View>
            ) : null}

            {turns.map((turn, index) => (
              <View key={`${index}-${turn.question}`} style={styles.turn}>
                {/* The question, as the person put it: their words, their bubble. */}
                <View style={styles.askedRow}>
                  <View style={[styles.asked, { backgroundColor: theme.backgroundSelected }]}>
                    <ThemedText type="body">{turn.question}</ThemedText>
                  </View>
                </View>

                <View style={styles.reply}>
                  <ThemedText type="body">{turn.answer.answer}</ThemedText>

                  {/*
                   * The clause itself, set apart. This is the difference between
                   * an assistant that tells you something and one you can check.
                   */}
                  {turn.answer.answered && turn.answer.quote ? (
                    <View style={[styles.quote, { borderLeftColor: theme.accent }]}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.quoteText}>
                        {turn.answer.quote}
                      </ThemedText>
                      {turn.answer.where ? (
                        <ThemedText type="label" themeColor="textTertiary">
                          {turn.answer.where}
                        </ThemedText>
                      ) : null}
                    </View>
                  ) : null}

                  {turn.answer.answered && turn.answer.source && !scoped ? (
                    <View style={styles.sourceRow}>
                      <MaterialCommunityIcons
                        name="file-document-outline"
                        size={14}
                        color={theme.textTertiary}
                      />
                      <ThemedText type="small" themeColor="textTertiary">
                        {turn.answer.source}
                      </ThemedText>
                    </View>
                  ) : null}

                  {!turn.answer.answered && (
                    <View style={styles.silent}>
                      <MaterialCommunityIcons
                        name="information-outline"
                        size={15}
                        color={theme.textTertiary}
                      />
                      <ThemedText type="small" themeColor="textTertiary" style={styles.flex}>
                        {scoped
                          ? 'Not covered by this document.'
                          : 'Not covered by anything Expyr has read.'}{' '}
                        That is not the same as being allowed or forbidden, only that the paper is
                        silent.
                      </ThemedText>
                    </View>
                  )}
                </View>
              </View>
            ))}

            {pending && (
              <View style={styles.turn}>
                <View style={styles.askedRow}>
                  <View style={[styles.asked, { backgroundColor: theme.backgroundSelected }]}>
                    <ThemedText type="body">{pending}</ThemedText>
                  </View>
                </View>
                <View style={styles.reply}>
                  <ThemedText type="body" themeColor="textTertiary">
                    {WORKING[working]}…
                  </ThemedText>
                </View>
              </View>
            )}

            {error && (
              <View style={styles.reply}>
                <ThemedText type="small" style={{ color: theme.urgentStrong }}>
                  {error}
                </ThemedText>
              </View>
            )}
          </ScrollView>

          {!nothingRead && (
            <View style={[styles.composer, { borderTopColor: theme.border }]}>
              {/*
               * A row of openers, at the edge of the thumb rather than filling
               * the screen above it. They disappear the moment there is a
               * conversation to read, which is the moment they stop helping.
               */}
              {turns.length === 0 && !busy && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.starters}>
                  {STARTERS.map((starter) => (
                    <Pressable key={starter} onPress={() => ask(starter)} disabled={busy}>
                      {({ pressed }) => (
                        <View
                          style={[
                            styles.starter,
                            { borderColor: theme.border },
                            pressed && styles.dim,
                          ]}>
                          <ThemedText type="small" themeColor="textSecondary">
                            {starter}
                          </ThemedText>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <View
                style={[
                  styles.inputWrap,
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                ]}>
                <TextInput
                  value={question}
                  onChangeText={setQuestion}
                  placeholder={scoped ? `Ask about ${scoped.title}` : 'Ask your documents'}
                  placeholderTextColor={theme.textTertiary}
                  multiline
                  style={[styles.input, { color: theme.text }]}
                  onSubmitEditing={() => ask(question)}
                  returnKeyType="send"
                  blurOnSubmit={false}
                  accessibilityLabel="Your question"
                />
                <Pressable
                  onPress={() => ask(question)}
                  disabled={busy || question.trim().length === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Send">
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.send,
                        {
                          backgroundColor:
                            question.trim().length === 0 || busy
                              ? theme.backgroundSelected
                              : theme.accent,
                        },
                        pressed && styles.dim,
                      ]}>
                      <MaterialCommunityIcons
                        name="arrow-up"
                        size={18}
                        color={
                          question.trim().length === 0 || busy
                            ? theme.textTertiary
                            : theme.accentContrast
                        }
                      />
                    </View>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  scope: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: 200,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  scopeLabel: { flexShrink: 1 },
  thread: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.four, gap: Spacing.four },
  blank: { alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.six },
  centered: { textAlign: 'center' },
  intro: { gap: Spacing.two, paddingTop: Spacing.six, alignItems: 'center' },
  starters: { gap: Spacing.two, paddingBottom: Spacing.three, paddingRight: Spacing.four },
  starter: {
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  turn: { gap: Spacing.three },
  askedRow: { alignItems: 'flex-end' },
  asked: {
    maxWidth: '85%',
    borderRadius: Radius.large,
    borderBottomRightRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  reply: { gap: Spacing.three },
  quote: { borderLeftWidth: 2, paddingLeft: Spacing.three, gap: Spacing.one },
  quoteText: { fontStyle: 'italic' },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  silent: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  composer: {
    paddingLeft: Spacing.four,
    paddingRight: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    paddingVertical: Spacing.two,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 15,
    lineHeight: 21,
    maxHeight: 120,
    paddingTop: 6,
    paddingBottom: 6,
  },
  send: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primary: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    marginTop: Spacing.two,
  },
  dim: { opacity: 0.6 },
});

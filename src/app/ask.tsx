import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';
import { askAboutDocument, loadBrief, type Turn } from '@/lib/reading';
import { useDocuments } from '@/store/documents';

/**
 * People open a chat box and cannot think of a question. These are the ones
 * worth asking of almost any agreement, and they double as a demonstration of
 * what the thing can do.
 */
const STARTERS = [
  'What will cost me money?',
  'What am I not allowed to do?',
  'How much notice do I have to give?',
  'What happens if I leave early?',
];

export default function AskScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { documents, archived } = useDocuments();
  const scroller = useRef<ScrollView>(null);

  const doc = [...documents, ...archived].find((d) => d.id === id);
  const brief = doc ? loadBrief(doc.id) : null;

  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: doc?.title ?? 'Ask' });
  }, [navigation, doc?.title]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!doc || !trimmed || busy) return;
    tapFeedback();
    setQuestion('');
    setError(null);
    setBusy(true);
    try {
      const answer = await askAboutDocument(doc.id, trimmed, turns);
      setTurns((current) => [...current, { question: trimmed, answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
      requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
    }
  }

  if (!doc) return <ThemedView style={styles.container} />;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={96}>
        <ScrollView
          ref={scroller}
          contentContainerStyle={styles.content}
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>
          {turns.length === 0 && (
            <View style={styles.intro}>
              <ThemedText type="headline">Ask it anything</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                {brief
                  ? `Answers come from your ${brief.kind.toLowerCase()}, quoting the clause they came from. If it does not say, Expyr will tell you that instead of guessing.`
                  : 'Answers come from this document, quoting the clause they came from. If it does not say, Expyr will tell you that instead of guessing.'}
              </ThemedText>

              <View style={styles.starters}>
                {STARTERS.map((starter) => (
                  <Pressable key={starter} onPress={() => ask(starter)} disabled={busy}>
                    {({ pressed }) => (
                      <View
                        style={[
                          styles.starter,
                          { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                          pressed && styles.dim,
                        ]}>
                        <ThemedText type="small">{starter}</ThemedText>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {turns.map((turn, i) => (
            <View key={`${i}-${turn.question}`} style={styles.turn}>
              <ThemedText type="ledgerTitle">{turn.question}</ThemedText>

              <ThemedText type="body" themeColor="textSecondary">
                {turn.answer.answer}
              </ThemedText>

              {/*
               * The clause itself, set apart. This is the difference between an
               * assistant that tells you something and one you can check.
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

              {!turn.answer.answered && (
                <View style={styles.silent}>
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={15}
                    color={theme.textTertiary}
                  />
                  <ThemedText type="small" themeColor="textTertiary" style={styles.flex}>
                    Not covered by this document. That is not the same as being allowed or
                    forbidden, only that the paper is silent.
                  </ThemedText>
                </View>
              )}
            </View>
          ))}

          {busy && (
            <View style={styles.thinking}>
              <ActivityIndicator color={theme.accent} />
              <ThemedText type="small" themeColor="textTertiary">
                Looking through it…
              </ThemedText>
            </View>
          )}

          {error && (
            <ThemedText type="small" style={{ color: theme.urgentStrong }}>
              {error}
            </ThemedText>
          )}

          <ThemedText type="small" themeColor="textTertiary" style={styles.disclaimer}>
            Expyr reads the document back to you. It is not legal advice, and the document itself
            is what counts.
          </ThemedText>
        </ScrollView>

        <View style={[styles.composer, { borderTopColor: theme.border }]}>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="Ask about this document"
            placeholderTextColor={theme.textTertiary}
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.backgroundElement,
              },
            ]}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => ask(question)}
            editable={!busy}
          />
          <Pressable
            onPress={() => ask(question)}
            disabled={busy || question.trim().length === 0}
            accessibilityRole="button"
            accessibilityLabel="Ask">
            {({ pressed }) => (
              <View
                style={[
                  styles.send,
                  { backgroundColor: theme.accent },
                  (pressed || busy || question.trim().length === 0) && styles.dim,
                ]}>
                <MaterialCommunityIcons
                  name="arrow-up"
                  size={20}
                  color={theme.accentContrast}
                />
              </View>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  intro: { gap: Spacing.three, paddingTop: Spacing.two },
  starters: { gap: Spacing.two, paddingTop: Spacing.two },
  starter: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  turn: { gap: Spacing.two },
  quote: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
    gap: 4,
    marginTop: 2,
  },
  quoteText: { fontStyle: 'italic' },
  silent: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  disclaimer: { paddingTop: Spacing.two },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.5 },
});

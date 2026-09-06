import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { SecondaryAction } from '@/components/document/actions';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { findGaps } from '@/data/gaps';
import { buildHousehold, MINE, personSummary } from '@/domain/household';
import { buildSections } from '@/domain/timeline';
import { TimelineRow, TimelineSectionHeader } from '@/components/timeline-row';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { countdownShort, daysUntil } from '@/lib/dates';
import { useDocuments } from '@/store/documents';
import { useSettings } from '@/store/settings';

/**
 * One person's file, in the order it arrives.
 *
 * The household page answers "who needs me"; this answers "what, exactly", and
 * it is the same list the home screen draws because there is no reason for one
 * person's papers to be organised differently from everybody's. Same rows, same
 * months, same overdue heading pinned above the calendar.
 *
 * The owner column is hidden here, and only here — a screen that is already
 * about Ali does not need to say "Ali" under every line.
 */
export default function PersonScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useTheme();
  const { name } = useLocalSearchParams<{ name: string }>();
  const { documents } = useDocuments();
  const { settings } = useSettings();

  /*
   * "Mine" travels as a literal because a route parameter cannot be empty, and
   * the phone's owner is stored with no name at all.
   */
  const owner = name === 'mine' ? MINE : decodeURIComponent(name ?? '');

  const person = useMemo(
    () =>
      buildHousehold(documents, settings.people, settings.ownName).find(
        (candidate) => candidate.name.toLowerCase() === owner.toLowerCase()
      ),
    [documents, settings.people, settings.ownName, owner]
  );

  const sections = useMemo(() => buildSections(person?.items ?? []), [person]);
  const gaps = useMemo(
    () => (person ? findGaps(person.items, settings.country) : []),
    [person, settings.country]
  );

  useEffect(() => {
    navigation.setOptions({ title: person?.label ?? 'Household' });
  }, [navigation, person?.label]);

  if (!person) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.empty}>
          <ThemedText type="body" themeColor="textSecondary">
            That person is no longer in your household.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  const next = person.items[0];

  return (
    <ThemedView style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText
              type="verdict"
              style={person.urgent > 0 ? { color: theme.urgentStrong } : undefined}>
              {person.empty
                ? 'Nothing yet.'
                : person.urgent > 0
                  ? personSummary(person) + '.'
                  : 'All clear.'}
            </ThemedText>

            {next && person.urgent === 0 && (
              <ThemedText type="body" themeColor="textSecondary">
                Next: {next.title}, {countdownShort(daysUntil(next.expiryDate))}.
              </ThemedText>
            )}

            {/*
             * Every gap, not just the worst one. The card on the household page
             * has room for a single line; this is the screen where the rest of
             * them belong.
             */}
            {gaps.length > 0 && (
              <View style={styles.gaps}>
                {gaps.map((gap) => (
                  <ThemedText
                    key={gap.text}
                    type="small"
                    themeColor={gap.severity === 'blocked' ? 'urgentSoft' : 'textTertiary'}>
                    {gap.text}
                  </ThemedText>
                ))}
              </View>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => <TimelineSectionHeader title={section.title} />}
        renderItem={({ item }) => (
          <TimelineRow
            doc={item}
            // Already a screen about one person; saying their name on every
            // line is the app talking to itself.
            showOwner={false}
            onPress={() => router.push(`/document/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <ThemedText type="body" themeColor="textSecondary">
              Nothing is filed under {person.label} yet.
            </ThemedText>
            <SecondaryAction
              icon="camera-outline"
              label={person.name === MINE ? 'Add something' : `Add something for ${person.label}`}
              onPress={() =>
                router.push(
                  person.name === MINE
                    ? { pathname: '/add' }
                    : { pathname: '/add', params: { owner: person.name } }
                )
              }
            />
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: {
    paddingHorizontal: Spacing.four,
    paddingBottom: 72,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: { gap: 6, paddingBottom: Spacing.two },
  gaps: { gap: 4, paddingTop: Spacing.three },
  empty: { alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.six },
});

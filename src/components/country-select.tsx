import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { countryLabel, flagFor, searchCountries, type Country } from '@/data/countries';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';

type Row = { value: Country; label: string; aka: string };

/** Alphabetical sections, the way every long list on a phone is grouped. */
function sectionsFor(query: string): { title: string; data: Row[] }[] {
  const sections: { title: string; data: Row[] }[] = [];
  for (const country of searchCountries(query)) {
    const letter = country.label[0].toUpperCase();
    const last = sections[sections.length - 1];
    if (last && last.title === letter) last.data.push(country);
    else sections.push({ title: letter, data: [country] });
  }
  return sections;
}

/**
 * Nearly two hundred countries is far past what chips or a wheel can carry, so
 * this is the shape people already know from every app that asks: a field
 * holding the answer, and behind it a searchable list grouped by letter.
 */
export function CountrySelect({
  value,
  onChange,
  open: openProp,
  onOpenChange,
}: {
  value: Country | null;
  onChange: (country: Country) => void;
  /**
   * Optional. Left out, the control opens and closes itself; supplied, the
   * parent decides — which onboarding needs so that its primary button can be
   * the thing that opens this, rather than a button that refuses in silence.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const theme = useTheme();
  const [openSelf, setOpenSelf] = useState(false);
  const open = openProp ?? openSelf;

  const setOpen = (next: boolean) => {
    setOpenSelf(next);
    onOpenChange?.(next);
  };
  const [query, setQuery] = useState('');
  const sections = useMemo(() => sectionsFor(query), [query]);

  function choose(country: Country) {
    tapFeedback();
    onChange(country);
    close();
  }

  function close() {
    setOpen(false);
    // A stale search would be the first thing seen on the way back in.
    setQuery('');
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
            {value && <ThemedText style={styles.flag}>{flagFor(value)}</ThemedText>}
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

      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Tapping the dimmed part is how a sheet is dismissed on iOS. */}
          <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close" />

          <View style={[styles.sheet, { backgroundColor: theme.background }]}>
            <View style={[styles.head, { borderBottomColor: theme.border }]}>
              <ThemedText type="label" themeColor="textTertiary" style={styles.flex}>
                Country
              </ThemedText>
              <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  Done
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.searchWrap}>
              <View
                style={[
                  styles.search,
                  { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
                ]}>
                <MaterialCommunityIcons name="magnify" size={18} color={theme.textTertiary} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search"
                  placeholderTextColor={theme.textTertiary}
                  autoCorrect={false}
                  autoCapitalize="words"
                  returnKeyType="search"
                  clearButtonMode="never"
                  style={[styles.searchInput, { color: theme.text }]}
                  accessibilityLabel="Search countries"
                />
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear">
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={18}
                      color={theme.textTertiary}
                    />
                  </Pressable>
                )}
              </View>
            </View>

            <SectionList
              sections={sections}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              stickySectionHeadersEnabled
              initialNumToRender={20}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <ThemedText type="body" themeColor="textTertiary" style={styles.empty}>
                  No country by that name.
                </ThemedText>
              }
              renderSectionHeader={({ section }) => (
                <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
                  <ThemedText type="label" themeColor="textTertiary">
                    {section.title}
                  </ThemedText>
                </View>
              )}
              renderItem={({ item }) => {
                const on = value === item.value;
                return (
                  <Pressable
                    onPress={() => choose(item.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}>
                    {({ pressed }) => (
                      <View
                        style={[
                          styles.option,
                          { borderBottomColor: theme.border },
                          pressed && styles.dim,
                        ]}>
                        <ThemedText style={styles.flag}>{flagFor(item.value)}</ThemedText>
                        <ThemedText type={on ? 'bodyMedium' : 'body'} style={styles.flex}>
                          {item.label}
                        </ThemedText>
                        {on && (
                          <MaterialCommunityIcons name="check" size={20} color={theme.accent} />
                        )}
                      </View>
                    )}
                  </Pressable>
                );
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
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
  /** Sized so every flag occupies the same width and the names line up. */
  flag: { fontSize: 20, lineHeight: 24, width: 28 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  sheet: {
    height: '82%',
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchWrap: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 2,
  },
  list: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six },
  sectionHeader: { paddingTop: Spacing.three, paddingBottom: Spacing.two },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  empty: { paddingTop: Spacing.five, textAlign: 'center' },
  dim: { opacity: 0.6 },
});

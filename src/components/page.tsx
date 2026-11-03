import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PAGES, usePager } from '@/components/pager';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ensureNotificationPermission, getNotificationPermission } from '@/lib/notifications';
import { useDocuments } from '@/store/documents';
import { useSettings } from '@/store/settings';

/**
 * The pieces both home pages are built from: the title with its avatar, the
 * strip of three figures, the one banner that may interrupt, and the footer.
 */

/** The page's Large Title, with the owner's initial on the right for Settings. */
export function PageHeader({ title }: { title: string }) {
  const theme = useTheme();
  const { settings } = useSettings();
  const { go } = usePager();
  const initial = settings.ownName.trim().charAt(0).toUpperCase();

  return (
    <View style={styles.header}>
      <ThemedText type="largeTitle" style={styles.title}>
        {title}
      </ThemedText>
      <Pressable
        onPress={() => go(PAGES.indexOf('settings'))}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Settings">
        {({ pressed }) => (
          <View style={[styles.avatar, { backgroundColor: theme.tile }, pressed && styles.dim]}>
            {initial ? (
              <Text style={[styles.initial, { color: theme.accent }]} maxFontSizeMultiplier={1.2}>
                {initial}
              </Text>
            ) : (
              <Icon name="person.fill" size={18} color={theme.accent} />
            )}
          </View>
        )}
      </Pressable>
    </View>
  );
}

export type Stat = { value: string; label: string; late?: boolean };

/** Three figures between two hairlines: the answers people open the page for. */
export function StatStrip({ stats }: { stats: Stat[] }) {
  const theme = useTheme();
  return (
    <View style={[styles.stats, { borderColor: theme.border }]}>
      {stats.map((stat, i) => (
        <View
          key={stat.label}
          style={[styles.stat, i > 0 && [styles.statDivided, { borderLeftColor: theme.border }]]}
          accessible
          accessibilityLabel={`${stat.label}, ${stat.value}`}>
          <Text
            style={[styles.statValue, { color: stat.late ? theme.urgentStrong : theme.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={1.3}>
            {stat.value}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textTertiary }]} maxFontSizeMultiplier={1.3}>
            {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Shown when iOS has notifications off for Expyr, which is the app quietly
 * not working. Both pages carry it, because it is true of both.
 */
export function RemindersOffBanner() {
  const theme = useTheme();
  const { documents, rescheduleAll } = useDocuments();
  const [on, setOn] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      getNotificationPermission().then(setOn).catch(() => setOn(null));
    }, [])
  );

  if (on !== false || documents.length === 0) return null;
  return (
    <Pressable
      onPress={async () => {
        const granted = await ensureNotificationPermission();
        setOn(granted);
        if (granted) await rescheduleAll();
      }}
      accessibilityRole="button">
      {({ pressed }) => (
        <View
          style={[
            styles.banner,
            { backgroundColor: theme.urgentSoftWash },
            pressed && styles.dim,
          ]}>
          <Icon name="bell.slash" size={18} color={theme.urgentSoft} />
          <ThemedText type="footnote" style={styles.flex}>
            Reminders are off. Tap to turn them on.
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

/** Under the list: the archive, if there is one, and where everything lives. */
export function PageFooter() {
  const theme = useTheme();
  const router = useRouter();
  const { documents, archived } = useDocuments();
  if (documents.length === 0) return null;

  return (
    <View style={styles.footer}>
      {archived.length > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/archive')}
          style={styles.archiveLink}>
          <ThemedText type="footnote" themeColor="textTertiary">
            {archived.length} archived
          </ThemedText>
          <Icon name="chevron.right" size={14} weight="semibold" color={theme.textTertiary} />
        </Pressable>
      )}
      <ThemedText type="footnote" themeColor="textTertiary" style={styles.center}>
        Saved on this iPhone
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
    marginHorizontal: 2,
  },
  title: { flexShrink: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  initial: { ...Fonts.strong, fontSize: 18 },
  dim: { opacity: 0.6 },
  stats: {
    flexDirection: 'row',
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stat: { flex: 1, gap: 4, paddingVertical: 12 },
  statDivided: { borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 14 },
  statValue: { ...Fonts.strong, fontSize: 24, lineHeight: 28, fontVariant: ['lining-nums', 'tabular-nums'] },
  statLabel: { ...Fonts.strong, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 14,
    marginTop: Spacing.three,
  },
  flex: { flex: 1 },
  footer: { paddingTop: Spacing.four, gap: Spacing.two },
  archiveLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  center: { textAlign: 'center' },
});

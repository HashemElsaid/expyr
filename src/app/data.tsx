import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { exportBackup, exportCsv, importBackup } from '@/lib/backup';
import { useDocuments } from '@/store/documents';
import { useSettings } from '@/store/settings';

/**
 * Backing up, exporting and deleting: three things somebody does once, or in a
 * hurry, and never while browsing Settings. They were taking a third of that
 * page to sit there being read past.
 */
export default function DataScreen() {
  const theme = useTheme();
  const { settings } = useSettings();
  const { documents, replaceAll, deleteEverything } = useDocuments();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    try {
      await action();
    } catch (error) {
      Alert.alert(
        'Something went wrong',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setBusy(null);
    }
  }

  function restore() {
    run('restore', async () => {
      const result = await importBackup();
      if (!result) return;
      Alert.alert(
        'Replace everything?',
        `This backup holds ${result.count} item${result.count === 1 ? '' : 's'}. Restoring replaces what is currently in Expyr.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Restore', style: 'destructive', onPress: () => replaceAll(result.documents) },
        ]
      );
    });
  }

  function wipe() {
    Alert.alert(
      'Delete everything?',
      'Every item, photo and reminder will be removed from this phone. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete all', style: 'destructive', onPress: () => deleteEverything() },
      ]
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.note, { borderColor: theme.border }]}>
          <Icon name="iphone" size={20} color={theme.textSecondary} />
          <ThemedText type="footnote" themeColor="textSecondary" style={styles.flex}>
            Your items and photos live in Expyr&apos;s private storage on this iPhone, and they
            travel with your iPhone backup. Restore a new phone from iCloud and they come back.
            None of it is kept on a server.
          </ThemedText>
        </View>

        <DataRow
          icon="square.and.arrow.up"
          title="Keep your own copy"
          subtitle="A single file with everything, to store wherever you like."
          label={busy === 'backup' ? 'Working…' : 'Back up'}
          onPress={() => run('backup', () => exportBackup(documents))}
        />
        <DataRow
          icon="tray-arrow-down"
          title="Restore from a backup"
          subtitle="Replaces what is in Expyr with the contents of a backup file."
          label={busy === 'restore' ? 'Working…' : 'Restore'}
          onPress={restore}
        />
        <DataRow
          icon="file-delimited-outline"
          title="Export as a spreadsheet"
          subtitle="A plain CSV of what you track, without photos."
          label={busy === 'csv' ? 'Working…' : 'Export'}
          onPress={() => run('csv', () => exportCsv(documents, settings.country))}
        />
        <DataRow
          icon="trash"
          title="Delete everything"
          subtitle="Removes every item, photo and reminder from this phone."
          label="Delete"
          onPress={wipe}
          destructive
        />
      </ScrollView>
    </ThemedView>
  );
}

function DataRow({
  icon,
  title,
  subtitle,
  label,
  onPress,
  destructive,
}: {
  icon: string;
  title: string;
  subtitle: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const theme = useTheme();
  const tint = destructive ? theme.urgentStrong : theme.accent;
  return (
    <View style={styles.row}>
      <Icon
        name={icon as never}
        size={20}
        color={destructive ? theme.urgentStrong : theme.textSecondary}
      />
      <View style={styles.rowBody}>
        <ThemedText type="headline">{title}</ThemedText>
        <ThemedText type="footnote" themeColor="textTertiary">
          {subtitle}
        </ThemedText>
      </View>
      <Pressable onPress={onPress} accessibilityRole="button">
        {({ pressed }) => (
          <View
            style={[
              styles.action,
              destructive
                ? { borderWidth: StyleSheet.hairlineWidth, borderColor: tint }
                : { backgroundColor: tint },
              pressed && styles.dim,
            ]}>
            <ThemedText
              type="footnoteStrong"
              style={{ color: destructive ? tint : theme.accentContrast }}>
              {label}
            </ThemedText>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  note: {
    flexDirection: 'row',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  rowBody: { flex: 1, gap: 3 },
  action: {
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  dim: { opacity: 0.6 },
});

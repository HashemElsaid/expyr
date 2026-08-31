import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'What Expyr stores',
    body: 'Everything you track — names, dates, reference numbers, notes and photos — is stored on your phone only. Expyr has no account system, no server database, and no analytics that identify you. If you delete the app, that data goes with it, which is why the backup option exists.',
  },
  {
    title: 'Where photos live',
    body: "Photos you scan or attach are written to Expyr's private app storage. They do not appear in your camera roll, are not added to iCloud Photo Library, and no other app can read them.",
  },
  {
    title: 'What happens when you scan',
    body: 'To read a date from a photo, the image is sent once to Expyr\'s scanning service and passed to Anthropic\'s Claude API, which returns the extracted details. The image is not written to disk on the server, is not used to train any model, and is discarded as soon as the response is produced. Only the image you choose is ever sent — Expyr never uploads anything in the background.',
  },
  {
    title: 'If you would rather not send anything',
    body: 'Scanning is always optional. You can add every item by hand, and attach photos without scanning them. Nothing leaves your phone in that case.',
  },
  {
    title: 'Reminders',
    body: 'Reminders are scheduled locally by iOS. They are not push notifications sent from a server, so no one needs to know your dates in order for them to arrive.',
  },
  {
    title: 'If you lose your phone',
    body: "Expyr's data sits in the app's own storage, which iOS includes in your iPhone backup. Set up a new phone from that backup and everything returns — items, dates and photos. You can also export a backup file yourself at any time, which is the belt-and-braces option if you would rather hold a copy you control.",
  },
  {
    title: 'Backups you create',
    body: 'A backup file contains your items and their photos. Once you save or send it, that file is yours to look after — treat it like the documents themselves and keep it somewhere private.',
  },
  {
    title: 'Locking the app',
    body: 'Turning on the app lock requires Face ID, Touch ID or your device passcode to open Expyr. The check is performed by iOS; Expyr never sees your biometric data.',
  },
];

export default function PrivacyScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText type="headline">Your documents are yours</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          Expyr asks you to photograph identity documents, so it owes you a plain answer about
          what happens to them.
        </ThemedText>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="label" themeColor="textTertiary">
                {section.title}
              </ThemedText>
              <View style={[styles.rule, { backgroundColor: theme.border }]} />
            </View>
            <ThemedText type="body" themeColor="textSecondary">
              {section.body}
            </ThemedText>
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  section: { gap: Spacing.two, paddingTop: Spacing.three },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
});

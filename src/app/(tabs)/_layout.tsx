import { TabList, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet } from 'react-native';

import { FloatingTabBar } from '@/components/floating-tab-bar';
import { Pager, PagerProvider } from '@/components/pager';

/**
 * Four pages you can swipe between, under a floating bar.
 *
 * Built on expo-router's headless tabs rather than its tab navigator, because
 * the navigator draws one page at a time and swaps them, and the pages here
 * have to sit side by side and follow a finger. The router still owns which
 * page is focused, so every link and deep link that names a page keeps
 * working; the pages slide to wherever it says.
 *
 * Household is not a page any more. Most people only ever track their own
 * things, so it waits in Settings and appears there once a second person
 * turns up in what has been scanned.
 */
export default function TabsLayout() {
  return (
    <Tabs style={styles.fill}>
      <PagerProvider>
        <Pager />
        <FloatingTabBar />
      </PagerProvider>
      {/* The routes, declared for the router; the bar above is what is drawn. */}
      <TabList style={styles.hidden}>
        <TabTrigger name="index" href="/" />
        <TabTrigger name="documents" href="/documents" />
        <TabTrigger name="ask" href="/ask" />
        <TabTrigger name="settings" href="/settings" />
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: 'none' },
});

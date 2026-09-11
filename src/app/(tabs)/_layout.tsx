import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { TabButton } from '@/components/tab-button';
import { shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';

/** Half above the bar's top edge, half below it. */
const CAMERA_SIZE = 60;

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        /*
         * The page slides in the direction you moved rather than cutting. It
         * is the difference between a tab bar that swaps screenshots and one
         * that feels like it has places in it — and iOS has done this for long
         * enough that its absence is what gets noticed.
         */
        animation: 'shift',
        tabBarButton: (props) => <TabButton {...props} />,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        /*
          * The tab bar's own size and weight, and no tracking. iOS sets a tab
          * label at 10 points medium and adjusts nothing else about it.
          */
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Timeline',
          tabBarIcon: ({ color, size }) => (
            <Icon name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="household"
        options={{
          title: 'Household',
          tabBarIcon: ({ color, size }) => (
            <Icon name="person.2" size={size} color={color} />
          ),
        }}
      />
      {/*
       * The camera takes the middle slot rather than floating over the list, so
       * the four real tabs stay evenly spaced around it and the button sits
       * half on the bar, half above it — the way in, dead centre, under the
       * thumb. Pressing it opens the add flow; the route behind it is empty.
       */}
      <Tabs.Screen
        name="scan"
        options={{
          title: '',
          // Not a tab and not given the pill: it opens a sheet rather than
          // going anywhere, so "where am I" has no answer to show here.
          tabBarButton: () => <CameraButton />,
        }}
      />
      {/*
       * The sparkle, because that is what an AI feature looks like now.
       *
       * It wore a speech bubble with a question mark in it, which is the
       * universal mark for a help centre — the one thing Expyr AI is not. And
       * the feature had four different faces depending on where you met it: a
       * speech bubble here, a comment bubble on a document, a magnifying glass
       * over a page on its own empty screen, and a lightning bolt in Settings.
       * Four marks is no mark.
       *
       * Outline rather than solid so it sits at the same weight as the
       * calendar, the people and the cog beside it. The cluster of three reads
       * as a sparkle at 24px where a single four-pointed star reads as a
       * favourite.
       */}
      <Tabs.Screen
        name="ask"
        options={{
          title: 'Expyr AI',
          tabBarIcon: ({ color, size }) => (
            <Icon name="sparkles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Icon name="gearshape" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

function CameraButton() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.slot, { pointerEvents: 'box-none' }]}>
      <Pressable
        onPress={() => {
          tapFeedback();
          router.push('/add');
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Add an item by photographing it">
        {({ pressed }) => (
          <View
            style={[
              styles.button,
              { backgroundColor: theme.accent, boxShadow: shadow(theme.text, 4, 8, 0.12) },
              pressed && styles.pressed,
            ]}>
            {/*
             * Viewfinder corners around the lens: the frame you line a document
             * up inside, shrunk onto the button that opens it.
             */}
            <View style={[styles.frame, { pointerEvents: 'none' }]}>
              {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
                <View
                  key={corner}
                  style={[styles.corner, styles[corner], { borderColor: theme.accentContrast }]}
                />
              ))}
            </View>
            <Icon name="camera" size={22} color={theme.accentContrast} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  /*
   * The slot is one fifth of the bar. The button is pulled up by half its own
   * height so its centre lands exactly on the hairline at the top of the bar.
   */
  slot: { flex: 1, alignItems: 'center' },
  button: {
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    borderRadius: CAMERA_SIZE / 2,
    marginTop: -CAMERA_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    /*
     * No ring. A band of page colour around a green disc reads as a white halo
     * on the phone, which is the one thing it was meant to avoid. The button
     * sits on its own shadow instead, kept soft and low.
     */
    elevation: 4,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  // Spelled out: absoluteFillObject went away with React Native 0.86.
  frame: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, margin: 11, opacity: 0.5 },
  corner: { position: 'absolute', width: 9, height: 9 },
  tl: { top: 0, left: 0, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderTopLeftRadius: 3 },
  tr: { top: 0, right: 0, borderTopWidth: 1.5, borderRightWidth: 1.5, borderTopRightRadius: 3 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderBottomLeftRadius: 3 },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomRightRadius: 3,
  },
});

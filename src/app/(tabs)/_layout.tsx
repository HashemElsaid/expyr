import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Fonts } from '@/constants/theme';
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
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.bodyMedium,
          fontSize: 11,
          letterSpacing: 0.3,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Timeline',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-blank-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="household"
        options={{
          title: 'Household',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-multiple-outline" size={size} color={color} />
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
          tabBarButton: () => <CameraButton />,
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          title: 'Expyr AI',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chat-question-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog-outline" size={size} color={color} />
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
    <View style={styles.slot} pointerEvents="box-none">
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
              {
                backgroundColor: theme.accent,
                borderColor: theme.background,
                shadowColor: theme.text,
              },
              pressed && styles.pressed,
            ]}>
            {/*
             * Viewfinder corners around the lens: the frame you line a document
             * up inside, shrunk onto the button that opens it.
             */}
            <View style={styles.frame} pointerEvents="none">
              {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
                <View
                  key={corner}
                  style={[styles.corner, styles[corner], { borderColor: theme.accentContrast }]}
                />
              ))}
            </View>
            <MaterialCommunityIcons name="camera" size={22} color={theme.accentContrast} />
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
    // A ring of the page colour, so the list never touches the button.
    borderWidth: 4,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  frame: { ...StyleSheet.absoluteFillObject, margin: 11, opacity: 0.5 },
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

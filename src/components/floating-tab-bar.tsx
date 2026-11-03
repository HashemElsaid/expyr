import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Icon, type SFSymbol } from '@/components/icon';
import { PAGES, usePager, useTabBarFrame } from '@/components/pager';
import { Springs } from '@/constants/motion';
import { Card, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';

const TABS: { label: string; symbol: SFSymbol }[] = [
  { label: 'Subscriptions', symbol: 'arrow.triangle.2.circlepath' },
  { label: 'Documents', symbol: 'doc.text' },
  { label: 'Expyr AI', symbol: 'sparkles' },
  { label: 'Settings', symbol: 'gearshape' },
];

/** The width kept for the add button in the middle. */
const ADD_SLOT = 74;
const ADD_SIZE = 60;

/**
 * The tab bar: a pill of glass floating over the page, with the add button
 * raised in the middle of it.
 *
 * The highlight behind the current tab is driven by the same position as the
 * pages, so while a finger drags between two pages it travels between their
 * tabs in step, and crosses the add button on the way past.
 */
export function FloatingTabBar() {
  const theme = useTheme();
  const router = useRouter();
  const { position, focused, go } = usePager();
  const frame = useTabBarFrame();

  /** Where each tab sits in the bar, measured once laid out. */
  const xs = useSharedValue<number[]>([0, 0, 0, 0]);
  const ws = useSharedValue<number[]>([0, 0, 0, 0]);
  const [measured, setMeasured] = useState(false);
  const press = useSharedValue(1);

  const onTabLayout = (index: number) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    const nextX = [...xs.value];
    const nextW = [...ws.value];
    nextX[index] = x;
    nextW[index] = width;
    xs.value = nextX;
    ws.value = nextW;
    if (nextW.every((w) => w > 0)) setMeasured(true);
  };

  const blob = useAnimatedStyle(() => {
    const pages = [0, 1, 2, 3];
    return {
      width: interpolate(position.value, pages, ws.value, Extrapolation.CLAMP),
      transform: [{ translateX: interpolate(position.value, pages, xs.value, Extrapolation.CLAMP) }],
    };
  });
  const addPress = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  const tab = (index: number) => {
    const on = index === focused;
    const { label, symbol } = TABS[index];
    return (
      <Pressable
        key={PAGES[index]}
        style={styles.tab}
        onLayout={onTabLayout(index)}
        onPress={() => {
          if (on) return;
          tapFeedback();
          go(index);
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={label}>
        <Icon name={symbol} size={23} color={on ? theme.accent : theme.textTertiary} />
        <Text
          style={[styles.label, { color: on ? theme.accent : theme.textTertiary }]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.2}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[styles.wrap, { bottom: frame.bottom, height: frame.height, pointerEvents: 'box-none' }]}
      accessibilityRole="tablist">
      <Glass style={styles.bar}>
        {measured ? <Animated.View style={[styles.blob, { backgroundColor: theme.tile }, blob]} /> : null}
        {tab(0)}
        {tab(1)}
        <View style={styles.addSlot} />
        {tab(2)}
        {tab(3)}
      </Glass>

      {/*
        * Outside the glass so it can rise above the bar's top edge without
        * being clipped by the rounded pill.
        */}
      <View style={[styles.addHolder, { pointerEvents: 'box-none' }]}>
        <Pressable
          onPress={() => {
            tapFeedback();
            router.push('/add');
          }}
          onPressIn={() => {
            press.value = withSpring(0.9, Springs.press);
          }}
          onPressOut={() => {
            press.value = withSpring(1, Springs.press);
          }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Add">
          <Animated.View style={[styles.add, addPress]}>
            <Icon name="plus" size={28} weight="medium" color={Card.mint} />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The material behind the bar: Liquid Glass where the phone has it, the
 * system's chrome blur where it does not, and a plain surface for anybody who
 * has asked iOS to reduce transparency.
 */
function Glass({ style, children }: { style: StyleProp<ViewStyle>; children: ReactNode }) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const reduceTransparency = useReduceTransparency();

  if (reduceTransparency) {
    return <View style={[style, { backgroundColor: theme.backgroundElement }]}>{children}</View>;
  }
  if (liquidGlass) {
    return (
      <GlassView style={style} glassEffectStyle="regular" colorScheme={scheme}>
        {children}
      </GlassView>
    );
  }
  return (
    <BlurView
      style={[
        style,
        { backgroundColor: theme.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.glassEdge },
      ]}
      tint={scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      intensity={90}>
      {children}
    </BlurView>
  );
}

/** Checked once: both calls are cheap but neither can change while the app runs. */
const liquidGlass = (() => {
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
})();

function useReduceTransparency() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    // An iOS setting; the web has neither the question nor the event.
    if (Platform.OS !== 'ios') return;
    AccessibilityInfo.isReduceTransparencyEnabled().then(setOn).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setOn);
    return () => sub.remove();
  }, []);
  return on;
}

const styles = StyleSheet.create({
  // The shadow lives out here, because the pill clips its own corners.
  wrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderRadius: 33,
    boxShadow: '0px 14px 34px -14px rgba(0, 0, 0, 0.35)',
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderRadius: 33,
    overflow: 'hidden',
  },
  blob: { position: 'absolute', top: 8, bottom: 8, left: 0, borderRadius: 24 },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingTop: 9, paddingBottom: 8 },
  label: { ...Fonts.strong, fontSize: 10 },
  addSlot: { width: ADD_SLOT },
  // Only as wide as the middle slot, so it can never sit over a tab.
  addHolder: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: ADD_SLOT,
    marginLeft: -ADD_SLOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    width: ADD_SIZE,
    height: ADD_SIZE,
    borderRadius: ADD_SIZE / 2,
    marginTop: -20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundImage: `radial-gradient(120% 120% at 30% 18%, ${Card.emeraldHigh.light}, ${Card.emeraldLow})`,
    boxShadow:
      'inset 0px 1px 0px rgba(255, 255, 255, 0.16), inset 0px 0px 0px 1px rgba(168, 230, 198, 0.16), 0px 12px 24px -10px rgba(6, 28, 20, 0.7)',
  },
});

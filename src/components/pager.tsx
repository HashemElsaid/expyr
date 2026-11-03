import { TabSlot, useTabTrigger } from 'expo-router/ui';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type ViewInstance } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Springs } from '@/constants/motion';
import { tapFeedback } from '@/lib/haptics';

/**
 * The four pages, side by side in tab bar order. The add button in the middle
 * of the bar is an action, not a page, so a swipe goes straight past it.
 */
export const PAGES = ['index', 'documents', 'ask', 'settings'] as const;
export type PageName = (typeof PAGES)[number];

/** The floating bar's own height, and how far it floats above the bottom edge. */
export const TAB_BAR_HEIGHT = 66;

type Pager = {
  /** Which page is showing, as a fraction while a finger is between two. */
  position: SharedValue<number>;
  /** The page the router says is focused. */
  focused: number;
  go: (page: number) => void;
};

const PagerContext = createContext<Pager | null>(null);

/**
 * True while a finger is swiping between pages. The pages stop taking touches
 * for that long, so a swipe that ends on a row does not also open it. iOS
 * cancels the touch itself once the swipe takes over; this makes sure, and
 * covers the web, which does not.
 */
const SwipingContext = createContext(false);

export function usePager(): Pager {
  const pager = useContext(PagerContext);
  if (!pager) throw new Error('usePager outside the tabs layout');
  return pager;
}

/** Where the bar sits, so pages can keep their last row clear of it. */
export function useTabBarFrame() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(12, insets.bottom - 8);
  return { bottom, height: TAB_BAR_HEIGHT, inset: bottom + TAB_BAR_HEIGHT + 20 };
}

/**
 * Holds the shared position and the way to change page. Must sit inside
 * expo-router's `Tabs`, because changing page is a tab switch and the router
 * stays the authority on which page is focused: a link to /settings from
 * anywhere still lands on Settings, and the pages slide there to meet it.
 */
export function PagerProvider({ children }: { children: ReactNode }) {
  const { getTrigger, switchTab } = useTabTrigger({ name: PAGES[0] });
  const focused = Math.max(
    0,
    PAGES.findIndex((name) => getTrigger(name)?.isFocused)
  );
  const position = useSharedValue(focused);

  const go = useCallback(
    (page: number) => {
      const name = PAGES[page];
      if (name) switchTab(name, {});
    },
    [switchTab]
  );

  const value = useMemo(() => ({ position, focused, go }), [position, focused, go]);
  return <PagerContext.Provider value={value}>{children}</PagerContext.Provider>;
}

/** iOS's own rubber band, in pages, for pulling past the first or the last. */
function rubber(over: number) {
  'worklet';
  return 1 - 1 / (over * 0.55 + 1);
}

/**
 * The pages themselves, following a finger sideways.
 *
 * Every page stays mounted so the next one is already drawn when a swipe
 * starts, and a page keeps its scroll position when you come back to it. A
 * vertical drag is left to the page's own list: the swipe only takes over
 * once the finger has moved further sideways than down.
 */
export function Pager() {
  const { position, focused, go } = usePager();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  const start = useSharedValue(0);
  const from = useSharedValue(0);
  /** The page a swipe has just committed to, so the router catching up does not restart the spring. */
  const swiped = useRef<number | null>(null);
  const [swiping, setSwiping] = useState(false);
  const guard = useRef(false);
  const hold = useCallback(() => {
    guard.current = true;
    setSwiping(true);
  }, []);
  const release = useCallback(() => {
    // After the lift has been delivered, so the tap it would have been is gone.
    setTimeout(() => {
      guard.current = false;
      setSwiping(false);
    }, 0);
  }, []);

  /*
   * The web delivers a tap as a click after the finger lifts, aimed at
   * whatever the finger went down on, so it is swallowed here on its way
   * down while a swipe has just happened.
   */
  const container = useRef<ViewInstance>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = container.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const swallow = (event: Event) => {
      if (!guard.current) return;
      event.stopPropagation();
      event.preventDefault();
    };
    node.addEventListener('click', swallow, true);
    return () => node.removeEventListener('click', swallow, true);
  }, []);

  useEffect(() => {
    if (swiped.current === focused) {
      swiped.current = null;
      return;
    }
    position.value = reduced ? withTiming(focused, { duration: 160 }) : withSpring(focused, Springs.settle);
  }, [focused, position, reduced]);

  const commit = useCallback(
    (page: number) => {
      swiped.current = page;
      tapFeedback();
      go(page);
    },
    [go]
  );

  const last = PAGES.length - 1;
  const pan = usePanGesture({
    activeOffsetX: [-14, 14],
    failOffsetY: [-12, 12],
    onActivate: (e) => {
      'worklet';
      scheduleOnRN(hold);
      from.value = Math.round(position.value);
      // From wherever the pages are, so catching one mid-spring does not jump.
      start.value = position.value + e.translationX / width;
    },
    onUpdate: (e) => {
      'worklet';
      const p = start.value - e.translationX / width;
      position.value = p < 0 ? -rubber(-p) : p > last ? last + rubber(p - last) : p;
    },
    onDeactivate: (e) => {
      'worklet';
      const moved = position.value - from.value;
      let target = from.value;
      if (!e.canceled) {
        // A third of the way across, or a flick in the direction it was going.
        if (moved > 0.33 || (e.velocityX < -450 && moved > 0)) target = from.value + 1;
        else if (moved < -0.33 || (e.velocityX > 450 && moved < 0)) target = from.value - 1;
      }
      target = Math.min(last, Math.max(0, target));
      position.value = reduced
        ? withTiming(target, { duration: 160 })
        : withSpring(target, { ...Springs.settle, velocity: -e.velocityX / width });
      if (target !== from.value) scheduleOnRN(commit, target);
    },
    onFinalize: () => {
      'worklet';
      scheduleOnRN(release);
    },
  });

  return (
    <GestureDetector gesture={pan}>
      <View ref={container} style={styles.pager}>
        <SwipingContext.Provider value={swiping}>
          <TabSlot
          detachInactiveScreens={false}
          style={styles.slot}
          renderFn={(descriptor, { isFocused }) => (
            <PagerPage
              key={descriptor.route.key}
              page={Math.max(0, PAGES.indexOf(descriptor.route.name as PageName))}
              focused={isFocused}>
              {descriptor.render()}
            </PagerPage>
          )}
          />
        </SwipingContext.Provider>
      </View>
    </GestureDetector>
  );
}

function PagerPage({ page, focused, children }: { page: number; focused: boolean; children: ReactNode }) {
  const { position } = usePager();
  const swiping = useContext(SwipingContext);
  const { width } = useWindowDimensions();

  const placed = useAnimatedStyle(() => {
    const offset = page - position.value;
    return {
      transform: [{ translateX: offset * width }],
      // Pages more than one away are off screen; not drawing them is free.
      opacity: Math.abs(offset) < 1.01 ? 1 : 0,
    };
  });

  return (
    <Animated.View
      style={[styles.page, { pointerEvents: focused && !swiping ? 'auto' : 'none' }, placed]}
      accessibilityElementsHidden={!focused}
      importantForAccessibility={focused ? 'auto' : 'no-hide-descendants'}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pager: { flex: 1, overflow: 'hidden' },
  slot: { flex: 1 },
  // Spelled out: absoluteFillObject went away with React Native 0.86.
  page: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});

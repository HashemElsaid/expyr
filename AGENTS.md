# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Where this project is

Expo SDK 57, React Native 0.86, React 19.2. Upgraded from 54 on 4 September
2026, because Expo Go on the App Store had moved to 57 and there is no way to
install an older one on an iPhone — the pin to 54 was only ever there to keep
Expo Go working, and it stopped doing that.

Two things that changed with 57 and would otherwise be found the hard way:
expo-router no longer depends on @react-navigation, so its hooks
(`useBottomTabBarHeight` and friends) are gone from the public API, and
`StyleSheet.absoluteFillObject` was removed from React Native.

The expo-* packages are versioned together with the SDK now: expo-file-system
is 57.x, not 19.x.

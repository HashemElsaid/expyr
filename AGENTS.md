# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v58.0.0/ before writing any code.

## Where this project is

Expo SDK 58, React Native 0.88, React 19.3. Upgraded from 57 on 2 November
2026 on the redesign branch. Expo Go for SDK 58 was still not on the App Store
at the time, so testing on a phone goes through a development build until it
is; purchases need one anyway, because expo-iap is not in Expo Go.

Things that changed with 58 and would otherwise be found the hard way:

- `InteractionManager` was removed from React Native 0.88, and touching it
  throws rather than warning. Use `requestIdleCallback`.
- expo-file-system's `File.write()` is now async and returns a promise. The
  app's writes use `File.writeSync()`, which is the old behaviour; a bare
  `write()` would let a backup be shared before it finished writing.
- React Native's strict TypeScript API: refs are instance types
  (`useRef<ScrollViewInstance>`, not `useRef<ScrollView>`), and list props
  such as `ListFooterComponent` take `undefined`, not `null`.
- expo-router dispatches navigation after the commit, not during it. Anything
  that times itself against a navigation (the lock offer, the draft restore
  alert) must be checked on a phone after the upgrade.
- npm 11 can refuse the upgrade itself with an ERESOLVE about
  `react-native-windows`, an optional peer of the date picker. It is never
  installed. Finishing the one install with `--legacy-peer-deps` and then
  running a plain `npm install` leaves a lockfile that a strict `npm ci`
  accepts, which is what EAS runs. Do not add `legacy-peer-deps` to `.npmrc`.

Still true from 57: expo-router no longer depends on @react-navigation, so its
hooks (`useBottomTabBarHeight` and friends) are gone from the public API, and
`StyleSheet.absoluteFillObject` was removed from React Native.

The expo-* packages are versioned together with the SDK: expo-file-system is
58.x, not 19.x. expo-iap is third-party; it now lives in the hyodotdev/openiap
monorepo, and its old hyochan/expo-iap repository is archived.

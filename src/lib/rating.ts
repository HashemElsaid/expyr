import * as StoreReview from 'expo-store-review';

/**
 * Asking for a rating, once, at the only moment worth asking.
 *
 * Every app that asks on launch is asking a person who has not yet been given
 * anything, and the honest answer to "how are we doing" at that moment is "I
 * do not know yet". The moment Expyr has actually done its job is the moment
 * somebody taps "I have renewed this": a document that would have lapsed did
 * not, because the app said so in time. That is the whole product, and it is
 * the one place this fires.
 *
 * Never on launch, never on an open count, and never twice. iOS throttles the
 * sheet to three a year on its own and shows nothing at all to somebody who
 * has already rated, so a second ask would usually be invisible rather than
 * annoying. It is still not asked: an app that asks again is an app that did
 * not believe the first answer.
 */

/**
 * How long to wait before asking.
 *
 * The renewal screen dismisses itself as it saves, and iOS drops its own
 * review sheet if it arrives during a transition. Long enough for the screen
 * behind to settle and for the person to see the date they just changed,
 * short enough that it still reads as a response to what they did.
 */
const SETTLE_MS = 1_200;

/**
 * Asks, and says whether it actually asked.
 *
 * The return value is the point. iOS refuses this in TestFlight and on the
 * simulator, and `requestReview` is silent about a sheet it decided not to
 * show, so a caller that recorded "asked" regardless would spend its single
 * chance on a prompt nobody ever saw.
 */
export async function askForReview(): Promise<boolean> {
  try {
    // Both, deliberately. `isAvailableAsync` is about the platform and the
    // build, and `hasAction` is about whether there is a store to send anyone
    // to at all.
    if (!(await StoreReview.isAvailableAsync())) return false;
    if (!(await StoreReview.hasAction())) return false;

    await new Promise((settle) => setTimeout(settle, SETTLE_MS));
    await StoreReview.requestReview();
    return true;
  } catch {
    // ERR_STORE_REVIEW_FAILED, or no store on this build. Nothing to report:
    // whoever called this was in the middle of renewing a passport.
    return false;
  }
}

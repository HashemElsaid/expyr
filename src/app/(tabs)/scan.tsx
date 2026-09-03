/**
 * A slot in the tab bar, not a screen. The camera button sits in the middle of
 * the bar and opens the add flow instead of navigating here, so this never
 * renders — it exists to reserve the space that keeps the four real tabs
 * evenly spaced around it.
 */
export default function ScanSlot() {
  return null;
}

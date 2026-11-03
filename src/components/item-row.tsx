import { useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { DocIcon } from '@/components/doc-icon';
import { Icon } from '@/components/icon';
import { Springs } from '@/constants/motion';
import { Fonts, Radius } from '@/constants/theme';
import { iconFor } from '@/data/document-icons';
import { isMine } from '@/domain/household';
import { chargeAmount } from '@/domain/year';
import { useTheme } from '@/hooks/use-theme';
import { guessDomain } from '@/lib/brand-icons';
import { launch, useInFlight } from '@/lib/card-flight';
import { dayMonthOf, daysUntil } from '@/lib/dates';
import { money, timeLeft } from '@/lib/figures';
import { recurrenceWord } from '@/lib/recurrence';
import { useSettings } from '@/store/settings';
import type { TrackedDocument } from '@/types';

/**
 * The rows on the two home pages.
 *
 * One line of name, one line of when, and the figure that matters on the
 * right: the price for a subscription, the time left for a document. The
 * owner's name rides along as a small tag only when it is somebody else's,
 * so a person tracking only their own things never sees a name at all.
 */

export function SubscriptionRow({ doc, onPress }: { doc: TrackedDocument; onPress: () => void }) {
  const theme = useTheme();
  const days = daysUntil(doc.expiryDate);
  const when = days === 0 ? 'Today' : dayMonthOf(doc.expiryDate);
  const cadence = doc.renewsEvery ? recurrenceWord(doc.renewsEvery).toLowerCase() : null;
  const each = chargeAmount(doc);

  return (
    <Row
      id={doc.id}
      onPress={onPress}
      label={`${doc.title}, ${when}${each ? `, ${doc.price!.currency} ${money(each)}` : ''}`}
      icon={
        <DocIcon
          typeId={doc.typeId}
          iconDomain={doc.iconDomain ?? guessDomain(doc.title)}
          size={38}
        />
      }
      title={doc.title}
      detail={cadence ? `${when}, ${cadence}` : when}
      owner={doc.owner}
      trailing={
        each ? (
          <Text style={[styles.amount, { color: theme.text }]} maxFontSizeMultiplier={1.3}>
            {doc.price!.currency} {money(each)}
          </Text>
        ) : null
      }
    />
  );
}

export function DocumentRow({ doc, onPress }: { doc: TrackedDocument; onPress: () => void }) {
  const theme = useTheme();
  const days = daysUntil(doc.expiryDate);
  const late = days < 0;

  return (
    <Row
      id={doc.id}
      late={late}
      onPress={onPress}
      label={`${doc.title}, ${late ? 'expired' : 'expires'} ${dayMonthOf(doc.expiryDate)}`}
      icon={
        <View
          style={[
            styles.tile,
            { backgroundColor: late ? theme.urgentStrongWash : theme.tile },
          ]}>
          <Icon
            name={iconFor(doc.typeId)}
            size={20}
            color={late ? theme.urgentStrong : theme.accent}
          />
        </View>
      }
      title={doc.title}
      detail={`${late ? 'Expired' : 'Expires'} ${dayMonthOf(doc.expiryDate)}`}
      owner={doc.owner}
      trailing={
        <Text
          style={[
            styles.when,
            { color: late ? theme.urgentStrong : theme.textSecondary },
            late && styles.lateWeight,
          ]}
          maxFontSizeMultiplier={1.3}>
          {timeLeft(days)}
        </Text>
      }
    />
  );
}

function Row({
  id,
  late = false,
  onPress,
  label,
  icon,
  title,
  detail,
  owner,
  trailing,
}: {
  id: string;
  late?: boolean;
  onPress: () => void;
  label: string;
  icon: ReactNode;
  title: string;
  detail: string;
  owner?: string;
  trailing: ReactNode;
}) {
  const theme = useTheme();
  const { settings } = useSettings();
  const scale = useSharedValue(1);
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const someoneElse = owner && !isMine(owner, settings.ownName) ? owner : null;
  const row = useRef<ViewInstance>(null);
  const reduced = useReducedMotion();
  const flying = useInFlight(id);

  /** Records where the row is, so its card can grow out of it, then opens it. */
  function open() {
    const node = row.current;
    if (!node || reduced) {
      onPress();
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      launch(id, { x, y, width, height }, 12, late);
      onPress();
    });
  }

  return (
    <Pressable
      onPress={open}
      onPressIn={() => {
        scale.value = withSpring(0.985, Springs.press);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, Springs.press);
      }}
      accessibilityRole="button"
      accessibilityLabel={someoneElse ? `${label}, ${someoneElse}` : label}>
      {({ pressed: down }) => (
        <Animated.View
          ref={row}
          collapsable={false}
          style={[styles.row, down && { backgroundColor: theme.tile }, flying && styles.away, pressed]}>
          {icon}
          <View style={styles.middle}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
              {title}
            </Text>
            <View style={styles.detailLine}>
              <Text
                style={[styles.detail, { color: theme.textSecondary }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.4}>
                {detail}
              </Text>
              {someoneElse ? (
                <Text
                  style={[styles.owner, { color: theme.textTertiary, backgroundColor: theme.backgroundSelected }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.3}>
                  {someoneElse}
                </Text>
              ) : null}
            </View>
          </View>
          {trailing}
        </Animated.View>
      )}
    </Pressable>
  );
}

/**
 * One row of an inset group: the white card with rounded ends that iOS puts
 * a list inside, and a hairline between rows inset to where the text starts.
 * Built per row because a SectionList has no wrapper to put round a section.
 */
export function GroupedItem({
  first,
  last,
  children,
}: {
  first: boolean;
  last: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement },
        first && styles.cardTop,
        last && styles.cardBottom,
      ]}>
      {children}
      {!last && <View style={[styles.separator, { backgroundColor: theme.border }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  tile: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...Fonts.strong, fontSize: 15.5, lineHeight: 20 },
  detailLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detail: { ...Fonts.body, fontSize: 13, lineHeight: 17, flexShrink: 1 },
  owner: {
    ...Fonts.strong,
    fontSize: 11,
    lineHeight: 15,
    paddingHorizontal: 6,
    borderRadius: 6,
    overflow: 'hidden',
  },
  amount: { ...Fonts.amount, fontSize: 13 },
  when: { ...Fonts.amount, fontSize: 13 },
  lateWeight: { fontWeight: '500' },
  // Its card is in the air, flying out of this spot or back into it.
  away: { opacity: 0 },
  card: { overflow: 'hidden' },
  cardTop: { borderTopLeftRadius: Radius.large - 4, borderTopRightRadius: Radius.large - 4 },
  cardBottom: { borderBottomLeftRadius: Radius.large - 4, borderBottomRightRadius: Radius.large - 4 },
  separator: { position: 'absolute', left: 64, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
});

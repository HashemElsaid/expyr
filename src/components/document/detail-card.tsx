import type { Ref } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type ViewInstance } from 'react-native';

import { DocIcon } from '@/components/doc-icon';
import { Odometer } from '@/components/odometer';
import { Pass, PassFigure, PassFoot, PassSub, PassTitle, PassTop, passFigureStyle } from '@/components/pass';
import { Card, Fonts } from '@/constants/theme';
import { labelForId } from '@/data/document-types';
import { isSubscription } from '@/domain/documents';
import { isMine } from '@/domain/household';
import { yearlyAmount } from '@/domain/money';
import { chargeAmount } from '@/domain/year';
import { guessDomain } from '@/lib/brand-icons';
import { daysUntil, longDate } from '@/lib/dates';
import { money, timeLeftParts, wholeMoney } from '@/lib/figures';
import { recurrenceWord } from '@/lib/recurrence';
import { useSettings } from '@/store/settings';
import type { TrackedDocument } from '@/types';

/** The figure's line height, which the odometer rolls by. */
const FIGURE_LINE = 70;

/**
 * The card at the top of a subscription's or a document's own page: the row
 * it was opened from, grown into the object it stands for.
 *
 * A subscription shows the days to its next charge, what that charge is, and
 * what it comes to over a year. A document shows the time it has left and the
 * number printed on it. Either way the figure rolls into place once the card
 * has landed, so the first thing the eye catches is the one that matters.
 */
export function DetailCard({
  doc,
  revealed,
  onLayout,
  cardRef,
}: {
  doc: TrackedDocument;
  /** False while a copy of the card is still flying in from the row. */
  revealed: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  cardRef?: Ref<ViewInstance>;
}) {
  const { settings } = useSettings();
  const days = daysUntil(doc.expiryDate);
  const late = days < 0;
  const { value, unit } = timeLeftParts(days);
  const owner = isMine(doc.owner, settings.ownName) ? settings.ownName : doc.owner;
  const subscription = isSubscription(doc);

  const figure = (
    <PassFigure
      value={<Odometer value={value} style={{ ...passFigureStyle, ...(late ? { color: Card.late } : null) }} lineHeight={FIGURE_LINE} play={revealed} />}
      unit={subscription && unit && !late ? `${unit} to go` : unit || undefined}
      late={late}
      accessibilityLabel={
        days === 0
          ? subscription
            ? 'Charges today'
            : 'Expires today'
          : `${value} ${unit}${subscription && !late ? ' to go' : ''}`
      }
    />
  );

  return (
    <View
      ref={cardRef}
      onLayout={onLayout}
      collapsable={false}
      style={{ opacity: revealed ? 1 : 0 }}>
      {subscription ? (
        <Pass accessibilityLabel={doc.title}>
          <PassTop
            left={
              <View style={styles.markRow}>
                <DocIcon
                  typeId={doc.typeId}
                  iconDomain={doc.iconDomain ?? guessDomain(doc.title)}
                  size={30}
                />
                <Text style={styles.label} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                  {planOf(doc)}
                </Text>
              </View>
            }
            right={owner || undefined}
          />
          <PassTitle>{doc.title}</PassTitle>
          {figure}
          <PassSub>{chargeLine(doc, days)}</PassSub>
          {doc.price && doc.renewsEvery ? (
            <PassFoot
              left={`${doc.price.currency} ${wholeMoney(yearlyAmount(doc.price))} a year`}
              right={recurrenceWord(doc.renewsEvery).toLowerCase()}
            />
          ) : null}
        </Pass>
      ) : (
        <Pass accessibilityLabel={doc.title}>
          <PassTop left={labelForId(doc.typeId, settings.country)} right={owner || undefined} />
          <PassTitle>{doc.title}</PassTitle>
          {figure}
          <PassSub>
            {late ? 'Expired' : 'Expires'} {longDate(doc.expiryDate)}
          </PassSub>
          {doc.documentNumber ? <PassFoot left={doc.documentNumber} /> : null}
        </Pass>
      )}
    </View>
  );
}

/** What the plan is called, as read from the screenshot, or how often it charges. */
function planOf(doc: TrackedDocument): string {
  const plan = doc.fields?.find((f) => /^plan$/i.test(f.label.trim()))?.value;
  if (plan) return plan.split(',')[0].trim();
  return doc.renewsEvery ? recurrenceWord(doc.renewsEvery) : 'Subscription';
}

/** "Charges USD 24.99 on Friday 6 November", or "today". */
function chargeLine(doc: TrackedDocument, days: number): string {
  const each = chargeAmount(doc);
  const what = each ? `Charges ${doc.price!.currency} ${money(each)}` : 'Charges';
  if (days === 0) return `${what} today`;
  const date = new Date(`${doc.expiryDate}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return `${what} on ${date}`;
}

const styles = StyleSheet.create({
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  label: {
    ...Fonts.strong,
    fontSize: 10.5,
    letterSpacing: 0.74,
    textTransform: 'uppercase',
    color: Card.inkTertiary,
    flexShrink: 1,
  },
});

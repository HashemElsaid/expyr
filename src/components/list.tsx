import { Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type SFSymbol } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useSystemColors, useTheme } from '@/hooks/use-theme';
import type { SystemColor } from '@/constants/theme';

/**
 * The inset grouped list, which is the shape iOS uses whenever it has settings
 * to show, and the shape Settings, Reminders, Mail and every first-party app
 * uses for a list of controls.
 *
 * Three things make it read as native rather than as a list of cards somebody
 * drew. The group is one rounded card with the rows inside it, so the corners
 * belong to the group and not to each row. The hairline between rows starts
 * where the text starts, not at the edge of the card. And the header above it
 * is uppercase Footnote in grey with no tracking, outside the card, on the
 * grouped background.
 *
 * What it replaced on the Settings screen: rows floating on the page with no
 * card at all, a section header with a rule drawn across the rest of the line,
 * and a mint pill button inside four different rows. The pills were the loudest
 * thing on a screen where nothing needed to be loud, and no first-party app has
 * one: an action in a row is tinted text, and a row that goes somewhere has a
 * chevron.
 */
export function ListSection({
  title,
  footer,
  children,
}: {
  /** Uppercase, grey, outside the card. Omitted for a group that needs none. */
  title?: string;
  /**
   * One clause under the group, for the thing that would otherwise be a
   * subtitle on every row. This is where iOS explains a group.
   */
  footer?: string;
  children: ReactNode;
}) {
  const theme = useTheme();

  /*
   * Flattened so that a conditional row, `{x && <ListRow/>}`, does not leave a
   * false in the list and draw a separator against nothing.
   */
  const rows = flatten(children);

  return (
    <View style={styles.section}>
      {title && (
        <ThemedText type="sectionHeader" themeColor="textSecondary" style={styles.header}>
          {title}
        </ThemedText>
      )}

      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 && <View style={[styles.separator, { backgroundColor: theme.border }]} />}
            {row}
          </Fragment>
        ))}
      </View>

      {footer && (
        <ThemedText type="footnote" themeColor="textSecondary" style={styles.footer}>
          {footer}
        </ThemedText>
      )}
    </View>
  );
}

function flatten(children: ReactNode): ReactNode[] {
  const out: ReactNode[] = [];
  const walk = (node: ReactNode) => {
    if (node === null || node === undefined || node === false || node === true) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    out.push(node);
  };
  walk(children);
  return out;
}

/**
 * One row of a group.
 *
 * The right-hand side is a value, a control such as a switch, or a chevron
 * saying the row opens a screen. Never two of them, which is what the old
 * pill-beside-a-subtitle rows were doing.
 *
 * A row that performs an action rather than going somewhere has its title in
 * the tint colour and no chevron, the way Settings shows Sign Out. That is
 * cleaner than a button inside a row, and it is why nothing here needs a
 * pill: an action is a row, or it is text.
 */
export function ListRow({
  symbol,
  tint,
  title,
  subtitle,
  value,
  control,
  onPress,
  chevron = true,
  destructive,
}: {
  symbol: SFSymbol;
  /** The tile's colour. Grey where the row is about the phone rather than you. */
  tint?: SystemColor;
  title: string;
  /** Only where it carries a fact somebody acts on. A fragment, no full stop. */
  subtitle?: string;
  /** The row's answer, grey and right-aligned, as Settings shows one. */
  value?: string;
  /** A switch, or anything else that belongs on the right of a row. */
  control?: ReactNode;
  /** Given where the row does something, or goes somewhere. */
  onPress?: () => void;
  /**
   * False for a row that acts rather than navigates, which also puts the
   * title in the tint colour. Settings draws Sign Out this way.
   */
  chevron?: boolean;
  /** Red, for a row whose action cannot be undone. */
  destructive?: boolean;
}) {
  const theme = useTheme();
  const system = useSystemColors();
  /** A row that does something rather than going somewhere. */
  const acts = onPress !== undefined && !chevron;

  const body = (
    <View style={styles.row}>
      <View style={[styles.tile, { backgroundColor: system[tint ?? 'gray'] }]}>
        <Icon name={symbol} size={15} weight="semibold" color="#FFFFFF" />
      </View>

      <View style={styles.label}>
        <ThemedText
          type="body"
          style={acts ? { color: destructive ? theme.urgentStrong : theme.accent } : undefined}
          numberOfLines={1}>
          {title}
        </ThemedText>
        {subtitle && (
          <ThemedText type="footnote" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        )}
      </View>

      {value && (
        <ThemedText type="body" themeColor="textSecondary" numberOfLines={1}>
          {value}
        </ThemedText>
      )}

      {control}

      {onPress && chevron && (
        <Icon name="chevron.right" size={14} weight="semibold" color={theme.textTertiary} />
      )}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <View style={pressed ? { backgroundColor: theme.backgroundSelected } : undefined}>
          {body}
        </View>
      )}
    </Pressable>
  );
}

const TILE = 29;

const styles = StyleSheet.create({
  section: { paddingTop: Spacing.four },
  header: { paddingBottom: 7, paddingHorizontal: Spacing.two },
  /** Corners belong to the group, so the rows inside are clipped by it. */
  card: { borderRadius: Radius.medium, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: 11,
    minHeight: 44,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, gap: 1 },
  /** Inset to where the text starts, which is what makes them read as rows. */
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three + TILE + Spacing.three },
  footer: { paddingTop: 7, paddingHorizontal: Spacing.two },
  dim: { opacity: 0.5 },
});

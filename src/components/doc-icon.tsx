import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Radius } from '@/constants/theme';
import { iconFor, tintFor } from '@/data/document-icons';
import { useSystemColors } from '@/hooks/use-theme';
import { brandIconUri } from '@/lib/brand-icons';
import { DocumentTypeId } from '@/types';

type Props = {
  typeId: DocumentTypeId;
  /** A subscription's service, when its icon has been fetched to this phone. */
  iconDomain?: string;
  size?: number;
  tint?: string;
  /**
   * True once the date has passed, which turns the tile red.
   *
   * A state rather than a category, so it overrides the colour rather than
   * being one of them. Red is the one colour in the set that says do something
   * now, and it has to mean that on a passport as much as on a gym membership.
   */
  overdue?: boolean;
};

/**
 * A mark for a document: the service's own icon for a subscription, and the
 * category's glyph for everything else.
 *
 * It used to show a thumbnail of whatever was attached, which sounded right and
 * read as noise — a list of documents became a list of tiny crops of a hand
 * holding a licence, a dark receipt email, a corner of a passport page. None of
 * them are recognisable at 38 points, and a photograph of a document tells you
 * less at that size than the word next to it. The glyphs are legible, they line
 * up, and the photograph is one tap away on the document's own screen, at a
 * size where it can actually be read.
 */
export function DocIcon({ typeId, iconDomain, size = 46, tint, overdue }: Props) {
  const system = useSystemColors();
  const [brandFailed, setBrandFailed] = useState(false);

  const brand = brandIconUri(iconDomain);
  if (brand && !brandFailed) {
    return (
      <Image
        source={{ uri: brand }}
        style={[styles.image, { width: size, height: size, borderRadius: Radius.small }]}
        resizeMode="contain"
        // A guessed domain that turns out to have no icon falls back quietly.
        onError={() => setBrandFailed(true)}
      />
    );
  }

  /*
   * A filled tile in the category's own colour, with a white symbol on it,
   * which is how Settings draws a row and most of why Settings is legible at a
   * glance. The colour is fixed per category, so it becomes something a person
   * reads without looking rather than decoration.
   */
  const fill = overdue ? system.red : system[tintFor(typeId)];

  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: Radius.small, backgroundColor: fill },
      ]}>
      <Icon
        name={iconFor(typeId)}
        size={Math.round(size * 0.52)}
        weight="medium"
        color={tint ?? '#FFFFFF'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {},
  tile: { alignItems: 'center', justifyContent: 'center' },
});

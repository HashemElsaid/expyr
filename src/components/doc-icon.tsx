import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { iconFor } from '@/data/document-icons';
import { useTheme } from '@/hooks/use-theme';
import { brandIconUri } from '@/lib/brand-icons';
import { DocumentTypeId } from '@/types';

type Props = {
  typeId: DocumentTypeId;
  /** A subscription's service, when its icon has been fetched to this phone. */
  iconDomain?: string;
  size?: number;
  tint?: string;
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
export function DocIcon({ typeId, iconDomain, size = 46, tint }: Props) {
  const theme = useTheme();
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

  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: Radius.small,
          borderColor: theme.border,
        },
      ]}>
      <MaterialCommunityIcons
        // The glyph names are validated against the shipped glyphmap.
        name={iconFor(typeId) as never}
        size={Math.round(size * 0.5)}
        color={tint ?? theme.textSecondary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {},
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});

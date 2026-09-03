import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { iconFor } from '@/data/document-icons';
import { brandIconUri } from '@/lib/brand-icons';
import { useTheme } from '@/hooks/use-theme';
import { Attachment, DocumentTypeId } from '@/types';

type Props = {
  typeId: DocumentTypeId;
  attachment?: Attachment;
  /** A subscription's service, when its icon has been fetched to this phone. */
  iconDomain?: string;
  size?: number;
  tint?: string;
};

/**
 * A photo thumbnail when there is one, a PDF marker when the attachment is a
 * document, and the category icon otherwise.
 */
export function DocIcon({ typeId, attachment, iconDomain, size = 46, tint }: Props) {
  const theme = useTheme();
  const [brandFailed, setBrandFailed] = useState(false);

  /*
   * Before the photo, because a subscription has no photo and a service's own
   * mark is the fastest thing on the screen to recognise — you find Spotify by
   * its green circle long before you have read the word.
   */
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

  if (attachment && attachment.type !== 'pdf') {
    return (
      <Image
        source={{ uri: attachment.uri }}
        style={[styles.image, { width: size, height: size, borderRadius: Radius.small }]}
        resizeMode="cover"
      />
    );
  }

  const isPdf = attachment?.type === 'pdf';

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
        name={(isPdf ? 'file-pdf-box' : iconFor(typeId)) as never}
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

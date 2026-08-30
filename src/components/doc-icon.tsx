import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { iconFor } from '@/data/document-icons';
import { useTheme } from '@/hooks/use-theme';
import { DocumentTypeId } from '@/types';

type Props = {
  typeId: DocumentTypeId;
  imageUri?: string;
  size?: number;
  tint?: string;
};

/** The document's photo when there is one, otherwise its category icon. */
export function DocIcon({ typeId, imageUri, size = 46, tint }: Props) {
  const theme = useTheme();

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={[styles.image, { width: size, height: size, borderRadius: Radius.small }]}
        resizeMode="cover"
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

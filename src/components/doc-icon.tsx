import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { iconFor } from '@/data/document-icons';
import { useTheme } from '@/hooks/use-theme';
import { DocumentTypeId } from '@/types';

type Props = {
  typeId: DocumentTypeId;
  fileUri?: string;
  fileType?: 'image' | 'pdf';
  size?: number;
  tint?: string;
};

/**
 * A photo thumbnail when there is one, a PDF marker when the attachment is a
 * document, and the category icon otherwise.
 */
export function DocIcon({ typeId, fileUri, fileType, size = 46, tint }: Props) {
  const theme = useTheme();

  if (fileUri && fileType !== 'pdf') {
    return (
      <Image
        source={{ uri: fileUri }}
        style={[styles.image, { width: size, height: size, borderRadius: Radius.small }]}
        resizeMode="cover"
      />
    );
  }

  const isPdf = fileUri && fileType === 'pdf';

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

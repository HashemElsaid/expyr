import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/**
 * One line of text, asked for and answered.
 *
 * A modal rather than `Alert.prompt`, which exists on iOS only. A control that
 * silently does nothing on one platform is worse than a plainer one that
 * works, and that reasoning was already written down on the household page,
 * where this lived until a second screen needed the same thing.
 *
 * The second screen is the document's own: every field a scan produced can now
 * be corrected, because a clear passport came back with the holder's name
 * misspelled and nothing in the app could change it.
 *
 * Two things it leaves to the caller on purpose. Saving is not disabled on an
 * empty value, because for a field that the document does not carry at all,
 * clearing it is the correction. And the title says what is being changed,
 * since "Save" over a bare text box tells nobody which of nine rows they are
 * editing.
 */
export function ValuePrompt({
  visible,
  title,
  hint,
  value,
  placeholder,
  autoCapitalize = 'sentences',
  allowEmpty = false,
  onChange,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  /** One line under the title, for saying where the value should come from. */
  hint?: string;
  value: string;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  /** True where clearing the value is itself a meaningful answer. */
  allowEmpty?: boolean;
  onChange: (next: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Stops a tap inside the card counting as a tap on the backdrop. */}
        <Pressable
          style={[
            styles.prompt,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
          onPress={() => {}}>
          <ThemedText type="bodyMedium">{title}</ThemedText>
          {hint && (
            <ThemedText type="small" themeColor="textTertiary">
              {hint}
            </ThemedText>
          )}

          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={theme.textTertiary}
            autoFocus
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={onSubmit}
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
          />

          <View style={styles.actions}>
            <SecondaryButton label="Cancel" onPress={onCancel} />
            <View style={styles.flex}>
              <PrimaryButton
                label="Save"
                onPress={onSubmit}
                disabled={!allowEmpty && !value.trim()}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/*
 * Carried over character for character from the household page, where this
 * lived. Extracting a component is not an invitation to restyle the screen it
 * came from: a boxed input rather than the ruled lines the forms use, a
 * lighter backdrop than the lock offer's, and a maximum width so it does not
 * stretch across an iPad.
 */
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  prompt: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 14,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
});

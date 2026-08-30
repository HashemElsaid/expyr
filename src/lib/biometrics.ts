import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type BiometricSupport = {
  available: boolean;
  /** What the phone actually offers, for accurate wording in the UI. */
  label: string;
};

export async function checkBiometricSupport(): Promise<BiometricSupport> {
  if (Platform.OS === 'web') return { available: false, label: 'Device lock' };

  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  const label = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
    ? 'Face ID'
    : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
      ? 'Touch ID'
      : 'Device passcode';

  return { available: hasHardware && isEnrolled, label };
}

export async function authenticate(reason = 'Unlock Renewly'): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    // Falling back to the passcode keeps people out of a lockout if Face ID fails.
    disableDeviceFallback: false,
    cancelLabel: 'Cancel',
  });
  return result.success;
}

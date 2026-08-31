import { DocumentTypeId } from '@/types';

/**
 * One line icon per category, from MaterialCommunityIcons. Deliberately
 * monochrome — colour in this app means urgency, never decoration.
 */
export const DOCUMENT_ICONS: Record<DocumentTypeId, string> = {
  'residence-visa': 'airplane',
  'emirates-id': 'card-account-details-outline',
  passport: 'passport',
  'car-registration': 'car',
  'car-insurance': 'shield-check-outline',
  'driving-license': 'card-text-outline',
  'health-insurance': 'hospital-box-outline',
  'tenancy-ejari': 'home-outline',
  'trade-license': 'briefcase-outline',
  'labor-card': 'badge-account-outline',
  assignment: 'school-outline',
  membership: 'ticket-outline',
  warranty: 'wrench-outline',
  other: 'file-document-outline',
};

export function iconFor(typeId: DocumentTypeId): string {
  return DOCUMENT_ICONS[typeId] ?? 'file-document-outline';
}

import type { SFSymbol } from '@/components/symbol';
import { DocumentTypeId } from '@/types';

/**
 * One SF Symbol per category.
 *
 * These were MaterialCommunityIcons, which is Google's set: a different grid,
 * different stroke weights and a different drawing of a house from the symbols
 * in every other tab bar on the phone.
 *
 * Typed as the symbol catalogue, so a name that does not exist fails the
 * typecheck. That matters more here than anywhere: a wrong SF Symbol name does
 * not throw, it draws nothing, and an empty tile on a list row is the kind of
 * fault that reaches the App Store.
 *
 * Chosen to be old, in the sense of long-available. Apple adds symbols with
 * each release and one introduced in the latest iOS is simply missing on a
 * phone a year behind, again silently. Every name here has been in the set for
 * several years.
 */
export const DOCUMENT_ICONS: Record<DocumentTypeId, SFSymbol> = {
  'residence-visa': 'airplane',
  'emirates-id': 'person.text.rectangle',
  /* No passport symbol exists. A closed book is the object itself. */
  passport: 'book.closed',
  'car-registration': 'car',
  'car-insurance': 'checkmark.shield',
  'driving-license': 'person.crop.rectangle',
  'health-insurance': 'cross.case',
  'tenancy-ejari': 'house',
  'trade-license': 'briefcase',
  'professional-license': 'rosette',
  'labor-card': 'person.crop.circle',
  membership: 'ticket',
  bill: 'doc.text',
  warranty: 'wrench.and.screwdriver',
  other: 'doc',
};

export function iconFor(typeId: DocumentTypeId): SFSymbol {
  return DOCUMENT_ICONS[typeId] ?? 'doc';
}

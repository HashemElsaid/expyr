import type { SFSymbol } from '@/components/icon';
import type { SystemColor } from '@/constants/theme';
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

/**
 * One of Apple's system colours per category, fixed for ever.
 *
 * Fixed is the whole value. A colour that means the same thing on every screen
 * becomes something a person reads without looking: blue is who you are, green
 * is the car, orange is the roof over your head and what insures it, teal is
 * permission to work, purple is money leaving on a schedule. A random colour
 * per row would be decoration, and decoration is what this whole pass is
 * removing.
 *
 * Red is deliberately not here. It belongs to a state rather than a category,
 * and a tile turns red when the thing has expired, whatever kind of thing it
 * is.
 */
export const DOCUMENT_TINTS: Record<DocumentTypeId, SystemColor> = {
  /* Who you are, and your right to be here. */
  'residence-visa': 'blue',
  'emirates-id': 'blue',
  passport: 'blue',
  'labor-card': 'blue',
  /* The car. */
  'car-registration': 'green',
  /* The roof, and what insures it or you. */
  'car-insurance': 'orange',
  'health-insurance': 'orange',
  'tenancy-ejari': 'orange',
  /* Permission to work. */
  'driving-license': 'teal',
  'trade-license': 'teal',
  'professional-license': 'teal',
  /* Money leaving on a schedule. */
  membership: 'purple',
  bill: 'indigo',
  /* Things you own rather than hold. */
  warranty: 'brown',
  other: 'gray',
};

export function tintFor(typeId: DocumentTypeId): SystemColor {
  return DOCUMENT_TINTS[typeId] ?? 'gray';
}

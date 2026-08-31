import { DocumentTypeId } from '@/types';
import type { Persona } from '@/store/settings';

/**
 * What each kind of person reaches for first. Everything stays available —
 * this only decides the order of the category grid.
 */
const PRIORITY: Record<Persona, DocumentTypeId[]> = {
  // A student visa comes with a passport and an Emirates ID, rarely a Mulkiya
  // or an Ejari — the car and the tenancy sink to the bottom of the grid.
  student: [
    'residence-visa',
    'emirates-id',
    'passport',
    'health-insurance',
    'membership',
    'driving-license',
  ],
  resident: [
    'residence-visa',
    'emirates-id',
    'car-registration',
    'car-insurance',
    'tenancy-ejari',
    'passport',
  ],
  both: [
    'residence-visa',
    'emirates-id',
    'passport',
    'car-registration',
    'tenancy-ejari',
    'health-insurance',
  ],
};

export function orderForPersona<T extends { id: DocumentTypeId }>(
  types: T[],
  persona: Persona
): T[] {
  const priority = PRIORITY[persona] ?? PRIORITY.resident;
  const rank = (id: DocumentTypeId) => {
    const index = priority.indexOf(id);
    return index === -1 ? priority.length : index;
  };
  return [...types].sort((a, b) => rank(a.id) - rank(b.id));
}

export const PERSONA_OPTIONS: { value: Persona; title: string; blurb: string; icon: string }[] = [
  {
    value: 'resident',
    title: 'Living here',
    blurb: 'Visa, Emirates ID, car, tenancy, insurance.',
    icon: 'home-city-outline',
  },
  {
    value: 'student',
    title: 'Studying here',
    blurb: 'Student visa, Emirates ID, passport, insurance.',
    icon: 'school-outline',
  },
  {
    value: 'both',
    title: 'Both',
    blurb: 'Studying and running a household.',
    icon: 'layers-outline',
  },
];

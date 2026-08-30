import { DocumentTypeId } from '@/types';
import type { Persona } from '@/store/settings';

/**
 * What each kind of person reaches for first. Everything stays available —
 * this only decides the order of the category grid.
 */
const PRIORITY: Record<Persona, DocumentTypeId[]> = {
  student: ['assignment', 'residence-visa', 'emirates-id', 'passport', 'membership', 'food-item'],
  resident: [
    'residence-visa',
    'emirates-id',
    'car-registration',
    'car-insurance',
    'tenancy-ejari',
    'passport',
  ],
  both: [
    'assignment',
    'residence-visa',
    'emirates-id',
    'car-registration',
    'tenancy-ejari',
    'passport',
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
    title: 'Studying',
    blurb: 'Assignments and exams, plus the documents you still need.',
    icon: 'school-outline',
  },
  {
    value: 'both',
    title: 'Both',
    blurb: 'Coursework and life admin in one place.',
    icon: 'layers-outline',
  },
];

import type { Country } from '@/data/countries';
import { DocumentType, DocumentTypeId } from '@/types';

/**
 * UAE-focused renewal knowledge base. Costs and fines are approximate
 * (AED, as of 2026) and shown to users with a "verify with the official
 * channel" disclaimer in the UI.
 */
const CATALOGUE: DocumentType[] = [
  {
    id: 'residence-visa',
    label: 'Residence Visa',
    genericLabel: 'Residence Permit',
    emoji: '🛂',
    numberField: { label: 'Visa / file number', placeholder: 'e.g. 201/2024/1234567' },
    defaultLeadDays: [60, 30, 7],
    typicalValidity: '1-10 years depending on visa type',
    guide: {
      where: 'GDRFA (Dubai) or ICP app/website (other emirates); employer or sponsor usually initiates',
      steps: [
        'Confirm who renews it: employer, sponsor, or you (Golden Visa / freelance)',
        'Complete the medical fitness test at an approved centre',
        'Renew or verify your health insurance (required for the visa)',
        'Apply through your residency authority’s app, or an accredited service centre',
        'Emirates ID renewal is bundled into the same application',
      ],
      typicalCost: 'AED 300-1,200 in government fees (varies by visa type; medical + insurance extra)',
      lateFee: 'AED 50/day overstay fine after the grace period',
      processingTime: '5-10 working days including medical results',
    },
  },
  {
    id: 'emirates-id',
    label: 'Emirates ID',
    genericLabel: 'National ID',
    emoji: '🪪',
    numberField: { label: 'Emirates ID number', placeholder: '784-XXXX-XXXXXXX-X' },
    genericNumberField: { label: 'ID number', placeholder: 'As printed on the card' },
    defaultLeadDays: [30, 14, 7],
    typicalValidity: 'Matches your residence visa duration',
    guide: {
      where: 'ICP app or website, or an accredited typing centre',
      steps: [
        'Usually renewed together with your residence visa, so check if yours is bundled',
        'Apply within 30 days of expiry to avoid fines',
        'Complete biometrics at an ICP centre if requested',
        'Collect the new card from the designated post office or opt for delivery',
      ],
      typicalCost: 'AED 100 per year of validity + ~AED 70 service fees',
      lateFee: 'AED 20/day, capped at AED 1,000',
      // The 30 days come from the step above: apply within them to avoid fines.
      lateFeeRate: { graceDays: 30, perDay: 20, cap: 1000, currency: 'AED' },
      processingTime: '3-7 working days',
    },
  },
  {
    id: 'passport',
    label: 'Passport',
    emoji: '📕',
    numberField: { label: 'Passport number', placeholder: 'e.g. A1234567' },
    defaultLeadDays: [180, 90, 30],
    typicalValidity: '5 or 10 years',
    guide: {
      where: "Your home country's embassy or consulate in the UAE",
      steps: [
        'Check your embassy’s renewal process, as many require appointments booked weeks ahead',
        'Start at least 6 months before expiry: many countries and airlines refuse travel on <6 months validity',
        'Gather photos, application form, and your Emirates ID / visa copies',
        'After renewal, transfer your UAE residence visa to the new passport if required',
      ],
      typicalCost: 'Varies by nationality (typically AED 200-1,000)',
      lateFee: 'No fine, but an expired passport invalidates travel and can complicate visa renewal',
      processingTime: '1-8 weeks depending on nationality',
    },
  },
  {
    id: 'car-registration',
    label: 'Car Registration (Mulkiya)',
    genericLabel: 'Vehicle Registration',
    emoji: '🚗',
    numberField: { label: 'Plate number', placeholder: 'e.g. Dubai A 12345' },
    genericNumberField: { label: 'Plate number', placeholder: 'e.g. A 12345' },
    defaultLeadDays: [30, 14, 7],
    typicalValidity: '1 year (+30 day grace period)',
    guide: {
      where: 'Your emirate’s transport authority, or an approved testing centre',
      steps: [
        'Renew or confirm car insurance first, as it must cover the new registration year',
        'Pay any outstanding traffic fines (renewal is blocked until cleared)',
        'Vehicles older than 3 years need a technical inspection (passing test)',
        'Renew online through your emirate’s portal, or in person at a testing centre',
      ],
      typicalCost: 'AED 350-500 + inspection ~AED 120-170 if required',
      lateFee: 'Fines apply after the 30-day grace period; driving unregistered risks ~AED 500 fine and vehicle impound',
      processingTime: 'Same day (minutes online if no inspection needed)',
    },
  },
  {
    id: 'car-insurance',
    label: 'Car Insurance',
    emoji: '🛡️',
    numberField: { label: 'Policy number', placeholder: 'e.g. POL-1234567' },
    defaultLeadDays: [30, 14, 7],
    typicalValidity: '13 months (12 + 1 to cover the registration grace period)',
    guide: {
      where: 'Any UAE insurer or comparison sites (compare quotes each year, because loyalty is rarely rewarded)',
      steps: [
        'Get 3+ quotes about a month before expiry, as prices vary widely for identical cover',
        'Check if agency (dealer) repair is worth it for your car’s age',
        'Buy the new policy before the old one lapses. A gap can void claims and block registration renewal',
        'Keep the policy certificate handy for registration renewal',
      ],
      typicalCost: 'AED 1,000-3,500+ depending on car value and cover type',
      lateFee: 'No direct fine, but driving uninsured is illegal and blocks Mulkiya renewal',
      processingTime: 'Instant to 1 day',
    },
  },
  {
    id: 'driving-license',
    /*
     * The UAE writes it the British way, and so does most of the world that
     * writes it in English. This label said "Driving License", which is the
     * British noun with the American spelling and therefore right nowhere.
     */
    label: 'Driving Licence',
    /*
     * Outside the UAE it takes the American form, because the store listing is
     * in English (U.S.) and because a Briton reading "Driver's License" loses
     * nothing. There is no spelling that is correct everywhere, and inventing a
     * per-country table for one word would be a lot of machinery for a letter.
     */
    genericLabel: "Driver's License",
    emoji: '🚦',
    numberField: { label: 'Licence number', placeholder: 'e.g. 1234567' },
    defaultLeadDays: [30, 14, 7],
    typicalValidity: '5 years (expats) / 10 years (citizens & GCC)',
    guide: {
      where: 'Your emirate’s transport authority or traffic department',
      steps: [
        'Take an eye test at an approved optician (they upload results directly)',
        'Clear any outstanding traffic fines',
        'Renew online through your emirate’s portal, or at a service centre',
        'Choose card delivery or collection',
      ],
      typicalCost: 'AED 300 renewal + ~AED 50 eye test + ~AED 20 delivery',
      lateFee: 'Late renewal fine applies after a grace period; driving on an expired license is fined',
      processingTime: 'Same day online',
    },
  },
  {
    id: 'health-insurance',
    label: 'Health Insurance',
    emoji: '🏥',
    numberField: { label: 'Member / policy number', placeholder: 'e.g. 1234567890' },
    defaultLeadDays: [45, 14, 7],
    typicalValidity: '1 year',
    guide: {
      where: 'Through your employer, or directly with an insurer. Mandatory across all seven emirates',
      steps: [
        'If employer-provided, confirm they’ve renewed it, because a lapse still fines the sponsor or you',
        'For self-sponsored: compare plans that meet your emirate’s minimum cover',
        'Ensure continuous coverage, as a lapse can trigger fines and blocks visa renewal',
        'Save the new insurance card/policy to your phone wallet',
      ],
      typicalCost: 'AED 700-10,000+ depending on plan and age',
      lateFee: 'Fines apply for uninsured periods, and a lapse can block visa renewal',
      processingTime: 'Instant to 3 days',
    },
  },
  {
    id: 'tenancy-ejari',
    label: 'Tenancy Contract (Ejari)',
    genericLabel: 'Tenancy Contract',
    emoji: '🏠',
    numberField: { label: 'Ejari contract number', placeholder: 'e.g. 1234567890123' },
    genericNumberField: { label: 'Contract number', placeholder: 'If it has one' },
    defaultLeadDays: [90, 60, 30],
    typicalValidity: '1 year',
    guide: {
      where: 'Ejari via the Dubai REST app or typing centres (Dubai); Tawtheeq (Abu Dhabi)',
      steps: [
        'Landlords must give 90 days notice for rent increases, so check the RERA rent calculator at that point',
        'Decide renew vs. move well before the notice deadline in your contract',
        'Negotiate using the RERA index if the increase exceeds the legal cap',
        'Re-register the contract afterwards, because utilities, visas and school registration depend on it',
      ],
      typicalCost: 'Ejari registration ~AED 120-220 + rent per your contract',
      lateFee: 'No fine, but missing notice deadlines locks you into the landlord’s terms',
      processingTime: 'Ejari registration is same-day',
    },
  },
  {
    id: 'trade-license',
    label: 'Trade / Freelance License',
    /*
     * "Trade licence" is what the UAE calls the thing that lets you operate a
     * business, and it is a UAE phrase. Somebody in Ohio renewing the same
     * document is renewing a business licence, and was being shown a term from
     * a country they may never have visited.
     */
    genericLabel: 'Business License',
    emoji: '💼',
    numberField: { label: 'Licence number', placeholder: 'e.g. 1234567' },
    defaultLeadDays: [60, 30, 7],
    typicalValidity: '1 year',
    guide: {
      where: 'Your free zone portal, or your emirate’s department of economic development',
      steps: [
        'Check if your office/flexi-desk contract must be renewed first (often a prerequisite)',
        'Clear any pending fines or filings tied to the license',
        'Pay the renewal through the portal that issued the licence',
        'Update any linked visas and bank records with the renewed license',
      ],
      typicalCost: 'AED 5,000-25,000 depending on free zone and activity',
      lateFee: 'Monthly late fines; expired licenses can freeze bank accounts and visas',
      processingTime: '1-5 working days',
    },
  },
  {
    /*
     * The credential somebody needs in order to be allowed to do their job:
     * a nursing licence, a medical one, a CPA, a teaching certificate, an
     * engineering registration, a contractor's licence, a CDL.
     *
     * Added when Expyr went worldwide, because this is the type that matters
     * elsewhere the way the Mulkiya matters in the UAE. It has the exact shape
     * the app is built for, and a sharper edge than most of the others: an
     * expired one does not merely cost a fine, it stops somebody working, and
     * the renewal usually cannot even be submitted until continuing education
     * hours are done. That is a deadline behind the deadline, which is
     * precisely what nobody remembers.
     *
     * Until now it had nowhere to go but "Other", where it got no lead times
     * worth having and no renewal note at all.
     */
    id: 'professional-license',
    label: 'Professional Licence',
    // Same split as the driving licence: British where the UAE writes it,
    // American everywhere else, because the store listing is English (U.S.).
    genericLabel: 'Professional License',
    emoji: '🎓',
    numberField: { label: 'Licence number', placeholder: 'e.g. DHA-P-0123456' },
    genericNumberField: { label: 'License number', placeholder: 'e.g. RN1234567' },
    /*
     * Ninety days, which is longer than anything else here except a passport.
     * The work that gates the renewal is the training, not the paperwork, and
     * thirty days is not enough to find and finish a course.
     */
    defaultLeadDays: [90, 30, 7],
    typicalValidity: '1-5 years, depending on the profession and the regulator',
    guide: {
      where: 'The authority that issued it',
      steps: [
        'Check how many continuing education or training hours this renewal needs',
        'Finish them early, because most regulators will not accept a renewal without the certificates',
        'Renew through the issuing authority, not a third party',
        'Keep the new certificate attached here once it arrives',
      ],
      typicalCost: '',
      /*
       * Deliberately general. Every regulator sets its own penalty and none of
       * them have been checked, so this says the shape of the risk rather than
       * inventing a number, which is the rule the rest of this file follows.
       */
      lateFee: 'Working on an expired licence can carry penalties and may void professional insurance',
      processingTime: '',
    },
  },
  {
    id: 'labor-card',
    label: 'Work Permit / Labor Card',
    genericLabel: 'Work Permit',
    emoji: '🧾',
    numberField: { label: 'Work permit number', placeholder: 'e.g. 12345678' },
    defaultLeadDays: [60, 30, 7],
    typicalValidity: '2 years (typically)',
    guide: {
      where: 'MOHRE, normally handled by your employer',
      steps: [
        'Confirm your employer has started the renewal (it’s their obligation)',
        'Check status via the MOHRE app with your passport or Emirates ID number',
        'Chase HR early, as an expired permit affects your visa status',
      ],
      typicalCost: 'Paid by the employer by law',
      lateFee: 'Employer fines; for you, risk of status complications',
      processingTime: '1-5 working days',
    },
  },
  {
    id: 'membership',
    label: 'Subscription / Membership',
    emoji: '🎟️',
    numberField: { label: 'Membership number', placeholder: 'If you have one' },
    defaultLeadDays: [14, 3],
    typicalValidity: 'Varies',
    /*
     * Deliberately almost empty, and worth explaining rather than looking like
     * an oversight.
     *
     * This used to carry three hand-written steps, one of which was about
     * giving a UAE gym thirty days' written notice. They were shown for every
     * subscription — so somebody in Dubai opening iCloud+ read about gyms,
     * under a line saying it had been checked against the responsible
     * authority. It had; the authority that renews visas.
     *
     * How you cancel a subscription is a fact about the service, not about the
     * emirate you are in, so it is looked up per service now. Only the late
     * fee stays, because that one is true of every subscription there is.
     */
    guide: {
      where: '',
      steps: [],
      typicalCost: '',
      lateFee: 'Auto-renewal charges if you miss the cancellation window',
      processingTime: '',
    },
  },
  {
    id: 'warranty',
    label: 'Warranty',
    emoji: '🔧',
    numberField: { label: 'Serial number', placeholder: 'e.g. SN-123456789' },
    defaultLeadDays: [30, 7],
    typicalValidity: '1-5 years',
    guide: {
      where: 'Retailer or manufacturer service centre',
      steps: [
        'Before it expires, test the product thoroughly and claim any defects',
        'Check if an extended warranty is worth it (often it isn’t)',
        'Keep the receipt photo attached to this document',
      ],
      typicalCost: '',
      lateFee: 'Repairs at your own cost after expiry',
      processingTime: '',
    },
  },
  {
    id: 'other',
    label: 'Other',
    emoji: '📄',
    defaultLeadDays: [30, 7],
    typicalValidity: 'Varies',
    guide: {
      where: '',
      steps: ['Add your own notes about how to renew this document'],
      typicalCost: '',
      lateFee: '',
      processingTime: '',
    },
  },
];

/**
 * The order categories are offered in.
 *
 * Led by the things that renew every year, not by the headline documents.
 * Someone who reaches for their passport first sees ten years left and decides
 * the app has nothing to do; someone who adds a Mulkiya, an insurance policy
 * and an Ejari gets a reminder within months and sees it earn its place. The
 * residence visa stays at the top because it is what most people came for, and
 * the ten-year documents sink below the annual ones.
 */
const DISPLAY_ORDER: DocumentTypeId[] = [
  'residence-visa',
  'car-registration',
  'car-insurance',
  'health-insurance',
  'tenancy-ejari',
  'emirates-id',
  'driving-license',
  'trade-license',
  'labor-card',
  'professional-license',
  'passport',
  'membership',
  'warranty',
  'other',
];

export const DOCUMENT_TYPES: DocumentType[] = [...CATALOGUE].sort(
  (a, b) => DISPLAY_ORDER.indexOf(a.id) - DISPLAY_ORDER.indexOf(b.id)
);

export function getDocumentType(id: DocumentTypeId): DocumentType {
  return DOCUMENT_TYPES.find((t) => t.id === id) ?? DOCUMENT_TYPES[DOCUMENT_TYPES.length - 1];
}

/**
 * The name to show this user. Outside the UAE the local terms are replaced by
 * plain descriptions — someone in Muscat tracking their residence permit should
 * not have to work out that "Mulkiya" is their car registration.
 */
export function labelFor(type: DocumentType, country: Country | null): string {
  if (country && country !== 'ae' && type.genericLabel) return type.genericLabel;
  return type.label;
}

/** Convenience for the many places that hold an id rather than the type. */
export function labelForId(id: DocumentTypeId, country: Country | null): string {
  return labelFor(getDocumentType(id), country);
}

/** The number to ask for, and the example to show — both vary by country. */
export function numberFieldFor(
  type: DocumentType,
  country: Country | null
): { label: string; placeholder: string } | undefined {
  if (country && country !== 'ae' && type.genericNumberField) return type.genericNumberField;
  return type.numberField;
}

/**
 * A document type's name, ready to sit inside a sentence.
 *
 * Lowercased only when the whole label is ordinary words: "Passport" becomes
 * "passport", "Car Insurance" becomes "car insurance". A label carrying an
 * initialism is left exactly as it is, because lowercasing it produces
 * "emirates id" and "uae driving licence", which is how the gaps on the
 * household page used to read.
 */
export function inSentence(label: string): string {
  const words = label.split(' ').filter(Boolean);
  const hasInitialism = words.some((word) => word.length > 1 && word === word.toUpperCase());
  return hasInitialism ? label : label.toLowerCase();
}

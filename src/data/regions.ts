import { DocumentTypeId } from '@/types';

/**
 * Vehicle and driving-licence services are run by the emirate, not federally,
 * so telling a Sharjah resident to use the RTA is simply wrong. Visas and
 * Emirates ID are federal (ICP), except that Dubai residents deal with GDRFA.
 *
 * Only authorities we could verify are listed. Where an emirate is not
 * separately confirmed it falls back to the Ministry of Interior portal, which
 * genuinely does serve the northern emirates for traffic services.
 */
export type Emirate =
  | 'dubai'
  | 'abu-dhabi'
  | 'sharjah'
  | 'ajman'
  | 'umm-al-quwain'
  | 'ras-al-khaimah'
  | 'fujairah';

export const EMIRATES: { value: Emirate; label: string }[] = [
  { value: 'dubai', label: 'Dubai' },
  { value: 'abu-dhabi', label: 'Abu Dhabi' },
  { value: 'sharjah', label: 'Sharjah' },
  { value: 'ajman', label: 'Ajman' },
  { value: 'umm-al-quwain', label: 'Umm Al Quwain' },
  { value: 'ras-al-khaimah', label: 'Ras Al Khaimah' },
  { value: 'fujairah', label: 'Fujairah' },
];

type Authority = { name: string; url: string };

/** Who runs vehicle registration and driving licences in each emirate. */
const TRANSPORT: Record<Emirate, Authority> = {
  dubai: { name: 'RTA', url: 'https://www.rta.ae' },
  'abu-dhabi': { name: 'TAMM', url: 'https://www.tamm.abudhabi' },
  sharjah: { name: 'Ministry of Interior', url: 'https://www.moi.gov.ae' },
  ajman: { name: 'Ministry of Interior', url: 'https://www.moi.gov.ae' },
  'umm-al-quwain': { name: 'Ministry of Interior', url: 'https://www.moi.gov.ae' },
  'ras-al-khaimah': { name: 'Ministry of Interior', url: 'https://www.moi.gov.ae' },
  fujairah: { name: 'Ministry of Interior', url: 'https://www.moi.gov.ae' },
};

/** Residency is federal through ICP, except Dubai, which has its own directorate. */
const RESIDENCY: Record<Emirate, Authority> = {
  dubai: { name: 'GDRFA Dubai', url: 'https://gdrfad.gov.ae' },
  'abu-dhabi': { name: 'ICP Smart Services', url: 'https://smartservices.icp.gov.ae' },
  sharjah: { name: 'ICP Smart Services', url: 'https://smartservices.icp.gov.ae' },
  ajman: { name: 'ICP Smart Services', url: 'https://smartservices.icp.gov.ae' },
  'umm-al-quwain': { name: 'ICP Smart Services', url: 'https://smartservices.icp.gov.ae' },
  'ras-al-khaimah': { name: 'ICP Smart Services', url: 'https://smartservices.icp.gov.ae' },
  fujairah: { name: 'ICP Smart Services', url: 'https://smartservices.icp.gov.ae' },
};

/** Emirates ID is federal everywhere, including Dubai. */
const ICP: Authority = { name: 'ICP Smart Services', url: 'https://smartservices.icp.gov.ae' };
const MOHRE: Authority = { name: 'MOHRE', url: 'https://www.mohre.gov.ae' };

/**
 * The portal to send someone to. Returns undefined when we have not verified
 * one for that combination — better to say nothing than send them somewhere
 * wrong.
 */
export function portalFor(typeId: DocumentTypeId, emirate: Emirate | null): Authority | undefined {
  switch (typeId) {
    case 'car-registration':
    case 'driving-license':
      return emirate ? TRANSPORT[emirate] : undefined;
    case 'residence-visa':
      // No default to ICP here: residency in Dubai is GDRFA's, not ICP's, so a
      // guess is wrong for the largest population of users we have.
      return emirate ? RESIDENCY[emirate] : undefined;
    case 'emirates-id':
      return ICP;
    case 'labor-card':
      return MOHRE;
    default:
      return undefined;
  }
}

/**
 * Replaces the "where" line in a renewal guide when the answer depends on the
 * emirate. Undefined means the guide's own wording already works everywhere.
 */
export function whereFor(typeId: DocumentTypeId, emirate: Emirate | null): string | undefined {
  if (!emirate) return undefined;

  switch (typeId) {
    case 'car-registration':
    case 'driving-license':
      return emirate === 'dubai'
        ? 'RTA app or website, or an approved testing centre'
        : emirate === 'abu-dhabi'
          ? 'TAMM app or website (Abu Dhabi Mobility), or an approved testing centre'
          : 'The Ministry of Interior app or website, or your emirate’s traffic department';
    case 'residence-visa':
      return emirate === 'dubai'
        ? 'GDRFA Dubai, or an Amer centre'
        : 'ICP app or website, or a Tasheel centre';
    case 'tenancy-ejari':
      return emirate === 'dubai'
        ? 'Ejari, through the Dubai REST app or a typing centre'
        : emirate === 'abu-dhabi'
          ? 'Tawtheeq, through TAMM'
          : 'Your emirate’s municipality or tenancy registration system';
    default:
      return undefined;
  }
}

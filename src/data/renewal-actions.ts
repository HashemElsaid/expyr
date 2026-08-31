import { DocumentTypeId } from '@/types';

/**
 * How long a fresh one usually lasts, used to roll the date forward when
 * someone marks an item as renewed. Types that are one-offs (a warranty,
 * an exam) are absent on purpose — there is nothing sensible to roll to.
 */
export const RENEWAL_PERIOD_DAYS: Partial<Record<DocumentTypeId, number>> = {
  'residence-visa': 730,
  'emirates-id': 730,
  passport: 3650,
  'car-registration': 365,
  'car-insurance': 365,
  'driving-license': 1825,
  'health-insurance': 365,
  'tenancy-ejari': 365,
  'trade-license': 365,
  'labor-card': 730,
  membership: 365,
};

/**
 * Where you actually go to do it. Only official portals — a wrong link here is
 * worse than no link, so anything uncertain is left out.
 */
export const RENEWAL_PORTALS: Partial<Record<DocumentTypeId, { name: string; url: string }>> = {
  'residence-visa': { name: 'ICP Smart Services', url: 'https://smartservices.icp.gov.ae' },
  'emirates-id': { name: 'ICP Smart Services', url: 'https://smartservices.icp.gov.ae' },
  'car-registration': { name: 'RTA', url: 'https://www.rta.ae' },
  'driving-license': { name: 'RTA', url: 'https://www.rta.ae' },
  'labor-card': { name: 'MOHRE', url: 'https://www.mohre.gov.ae' },
};

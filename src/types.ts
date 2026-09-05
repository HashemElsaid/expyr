export type DocumentTypeId =
  | 'residence-visa'
  | 'emirates-id'
  | 'passport'
  | 'car-registration'
  | 'car-insurance'
  | 'driving-license'
  | 'health-insurance'
  | 'tenancy-ejari'
  | 'trade-license'
  | 'labor-card'
  | 'membership'
  | 'warranty'
  | 'other';

export type RenewalGuide = {
  where: string;
  steps: string[];
  typicalCost: string;
  lateFee: string;
  /**
   * The same fine as a sum that can be counted, for the documents whose
   * penalty is a plain daily rate. Only set where the authority states the
   * grace period and the rate plainly enough to arrive at a figure — a wrong
   * number about somebody's money is worse than no number, so most types leave
   * this out and show the sentence alone.
   */
  lateFeeRate?: { graceDays: number; perDay: number; cap: number; currency: string };
  processingTime: string;
};

export type DocumentType = {
  id: DocumentTypeId;
  label: string;
  /**
   * What to call this outside the UAE. "Emirates ID" and "Mulkiya" are the
   * right words in Dubai and meaningless in Doha; only set where the UAE label
   * is a local term rather than a description.
   */
  genericLabel?: string;
  emoji: string;
  /** Only set for documents that actually carry an official number. */
  numberField?: { label: string; placeholder: string };
  /** Used instead of numberField outside the UAE, where the format differs. */
  genericNumberField?: { label: string; placeholder: string };
  /** Days before expiry at which reminders fire, largest first. */
  defaultLeadDays: number[];
  typicalValidity: string;
  guide: RenewalGuide;
};

/**
 * What kind of thing a field holds, which decides how the app treats it.
 *
 * A number gets a copy button, because what people do with an Emirates ID
 * number is paste it into a government form. Money is worth finding across
 * every document at once. A date here is a fact, not a reminder — only the
 * document's own expiry becomes one of those.
 */
export type FieldKind = 'name' | 'number' | 'date' | 'money' | 'place' | 'other';

/** One thing a document says about itself, as the scan read it. */
export type ExtractedField = {
  /** How it reads on screen: "Issuing authority". */
  label: string;
  /** Exactly as printed. Never reformatted — a normalised number is a wrong one. */
  value: string;
  kind: FieldKind;
};

export type Attachment = {
  uri: string;
  type: 'image' | 'pdf';
  /** Stable key used for the file name on disk. */
  key: string;
};

/**
 * Who can see a document once family sharing exists. Private is the default and
 * stays the default: a document nobody chose to share must never appear on a
 * relative's phone, and an item hidden from a family list should not announce
 * that it is being hidden. Sharing is something you do, not something you
 * undo.
 */
export type Visibility = 'private' | 'family';

/**
 * How often something charges itself. Set only for things that renew without
 * anybody doing anything — a subscription bills again whether or not you deal
 * with it, unlike a visa, which waits for you.
 */
export type Recurrence = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type TrackedDocument = {
  id: string;
  typeId: DocumentTypeId;
  title: string;
  /** ISO date string (yyyy-mm-dd) of expiry. */
  expiryDate: string;
  documentNumber?: string;
  notes?: string;
  /** Whose document this is — blank means the owner of the phone. */
  owner?: string;
  /**
   * Photos or PDFs kept in the app's private directory. An Emirates ID has two
   * sides; a tenancy contract may be a PDF plus a photo of the signature page.
   */
  files: Attachment[];
  /** Days before expiry at which reminders fire, largest first. */
  leadDays: number[];
  /** Set once dealt with — hidden from the main list, reminders cancelled. */
  archivedAt?: string;
  /**
   * An extra nudge the user asked for from a notification, as an ISO date.
   *
   * Stored rather than booked straight with iOS, because reminders are planned
   * as a whole and a plan that rebooked everything would cancel a bare
   * scheduled notification it knew nothing about. This is the one reminder
   * somebody explicitly asked for, so it is the last that should vanish.
   */
  snoozedUntil?: string;
  /** Expiry dates this item has had before, oldest first. */
  history?: string[];
  /**
   * Set for subscriptions. The date rolls forward on its own once it passes,
   * because the charge happened whether or not anyone opened the app — and a
   * subscription tracker that needs to be told it renewed is a to-do list.
   */
  renewsEvery?: Recurrence;
  /**
   * Everything else the document said about itself when it was scanned.
   *
   * Expyr was built around one date, which meant a scan gave a person nothing
   * they could use until the day it mattered — sometimes years later. These are
   * what make the scan worth something the moment it happens: the name as
   * printed, the number to paste into a form, who issued it, what it costs.
   *
   * Absent on anything typed in by hand and on everything scanned before this
   * existed, so every reader must cope with it being missing.
   */
  fields?: ExtractedField[];
  /**
   * The service's website, for a subscription. Only ever used to show the
   * service's own icon instead of a generic one — Spotify's list should look
   * like Spotify, not like a row of identical tickets.
   */
  iconDomain?: string;
  visibility: Visibility;
  createdAt: string;
  /**
   * Last change made on this device. Nothing reads it yet; it is what decides
   * the winner when two phones edit the same document and one has to give way.
   */
  updatedAt: string;
};

/**
 * Everything a screen needs to create or update a document. Visibility is
 * optional because no screen offers it yet — the store keeps whatever the
 * document already had, and new ones start private.
 */
export type DocumentDraft = Omit<
  TrackedDocument,
  'id' | 'createdAt' | 'updatedAt' | 'visibility'
> & { visibility?: Visibility };

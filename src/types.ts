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
  /** Expiry dates this item has had before, oldest first. */
  history?: string[];
  /**
   * Set for subscriptions. The date rolls forward on its own once it passes,
   * because the charge happened whether or not anyone opened the app — and a
   * subscription tracker that needs to be told it renewed is a to-do list.
   */
  renewsEvery?: Recurrence;
  visibility: Visibility;
  /** Ids of scheduled local notifications, so they can be cancelled. */
  notificationIds: string[];
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
  'id' | 'notificationIds' | 'createdAt' | 'updatedAt' | 'visibility'
> & { visibility?: Visibility };

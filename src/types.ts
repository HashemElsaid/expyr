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
  | 'assignment'
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
  emoji: string;
  /** Only set for documents that actually carry an official number. */
  numberField?: { label: string; placeholder: string };
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
  /** Ids of scheduled local notifications, so they can be cancelled. */
  notificationIds: string[];
  createdAt: string;
};

/** Everything a screen needs to create or update a document. */
export type DocumentDraft = Omit<TrackedDocument, 'id' | 'notificationIds' | 'createdAt'>;

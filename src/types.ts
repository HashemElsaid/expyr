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
  | 'food-item'
  | 'supplement'
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
  /** URI of the stored photo or PDF, inside the app's private directory. */
  fileUri?: string;
  fileType?: 'image' | 'pdf';
  /** Days before expiry at which reminders fire, largest first. */
  leadDays: number[];
  /** Set once dealt with — hidden from the main list, reminders cancelled. */
  archivedAt?: string;
  /** Ids of scheduled local notifications, so they can be cancelled. */
  notificationIds: string[];
  createdAt: string;
};

/** Everything a screen needs to create or update a document. */
export type DocumentDraft = Omit<TrackedDocument, 'id' | 'notificationIds' | 'createdAt'>;

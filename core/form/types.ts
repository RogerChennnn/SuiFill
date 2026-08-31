export type SemanticField =
  | 'fullName'
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'phoneCountryCode'
  | 'organization'
  | 'addressLine1'
  | 'addressLine2'
  | 'city'
  | 'district'
  | 'province'
  | 'postalCode'
  | 'country'
  | 'birthDate'
  | 'title'
  | 'gender'
  | 'pronouns'
  | 'nationality'
  | 'region'
  | 'wechat'
  | 'telegram'
  | 'instagram'
  | 'whatsapp'
  | 'website'
  | 'username'
  | 'unknown';

export type BirthDatePart = 'month' | 'day' | 'year';

export interface FieldLocator {
  ordinal: number;
  tagName: 'input' | 'select' | 'textarea';
  id: string;
  name: string;
}

export interface RawFieldSignal {
  locator: FieldLocator;
  inputType: string;
  autocomplete: string;
  placeholder: string;
  ariaLabel: string;
  labels: string[];
  codeLabels?: string[];
  visualLabels?: string[];
  visualGroupRole?: 'prefix' | 'main';
  required: boolean;
  maxLength: number | null;
}

export interface PageScanResult {
  hostname: string;
  fields: RawFieldSignal[];
  totalCandidates: number;
  skippedSensitive: number;
  truncated: boolean;
}

export interface ClassifiedField {
  signal: RawFieldSignal;
  semantic: SemanticField;
  confidence: number;
  evidence: string[];
  birthDatePart?: BirthDatePart;
  customFieldId?: string;
}

export interface FillPlanItem {
  id: string;
  locator: FieldLocator;
  targetLabel: string;
  semantic: SemanticField;
  confidence: number;
  value: string;
  sourceLabel: string;
  sensitivity: 1 | 2 | 3;
  selectedByDefault: boolean;
  requiresExplicitConfirmation: boolean;
}

export interface FillInstruction {
  locator: FieldLocator;
  value: string;
  overwriteExisting?: boolean;
}

export interface FillExecutionResult {
  filled: number;
  overwritten: number;
  skippedOccupied: number;
  failed: number;
  pageMismatch: boolean;
}

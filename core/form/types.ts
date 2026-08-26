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
  | 'gender'
  | 'website'
  | 'username'
  | 'unknown';

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
}

export interface FillExecutionResult {
  filled: number;
  skippedOccupied: number;
  failed: number;
  pageMismatch: boolean;
}

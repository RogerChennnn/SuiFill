import type {
  SiteFieldMapping,
  SiteFieldSignature,
  SiteRule,
  SiteRuleSource,
  WorkspaceData,
} from '../vault/schema';
import type { ClassifiedField, RawFieldSignal } from './types';

interface SiteRuleFactoryOptions {
  id?: string;
  now?: Date;
}

export function createSiteRule(
  hostname: string,
  mappings: SiteFieldMapping[],
  options: SiteRuleFactoryOptions = {},
): SiteRule {
  const timestamp = (options.now ?? new Date()).toISOString();
  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedHostname) throw new Error('A valid hostname is required.');

  return {
    id: options.id ?? crypto.randomUUID(),
    label: normalizedHostname,
    hostname: normalizedHostname,
    mappings: deduplicateMappings(mappings),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function saveSiteRule(
  workspace: WorkspaceData,
  rule: SiteRule,
  now = new Date(),
): WorkspaceData {
  const timestamp = now.toISOString();
  const normalized: SiteRule = {
    ...rule,
    label: normalizeHostname(rule.hostname),
    hostname: normalizeHostname(rule.hostname),
    mappings: deduplicateMappings(rule.mappings),
    updatedAt: timestamp,
  };
  const siteRules = workspace.siteRules.some(
    (item) => item.id === normalized.id || item.hostname === normalized.hostname,
  )
    ? workspace.siteRules.map((item) =>
        item.id === normalized.id || item.hostname === normalized.hostname
          ? { ...normalized, id: item.id, createdAt: item.createdAt }
          : item,
      )
    : [...workspace.siteRules, normalized];

  return { ...workspace, siteRules, updatedAt: timestamp };
}

export function deleteSiteRule(
  workspace: WorkspaceData,
  hostname: string,
  now = new Date(),
): WorkspaceData {
  const normalizedHostname = normalizeHostname(hostname);
  return {
    ...workspace,
    siteRules: workspace.siteRules.filter((rule) => rule.hostname !== normalizedHostname),
    updatedAt: now.toISOString(),
  };
}

export function applySiteRule(
  fields: ClassifiedField[],
  workspace: WorkspaceData,
  hostname: string,
): ClassifiedField[] {
  const rule = getSiteRule(workspace, hostname);
  if (!rule) return fields;

  return fields.map((field) => {
    const mapping = findSiteMapping(rule, field.signal);
    if (!mapping) return field;
    if (!isCompositeMappingCompatible(field.signal, mapping.source)) return field;

    if (mapping.source.kind === 'custom') {
      return {
        ...field,
        semantic: 'unknown',
        customFieldId: mapping.source.customFieldId,
        confidence: 1,
        evidence: ['使用本网站的加密自定义规则'],
      };
    }
    return {
      ...field,
      semantic: mapping.source.semantic,
      customFieldId: undefined,
      confidence: 1,
      evidence: ['使用本网站的加密自定义规则'],
    };
  });
}

function isCompositeMappingCompatible(signal: RawFieldSignal, source: SiteRuleSource): boolean {
  if (!signal.visualGroupRole) return true;
  if (source.kind !== 'semantic') return false;
  return signal.visualGroupRole === 'main'
    ? source.semantic === 'phone'
    : source.semantic === 'phoneCountryCode';
}

export function getSiteRule(workspace: WorkspaceData, hostname: string): SiteRule | undefined {
  const normalizedHostname = normalizeHostname(hostname);
  return workspace.siteRules.find((rule) => rule.hostname === normalizedHostname);
}

export function findSiteMapping(
  rule: SiteRule,
  signal: RawFieldSignal,
): SiteFieldMapping | undefined {
  return rule.mappings.find((mapping) => signatureMatches(mapping.signature, signal));
}

export function createFieldSignature(signal: RawFieldSignal): SiteFieldSignature {
  return {
    tagName: signal.locator.tagName,
    id: signal.locator.id,
    name: signal.locator.name,
    label: getSignalLabel(signal),
  };
}

export function createSiteMapping(
  signal: RawFieldSignal,
  source: SiteRuleSource,
): SiteFieldMapping {
  return { signature: createFieldSignature(signal), source };
}

export function signatureMatches(signature: SiteFieldSignature, signal: RawFieldSignal): boolean {
  if (signature.tagName !== signal.locator.tagName) return false;
  if (signature.id && signal.locator.id && signature.id === signal.locator.id) return true;
  if (signature.name && signal.locator.name && signature.name === signal.locator.name) return true;
  return Boolean(signature.label && signature.label === getSignalLabel(signal));
}

function deduplicateMappings(mappings: SiteFieldMapping[]): SiteFieldMapping[] {
  const unique = new Map<string, SiteFieldMapping>();
  for (const mapping of mappings) {
    const signature = mapping.signature;
    const key = [signature.tagName, signature.id, signature.name, signature.label].join('|');
    unique.set(key, mapping);
  }
  return [...unique.values()];
}

function getSignalLabel(signal: RawFieldSignal): string {
  const label = (
    signal.labels[0] ||
    signal.ariaLabel ||
    signal.placeholder ||
    signal.locator.name ||
    signal.locator.id
  )
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  return label || `@ordinal:${signal.locator.ordinal}`;
}

function normalizeHostname(hostname: string): string {
  const normalized = hostname.trim().toLowerCase();
  if (
    !normalized ||
    normalized.length > 253 ||
    normalized.includes('/') ||
    normalized.includes(':') ||
    /\s/u.test(normalized)
  ) {
    return '';
  }
  return normalized;
}

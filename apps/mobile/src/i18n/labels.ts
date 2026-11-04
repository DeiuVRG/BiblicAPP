import { t } from '@/i18n';

const LANGUAGE_NAMES: Record<string, string> = {
  ro: 'Română',
  en: 'Engleză',
  ang: 'Engleza veche',
  enm: 'Engleza medie',
  de: 'Germană',
  goh: 'Germana veche',
  gmh: 'Germana medie',
  la: 'Latină',
  grc: 'Greaca veche',
  el: 'Greacă',
  he: 'Ebraică',
  hbo: 'Ebraica biblică',
  fr: 'Franceză',
  it: 'Italiană',
  es: 'Spaniolă',
  syc: 'Siriacă',
  cop: 'Coptă',
};

/** Romanian name of a language code, falling back to the upper-cased code. */
export function languageName(code: string): string {
  const base = code.toLowerCase();
  return LANGUAGE_NAMES[base] ?? LANGUAGE_NAMES[base.split('-')[0] ?? ''] ?? code.toUpperCase();
}

/** "1903", "5 î.Hr." or an empty string for unknown years. */
export function formatYear(year: number | null | undefined): string {
  if (year == null) return '';
  return year < 0 ? `${-year} î.Hr.` : String(year);
}

/** "1862–1949", "n. 1862", "m. 1949" or an empty string. */
export function formatLifespan(
  born: number | null | undefined,
  died: number | null | undefined,
): string {
  if (born != null && died != null) return `${formatYear(born)}–${formatYear(died)}`;
  if (born != null) return `n. ${formatYear(born)}`;
  if (died != null) return `m. ${formatYear(died)}`;
  return '';
}

export const licenceLabel = (status: keyof typeof t.licenceStatus): string =>
  t.licenceStatus[status];
export const editionKindLabel = (kind: keyof typeof t.editionKind): string => t.editionKind[kind];

import type { Language } from '../types';

export type ErrorCode =
  | 'provider_unavailable'
  | 'provider_busy'
  | 'provider_misconfigured'
  | 'provider_error'
  | 'timeout'
  | 'refused'
  | 'shutting_down'
  | 'internal_error';

const MESSAGES: Record<ErrorCode, Record<Language, string>> = {
  provider_unavailable: {
    en: 'The AI service is temporarily unavailable. Please try again in a moment.',
    ro: 'Serviciul AI este momentan indisponibil. Încearcă din nou peste puțin timp.',
  },
  provider_busy: {
    en: 'The AI service is busy. Please try again shortly.',
    ro: 'Serviciul AI este aglomerat. Încearcă din nou în scurt timp.',
  },
  provider_misconfigured: {
    en: 'The AI service is not available right now.',
    ro: 'Serviciul AI nu este disponibil acum.',
  },
  provider_error: {
    en: 'The AI service returned an error. Please try again.',
    ro: 'Serviciul AI a întors o eroare. Încearcă din nou.',
  },
  timeout: {
    en: 'The answer took too long. Please try again.',
    ro: 'Răspunsul a durat prea mult. Încearcă din nou.',
  },
  refused: {
    en: 'The AI could not answer this question. Try rephrasing it.',
    ro: 'Modelul AI nu a putut răspunde la această întrebare. Încearcă să o reformulezi.',
  },
  shutting_down: {
    en: 'The server is restarting. Please try again in a moment.',
    ro: 'Serverul se repornește. Încearcă din nou peste puțin timp.',
  },
  internal_error: {
    en: 'Something went wrong on our side. Please try again.',
    ro: 'Ceva nu a mers bine la noi. Încearcă din nou.',
  },
};

export function errorMessage(code: ErrorCode, language: Language): string {
  return MESSAGES[code][language];
}

/** Said when the global daily question cap is reached (`provider_busy`, with `Retry-After`). */
export function dailyCapMessage(language: Language): string {
  return language === 'ro'
    ? 'S-a atins limita zilnică de întrebări a acestui serviciu. Încearcă din nou după miezul nopții (ora UTC).'
    : 'The daily limit of questions for this service has been reached. Please try again after midnight UTC.';
}

/** Said instead of calling the model when retrieval finds nothing: no passage, no answer. */
export function notCoveredAnswer(language: Language): string {
  return language === 'ro'
    ? 'Biblioteca nu acoperă încă această întrebare: nu am găsit niciun pasaj care să corespundă. Încearcă alte cuvinte, o trimitere biblică (de exemplu Matei 4:17) sau întreabă despre o lucrare din bibliotecă.'
    : 'The library does not cover this yet: I found no passage that matches your question. Try other words, a Bible reference (for example Matthew 4:17), or ask about a work in the library.';
}

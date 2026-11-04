import { formatCentury } from './centuries';
import { count } from './plural';

// Romanian UI strings. Use comma-below diacritics (ș ț), never cedilla forms (a test fails on them).
// `en.ts` must have every key of this table: its type, `Strings` (strings.ts), is derived from it.
// A number next to a noun is always written with `count` (plural categories, "de" after 19).
const forms = {
  works: { one: 'lucrare', few: 'lucrări', other: 'de lucrări' },
  passages: { one: 'pasaj', few: 'pasaje', other: 'de pasaje' },
  editions: { one: 'ediție', few: 'ediții', other: 'de ediții' },
  sections: { one: 'secțiune', few: 'secțiuni', other: 'de secțiuni' },
  sources: { one: 'sursă', few: 'surse', other: 'de surse' },
  results: { one: 'rezultat', few: 'rezultate', other: 'de rezultate' },
  authors: { one: 'autor', few: 'autori', other: 'de autori' },
  packs: { one: 'pachet de conținut', few: 'pachete de conținut', other: 'de pachete de conținut' },
};

export const ro = {
  appName: 'Biblioteca',
  common: {
    loading: 'Se încarcă…',
    error: 'Ceva nu a mers bine. Încearcă din nou.',
    back: 'Înapoi',
    backToLibrary: 'Înapoi la bibliotecă',
    close: 'Închide',
  },
  // Counts with their nouns: 1 lucrare, 2 lucrări, 12 lucrări, 20 de lucrări.
  counts: {
    works: (n: number) => count(n, forms.works, 'ro'),
    passages: (n: number) => count(n, forms.passages, 'ro'),
    editions: (n: number) => count(n, forms.editions, 'ro'),
    sections: (n: number) => count(n, forms.sections, 'ro'),
    sources: (n: number) => count(n, forms.sources, 'ro'),
    results: (n: number) => count(n, forms.results, 'ro'),
    authors: (n: number) => count(n, forms.authors, 'ro'),
  },
  library: {
    title: 'Biblioteca',
    subtitle: 'Cărți vechi, traduse cu grijă.',
    empty: 'Nu există lucrări instalate.',
    loading: 'Se încarcă biblioteca…',
    search: 'Căutare',
    settings: 'Setări',
    openWork: (title: string) => `Deschide lucrarea ${title}`,
    // Spoken before the list of editions of a work (the chips carry the same text visually).
    editions: 'Ediții',
    unverified: (n: number) =>
      n === 1
        ? 'Un pachet de conținut nu a putut fi verificat și nu este afișat.'
        : `${count(n, forms.packs, 'ro')} nu au putut fi verificate și nu sunt afișate.`,
  },
  work: {
    title: 'Lucrare',
    notFound: 'Lucrarea nu a fost găsită.',
    contents: 'Cuprins',
    emptyContents: 'Această lucrare nu are secțiuni.',
    startReading: 'Începe lectura',
    continueReading: 'Continuă lectura',
    inProgress: 'în curs',
    author: 'Autor',
    originalTitle: 'Titlu original',
    originalLanguage: 'Limba originală',
    original: 'Original',
    language: 'Limbă',
    edition: 'Ediție',
    licence: 'Licență',
    openSection: (heading: string) => `Deschide ${heading}`,
    // The label of the control that switches between the editions of the work.
    editionSwitch: 'Alege ediția',
    // A translation that covers fewer sections than its source edition.
    partial: 'Traducere parțială',
  },
  reader: {
    title: 'Citire',
    notFound: 'Secțiunea nu a fost găsită.',
    emptySection: 'Această secțiune nu are text.',
    previous: 'Anterior',
    next: 'Următor',
    previousLabel: 'Capitolul anterior',
    nextLabel: 'Capitolul următor',
    typography: 'Aspectul textului',
    typographyButton: 'Aa',
    typographyLabel: 'Aspectul textului: mărime, spațiere, temă',
    progressLabel: 'Progresul lecturii',
    // A no-break space keeps "9 %" together on one line.
    percent: (percent: number) => `${percent} %`,
    position: (index: number, total: number, percent: number) =>
      `${index} din ${total} · ${percent} %`,
    endOfWork: 'Ai ajuns la sfârșitul lucrării.',
    toContents: 'La cuprins',
  },
  search: {
    title: 'Căutare',
    placeholder: 'Caută în biblioteca instalată',
    label: 'Caută în text',
    hint: 'Scrie cel puțin 2 caractere. Căutarea ignoră majusculele și diacriticele.',
    noResults: 'Niciun rezultat.',
    searching: 'Se caută…',
    results: (n: number) => count(n, forms.results, 'ro'),
    resultsCapped: (n: number) => `Primele ${count(n, forms.results, 'ro')}`,
    openResult: (heading: string) => `Deschide rezultatul din ${heading}`,
    clear: 'Șterge căutarea',
  },
  settings: {
    title: 'Setări',
    reading: 'Citire',
    fontSize: 'Mărimea textului',
    // A no-break space between a number and its unit.
    fontSizeValue: (size: number) => `${size}\u00A0pt`,
    increaseFontSize: 'Mărește dimensiunea textului',
    decreaseFontSize: 'Micșorează dimensiunea textului',
    lineHeight: 'Spațierea rândurilor',
    lineHeightValue: (value: number) => value.toFixed(1).replace('.', ','),
    increaseLineHeight: 'Mărește spațierea rândurilor',
    decreaseLineHeight: 'Micșorează spațierea rândurilor',
    readingFont: 'Fontul lecturii',
    // Names of the faces, the same in both languages: Source Serif 4 ("Serif"), Literata, Inter ("Sans").
    readingFonts: {
      serif: 'Serif',
      literata: 'Literata',
      sans: 'Sans',
    },
    theme: 'Tema',
    themes: {
      system: 'Automat',
      light: 'Luminos',
      sepia: 'Sepia',
      dark: 'Întunecat',
    },
    language: 'Limbă',
    readingLanguage: 'Limba lecturii',
    readingLanguageHint:
      'Ediția în această limbă se deschide prima. Dacă lucrarea nu o are, se deschide cea mai apropiată.',
    uiLanguage: 'Limba interfeței',
    uiLanguageHint: 'Sistem urmează limba dispozitivului.',
    uiLanguages: {
      system: 'Sistem',
      ro: 'Română',
      en: 'English',
    },
    preview: 'Previzualizare',
    previewText:
      'Împărăția lui Dumnezeu nu vine în chip văzut. Textul este aliniat la stânga, cu diacritice corecte: ș, ț, ă, â, î.',
    about: 'Despre',
    version: 'Versiunea aplicației',
    content: 'Conținut',
    // The counts follow the labels, so no word has to agree with a number ("1 verificate").
    packs: (verified: number, rejected: number) =>
      `Pachete de conținut verificate: ${verified}. Respinse: ${rejected}.`,
    licenceTitle: 'Licența conținutului',
    licenceNote:
      'Fiecare ediție își declară statutul de licență în pagina lucrării. Textele din domeniul public pot fi citite și copiate liber; pentru celelalte se aplică licența indicată.',
    fonts:
      'Fonturi: IM Fell Great Primer (titluri), Source Serif 4 (text și interfață), Literata și Inter (opțiuni de lectură), Gentium Plus (greacă), sub SIL Open Font License.',
    noWorks: 'Nicio lucrare instalată.',
  },
  licenceStatus: {
    'public-domain': 'Domeniu public',
    licensed: 'Sub licență',
    unknown: 'Licență necunoscută',
  },
  // What an edition is: the original text, or a translation of it. The lower-case form of these
  // words ends the short edition labels ("Română · traducere").
  editionKind: {
    source: 'Original',
    translation: 'Traducere',
  },
  // The two reading languages, each written in its own language (as in any language picker), in
  // every interface language.
  readingLanguages: {
    ro: 'Română',
    en: 'English',
  },
  // Names of the languages of the works, in this interface language.
  languageNames: {
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
  },
  dates: {
    bc: (year: number) => `${year} î.Hr.`,
    born: (year: string) => `n. ${year}`,
    died: (year: string) => `m. ${year}`,
    // "sec. V", "secolul al V-lea" (the first one: "secolul I"); a negative century is before Christ.
    centuryShort: (century: number) => formatCentury(century, 'ro', 'short'),
    centuryLong: (century: number) => formatCentury(century, 'ro', 'long'),
  },
  notFound: {
    title: 'Pagină negăsită',
    message: 'Pagina căutată nu există.',
  },
} as const;

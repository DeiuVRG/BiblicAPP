// Romanian UI strings. Use comma-below diacritics (ș ț), never cedilla forms.
// `en.ts` must have every key of this table: its type, `Strings` (strings.ts), is derived from it.
export const ro = {
  appName: 'Biblioteca',
  common: {
    loading: 'Se încarcă…',
    error: 'Ceva nu a mers bine. Încearcă din nou.',
    back: 'Înapoi',
    backToLibrary: 'Înapoi la bibliotecă',
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
    unverified: (count: number) =>
      count === 1
        ? 'Un pachet de conținut nu a putut fi verificat și nu este afișat.'
        : `${count} pachete de conținut nu au putut fi verificate și nu sunt afișate.`,
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
    results: (count: number) => (count === 1 ? '1 rezultat' : `${count} rezultate`),
    resultsCapped: (count: number) => `Primele ${count} rezultate`,
    openResult: (heading: string) => `Deschide rezultatul din ${heading}`,
    clear: 'Șterge căutarea',
  },
  settings: {
    title: 'Setări',
    reading: 'Citire',
    fontSize: 'Mărimea textului',
    fontSizeValue: (size: number) => `${size} pt`,
    increaseFontSize: 'Mărește dimensiunea textului',
    decreaseFontSize: 'Micșorează dimensiunea textului',
    lineHeight: 'Spațierea rândurilor',
    lineHeightValue: (value: number) => value.toFixed(1).replace('.', ','),
    increaseLineHeight: 'Mărește spațierea rândurilor',
    decreaseLineHeight: 'Micșorează spațierea rândurilor',
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
    fonts: 'Fonturi: Literata (lectură) și Inter (interfață), sub SIL Open Font License.',
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
  },
  notFound: {
    title: 'Pagină negăsită',
    message: 'Pagina căutată nu există.',
  },
} as const;

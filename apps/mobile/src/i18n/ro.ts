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
  shelves: { one: 'raft', few: 'rafturi', other: 'de rafturi' },
  centuries: { one: 'secol', few: 'secole', other: 'de secole' },
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
    all: 'Toate',
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
    shelves: (n: number) => count(n, forms.shelves, 'ro'),
    centuries: (n: number) => count(n, forms.centuries, 'ro'),
  },
  // The navigation shell: the section bar, its drawers and the brand bar (docs/ui-spec-v2.md, 4).
  nav: {
    sections: 'Secțiuni',
    home: 'Acasă',
    search: 'Căutare',
    read: 'Citește',
    curated: 'Selecție',
    all: 'Toată biblioteca',
    authors: 'Autori',
    traditions: 'Tradiții',
    guides: 'Ghiduri',
    dictionary: 'Dicționar',
    scripture: 'Scriptura',
    topics: 'Teme',
    resources: 'Resurse',
    research: 'Cercetare',
    ask: 'Întreabă',
    semantic: 'Căutare după sens',
    compare: 'Compară',
    connections: 'Conexiuni',
    decks: 'Comentarii',
    disputed: 'Întrebări disputate',
    lexicon: 'Lexicon',
    indexes: 'Indexuri',
    scans: 'Scanări',
    bookmarks: 'Marcaje',
    notebook: 'Caiet',
    desk: 'Birou',
    about: 'Despre',
    aboutLibrary: 'Despre bibliotecă',
    transparency: 'Transparență',
    howTo: 'Cum se folosește',
    tour: 'Tur ghidat',
    soon: 'Curând',
    settings: 'Setări',
    menu: 'Meniu',
    menuOpen: 'Deschide meniul',
    menuClose: 'Închide meniul',
    homeLink: 'Biblioteca, pagina principală',
  },
  shell: {
    searchButton: 'Căutare',
    askButton: 'Întreabă',
    askButtonLabel: 'Întreabă biblioteca',
    languageSwitch: 'Limba',
    menuLanguage: 'Limba interfeței',
    themeButton: (current: string, next: string) => `Tema: ${current}. Apasă pentru ${next}.`,
    menuTheme: 'Tema',
  },
  landing: {
    kicker: 'Biblioteca',
    badge: 'Beta',
    titleFirst: 'Tradiția creștină,',
    titleSecond: 'în limba ta.',
    sub: 'Cărți creștine vechi, în română și în engleză, cu originalul alături. Un asistent răspunde numai din texte, cu trimiteri la paragraf.',
    start: 'Începe lectura',
    askCta: 'Întreabă biblioteca',
    about: 'Despre bibliotecă',
    tour: 'Tur ghidat',
    doorRead: {
      title: 'Citește',
      text: 'Răsfoiește rafturile sau caută după autor și titlu.',
      link: 'Citește',
    },
    doorAsk: {
      title: 'Întreabă',
      text: 'Pune o întrebare cărților și citește un răspuns care trimite la paragrafele pe care se sprijină.',
      link: 'Întreabă',
    },
    freeBooks: 'Toate cărțile se citesc gratuit, fără cont.',
    freeAsk:
      'Întreabă este deschis testerilor pe durata beta, cu un cod de acces, și va cere un cont gratuit după aceea.',
    collectionTitle: 'În bibliotecă',
    collectionAll: 'Răsfoiește toată biblioteca',
    shelvesTitle: 'Rafturile',
    shelvesAll: 'Toată biblioteca',
    betaKicker: 'Beta',
    betaText: 'Biblioteca este în versiune beta. Dacă găsești o greșeală sau ai o idee, spune-ne.',
    feedback: 'Trimite feedback',
    feedbackSubject: 'Biblioteca: feedback',
    transparencyTitle: 'Angajamentul nostru de transparență',
    transparencyText:
      'Spunem deschis cum a fost făcut fiecare text: ce traducere este făcută de o mașină, ce a fost verificat și de cine.',
    transparencyCta: 'Citește angajamentul',
    footerLinks: 'Legături',
    contact: 'Contact',
    language: 'Limba interfeței',
    version: (version: string) => `Versiunea ${version}`,
    read: 'Citește',
  },
  library: {
    title: 'Biblioteca',
    empty: 'Nu există lucrări instalate.',
    loading: 'Se încarcă biblioteca…',
    openWork: (title: string) => `Deschide lucrarea ${title}`,
    // Spoken before the list of editions of a work (the chips carry the same text visually).
    editions: 'Ediții',
    unverified: (n: number) =>
      n === 1
        ? 'Un pachet de conținut nu a putut fi verificat și nu este afișat.'
        : `${count(n, forms.packs, 'ro')} nu au putut fi verificate și nu sunt afișate.`,
    // Selecție, the curated page.
    heroEyebrow: 'Biblioteca',
    heroTitle: 'Ce vrei să citești?',
    heroPlaceholder: 'Caută o lucrare sau un autor',
    heroSubmit: 'Caută',
    heroAll: 'Toată biblioteca',
    heroAuthors: 'Autori',
    heroTraditions: 'Tradiții',
    heroGuides: 'Ghiduri',
    bandCreeds: { label: 'Crezuri și catehisme', title: 'Ce mărturisește Biserica' },
    bandStart: { label: 'Începe aici', title: 'Lucrări de citit întâi' },
    bandAuthors: {
      label: 'Autori',
      title: 'Autori pe care îi poți citi',
      all: 'Toți autorii',
    },
    bandFathers: { label: 'Părinții Bisericii', title: 'Citește Părinții Bisericii' },
    bandShelves: { label: 'Rafturi', title: 'Toate tradițiile prezente aici' },
    // The footer of a shelf block: "Toate cele 12 lucrări", and for one work the shelf itself ("Toate
    // 1 lucrare" is not Romanian).
    allOfShelf: (n: number) =>
      n === 1 ? 'Deschide raftul' : `Toate cele ${count(n, forms.works, 'ro')}`,
    foldCollapse: 'Restrânge',
    foldExpand: 'Extinde',
    // Toată biblioteca.
    allEyebrow: 'Biblioteca · Toate lucrările',
    allTitle: 'Toate lucrările bibliotecii',
    allSub: 'Fiecare lucrare se citește în română și în engleză, cu originalul alături.',
    shelfEyebrow: 'Biblioteca · Raft',
    shelvesFold: 'Răsfoiește rafturile',
    allShelves: 'Toate rafturile',
    shelfWorks: (n: number) => count(n, forms.works, 'ro'),
    viewTabs: 'Vizualizare',
    viewAuthor: 'După autor',
    viewCentury: 'După secol',
    searchPlaceholder: 'Caută după autor sau titlu…',
    searchLabel: 'Caută în bibliotecă după autor sau titlu',
    filterShelf: 'Raft',
    filterCentury: 'Secol',
    filterTradition: 'Tradiție',
    filterLang: 'Limba originalului',
    filterAvailability: 'Disponibilitate',
    filterAll: 'Toate',
    filterChoose: (label: string) => `Alege: ${label}`,
    availabilityPartial: 'Traducere parțială',
    undated: (n: number) => `${count(n, forms.works, 'ro')} fără dată`,
    countLine: (n: number, parts: { query?: string; shelf?: string; century?: string }) => {
      const works = count(n, forms.works, 'ro');
      const query = parts.query ? ` cu „${parts.query}”` : '';
      if (parts.shelf) {
        return `${works}${query} în raftul ${parts.shelf}${parts.century ? ` și ${parts.century}` : ''}`;
      }
      if (parts.century) return `${works}${query} din ${parts.century} în toată biblioteca`;
      return `${works}${query} în toată biblioteca`;
    },
    countLineLang: (name: string) => `limba originalului: ${name}`,
    countLineLetter: (letter: string) => `litera ${letter}`,
    countLineCenturies: (centuries: number, works: number) =>
      `${count(centuries, forms.centuries, 'ro')} · ${count(works, forms.works, 'ro')} în toată biblioteca`,
    lettersLabel: 'Autori după literă',
    allLetters: 'Toate',
    letterLabel: (letter: string, n: number) => `${letter}: ${count(n, forms.authors, 'ro')}`,
    allLettersLabel: (n: number) => `Toate: ${count(n, forms.authors, 'ro')}`,
    aboutAuthor: (name: string) => `Despre ${name}`,
    authorWorks: (name: string, n: number) => `${name}, ${count(n, forms.works, 'ro')}`,
    pager: 'Pagini',
    pagerPrevious: 'Anterioară',
    pagerNext: 'Următoarea',
    pagerPage: (n: number) => `Pagina ${n}`,
    centuryHint: 'Alege un secol pentru a vedea ce conține raftul din el.',
    centuryTile: (century: string, n: number) => `${century}: ${count(n, forms.works, 'ro')}`,
    emptyFilters: 'Nicio lucrare nu corespunde filtrelor.',
    clearFilters: 'Șterge filtrele',
    partialChip: 'Parțial',
  },
  authorsPage: {
    eyebrow: 'Biblioteca · Autori',
    title: 'Autori',
    placeholder: 'Caută un autor după nume',
    label: 'Caută un autor după nume',
    empty: 'Niciun autor nu corespunde căutării.',
    open: (name: string) => `Lucrările lui ${name}`,
  },
  coming: {
    text: 'Această parte a bibliotecii este în lucru și va fi aici curând.',
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
    eyebrow: 'Căutare',
    // Shorter than "Caută o lucrare, un autor sau un pasaj" (286 points): that one did not fit in a
    // 312 point field on a 360 point phone.
    fieldPlaceholder: 'Caută lucrări, autori sau pasaje',
    modes: 'Tipul căutării',
    modeWorks: 'Lucrări',
    modePassages: 'Pasaje',
    authorsHeading: 'Autori',
    worksHeading: 'Lucrări',
    inWorks: (results: number, works: number) =>
      `${count(results, forms.results, 'ro')} în ${count(works, forms.works, 'ro')}`,
    // The results were cut at the cap: how many are shown and in how many works.
    resultsCappedInWorks: (results: number, works: number) =>
      `Primele ${count(results, forms.results, 'ro')}, în ${count(works, forms.works, 'ro')}`,
    nameResults: (authors: number, works: number) =>
      `${count(authors, forms.authors, 'ro')} · ${count(works, forms.works, 'ro')}`,
    openAuthor: (name: string) => `Lucrările lui ${name}`,
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

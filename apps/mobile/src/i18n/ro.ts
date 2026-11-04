// Romanian UI strings. Use comma-below diacritics (ș ț), never cedilla forms.
export const ro = {
  appName: 'Biblioteca',
  library: {
    title: 'Biblioteca',
    empty: 'Nu există lucrări instalate.',
    loading: 'Se încarcă biblioteca…',
    search: 'Căutare',
    settings: 'Setări',
  },
  work: {
    title: 'Lucrare',
    notFound: 'Lucrarea nu a fost găsită.',
    contents: 'Cuprins',
  },
  reader: {
    title: 'Citire',
    notFound: 'Secțiunea nu a fost găsită.',
  },
  search: {
    title: 'Căutare',
    placeholder: 'Caută în biblioteca instalată',
    noResults: 'Niciun rezultat.',
  },
  settings: {
    title: 'Setări',
    about: 'Despre',
  },
  placeholder: 'În lucru',
} as const;

export type Strings = typeof ro;

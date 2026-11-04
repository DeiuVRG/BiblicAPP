// Stop words are stored folded (lower case, no diacritics), the way tokens are compared.

const split = (words: string): ReadonlySet<string> =>
  new Set(words.split(/\s+/).filter((word) => word !== ''));

/** Romanian function words plus the filler of a typical question ("ce spune ... despre ..."). */
export const ROMANIAN_STOPWORDS = split(`
  a ai al ale alt alta alte altfel am ar are as asa asta astea astfel atat atata atunci au avea
  aveau avut ba bine ca cam cand care carei caror carui cat cate catre ce cel cei cele ceva cine
  ci cu cum cumva da daca dar dat de deci deja deasupra despre desi din dintre doar dupa e ea ei
  el ele era eram este esti eu fara fi fie fiecare fiind fost i ii il in inainte inapoi inca insa
  intr intre l la le li lor lui ma mai mea mei mele mi mie mine mult multa multe multi ne nici
  nimeni nimic niste noi nostru noastra nostri noastre nu o or ori pana pe pentru peste poate
  prea prin printre sa sale sau se si sunt suntem sunteti sub sus ta tale te ti tine toata toate
  tot toti tu un una unde unei unele uneori unor unui va vom voi vor vostru voastra vreo vreun
  spune spun spuneti spus zice explica explici explicati inseamna poti puteti pot vreau rog
  ajuta ajutati arata aratati
`);

/** English function words, archaic forms found in older texts, and question filler. */
export const ENGLISH_STOPWORDS = split(`
  a about above after again against all also am an and any are aren as at be because been before
  being below between both but by can cannot could couldn did didn do does doesn doing don down
  during each few for from further had hadn has hasn have haven having he her here hers herself
  him himself his how i if in into is isn it its itself just let may me might more most must my
  myself no nor not of off on once only or other ought our ours ourselves out over own same shall
  she should shouldn so some such than that the their theirs them themselves then there these
  they this those through to too under until up upon very was wasn we were weren what when where
  which while who whom whose why will with won would wouldn yet you your yours yourself yourselves
  hath doth thee thou thy thine unto ye
  say says said tell tells explain explains mean means please
`);

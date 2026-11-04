// A small Romanian <-> English glossary of theological vocabulary.
//
// Retrieval is lexical and per language, so a question in Romanian cannot find a passage that
// exists only in English (a book whose Romanian translation is not finished) and the other way
// round. This glossary carries the *question* across: the content words of the question are
// replaced by their equivalents in the language of the index being searched, and the result is
// analysed there like any other query. It is a bridge, not a translator: words it does not know
// are kept as they are (names and shared words still match), and it is meant to shrink in
// importance as translations are completed and as the hybrid (vector) search replaces it.
//
// Format of the table: one concept per line, `romanian words = english words`, comma separated.
// The first word of each side is the main one; the others are inflected forms the light stemmers
// do not merge, and synonyms. Only single words (no spaces). Lines starting with `#` are comments.
// Words are written as they are normally spelled (with diacritics); matching goes through the same
// folding and stemming as the index, so `împărăția` and `imparatiei` are the same entry.
// Keep entries to words that mean the same thing in a theological text, not in general language.

import { getAnalyzer } from './analyzer';

const TABLE = `
# --- God, the persons of the Trinity ---------------------------------------------------------
dumnezeu, dumnezeul, dumnezeului, dumnezeilor = god
domn, domnul, domnului, domnii, domnilor = lord
tată, tatăl, tatălui, tații, taților = father, fathers
părinte, părintele, părinți, părinții, părinților = father, fathers, parent, parents
fiu, fiul, fiului, fii, fiii, fiilor = son, sons
duh, duhul, duhului = spirit
duhovnicesc, duhovnicească, duhovnicești = spiritual
treime, treimea, treimii, trinitate, trinitatea = trinity, trinitarian
dumnezeire, dumnezeirea, divinitate, divinitatea = deity, divinity, godhead
divin, divină, divine = divine
creator, creatorul, ziditor, ziditorul = creator, maker
creație, creația, creațiune, creațiunea, făptură, făpturile, zidire = creation, creature, creatures
crea, creat, creează, creează = create, created
providență, providența, providenței = providence
atotputernic, atotputernicul, atotputernicie = almighty, omnipotent, omnipotence
atotștiutor, atotștiința = omniscient, omniscience
veșnic, veșnică, veșnice, veșnicie, veșniciei, nemuritor, nemurire = eternal, everlasting, eternity, immortal, immortality
slavă, slava, slavei, slăvit, slăvire = glory, glorify, glorified
sfințenie, sfințenia, sfințeniei = holiness
sfânt, sfântă, sfântul, sfinte, sfinți, sfinții, sfinților = holy, saint, saints
dreptate, dreptatea, dreptății, drept, dreaptă, drepți, neprihănire, neprihănirea, neprihănit, neprihănită = righteousness, righteous, justice
iubire, iubirea, iubirii, dragoste, dragostea, dragostei, iubit, iubi = love
milă, mila, milei, îndurare, îndurarea, îndurării, milostivire, milostiv = mercy, merciful, compassion
har, harul, harului = grace
adevăr, adevărul, adevărului, adevărat, adevărată = truth, true
înțelepciune, înțelepciunea, înțelept, înțeleptul = wisdom, wise
cuvânt, cuvântul, cuvântului, cuvinte, cuvintele, logos = word, words, logos
putere, puterea, puterii, puteri = power, powers
autoritate, autoritatea, autorității = authority
legământ, legământul, legământului, legăminte, legămintele = covenant, covenants
testament, testamentul, testamentului = testament
vechi, vechiul, vechea = old
nou, noul, noua, noului = new

# --- Christ and his work ---------------------------------------------------------------------
hristos, hristosul, hristosului, cristos, cristosul = christ
isus, isuse, iisus = jesus
mesia, mesiei, mesianic, mesianică = messiah, messianic
mântuitor, mântuitorul, mântuitorului = savior, saviour
răscumpărător, răscumpărătorul = redeemer
răscumpărare, răscumpărarea, răscumpărării, răscumpărat = redemption, redeem, redeemed
întrupare, întruparea, întrupat = incarnation, incarnate
cruce, crucea, crucii, răstignire, răstignirea, răstignit = cross, crucifixion, crucified
jertfă, jertfa, jertfei, jertfe, jertfelor, jertfire, sacrificiu, sacrificiul = sacrifice, offering
ispășire, ispășirea, ispășitor = atonement, propitiation, expiation
împăcare, împăcarea, reconciliere, reconcilierea = reconciliation, reconcile
înviere, învierea, învierii, înviat = resurrection, risen
înălțare, înălțarea, înălțat = ascension, exalted, exaltation
rege, regele, regelui, regi, regilor, regesc, regească = king, kings, kingly, royal
preot, preotul, preotului, preoți, preoția = priest, priests, priesthood
proroc, prorocul, prorocului, prorocii, profet, profetul, profeți, profeții, profeție, profeția, profeției, profețiile = prophet, prophets, prophetic, prophecy, prophecies
mijlocitor, mijlocitorul, mijlocire, mijlocirea = mediator, intercession, intercessor
învățător, învățătorul, învățătorului, învățători = teacher, teachers, rabbi
învățătură, învățătura, învățăturii, învățături, învățăturile, învățăturilor = teaching, teachings, doctrine, instruction
ucenic, ucenicul, ucenici, ucenicii, ucenicilor = disciple, disciples, discipleship
apostol, apostolul, apostolului, apostoli, apostolii, apostolic = apostle, apostles, apostolic
om, omul, omului, oameni, oamenii, oamenilor, omenesc, omenire, omenirea = man, men, human, humanity, mankind

# --- The kingdom, the church, the people of God ------------------------------------------------
împărăție, împărăția, împărăției, împărății, împărăților, împărat, împăratul, împăratului, împărați = kingdom, king
biserică, biserica, bisericii, biserici, bisericile, bisericilor, bisericesc, bisericească = church, churches, ecclesiastical
adunare, adunarea, adunării, adunări, comunitate, comunitatea, obște, obștea = assembly, congregation, community
trup, trupul, trupului, trupuri = body, bodies
popor, poporul, poporului, popoare, popoarele = people, peoples
neam, neamul, neamuri, neamurile, neamurilor, păgân, păgâni, păgânii, națiune, națiuni, națiunile = nation, nations, gentiles, gentile, pagan
israel, israelul, israelului, israeliți, israeliții, israelit = israel, israelites, israelite
evreu, evrei, evreii, evreilor, iudeu, iudei, iudeii, iudeilor = jew, jews, jewish, hebrew, hebrews
lege, legea, legii, legi, legilor, legiuire = law, laws
poruncă, porunca, poruncii, porunci, poruncile, poruncilor = commandment, commandments, command
fapte, faptă, fapta, faptele, faptelor, lucrare, lucrarea, lucrări, lucrările = works, work, deeds, deed

# --- Scripture and what is taught -------------------------------------------------------------
biblie, biblia, bibliei, biblic, biblică = bible, biblical
scriptură, scriptura, scripturii, scripturi, scripturile, scripturilor = scripture, scriptures, scriptural
evanghelie, evanghelia, evangheliei, evanghelii, evangheliile, evanghelist, evanghelic = gospel, gospels, evangelist, evangelical
parabolă, parabola, parabolei, parabole, pildă, pilda, pildei, pilde, pildele = parable, parables
minune, minunea, minunii, minuni, minunile, minunilor, miracol, miracole = miracle, miracles, wonder, wonders
semn, semnul, semnului, semne, semnele, semnelor = sign, signs
psalm, psalmul, psalmi, psalmii, psalmilor = psalm, psalms
epistolă, epistola, epistole, epistolele, scrisoare, scrisoarea, scrisori = epistle, epistles, letter, letters
predică, predica, predicii, predici, predicile, predicare, predicarea, predicat, predicator, propovăduire, propovăduirea, propovăduit = sermon, preaching, preach, preached, preacher, proclamation, proclaim
rugăciune, rugăciunea, rugăciunii, rugăciuni, rugăciunile, rugăciunilor, rugat, roagă = prayer, prayers, pray
munte, muntele, muntelui, munți, munții = mountain, mount

# --- Ideas and arguments (the vocabulary of a theological book) --------------------------------
supremație, supremația, supremației = supremacy
suveranitate, suveranitatea, suveran, suverană = sovereignty, sovereign
stăpânire, stăpânirea, stăpânirii = dominion, rule, reign
regalitate, regalitatea = kingship, royalty
paternitate, paternitatea, paternității = fatherhood
filiație, filiația, filiației = sonship
frate, fratele, frați, frații, frăție, frăția, fraternitate = brother, brothers, brotherhood, brethren
soră, sora, surori = sister, sisters
prieten, prietenul, prieteni, prietenii = friend, friends
sinoptic, sinoptice, sinopticii = synoptic, synoptical, synoptics
apocalipsă, apocalipsa, apocalipsei, apocaliptic, apocaliptică = apocalypse, apocalyptic, revelation
teocrație, teocrația, teocratic = theocracy, theocratic
rabin, rabini, rabinii, rabinic, rabinică = rabbi, rabbis, rabbinical
idee, ideea, ideii, idei, ideile, concept, conceptul, concepție, concepția, noțiune, noțiunea = idea, ideas, concept, conception, notion
relație, relația, relației, raport, raportul = relation, relationship, relations
diferență, diferența, diferenței, deosebire, deosebirea = difference, distinction
natură, natura, naturii = nature
esență, esența, esenței, esențial, esențială = essence, essential
sens, sensul, sensului, înțeles, înțelesul, semnificație, semnificația = meaning, sense, significance
scop, scopul, scopului = purpose, goal, aim
fundal, fundalul, context, contextul = background, context
condiție, condiția, condiții, condițiile = condition, conditions
intrare, intrarea, intrării, intra, intră, intrat, intrați = entrance, enter, entering
moștenire, moștenirea, moștenit, moștenitor, moștenitori = inheritance, inherit, inherited, heir, heirs
răsplată, răsplata, răsplătire, plată, plata = reward, recompense, wages, payment
pedeapsă, pedeapsa, pedepse, pedepsele = punishment, penalty
învăța, învață, învățat, învățăm, învățați = teach, teaches, taught
vorbi, vorbea, vorbit, vorbește, vorbind, vorbire = speak, spoke, spoken, speech
vedea, vede, văzut, văd, vedem = see, saw, seen, sight
primi, primește, primit, primiți = receive, received
pierde, pierdut, pierduți, pierdere = lose, lost, loss
găsi, găsit, găsește = find, found
căuta, caută, căutat, căutare = seek, sought, search
deveni, devine, devenit = become, became
trăi, trăiește, trăit, trăiesc = live, lived, living
scrie, scris, scrisă, scriu = write, written, wrote
ști, știe, știut, știm = know, knew, known

# --- Time and the end -------------------------------------------------------------------------
viitor, viitorul, viitoare, viitoarele, viitorului = future, coming
prezent, prezentă, prezentul, prezența = present, presence
trecut, trecutul, trecutului = past
sfârșit, sfârșitul, sfârșitului = end, ending
eshatologie, eshatologia, eshatologic, eshatologică, escatologie, escatologia, escatologic = eschatology, eschatological
venire, venirea, venirii, venit, veni = coming, come, advent
doilea, doua = second
ultim, ultima, ultimul, ultimă, ultimii = last
judecată, judecata, judecății, judecăți, judecător, judecătorul, judeca, judecat = judgment, judgement, judge, judges, judged
osândă, osânda, osândei, osândire, osândit, condamnare, condamnarea = condemnation, condemn, condemned, damnation
iad, iadul, iadului, gheena, hades, șeol = hell, hades, gehenna, sheol
rai, raiul, raiului = paradise, eden
cer, ceruri, cerul, cerului, cerurilor = heaven, heavens
ceresc, cerească, cerești = heavenly
lume, lumea, lumii, lumilor = world
veac, veacul, veacuri, veacurile = age, ages
mileniu, mileniul, mileniului, milenar, milenarism = millennium, millennial, millenarian
antihrist, antihristul, antihristului = antichrist
zi, ziua, zilei, zile, zilele = day, days
timp, timpul, timpului, timpuri, vreme, vremea, vremuri = time, times, season
aproape, aproapele, aproapelui, apropiat, apropiată, apropie, apropiere = near, nigh, neighbour, neighbor, approach
pământ, pământul, pământului = earth

# --- Salvation, sin, the life of faith --------------------------------------------------------
mântuire, mântuirea, mântuirii, mântuit, mântuiți, mântui = salvation, saved, save, saving
păcat, păcatul, păcatului, păcate, păcatele, păcatelor, păcătos, păcătosul, păcătoși, păcătoșii, păcătui, păcătuit = sin, sins, sinner, sinners, sinful
iertare, iertarea, iertării, iertat, ierta, iartă, iertați = forgiveness, forgive, forgiven, pardon, remission
pocăință, pocăința, pocăinței, pocăire, pocăirea, pocăi, pocăiți, pocăit, pocăiește, pocăiesc = repentance, repent, repented
convertire, convertirea, convertit, convertiți, întoarcere, întoarcerea = conversion, convert, converted
credință, credința, credinței, credincios, credinciosul, credincioși, credincioșii, credincioasă, credincioșie, crede, cred, credem, credeți, crezi, crezut = faith, faithful, believe, believer, believers, belief
necredință, necredința, necredincios, necredincioși = unbelief, unbeliever, unbelievers, unfaithful
necesar, necesară, necesare, necesitate, necesitatea = necessary, necessity, necessarily, need
îndreptățire, îndreptățirea, îndreptățit, îndreptăți, justificare, justificarea = justification, justified, justify
sfințire, sfințirea, sfințit, sfințiți = sanctification, sanctify, sanctified
naștere, nașterea, nașterii, născut, născută, născuți, regenerare, regenerarea = birth, born, regeneration
alegere, alegerea, alegerii, ales, aleși, aleșii, aleasă, alesul, predestinare, predestinarea, predestinat, predestinați = election, elect, chosen, predestination, predestined
chemare, chemarea, chemării, chemat, chemați, cheamă = calling, call, called, vocation
binecuvântare, binecuvântarea, binecuvântat, binecuvântați, binecuvânta, fericire, fericirea, fericit, fericiți, fericirile = blessing, blessed, bless, blessedness, beatitude, beatitudes
blestem, blestemul, blestemat, blestemați = curse, cursed
ispită, ispita, ispitei, ispite, ispitire, ispitit = temptation, tempt, tempted
diavol, diavolul, diavolului, diavoli, drac, dracul, draci, satana, satan, demon, demoni, demonii = devil, satan, demon, demons
rău, răul, răului, rea, rele, răutate, răutatea = evil, wicked, wickedness
bun, bună, bunul, buni, bunătate, bunătatea, binele, binelui = good, goodness
vină, vina, vinei, vinovat, vinovăție, vinovăția = guilt, guilty
libertate, libertatea, libertății, liber, liberă, liberi, eliberare, eliberarea, eliberat = freedom, liberty, free, deliverance, liberation
suflet, sufletul, sufletului, suflete, sufletele = soul, souls
inimă, inima, inimii, inimi, inimile, inimilor = heart, hearts
conștiință, conștiința, conștiinței = conscience, consciousness
rațiune, rațiunea, rațiunii, minte, mintea, minții, gândire, gândirea = reason, mind, thought
cunoaștere, cunoașterea, cunoștință, cunoștința, cunoștinței, cunoscut, cunoaște, cunosc = knowledge, know, known
speranță, speranța, speranței, nădejde, nădejdea, nădejdii = hope, hopes
frică, frica, fricii, teamă, teama, temere, temerea = fear, fears
bucurie, bucuria, bucuriei, bucurii, bucuros = joy, rejoice, gladness
pace, pacea, păcii, pașnic, pașnică = peace, peaceful
răbdare, răbdarea, răbdării, răbdător, suferință, suferința, suferințele, suferi, suferit = patience, patient, suffering, suffer
smerenie, smerenia, smereniei, smerit, smeriți, umilință, umilința = humility, humble, meekness, meek
blândețe, blândețea, blând, blânzi = gentleness, gentle, meek
ascultare, ascultarea, ascultării, ascultător, ascultat, ascultă, supunere, supunerea = obedience, obey, obedient, listen, submission
sărac, săracul, săraci, săracii, săracilor, sărăcie, sărăcia = poor, poverty
bogat, bogatul, bogați, bogăție, bogăția, bogății, avere, averea = rich, riches, wealth
milostenie, milostenia, milosteniei, milostenii = almsgiving, alms, charity
darul, darului, daruri, darurile = gift, gifts
martor, martorul, martori, mărturie, mărturia, mărturiei, mărturii = witness, witnesses, testimony, testimonies
mărturisire, mărturisirea, mărturisit, mărturisi, spovedanie, spovedania = confession, confess, confessed
lumină, lumina, luminii, luminat, luminare = light, enlightenment
întuneric, întunericul, întunericului = darkness, dark
foc, focul, focului, focuri = fire
carne, carnea, cărnii, trupesc, trupească = flesh, fleshly, carnal
sânge, sângele, sângelui = blood
mormânt, mormântul, mormântului, morminte, mormintele = tomb, grave, sepulchre
moarte, moartea, morții, mort, morți, murit, muri, moare = death, dead, die, died
viață, viața, vieții, viețuire = life
viu, vie, vii, viul = living, alive

# --- Church life, doctrine, history ------------------------------------------------------------
botez, botezul, botezului, botezuri, botezat, botezați, botezare, botezător, botezătorul = baptism, baptize, baptized, baptist
euharistie, euharistia, euharistiei, împărtășanie, împărtășania, împărtășaniei, cină, cina, cinei = eucharist, communion, supper
taină, taina, tainei, taine, tainele, tainelor, sacrament, sacramente, mister, misterul = sacrament, sacraments, mystery, mysteries
episcop, episcopul, episcopi, episcopii, episcopat = bishop, bishops, episcopal, episcopate
diacon, diaconul, diaconi, diaconii = deacon, deacons
prezbiter, prezbiterul, prezbiteri, presbiter, bătrân, bătrânul, bătrâni = presbyter, presbyters, elder, elders
pastor, pastorul, pastori, păstor, păstorul, păstori = pastor, pastors, shepherd, shepherds
papă, papa, papei, papi, papalitate = pope, popes, papacy, papal
sinod, sinodul, sinoade, sinoadele, conciliu, conciliul, concilii, conciliile = synod, synods, council, councils
cult, cultul, închinare, închinarea, închinăciune, adorare = worship, adoration
liturghie, liturghia, liturghiei, liturgic = liturgy, liturgical
icoană, icoana, icoanei, icoane, icoanele, icoanelor = icon, icons
mucenic, mucenicul, mucenici, martir, martiri, martiriu = martyr, martyrs, martyrdom
fecioară, fecioara, fecioarei, fecioare = virgin
maria, mariei = mary
mamă, mama, mamei, mame, maică, maica, maicii = mother, mothers
monah, monahul, monahi, monahii, călugăr, călugărul, călugări, călugării, monahism, mănăstire, mănăstirea, mănăstirii, mănăstiri = monk, monks, monastery, monasteries, monastic, monasticism
tradiție, tradiția, tradiției, tradiții, tradițiile, tradițional = tradition, traditions, traditional
erezie, erezia, ereziei, erezii, ereziile, eretic, ereticii, ereticul, ereticilor = heresy, heresies, heretic, heretics
schismă, schisma, schismei, schisme = schism, schisms
dogmă, dogma, dogmei, dogme, dogmatic, dogmatică = dogma, dogmas, dogmatic
doctrină, doctrina, doctrinei, doctrine, doctrinar = doctrine, doctrines, doctrinal
teologie, teologia, teologiei, teologic, teologică, teolog, teologul, teologi, teologii = theology, theological, theologian, theologians
reformă, reforma, reformei, reforme, reformator, reformatori, reformat, reformată = reformation, reform, reformer, reformers, reformed
patristic, patristică, patristica = patristic, patristics
ortodox, ortodoxă, ortodoxia, ortodocși, ortodoxe = orthodox, orthodoxy
catolic, catolică, catolicism, catolicii, catolicilor = catholic, catholics, catholicism
protestant, protestantă, protestanți, protestantism, protestantismul = protestant, protestants, protestantism
templu, templul, templului, temple, templele = temple, temples
sinagogă, sinagoga, sinagogii, sinagogi = synagogue, synagogues
sabat, sabatul, sabatului, sâmbătă, sâmbăta = sabbath, saturday
paște, paștele, paștelui, paștilor = passover, easter, pascha
cincizecime, cincizecimea, rusalii = pentecost
fariseu, farisei, fariseii, fariseilor = pharisee, pharisees
saduceu, saduchei, saduceii = sadducee, sadducees
vameș, vameși, vameșii, vameșul = publican, publicans
samaritean, samariteanul, samaritenii = samaritan, samaritans
înger, îngerul, îngeri, îngerii, îngerilor, arhanghel, arhanghelul = angel, angels, archangel
orb, orbul, orbi, orbii, orbilor = blind
bolnav, bolnavi, boală, boala, boli, vindecare, vindecarea, vindeca, vindecat, tămăduire, tămăduit = sick, sickness, disease, healing, heal, healed
familie, familia, familiei, familii, căsătorie, căsătoria, căsătoriei = family, families, marriage
soț, soția, soții, soție = husband, wife, wives
copil, copilul, copii, copiii, copilărie = child, children, childhood
război, războiul, războiului, războaie = war, wars
etică, etica, eticii, moral, morală, morala, moralitate, moralitatea = ethics, ethical, moral, morality
virtute, virtutea, virtuții, virtuți, virtuțile, vicii, viciu = virtue, virtues, vice, vices
societate, societatea, societății, social, socială = society, social
istorie, istoria, istoriei, istoric, istorică, istorici = history, historical, historian, historians
filosofie, filosofia, filosofiei, filosof, filosoful, filosofi, filosofic = philosophy, philosopher, philosophers, philosophical
critică, critica, criticii, critic, critici = criticism, critical, critic, critics
autor, autorul, autorului, autori, autorii = author, authors
carte, cartea, cărții, cărți, cărțile = book, books
capitol, capitolul, capitole = chapter, chapters
verset, versetul, versete, versetele = verse, verses

# --- People and places (spelled differently in the two languages) ------------------------------
augustin = augustine
toma = thomas
aquino = aquinas
atanasie = athanasius
vasile = basil
grigorie = gregory
ioan = john
iacov, iacob = james, jacob
pavel = paul
petru = peter
matei = matthew
marcu = mark
luca = luke
moise = moses
avraam = abraham
iosif = joseph
isaia = isaiah
ieremia = jeremiah
ezechiel = ezekiel
ilie = elijah
iov = job
noe = noah
eva = eve
timotei = timothy
tit = titus
ierusalim = jerusalem
betleem = bethlehem
nazaret = nazareth
galileea = galilee
iordan = jordan
iuda = judah, judas
egipt = egypt
corint = corinth
efes = ephesus
roma, romani = rome, roman, romans
irineu = irenaeus
tertulian = tertullian
ciprian = cyprian
ieronim = jerome
ambrozie = ambrose
crisostom = chrysostom
`;

export type GlossaryLanguage = 'ro' | 'en';

interface Concept {
  ro: string[];
  en: string[];
}

/** The concepts of the table, as written (for tests and for anyone who wants to list them). */
export const GLOSSARY_CONCEPTS: readonly Concept[] = TABLE.split('\n')
  .map((line) => line.trim())
  .filter((line) => line !== '' && !line.startsWith('#'))
  .map((line) => {
    const [ro = '', en = ''] = line.split('=');
    const words = (side: string): string[] =>
      side
        .split(',')
        .map((word) => word.trim())
        .filter((word) => word !== '');
    return { ro: words(ro), en: words(en) };
  });

type Direction = ReadonlyMap<string, readonly string[]>;

/** Source term -> the words to search for in the other language (one per distinct target term). */
function buildDirection(from: GlossaryLanguage, to: GlossaryLanguage): Direction {
  const source = getAnalyzer(from);
  const target = getAnalyzer(to);
  const direction = new Map<string, string[]>();
  for (const concept of GLOSSARY_CONCEPTS) {
    // One word per distinct term of the target language: its inflected forms add nothing.
    const words: string[] = [];
    const seen = new Set<string>();
    for (const word of concept[to]) {
      const term = target.analyze(word)[0];
      if (term === undefined || seen.has(term)) continue;
      seen.add(term);
      words.push(word);
    }
    for (const word of concept[from]) {
      const term = source.analyze(word)[0];
      if (term === undefined) continue;
      const known = direction.get(term);
      if (known === undefined) direction.set(term, [...words]);
      else {
        // The two stems collide ("împărăție" and "împărat" both stem to "imparat"): merge.
        for (const candidate of words) {
          const candidateTerm = target.analyze(candidate)[0];
          if (!known.some((other) => target.analyze(other)[0] === candidateTerm)) {
            known.push(candidate);
          }
        }
      }
    }
  }
  return direction;
}

const directions = new Map<string, Direction>();

function directionFor(from: string, to: string): Direction | undefined {
  if ((from !== 'ro' && from !== 'en') || (to !== 'ro' && to !== 'en') || from === to) {
    return undefined;
  }
  const key = `${from}>${to}`;
  let direction = directions.get(key);
  if (direction === undefined) {
    direction = buildDirection(from, to);
    directions.set(key, direction);
  }
  return direction;
}

/** Builds both directions now (about 50 ms), so that the first question does not pay for it. */
export function warmGlossary(): void {
  directionFor('ro', 'en');
  directionFor('en', 'ro');
}

export interface TranslatedQuery {
  /** The question word for word, in order (so that adjacent words can still be searched as a phrase). */
  text: string;
  /** Other words with the same meaning (synonyms, inflected forms): searched too, but counting for less. */
  extras: string;
}

/**
 * The question in the vocabulary of another language, ready to be analysed there: stop words and
 * one-letter words of the question's language are dropped, words the glossary knows are replaced
 * by their main equivalent (the other equivalents go to `extras`), anything else is kept as it
 * is, because names and shared words still match. `null` when the glossary does not cover the
 * pair of languages (then the question is searched as it is).
 */
export function translateQuery(text: string, from: string, to: string): TranslatedQuery | null {
  const direction = directionFor(from, to);
  if (direction === undefined) return null;
  const main: string[] = [];
  const extras: string[] = [];
  for (const { token, term } of getAnalyzer(from).tokenize(text)) {
    if (term === null) continue;
    const targets = direction.get(term);
    if (targets === undefined || targets.length === 0) {
      main.push(token);
      continue;
    }
    main.push(targets[0] as string);
    extras.push(...targets.slice(1));
  }
  return { text: main.join(' '), extras: extras.join(' ') };
}

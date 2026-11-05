// The checks that the review of the shell phase added to the browser suite (docs/ui-spec-v2.md,
// section 20): what Jest cannot see and the first round of checks did not look at. Two exports:
//
//   `reviewChecks`  runs on the export as it is delivered (the flags of the shell phase);
//   `beta1Checks`   runs on an export built with `EXPO_PUBLIC_FEATURES=beta1` (the flags of Beta 1),
//                   because S1, S2, L2, L3 and L7 cannot pass with the section bar of three items,
//                   one door and no transparency band, and nothing else would exercise the
//                   configuration the owner will ship.
//
// smoke-web.mjs calls them after `shellChecks` (scripts/lib/smoke-shell.mjs, whose helpers they use).

/* global document, getComputedStyle, innerWidth, NodeFilter -- evaluated inside the browser page */
import { DESKTOP, PHONE, boxOf, expect, normal, open, shown, textOf } from './smoke-shell.mjs';

/** The test id of the element that has the focus. */
const focused = (page) => page.evaluate(() => document.activeElement?.getAttribute('data-testid'));

/** The pointer is pressed on an element, in two steps: what happens between them is what a finger sees. */
async function pressIn(page, locator) {
  const box = await locator.boundingBox();
  expect(box, 'the element to press is not on screen');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
}

/** Counts the h1 that are on screen (a screen that was left stays mounted under the next one, hidden). */
const visibleH1 = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('h1')]
      .filter((heading) => heading.getBoundingClientRect().width > 0)
      .map((heading) => (heading.textContent ?? '').trim().slice(0, 50)),
  );

/**
 * The width of a field's placeholder in the face of the field, and the room it has. Evaluated in the
 * page (it must be self-contained).
 */
const placeholderFit = (field) => {
  const style = getComputedStyle(field);
  const context = document.createElement('canvas').getContext('2d');
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const text = field.getAttribute('placeholder') ?? '';
  const room =
    field.getBoundingClientRect().width -
    parseFloat(style.paddingLeft) -
    parseFloat(style.paddingRight) -
    parseFloat(style.borderLeftWidth) -
    parseFloat(style.borderRightWidth);
  return { text, width: context.measureText(text).width, room };
};

/**
 * The visible text whose face is not one of the app's (Source Serif 4, IM Fell Great Primer,
 * Literata, Inter, Gentium Plus): a bare `Text` draws in the system font, as the arrow of the work
 * cards did. Evaluated in the page (it must be self-contained).
 */
const textInOtherFaces = () => {
  const own = /^"?(SourceSerif4|IMFellGreatPrimer|Literata|Inter|GentiumPlus)_/;
  const found = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.textContent ?? '').trim();
    const parent = node.parentElement;
    if (!text || !parent) continue;
    const box = parent.getBoundingClientRect();
    const style = getComputedStyle(parent);
    if (box.width === 0 || box.height === 0 || style.visibility === 'hidden') continue;
    if (!own.test(style.fontFamily)) {
      found.push(`"${text.slice(0, 20)}" in ${style.fontFamily.slice(0, 40)} at ${style.fontSize}`);
    }
  }
  return found;
};

/** Fresh browser context and page, with the page errors collected. */
async function newPage(browser, { viewport, timeout, problems, label, ...options }) {
  const context = await browser.newContext({ locale: 'ro-RO', viewport, ...options });
  const page = await context.newPage();
  page.setDefaultTimeout(timeout);
  page.on('pageerror', (error) => problems.push(`page error (${label}): ${error.message}`));
  return { context, page };
}

/** Checks of the export as it is delivered. */
export async function reviewChecks({ browser, origin, basePath, timeout, step, problems }) {
  const base = `${origin}${basePath}`;

  // --- S3, S4 on a stack of screens: the drawer entries can be pressed after a client-side
  // navigation (the screens a reader came from stay mounted, each with a bar of its own) ----------
  for (const [name, viewport, options] of [
    ['desktop', DESKTOP, {}],
    ['phone', PHONE, { hasTouch: true }],
  ]) {
    const { context, page } = await newPage(browser, {
      viewport,
      timeout,
      problems,
      label: name,
      ...options,
    });
    await open(page, base, '/', 'doors');
    // "/" -> "Căutare" (client side: two screens are mounted now) -> "Citește" -> "Autori".
    await shown(page, 'section-item-search').click();
    await page.waitForURL(/\/search$/);
    await shown(page, 'search-input').waitFor({ state: 'visible' });
    await shown(page, 'section-item-read').click();
    await shown(page, 'drawer-entry-read-authors').waitFor({ state: 'visible' });
    // On a wide screen the strip opens over 300 ms: the entry is where it stays only afterwards.
    await page.waitForTimeout(450);
    const entry = shown(page, 'drawer-entry-read-authors');
    await pressIn(page, entry);
    await page.waitForTimeout(120);
    // The drawer was closed under the finger by the bar of the screen below: the entry was gone
    // before the press ended and the page stayed where it was.
    expect(
      (await page.locator('[data-testid="drawer-entry-read-authors"]:visible').count()) === 1,
      `S3/S4 (${name}): the drawer went away when its entry was pressed on the second screen of the stack`,
    );
    await page.mouse.up();
    await page.waitForURL(/\/authors$/, { timeout: 5000 }).catch(() => {
      throw new Error(
        `S3/S4 (${name}): pressing an entry of the drawer on the second screen of the stack did not follow its link (the page is at ${new URL(page.url()).pathname})`,
      );
    });
    // At the third screen: the open toggle closes the drawer when it is pressed again.
    await shown(page, 'section-item-read').click();
    await shown(page, 'section-drawer-read').waitFor({ state: 'visible' });
    await shown(page, 'section-item-read').click();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="section-item-read"][aria-expanded="true"]') === null,
    );
    await context.close();
  }
  step(
    'S3, S4: on the second and the third screen of the stack an entry of the drawer follows its link and the toggle closes it again, on desktop and on a phone',
  );

  const desktop = await newPage(browser, {
    viewport: DESKTOP,
    timeout,
    problems,
    label: 'desktop review',
  });
  const wide = desktop.page;

  // --- S3: the keys of the bar, links included -----------------------------------------------------
  await open(wide, base, '/', 'doors');
  await shown(wide, 'section-item-home').focus();
  await wide.keyboard.press('ArrowRight');
  expect(
    (await focused(wide)) === 'section-item-search',
    `S3: ArrowRight from "home" moved the focus to "${await focused(wide)}"`,
  );
  await wide.keyboard.press('ArrowRight');
  await wide.keyboard.press('ArrowLeft');
  expect(
    (await focused(wide)) === 'section-item-search',
    `S3: ArrowLeft from "read" moved the focus to "${await focused(wide)}"`,
  );
  await wide.keyboard.press('ArrowRight');
  await wide.keyboard.press('ArrowDown');
  await wide.waitForFunction(
    () => document.activeElement?.getAttribute('data-testid') === 'drawer-entry-read-library',
  );
  await wide.keyboard.press('Escape');
  await wide.waitForFunction(
    () => document.activeElement?.getAttribute('data-testid') === 'section-item-read',
  );
  step(
    'S3: ArrowRight and ArrowLeft move between the items of the bar (links too), ArrowDown opens the drawer and moves the focus to its first entry, Esc gives it back',
  );

  // --- G13 / spec 18: one h1 on every screen, the reader included ---------------------------------
  for (const [path, ready] of [
    ['/', 'doors'],
    ['/library', 'library-hero-search'],
    ['/library/all', 'library-count'],
    ['/authors', 'authors-count'],
    ['/search', 'search-input'],
    ['/settings', 'settings-title'],
  ]) {
    await open(wide, base, path, ready);
    const headings = await visibleH1(wide);
    expect(
      headings.length === 1,
      `G13: ${path} has ${headings.length} h1 (${headings.join(' | ')})`,
    );
  }
  await open(wide, base, '/library/all', 'library-count');
  await wide.locator('a[href*="/work/"]:visible').first().click();
  await wide.locator('a[href*="/read/"]:visible').first().waitFor({ state: 'visible' });
  const workH1 = await visibleH1(wide);
  expect(workH1.length === 1, `G13: the work page has ${workH1.length} h1`);
  await wide.locator('a[href*="/read/"]:visible').first().click();
  await wide.waitForFunction(() =>
    [...document.querySelectorAll('[role="progressbar"][aria-valuenow]')].some(
      (bar) => bar.getBoundingClientRect().width > 0,
    ),
  );
  const readerH1 = await visibleH1(wide);
  expect(
    readerH1.length === 1,
    `G13: the reader has ${readerH1.length} h1 (${readerH1.join(' | ')}), not one`,
  );
  step(`G13: every screen has one h1, the reader's is the name of the work ("${readerH1[0]}")`);

  // --- G2: every visible text is set in one of the faces of the app -------------------------------------
  for (const [viewport, label] of [
    [DESKTOP, 'desktop'],
    [PHONE, 'phone'],
  ]) {
    await wide.setViewportSize(viewport);
    for (const [path, ready] of [
      ['/', 'doors'],
      ['/library', 'library-hero-search'],
      ['/library/all', 'library-count'],
      ['/authors', 'authors-count'],
      ['/search?q=vos&mode=passages', 'search-input'],
      ['/settings', 'settings-title'],
    ]) {
      await open(wide, base, path, ready);
      await wide.evaluate(() => document.fonts.ready);
      await wide.waitForTimeout(300);
      const other = await wide.evaluate(textInOtherFaces);
      expect(
        other.length === 0,
        `G2: on ${path} (${label}) text is set outside the faces of the app: ${other.join('; ')}`,
      );
    }
  }
  await wide.setViewportSize(DESKTOP);
  step(
    'G2: on the landing, the library, the authors, the search and Settings every visible text is in a face of the app, on desktop and on a phone',
  );

  // --- B1: the hero of Selecție (660 + 121 wide, 380 high) ---------------------------------------
  await open(wide, base, '/library', 'library-hero-search');
  const field = await boxOf(wide, 'library-hero-search');
  const submit = await boxOf(wide, 'library-hero-submit');
  const hero = await boxOf(wide, 'library-hero');
  expect(
    Math.abs(field.width - 660) <= 2 && Math.abs(submit.width - 121) <= 1,
    `B1: the form is ${field.width} + ${submit.width} wide, expected 660 + 121`,
  );
  expect(
    Math.abs(field.x + field.width - submit.x) <= 1,
    'B1: the button is not joined to the field',
  );
  expect(Math.abs(hero.height - 380) <= 2, `B1: the hero is ${hero.height} px high, not 380`);
  step('B1: the hero of Selecție is 380 high with a joined form of 660 + 121');

  // --- B5 / G7: the ring of the field on the dark band lies on the band --------------------------
  await shown(wide, 'library-hero-search').focus();
  const ring = await shown(wide, 'library-hero-search').evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: style.outlineWidth, offset: style.outlineOffset, color: style.outlineColor };
  });
  expect(
    ring.width === '2px' && ring.offset === '2px' && ring.color === 'rgb(239, 231, 218)',
    `G7: the ring of the hero field is ${JSON.stringify(ring)}, expected 2px, offset 2px, the ink of the band`,
  );
  step(
    'G7: the ring of the field in the dark hero is 2 px of the ink of the band, 2 px outside the field',
  );

  // --- Q1: "/" takes the field of Selecție and of the authors; Down moves into the results -----------
  await open(wide, base, '/library', 'library-hero-search');
  await wide.locator('body').click({ position: { x: 5, y: 450 } });
  await wide.keyboard.press('/');
  expect(
    (await focused(wide)) === 'library-hero-search',
    `Q1: "/" on Selecție focused "${await focused(wide)}"`,
  );
  await open(wide, base, '/authors', 'authors-count');
  await wide.locator('body').click({ position: { x: 5, y: 450 } });
  await wide.keyboard.press('/');
  expect(
    (await focused(wide)) === 'authors-search',
    `Q1: "/" on the authors page focused "${await focused(wide)}"`,
  );
  await open(wide, base, '/search?q=vos&mode=passages', 'search-input');
  await wide.waitForFunction(() => document.querySelector('[data-testid="search-result-0"]'));
  await shown(wide, 'search-input').focus();
  await wide.keyboard.press('ArrowDown');
  expect(
    (await focused(wide)) === 'search-result-0',
    `Q1: Down in the search field moved the focus to "${await focused(wide)}"`,
  );
  await open(wide, base, '/search?q=vos', 'search-input');
  await wide.waitForFunction(() => document.querySelector('[data-testid^="search-author-"]'));
  await shown(wide, 'search-input').focus();
  await wide.keyboard.press('ArrowDown');
  expect(
    (await focused(wide))?.startsWith('search-author-'),
    `Q1: Down in the "Lucrări" search moved the focus to "${await focused(wide)}"`,
  );
  step(
    'Q1: "/" focuses the field of Selecție and of the authors page; Down in the search field moves into the results (works and passages)',
  );

  // --- A9 (spec 10): "Pasaje" names the author and the editions of a work, and the count says both ---
  await open(wide, base, '/search?q=%C3%AEmp%C4%83r%C4%83%C8%9Bia&mode=passages', 'search-input');
  await wide.waitForFunction(() => document.querySelector('[data-testid="search-count"]'));
  const group = wide.locator('[data-testid^="search-group-"]:visible').first();
  const groupText = normal(await group.innerText());
  expect(
    /Geerhardus Vos/i.test(groupText) && /\bRO\b/.test(groupText) && /\bEN\b/.test(groupText),
    `A9: the heading of a group of passages reads "${groupText}"`,
  );
  const count = await textOf(wide, 'search-count');
  expect(
    /^(Primele \d+ de rezultate, în 1 lucrare|\d+ rezultate? în 1 lucrare)$/i.test(count),
    `A9: the count line reads "${count}"`,
  );
  step(
    'A9: "Pasaje" shows the author and the editions under the title of a group, and the count line says the works',
  );

  // --- B10, B6, B3: a library row, a work card, the landing ------------------------------------------
  await open(wide, base, '/library/all', 'library-count');
  const row = wide.locator('[data-testid^="library-row-"]:visible').first();
  const rowBox = await row.boundingBox();
  const chips = await wide.locator('[data-testid="row-badges"]:visible').first().boundingBox();
  expect(
    rowBox && chips && chips.x + chips.width >= rowBox.x + rowBox.width - 24,
    `B10: the edition chips end at ${chips && chips.x + chips.width}, the row at ${rowBox && rowBox.x + rowBox.width}: they are not at the right`,
  );
  await open(wide, base, '/', 'doors');
  const arrow = await shown(wide, 'work-card-arrow').evaluate(
    (element) => getComputedStyle(element).fontFamily,
  );
  expect(/Source ?Serif ?4/i.test(arrow), `B6: the arrow of "CITEȘTE ›" is set in ${arrow}`);
  // B4: the highlighted line and the buttons of the hero are on the middle axis of the window (the
  // reference's landing hero is centred).
  const middle = DESKTOP.width / 2;
  // The bar sweeps in over 550 ms after a delay of 250 ms: measured before that it is a sliver.
  await wide.waitForFunction(() => {
    const bar = [...document.querySelectorAll('[data-testid="hero-highlight"]')].find(
      (element) => element.offsetWidth > 0,
    );
    return !bar || /matrix\(1,|none/.test(getComputedStyle(bar).transform);
  });
  const heroBar = await boxOf(wide, 'hero-highlight');
  const heroButton = await boxOf(wide, 'hero-cta-primary');
  const centres = [heroBar, heroButton].map((box) => Math.round(box.x + box.width / 2));
  expect(
    centres.every((centre) => Math.abs(centre - middle) <= 12),
    `B4: the highlighted line and the button of the hero are centred at ${centres.join(' and ')}, the window at ${middle}`,
  );
  step(
    'B10, B6, B4: the chips are at the right of a row, the arrow of a card is in Source Serif 4, the hero of the landing is centred',
  );

  // --- A12: the footer of a shelf block of one work -------------------------------------------------
  await open(wide, base, '/library', 'library-hero-search');
  const footer = await wide
    .locator('[data-testid^="shelf-block-"][data-testid$="-all"]:visible')
    .first()
    .innerText();
  expect(
    /^deschide raftul/i.test(normal(footer)),
    `A12: the footer of a shelf of one work reads "${normal(footer)}"`,
  );
  step('A12: the footer of a shelf block of one work reads "DESCHIDE RAFTUL"');

  // --- B3/B8: the scroll cue and the breakpoints ----------------------------------------------------
  await wide.setViewportSize({ width: 660, height: 900 });
  await open(wide, base, '/', 'doors');
  await shown(wide, 'section-item-read').click();
  await wide.waitForTimeout(500);
  const bar = await wide.evaluate(() => {
    const scroller = document.querySelector('[data-testid="section-bar-scroll"]');
    return { content: scroller.scrollWidth, window: scroller.clientWidth };
  });
  expect(
    bar.content > bar.window,
    `S3: at 660 points the open drawer fits (${bar.content} in ${bar.window}): the check cannot see the cue`,
  );
  const cue = await shown(wide, 'section-bar-cue').boundingBox();
  const thumb = await shown(wide, 'section-bar-cue-thumb').boundingBox();
  expect(
    cue && thumb && cue.height >= 2 && thumb.width >= 32 && thumb.width < cue.width,
    'S3: a bar that scrolls sideways has no hairline cue with a thumb under it',
  );
  await wide.keyboard.press('Escape');
  await wide.setViewportSize(DESKTOP);
  await wide.waitForTimeout(300);
  step(
    'S3: with a drawer open at 660 points the bar scrolls and a hairline cue with a thumb shows how much is in view',
  );
  await desktop.context.close();

  // --- B8: the phone menu does not stay open over the wide layout -------------------------------------
  {
    const { context, page } = await newPage(browser, {
      viewport: PHONE,
      timeout,
      problems,
      label: 'menu',
      hasTouch: true,
    });
    await open(page, base, '/', 'doors');
    await shown(page, 'menu-button').click();
    await shown(page, 'menu-drawer-panel').waitFor({ state: 'visible' });
    await page.setViewportSize(DESKTOP);
    await page.waitForFunction(
      () => document.querySelector('[data-testid="menu-drawer-panel"]') === null,
    );
    // G6, G6b: the segments of the language switch are targets of 44 x 44 for a finger (the menu on
    // a phone, and a wide window with a coarse pointer).
    await page.setViewportSize(PHONE);
    await shown(page, 'menu-button').click();
    await shown(page, 'menu-drawer-panel').waitFor({ state: 'visible' });
    for (const id of ['language-ro', 'language-en']) {
      const box = await page
        .locator(`[data-testid="menu-language-switch"] [data-testid="${id}"]`)
        .boundingBox();
      expect(
        box && box.width >= 43.5 && box.height >= 43.5,
        `G6: "${id}" in the phone menu is ${box?.width} x ${box?.height}`,
      );
    }
    await context.close();
    const coarse = await newPage(browser, {
      viewport: { width: 1024, height: 768 },
      timeout,
      problems,
      label: 'coarse',
      hasTouch: true,
      isMobile: true,
    });
    await open(coarse.page, base, '/', 'doors');
    for (const id of ['language-ro', 'language-en']) {
      const box = await coarse.page
        .locator(`[data-testid="brand-bar"] [data-testid="${id}"]`)
        .first()
        .boundingBox();
      expect(
        box && box.width >= 43.5 && box.height >= 43.5,
        `G6b: "${id}" in the brand bar is ${box?.width} x ${box?.height} with a coarse pointer`,
      );
    }
    await coarse.context.close();
  }
  step(
    'B8, G6, G6b: the phone menu closes when the window grows past 640; the language segments are 44 x 44 for a finger',
  );

  // --- B9: the filters, shelves and placeholders at the sizes where they were uneven or cut ---------------
  {
    const { context, page } = await newPage(browser, {
      viewport: { width: 768, height: 1024 },
      timeout,
      problems,
      label: 'tablet',
    });
    await open(page, base, '/library/all', 'library-count');
    const [shelf, century, lang, availability] = await Promise.all(
      ['filter-shelf', 'filter-century', 'filter-lang', 'filter-availability'].map((id) =>
        boxOf(page, id),
      ),
    );
    expect(
      Math.abs(shelf.y - century.y) <= 1 &&
        Math.abs(lang.y - availability.y) <= 1 &&
        Math.abs(shelf.x - lang.x) <= 1 &&
        Math.abs(century.x - availability.x) <= 1 &&
        lang.y > shelf.y + 40,
      `B9: at 768 the four filters are not two and two (${[shelf, century, lang, availability].map((box) => `${Math.round(box.x)},${Math.round(box.y)}`).join(' | ')})`,
    );
    expect(
      Math.abs(shelf.width - availability.width) <= 1,
      `B9: the filters are ${shelf.width} and ${availability.width} wide: one stands alone on a wider row`,
    );
    await page.setViewportSize(DESKTOP);
    await page.waitForTimeout(300);
    const row = await Promise.all(
      ['filter-shelf', 'filter-century', 'filter-lang', 'filter-availability'].map((id) =>
        boxOf(page, id),
      ),
    );
    expect(
      row.every((box) => Math.abs(box.y - row[0].y) <= 1),
      'B9: at 1366 the four filters are not in one row',
    );
    await context.close();
  }
  {
    const { context, page } = await newPage(browser, {
      viewport: { width: 600, height: 900 },
      timeout,
      problems,
      label: '600',
    });
    await open(page, base, '/', 'shelves-grid');
    const grid = await boxOf(page, 'shelves-grid');
    const card = await page.locator('[data-testid^="shelf-card-"]:visible').first().boundingBox();
    expect(
      card && card.width >= grid.width - 2,
      `A10: at 600 points a shelf card is ${card?.width} wide in a grid of ${grid.width}: two to a row on a phone`,
    );
    await context.close();
  }
  for (const width of [360, 390]) {
    const { context, page } = await newPage(browser, {
      viewport: { width, height: 800 },
      timeout,
      problems,
      label: `placeholders ${width}`,
    });
    for (const [path, id, ready] of [
      ['/library', 'library-hero-search', 'library-hero-search'],
      ['/search', 'search-input', 'search-input'],
      ['/library/all', 'library-search', 'library-count'],
      ['/authors', 'authors-search', 'authors-count'],
    ]) {
      await open(page, base, path, ready);
      await page.evaluate(() => document.fonts.ready);
      const fit = await shown(page, id).evaluate(placeholderFit);
      expect(
        fit.width <= fit.room,
        `B1: at ${width} points the placeholder "${fit.text}" of ${path} is ${Math.round(fit.width)} points and has ${Math.round(fit.room)}`,
      );
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `G1: the page scrolls sideways at ${width} points`,
    );
    await context.close();
  }
  // B1 on a phone: the field over the button, both as wide as the form.
  {
    const { context, page } = await newPage(browser, {
      viewport: PHONE,
      timeout,
      problems,
      label: 'phone hero',
    });
    await open(page, base, '/library', 'library-hero-search');
    const field = await boxOf(page, 'library-hero-search');
    const submit = await boxOf(page, 'library-hero-submit');
    expect(
      submit.y >= field.y + field.height && Math.abs(submit.width - field.width) <= 2,
      `B1: on a phone the button (${submit.width}) is not under the field (${field.width})`,
    );
    await context.close();
  }
  step(
    'B9, A10, B1: the filters are two and two at 768 and four at 1366, a shelf is one per row at 600, the placeholders fit at 360 and 390, the phone form is stacked',
  );
}

/** Checks of the export built with the flags of Beta 1 (`EXPO_PUBLIC_FEATURES=beta1`). */
export async function beta1Checks({ browser, origin, basePath, timeout, step, problems }) {
  const base = `${origin}${basePath}`;

  // --- S1 -------------------------------------------------------------------------------------------
  const desktop = await newPage(browser, {
    viewport: DESKTOP,
    timeout,
    problems,
    label: 'beta1 desktop',
  });
  const wide = desktop.page;
  await open(wide, base, '/', 'doors');
  const items = await wide.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="section-item-"]')]
      .filter((element) => element.getBoundingClientRect().width > 0)
      .map((element) => element.getAttribute('data-testid').replace('section-item-', '')),
  );
  expect(
    items.join() === 'home,search,read,research,about',
    `S1: the bar has ${items.join()}, expected home,search,read,research,about`,
  );
  const brand = await boxOf(wide, 'brand-bar');
  const section = await boxOf(wide, 'section-bar');
  expect(
    Math.abs(brand.height - 65) <= 2 && Math.abs(section.height - 49) <= 2,
    `S1: the bars are ${brand.height} and ${section.height} px high, expected 64 and 48 (plus the borders)`,
  );
  const rail = await wide.evaluate(() => {
    const style = getComputedStyle(document.querySelector('[data-testid="section-item-search"] *'));
    return { transform: style.textTransform, size: style.fontSize, spacing: style.letterSpacing };
  });
  expect(
    rail.transform === 'uppercase' && rail.size === '13px' && rail.spacing === '1.3px',
    `S1: the items are ${rail.size}, ${rail.spacing}, ${rail.transform}; expected 13px, 1.3px, uppercase`,
  );
  step('S1: brand bar 64 and section bar 48, the items home, search, read, research, about');

  // --- L2, L3, L7 --------------------------------------------------------------------------------------
  const primary = await boxOf(wide, 'hero-cta-primary');
  const secondary = await boxOf(wide, 'hero-cta-secondary');
  expect(
    primary.height >= 44 && secondary.height >= 44,
    `L2: the hero buttons are ${primary.height} and ${secondary.height} high`,
  );
  const doors = await wide.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="door-"]')]
      .filter((element) => element.getBoundingClientRect().width > 0)
      .map((element) => ({
        id: element.getAttribute('data-testid'),
        width: element.getBoundingClientRect().width,
        href: element.getAttribute('href'),
      })),
  );
  expect(
    doors.length === 2 && Math.abs(doors[0].width - doors[1].width) <= 2,
    `L3: the doors are ${JSON.stringify(doors)}: two of equal width were expected`,
  );
  expect(
    doors.every((door) => door.href),
    'L3: a door is not a link',
  );
  const band = await boxOf(wide, 'transparency-band');
  expect(band.height > 100, `L7: the transparency band is ${band.height} px high`);
  expect(
    (await shown(wide, 'transparency-cta').getAttribute('href'))?.endsWith('/about/transparency'),
    'L7: the button of the transparency band does not go to /about/transparency',
  );
  await boxOf(wide, 'beta-band');
  await shown(wide, 'hero-cta-secondary').click();
  await wide.waitForURL(/\/ask$/);
  step(
    'L2, L3, L7: the second hero button goes to /ask, there are two doors of one width, the transparency band is there with its button',
  );

  // --- G13: every item and entry of the bar lands on a screen with an h1 -------------------------------
  const landed = [];
  const keys = ['home', 'search', 'read', 'research', 'about'];
  for (const key of keys) {
    await open(wide, base, '/', 'doors');
    const item = shown(wide, `section-item-${key}`);
    const isLink =
      (await item.getAttribute('role')) === 'link' ||
      (await item.evaluate((el) => el.tagName)) === 'A';
    if (isLink) {
      await item.click();
      await wide.waitForTimeout(400);
      landed.push(new URL(wide.url()).pathname);
      expect(
        (await visibleH1(wide)).length >= 1 &&
          !/nu a fost găsită|not found/i.test(await wide.locator('body').innerText()),
        `G13: the item "${key}" lands on a screen with no h1, or on "not found"`,
      );
      continue;
    }
    await item.click();
    const entries = await wide.evaluate(
      (drawerKey) =>
        [...document.querySelectorAll(`[data-testid^="drawer-entry-${drawerKey}-"]`)]
          .filter((element) => element.getBoundingClientRect().width > 0)
          .map((element) => element.getAttribute('data-testid')),
      key,
    );
    expect(entries.length > 0, `G13: the drawer of "${key}" has no entries`);
    for (const entry of entries) {
      await open(wide, base, '/', 'doors');
      await shown(wide, `section-item-${key}`).click();
      await shown(wide, entry).click();
      await wide.waitForTimeout(400);
      landed.push(new URL(wide.url()).pathname);
      const text = await wide.locator('body').innerText();
      expect(
        (await visibleH1(wide)).length >= 1 && !/pagină negăsită|page not found/i.test(text),
        `G13: the entry "${entry}" lands on a screen with no h1, or on "not found"`,
      );
    }
  }
  step(
    `G13: every item and every entry of the bar (${landed.join(', ')}) lands on a screen with an h1`,
  );
  await desktop.context.close();

  // --- S2, S4: the phone ------------------------------------------------------------------------------------
  const phone = await newPage(browser, {
    viewport: PHONE,
    timeout,
    problems,
    label: 'beta1 phone',
    hasTouch: true,
  });
  const small = phone.page;
  await open(small, base, '/', 'doors');
  const scroller = await small.evaluate(() => {
    const element = document.querySelector('[data-testid="section-bar-scroll"]');
    const first = ['home', 'search', 'read'].map((key) =>
      document.querySelector(`[data-testid="section-item-${key}"]`).getBoundingClientRect(),
    );
    return {
      content: element.scrollWidth,
      window: element.clientWidth,
      firstThreeEnd: Math.max(...first.map((box) => box.right)),
      fade: !!document.querySelector('[data-testid="section-bar-fade"]'),
      pageWidth: document.documentElement.scrollWidth <= innerWidth,
    };
  });
  expect(
    scroller.content > scroller.window,
    `S2: the bar of five items does not scroll sideways (${scroller.content} in ${scroller.window})`,
  );
  expect(
    scroller.firstThreeEnd <= PHONE.width,
    `S2: the first three items end at ${scroller.firstThreeEnd}, past the window (${PHONE.width})`,
  );
  expect(scroller.fade, 'S2: no edge fade on a bar that scrolls');
  expect(scroller.pageWidth, 'S2: the page scrolls sideways on a phone');
  // S4: the panel of "Cercetare" on a phone, the entries pressed after one navigation.
  await shown(small, 'section-item-search').click();
  await small.waitForURL(/\/search$/);
  await shown(small, 'section-item-research').click();
  const panel = await boxOf(small, 'section-drawer-research');
  expect(panel.width >= PHONE.width - 2, `S4: the panel of "Cercetare" is ${panel.width} wide`);
  await shown(small, 'drawer-entry-research-ask').click();
  await small.waitForURL(/\/ask$/);
  expect((await visibleH1(small)).length >= 1, 'G13: /ask has no h1');
  step(
    'S2, S4: the phone bar scrolls with an edge fade and the first three items in view; a panel entry follows its link',
  );
  await phone.context.close();
}

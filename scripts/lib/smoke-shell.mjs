// The checks of docs/ui-spec-v2.md section 20 that need a real browser and are about the shell, the
// landing and the library (S1, S3, S5, S6, S8; L2, L5, L6; B2, B3, B4, B9; Q1; L8): geometry, the
// drawer with its keys, the language, the sticky bar, the filters in the address, the shortcut and
// the app offline. smoke-web.mjs calls `shellChecks` after its own reading flow.

/* global document, getComputedStyle, innerWidth, location -- evaluated inside the browser page */

export const DESKTOP = { width: 1366, height: 900 };
export const PHONE = { width: 390, height: 844 };

/** Fails the smoke test with a message when `condition` is false. */
export function expect(condition, message) {
  if (!condition) throw new Error(message);
}

/** Only what is on screen: a screen that was left stays mounted under the next one, hidden. */
export const shown = (page, testId) => page.locator(`[data-testid="${testId}"]:visible`).first();

/** The box of what is on screen with this test id. */
export async function boxOf(page, testId) {
  const box = await shown(page, testId).boundingBox();
  expect(box, `"${testId}" is not on screen`);
  return box;
}

export const normal = (text) => text.replace(/\s+/g, ' ').trim();

/** The visible text of an element as the reader sees it (capitals applied). */
export const textOf = async (page, testId) => normal(await shown(page, testId).innerText());

export async function open(page, base, path, readyTestId) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
  await shown(page, readyTestId).waitFor({ state: 'visible' });
  await page.waitForTimeout(250);
}

/**
 * Runs the checks in two fresh browser contexts (desktop and phone). `step` logs a line; a failed
 * check throws, and smoke-web.mjs reports it with a screenshot of `page`.
 */
export async function shellChecks({ browser, origin, basePath, timeout, step, problems }) {
  const base = `${origin}${basePath}`;

  const desktop = await browser.newContext({ locale: 'ro-RO', viewport: DESKTOP });
  const wide = await desktop.newPage();
  wide.setDefaultTimeout(timeout);
  wide.on('pageerror', (error) => problems.push(`page error (desktop): ${error.message}`));

  // --- S1: the two bars -------------------------------------------------------------------------
  await open(wide, base, '/', 'doors');
  const brand = await boxOf(wide, 'brand-bar');
  const section = await boxOf(wide, 'section-bar');
  expect(Math.abs(brand.height - 65) <= 2, `S1: the brand bar is ${brand.height} px high, not 64`);
  expect(
    Math.abs(section.height - 49) <= 2,
    `S1: the section bar is ${section.height} px high, not 48`,
  );
  expect(
    Math.abs(section.y - (brand.y + brand.height)) <= 1,
    'S1: the section bar is not right under the brand bar',
  );
  const items = await wide.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="section-item-"]')]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => el.getAttribute('data-testid').replace('section-item-', '')),
  );
  expect(
    items.join() === 'home,search,read,about',
    `S1: the bar has ${items.join()}, expected home,search,read,about`,
  );
  const rail = await wide.evaluate(() => {
    const style = getComputedStyle(document.querySelector('[data-testid="section-item-search"] *'));
    return { transform: style.textTransform, size: style.fontSize };
  });
  expect(
    rail.transform === 'uppercase' && rail.size === '13px',
    `S1: the items are ${rail.size} ${rail.transform}, expected 13px uppercase`,
  );
  step('S1: brand bar 64 + section bar 48, items home, search, read, about');

  // --- L2, L6: the landing -----------------------------------------------------------------------
  const shelfLinks = await wide.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="shelf-card-"]')]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => el.getAttribute('href')),
  );
  expect(
    shelfLinks.length > 0 &&
      shelfLinks.every((href) => /\/library\/all\?shelf=[a-z-]+$/.test(href ?? '')),
    `L6: the shelf cards link to ${shelfLinks.join()}`,
  );
  await shown(wide, 'hero-cta-primary').click();
  await wide.waitForURL(/\/library$/);
  step('L2, L6: the hero button goes to /library; the shelf cards link to /library/all?shelf=');

  // --- S3, S5: the drawer ----------------------------------------------------------------------
  await open(wide, base, '/library/all', 'library-count');
  const read = shown(wide, 'section-item-read');
  expect(
    (await read.getAttribute('aria-current')) === 'true',
    'S5: "Citește" is not the current item on /library/all',
  );
  const started = await wide.evaluate(() => performance.now());
  await read.click();
  await wide.waitForFunction(
    () =>
      document.querySelector('[data-testid="section-item-read"]:not([aria-expanded="false"])') !==
      null,
    null,
    { timeout: 400 },
  );
  expect(
    (await wide.evaluate(() => performance.now())) - started < 400,
    'S3: the drawer took more than 400 ms',
  );
  await shown(wide, 'section-drawer-read').waitFor({ state: 'visible' });
  const entries = await wide.locator('[data-testid^="drawer-entry-read-"]:visible').count();
  expect(entries === 3, `S3: the drawer has ${entries} entries, not 3`);
  const currentEntry = await shown(wide, 'drawer-entry-read-library-all').getAttribute(
    'aria-current',
  );
  expect(
    currentEntry === 'page',
    `S5: the entry "Toată biblioteca" is aria-current="${currentEntry}"`,
  );
  expect((await textOf(wide, 'section-caret-read')) === '‹', 'S3: the caret did not flip');
  await wide.keyboard.press('Escape');
  await wide.waitForFunction(
    () =>
      document.querySelector('[data-testid="section-item-read"][aria-expanded="true"]') === null,
  );
  const focused = await wide.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  expect(
    focused === 'section-item-read',
    `S3: after Esc the focus is on "${focused}", not on the toggle`,
  );
  // A press outside the bar closes it, too.
  await read.click();
  await shown(wide, 'section-drawer-read').waitFor({ state: 'visible' });
  await wide.mouse.click(40, 700);
  await wide.waitForFunction(
    () =>
      document.querySelector('[data-testid="section-item-read"][aria-expanded="true"]') === null,
  );
  // ArrowRight moves to the next item of the bar.
  await shown(wide, 'section-item-search').focus();
  await wide.keyboard.press('ArrowRight');
  const next = await wide.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  expect(next === 'section-item-read', `S3: ArrowRight moved the focus to "${next}"`);
  step(
    'S3, S5: the drawer opens in < 400 ms, has 3 entries, marks the current page, closes with Esc (focus back) and outside; ArrowRight moves',
  );

  // --- B2, B3, B4, Q1: the library -----------------------------------------------------------------
  const count = await textOf(wide, 'library-count');
  expect(
    /^\d+ (lucrare|lucrări|de lucrări) în toată biblioteca$/i.test(count),
    `B2: the count line reads "${count}"`,
  );
  await shown(wide, 'library-search').fill('vos');
  await wide.waitForFunction(() =>
    /CU „VOS”/i.test(
      document.querySelector('[data-testid="library-count"]:not([style*="display: none"])')
        ?.textContent ?? '',
    ),
  );
  const named = await textOf(wide, 'library-count');
  expect(
    /^1 lucrare cu „vos” în toată biblioteca$/i.test(named),
    `B3: the count line reads "${named}"`,
  );
  const letters = await wide.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="az-"]')]
      .filter(
        (el) => el.getBoundingClientRect().width > 0 && el.getAttribute('data-testid') !== 'az-all',
      )
      .map((el) => el.getAttribute('data-testid').replace('az-', ''))
      .filter((id) => /^[A-Z#]$/.test(id)),
  );
  expect(letters.join() === 'V', `B3: the A-Z bar lists ${letters.join()}, expected V`);
  expect(
    await wide.evaluate(() =>
      [...document.querySelectorAll('[data-testid^="library-row-"]')].some(
        (row) => row.getBoundingClientRect().width > 0,
      ),
    ),
    'B3: the matching work is not listed',
  );
  await shown(wide, 'library-search-clear').click();
  await wide.waitForFunction(() => !location.search.includes('q='));
  // B4: the century is in the address, defaults are not, and a reload restores it.
  await shown(wide, 'filter-century').click();
  await wide.locator('[data-testid="filter-century-option-20"]:visible').first().click();
  await wide.waitForFunction(() => location.search === '?century=20');
  expect(
    (await textOf(wide, 'library-count')).toLowerCase().includes('secolul al xx-lea'),
    'B4: the count line does not name the century',
  );
  await wide.reload({ waitUntil: 'domcontentloaded' });
  await shown(wide, 'library-count').waitFor({ state: 'visible' });
  expect(
    (await textOf(wide, 'library-count')).toLowerCase().includes('secolul al xx-lea'),
    'B4: the century is not restored after a reload',
  );
  expect(
    new URL(wide.url()).search === '?century=20',
    `B4: the address is ${new URL(wide.url()).search}`,
  );
  step(
    'B2, B3, B4: count line, search by name (1 lucrare cu „vos”, letter V), ?century=20 restored after a reload, no default in the address',
  );

  // Q1: "/" focuses the field of the library page, and opens the search from the landing.
  await wide.locator('body').click({ position: { x: 5, y: 450 } });
  await wide.keyboard.press('/');
  const slashFocus = await wide.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  expect(slashFocus === 'library-search', `Q1: "/" focused "${slashFocus}" on the library`);
  await open(wide, base, '/', 'doors');
  await wide.locator('body').click({ position: { x: 5, y: 450 } });
  await wide.keyboard.press('/');
  await wide.waitForURL(/\/search$/);
  step('Q1: "/" focuses the field of the library and opens the search from the landing');

  // --- S8: the section bar is sticky ----------------------------------------------------------------
  await open(wide, base, '/', 'doors');
  await wide.mouse.move(700, 500);
  await wide.mouse.wheel(0, 600);
  await wide.waitForTimeout(400);
  const scrolled = await wide.evaluate(() => {
    const top = (id) =>
      [...document.querySelectorAll(`[data-testid="${id}"]`)]
        .find((el) => el.getBoundingClientRect().height > 0)
        ?.getBoundingClientRect();
    return { brand: top('brand-bar')?.bottom ?? null, section: top('section-bar')?.top ?? null };
  });
  expect(
    scrolled.brand !== null && scrolled.brand <= 1,
    `S8: after scrolling 600 px the brand bar ends at ${scrolled.brand}`,
  );
  expect(
    scrolled.section !== null && Math.abs(scrolled.section) <= 1,
    `S8: the section bar is at y = ${scrolled.section}`,
  );
  step('S8: after 600 px the brand bar has scrolled away and the section bar is at y = 0');

  // --- S6: the interface language ---------------------------------------------------------------------
  await shown(wide, 'language-en').click();
  await wide.waitForFunction(() => document.documentElement.lang === 'en');
  expect(
    (await textOf(wide, 'section-item-read')).startsWith('READ'),
    'S6: "Citește" did not become "READ"',
  );
  await wide.reload({ waitUntil: 'domcontentloaded' });
  await shown(wide, 'section-item-read').waitFor({ state: 'visible' });
  expect(
    (await textOf(wide, 'section-item-read')).startsWith('READ'),
    'S6: the language did not persist after a reload',
  );
  expect(
    (await wide.evaluate(() => document.documentElement.lang)) === 'en',
    'S6: html[lang] is not "en" after a reload',
  );
  await shown(wide, 'language-ro').click();
  step('S6: RO to EN changes CITEȘTE to READ and html[lang], and persists after a reload');

  // --- L8: offline, navigating inside the app ---------------------------------------------------------
  await open(wide, base, '/', 'doors');
  await desktop.setOffline(true);
  try {
    await shown(wide, 'section-item-read').click();
    await shown(wide, 'drawer-entry-read-library-all').click();
    await wide.waitForURL(/\/library\/all$/);
    await wide.locator('a[href*="/work/"]:visible').first().waitFor({ state: 'visible' });
    await wide.locator('a[href*="/work/"]:visible').first().click();
    await wide.locator('a[href*="/read/"]:visible').first().click();
    await wide.waitForFunction(() =>
      [...document.querySelectorAll('[role="progressbar"][aria-valuenow]')].some(
        (el) => el.getBoundingClientRect().width > 0,
      ),
    );
  } finally {
    await desktop.setOffline(false);
  }
  step('L8: offline, the landing, the library, a work and the reader render');
  await desktop.close();

  // --- S2, S4, L5, B9: the phone ------------------------------------------------------------------------
  const phone = await browser.newContext({ locale: 'ro-RO', viewport: PHONE });
  const small = await phone.newPage();
  small.setDefaultTimeout(timeout);
  small.on('pageerror', (error) => problems.push(`page error (phone): ${error.message}`));
  await open(small, base, '/', 'doors');
  const phoneSection = await boxOf(small, 'section-bar');
  expect(
    Math.abs(phoneSection.height - 45) <= 2,
    `S2: the section bar is ${phoneSection.height} px high on a phone, not 44`,
  );
  expect(
    await small.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'S2: the page scrolls sideways on a phone',
  );
  const cardHeight = (await boxOf(small, 'work-card-vos-1903-kingdom')).height;
  expect(cardHeight <= 140, `L5: the work card is ${cardHeight} px high on a phone, over 140`);
  await shown(small, 'section-item-read').click();
  const panel = await boxOf(small, 'section-drawer-read');
  expect(
    Math.abs(panel.y - (phoneSection.y + phoneSection.height)) <= 2,
    `S4: the panel starts at ${panel.y}, the bar ends at ${phoneSection.y + phoneSection.height}`,
  );
  const rows = await small.evaluate(() =>
    [
      ...document.querySelectorAll(
        '[data-testid="section-drawer-read"] [data-testid^="drawer-entry-read-"]',
      ),
    ]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => Math.round(el.getBoundingClientRect().height)),
  );
  expect(
    rows.length === 3 && rows.every((height) => height >= 47 && height <= 50),
    `S4: the panel rows are ${rows.join()} px high, expected 48`,
  );
  expect(
    await small.evaluate(
      () =>
        document.querySelector(
          '[data-testid="section-bar"]:not([style*="display: none"]) [data-testid="section-drawer-read"]',
        ) !== null,
    ),
    'S4: the panel is not a child of the bar',
  );
  expect(
    panel.width >= PHONE.width - 2,
    `S4: the panel is ${panel.width} px wide, not the width of the window`,
  );
  step('S2, S4, L5: phone section bar 44, panel under it with 3 rows of 48, work card 140 or less');
  await open(small, base, '/library/all', 'library-count');
  const shelf = await boxOf(small, 'filter-shelf');
  const century = await boxOf(small, 'filter-century');
  const panelBox = await boxOf(small, 'filter-panel');
  expect(
    Math.abs(shelf.x - century.x) <= 1 && century.y > shelf.y + shelf.height - 1,
    'B9: the filters are not stacked',
  );
  expect(
    shelf.width >= panelBox.width - 44,
    `B9: the filter is ${shelf.width} px wide in a ${panelBox.width} px panel`,
  );
  expect(
    await small.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'B9: the library scrolls sideways on a phone',
  );
  step('B9: on a phone the filters are stacked and full width');
  await phone.close();
}

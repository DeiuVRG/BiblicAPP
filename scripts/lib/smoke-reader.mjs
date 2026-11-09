// The checks of docs/ui-spec-v2.md section 20.4 that need a real browser and are about the work hub,
// the reader and the transparency panel (W1-W7, R1-R12, R13 in part, R15, R18, R19, T1, T2, T4, T5):
// geometry, type, the panels, the keys, the two lanes, the language, the place that is kept. Each group
// opens a fresh browser context (empty storage), so one group never leaves its settings to the next.
// smoke-web.mjs calls `readerChecks` after the checks of the shell.

/* global document, getComputedStyle, innerHeight, innerWidth, location -- evaluated inside the browser page */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { DESKTOP, PHONE, boxOf, expect, open, shown, textOf } from './smoke-shell.mjs';

/** The colours of a palette of apps/mobile/src/theme/palettes.ts as [r, g, b] (the file is the source of truth). */
function palette(name) {
  const source = readFileSync(
    fileURLToPath(new URL('../../apps/mobile/src/theme/palettes.ts', import.meta.url)),
    'utf8',
  );
  const block = new RegExp(`\\b${name}:\\s*\\{([^}]*)\\}`).exec(source);
  if (!block) throw new Error(`palette "${name}" not found`);
  const colours = {};
  for (const [, token, hex] of block[1].matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)) {
    const n = Number.parseInt(hex.slice(1), 16);
    colours[token] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return colours;
}

/** The first leaf with text of its own at or under the element: the box that carries the type. */
const leafOf = (page, selector) =>
  page.evaluate((query) => {
    const element = [...document.querySelectorAll(query)].find((node) => {
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });
    if (!element) return null;
    const leaf =
      [element, ...element.querySelectorAll('*')].find((node) =>
        [...node.childNodes].some((child) => child.nodeType === 3 && child.textContent.trim()),
      ) ?? element;
    const style = getComputedStyle(leaf);
    return {
      family: style.fontFamily,
      size: parseFloat(style.fontSize),
      lineHeight: style.lineHeight === 'normal' ? null : parseFloat(style.lineHeight),
      weight: style.fontWeight,
      transform: style.textTransform,
      colour: style.color,
      text: leaf.textContent.trim(),
    };
  }, selector);

/** "rgb(238, 231, 217)" or "rgba(…)" to [r, g, b]. */
const rgb = (value) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
const within = (a, b, units) => a.every((channel, index) => Math.abs(channel - b[index]) <= units);

/** The ids of the work and of the sections of the first edition: from the first chapter link on the hub. */
async function discover(browser, base) {
  const context = await browser.newContext({ locale: 'ro-RO', viewport: DESKTOP });
  const page = await context.newPage();
  await open(page, base, '/library/all', 'library-count');
  const workHref = await page.locator('a[href*="/work/"]:visible').first().getAttribute('href');
  const workPath = new URL(workHref, `${base}/`).pathname.replace(
    new URL(base).pathname.replace(/\/$/, ''),
    '',
  );
  await page.goto(`${base}${workPath}`, { waitUntil: 'domcontentloaded' });
  await shown(page, 'work-card').waitFor({ state: 'visible' });
  const first = await page.locator('a[href*="/read/"]:visible').first().getAttribute('href');
  await context.close();
  const [, , workId, sectionId] = new URL(first, `${base}/`).pathname
    .replace(new URL(base).pathname.replace(/\/$/, ''), '')
    .split('/');
  return { workPath, workId, sectionId, readPath: `/read/${workId}/${sectionId}` };
}

/** A fresh desktop or phone context, with a settings record when asked. */
async function fresh(browser, viewport, { settings, scheme = 'light', reducedMotion } = {}) {
  const context = await browser.newContext({
    locale: 'ro-RO',
    viewport,
    colorScheme: scheme,
    ...(reducedMotion ? { reducedMotion } : null),
  });
  if (settings) {
    await context.addInitScript(
      ([key, value]) => {
        try {
          if (!localStorage.getItem(key)) localStorage.setItem(key, value);
        } catch {
          /* storage unavailable */
        }
      },
      ['biblioteca:settings:v1', JSON.stringify(settings)],
    );
  }
  const page = await context.newPage();
  return { context, page };
}

export async function readerChecks({ browser, origin, basePath, timeout, step, problems }) {
  const base = `${origin}${basePath}`;
  const { workPath, readPath } = await discover(browser, base);
  const watch = (page, label) => {
    page.setDefaultTimeout(timeout);
    page.on('pageerror', (error) => problems.push(`page error (${label}): ${error.message}`));
  };

  // ===== The work hub, 1366 x 900 ================================================================
  {
    const { context, page } = await fresh(browser, DESKTOP);
    watch(page, 'work hub');
    await open(page, base, workPath, 'work-card');

    // W1: the card
    const title = await leafOf(page, '[data-testid="work-title"]');
    expect(
      /IM.?Fell.?Great.?Primer/i.test(title.family),
      `W1: the title is set in ${title.family}, not IM Fell Great Primer`,
    );
    expect(
      title.size === 34 && title.lineHeight === 40,
      `W1: the title is ${title.size}/${title.lineHeight} at 1366, not 34/40`,
    );
    expect((await textOf(page, 'stat-sections')).length > 0, 'W1: no figure for the sections');
    const sections = await page.locator('[data-testid^="contents-row-"]:visible').count();
    const tile = await textOf(page, 'stat-sections');
    expect(
      tile.includes(String(sections)) || sections === 0,
      `W1: the tile says "${tile}" for ${sections} sections`,
    );
    expect(/\d/.test(await textOf(page, 'stat-words')), 'W1: the words tile has no number');
    step('W1: the title is IM Fell Great Primer 34/40; the tiles carry the sections and the words');

    // W3: the transparency row opens the panel of the reader
    expect((await textOf(page, 'status-chip')).length > 0, 'W3: the status chip is empty');
    await shown(page, 'transparency-open').click();
    await shown(page, 'transparency-panel').waitFor({ state: 'visible' });
    await shown(page, 'transparency-lead').waitFor({ state: 'visible' });
    await page.waitForTimeout(400); // the focus goes into the dialog once it has opened
    await page.keyboard.press('Escape');
    await shown(page, 'transparency-panel').waitFor({ state: 'hidden' });
    step('W3: "Detalii" opens the transparency panel, Esc closes it');

    // W4: a first visit starts the work, and the other buttons
    const start = await textOf(page, 'work-cta-start');
    expect(
      /Începe lectura/i.test(start),
      `W4: the first visit says "${start}", not "Începe lectura"`,
    );
    const lanes = shown(page, 'work-cta-lanes');
    expect(
      /[?&]pair=/.test((await lanes.getAttribute('href')) ?? ''),
      'W4: "Citește în două limbi" does not open the reader with pair=',
    );
    expect(
      (await page.locator('[data-testid="work-cta-ask"]:visible').count()) === 0,
      'W4: "Întreabă" is offered although Ask is not delivered',
    );

    // W5: "Prezentare" is the current tab (600, a 2 px underline in `accent`), and the strip of tabs
    // sticks under the section bar once the page is scrolled
    const tabLook = (testId) =>
      page.evaluate((id) => {
        const tabEl = [...document.querySelectorAll(`[data-testid="${id}"]`)].find(
          (el) => el.getBoundingClientRect().width > 0,
        );
        if (!tabEl) return null;
        const parts = [tabEl, ...tabEl.querySelectorAll('*')];
        const label = parts.find(
          (node) =>
            node.getBoundingClientRect().height > 0 &&
            [...node.childNodes].some((child) => child.nodeType === 3 && child.textContent.trim()),
        );
        const line = parts.find((node) => {
          const box = node.getBoundingClientRect();
          return (
            Math.round(box.height) === 2 &&
            box.width > 0 &&
            getComputedStyle(node).backgroundColor !== 'rgba(0, 0, 0, 0)'
          );
        });
        return {
          // (A weight of the app's faces is part of the family name: SourceSerif4_600SemiBold.)
          family: label ? getComputedStyle(label).fontFamily : '',
          underline: line ? getComputedStyle(line).backgroundColor : null,
        };
      }, testId);
    const current = await tabLook('tab-overview');
    const other = await tabLook('tab-contents');
    expect(
      current && /600|SemiBold/.test(current.family) && current.underline !== null,
      `W5: the current tab is ${JSON.stringify(current)}, expected 600 with a 2 px underline`,
    );
    expect(
      other && !/600|SemiBold/.test(other.family) && other.underline === null,
      `W5: the other tab is ${JSON.stringify(other)}, expected a regular face and no underline`,
    );
    await shown(page, 'tab-contents').click();
    // (The strip starts 733 px down a 900 px window: it meets the section bar after about 690 px, so
    // the page is scrolled 900, not 600, to be sure that it has stuck.)
    await page.mouse.move(700, 500);
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(400);
    const strip = await boxOf(page, 'work-tabs-sticky');
    const bar = await boxOf(page, 'section-bar');
    expect(
      Math.abs(strip.y - (bar.y + bar.height)) <= 1.5,
      `W5: the tab strip is at ${strip.y}, the section bar ends at ${bar.y + bar.height}`,
    );
    step(
      'W5: "Prezentare" is 600 with a 2 px underline; after scrolling the strip sits under the section bar',
    );

    // W6: the contents
    const rows = page.locator('[data-testid^="contents-row-"]:visible');
    expect((await rows.count()) > 0, 'W6: no contents rows');
    const numeral = await page.evaluate(() => {
      const row = [...document.querySelectorAll('[data-testid^="contents-row-"]')].find(
        (el) => el.getBoundingClientRect().width > 0,
      );
      // The row holds one line: the numeral column, then the title.
      const cell = row?.firstElementChild?.firstElementChild;
      if (!cell) return null;
      const box = cell.getBoundingClientRect();
      const leaf = [cell, ...cell.querySelectorAll('*')].find((node) =>
        [...node.childNodes].some((child) => child.nodeType === 3 && child.textContent.trim()),
      );
      const style = getComputedStyle(leaf ?? cell);
      return { width: box.width, family: style.fontFamily, size: parseFloat(style.fontSize) };
    });
    expect(
      numeral &&
        Math.abs(numeral.width - 44) <= 1 &&
        /600|SemiBold/.test(numeral.family) &&
        numeral.size >= 15,
      `W6: the numeral column is ${JSON.stringify(numeral)}, expected 44 wide, 600, 15 or more`,
    );
    step('W6: the numeral column is 44 wide, the numerals are 600 and 15 or more');
    await context.close();
  }

  // ===== The work hub on a phone ==================================================================
  {
    const { context, page } = await fresh(browser, PHONE);
    watch(page, 'work hub, phone');
    await open(page, base, workPath, 'work-card');
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(sideways <= 0, `W7: the phone page scrolls sideways by ${sideways} px`);
    const startBox = await boxOf(page, 'work-cta-start');
    const lanesBox = await boxOf(page, 'work-cta-lanes');
    expect(
      lanesBox.y >= startBox.y + startBox.height - 1 && Math.abs(lanesBox.x - startBox.x) <= 1,
      'W7: the actions do not stack',
    );
    expect(
      Math.abs(startBox.width - (PHONE.width - 2 * startBox.x)) <= 2,
      `W7: the primary button is ${startBox.width} wide at ${startBox.x}, not full width`,
    );
    step('W7: on a phone the actions stack and the primary button is full width');
    await context.close();
  }

  await readerDesktopChecks({ browser, base, readPath, workPath, watch, step });
  await readerLinkChecks({ browser, base, readPath, watch, step });
  await readerLaneChecks({ browser, base, readPath, watch, step });
  await readerPhoneChecks({ browser, base, readPath, watch, step });
}

// ---------------------------------------------------------------------------------------------------
// helpers of the reader groups

const READY = 'reader-toolbar';

/** Opens a reader address and waits until its first paragraphs are drawn. */
async function openReader(page, base, path) {
  await open(page, base, path, READY);
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('[data-testid^="paragraph-"]')].filter(
        (el) => el.getBoundingClientRect().height > 0,
      ).length >= 2,
  );
  await page.waitForTimeout(300);
}

/** The first paragraph whose bottom is below the toolbar: where the reader is, as its ids and place. */
const firstInView = (page) =>
  page.evaluate(() => {
    const toolbar = [...document.querySelectorAll('[data-testid="reader-toolbar"]')].find(
      (el) => el.getBoundingClientRect().height > 0,
    );
    const top = toolbar ? toolbar.getBoundingClientRect().bottom : 0;
    const paragraphs = [...document.querySelectorAll('[data-testid^="paragraph-"]')].filter(
      (el) => el.getBoundingClientRect().height > 0,
    );
    const index = paragraphs.findIndex((el) => el.getBoundingClientRect().bottom > top + 4);
    const el = paragraphs[index];
    return el
      ? {
          index,
          paragraphId: el.getAttribute('data-paragraph-id'),
          sourceId: el.getAttribute('data-source-id'),
          y: Math.round(el.getBoundingClientRect().top),
        }
      : null;
  });

/** Scrolls the text with the wheel, the way a reader does. */
async function scrollText(page, by) {
  await page.mouse.move(700, 500);
  await page.mouse.wheel(0, by);
  await page.waitForTimeout(450);
}

const progressNow = (page) =>
  page.evaluate(() =>
    Number(
      [...document.querySelectorAll('[role="progressbar"][aria-valuenow]')]
        .find((el) => el.getBoundingClientRect().width > 0)
        ?.getAttribute('aria-valuenow'),
    ),
  );

// ---------------------------------------------------------------------------------------------------
// the reader on a desktop

async function readerDesktopChecks({ browser, base, readPath, workPath, watch, step }) {
  const light = palette('light');
  const sepia = palette('sepia');
  const { context, page } = await fresh(browser, DESKTOP);
  watch(page, 'reader, desktop');
  await openReader(page, base, readPath);

  // R1: the zones
  const toolbar = await boxOf(page, 'reader-toolbar');
  expect(
    Math.abs(toolbar.height - 67) <= 1,
    `R1: the toolbar is ${toolbar.height} px high, not 67`,
  );
  const outline = await boxOf(page, 'outline-panel');
  expect(
    Math.abs(outline.width - 300) <= 1,
    `R1: the outline panel is ${outline.width} px wide, not 300`,
  );
  const type = await leafOf(page, '[data-testid^="paragraph-"]');
  const paragraphBox = await page
    .locator('[data-testid^="paragraph-"]:visible')
    .first()
    .boundingBox();
  expect(
    paragraphBox.width <= 37 * type.size + 2,
    `R1: a paragraph is ${paragraphBox.width} px wide, more than 37 em of ${type.size} px`,
  );
  step('R1: toolbar 67, outline panel 300, a column of 37 em at most');

  // R3: the type of a fresh profile
  expect(/SourceSerif4/.test(type.family), `R3: the text is set in ${type.family}`);
  expect(type.size === 20, `R3: the text is ${type.size} px at 1366, not 20`);
  expect(
    Math.abs(type.lineHeight / type.size - 1.55) <= 0.02,
    `R3: the line height is ${type.lineHeight / type.size} of the size, not 1.55`,
  );
  step('R3: Source Serif 4 at 20 px, line height 1.55');

  // R2: the order of the controls, each 36 high and named
  const order = [
    'outline-toggle',
    'reader-title',
    'reader-previous',
    'reader-next',
    'reader-counter',
    'transparency-button',
    'reader-language',
    'find-button',
    'aa-button',
    'tools-button',
  ];
  let lastX = -1;
  for (const id of order) {
    const box = await boxOf(page, id);
    expect(box.x > lastX - 1, `R2: "${id}" is not to the right of the control before it`);
    lastX = box.x;
    if (id !== 'reader-title' && id !== 'reader-counter' && id !== 'reader-language') {
      expect(Math.abs(box.height - 36) <= 1, `R2: "${id}" is ${box.height} px high, not 36`);
    }
    if (id !== 'reader-title') {
      const named = await page.evaluate((testId) => {
        const el = [...document.querySelectorAll(`[data-testid="${testId}"]`)].find(
          (node) => node.getBoundingClientRect().width > 0,
        );
        return Boolean(el && (el.getAttribute('aria-label') || el.textContent?.trim()));
      }, id);
      expect(named, `R2: "${id}" has no accessible name`);
    }
  }
  step('R2: the controls of the toolbar are in order, 36 high and named');

  // R4: the chapter card
  const card = await page.evaluate(() => {
    const el = [...document.querySelectorAll('[data-testid="chapter-card"]')].find(
      (node) => node.getBoundingClientRect().width > 0,
    );
    if (!el) return null;
    const style = getComputedStyle(el);
    const leaves = [el, ...el.querySelectorAll('*')].filter((node) =>
      [...node.childNodes].some((child) => child.nodeType === 3 && child.textContent.trim()),
    );
    const eyebrow = leaves.find((node) => getComputedStyle(node).textTransform === 'uppercase');
    const title = leaves.sort(
      (a, b) => parseFloat(getComputedStyle(b).fontSize) - parseFloat(getComputedStyle(a).fontSize),
    )[0];
    return {
      border: style.borderTopWidth,
      fill: style.backgroundColor,
      eyebrow: eyebrow?.textContent.trim() ?? null,
      titleSize: parseFloat(getComputedStyle(title).fontSize),
      titleFamily: getComputedStyle(title).fontFamily,
    };
  });
  expect(card && card.eyebrow, 'R4: the chapter card has no uppercase eyebrow');
  expect(card.border === '1px', `R4: the card has a ${card.border} border, not 1px`);
  expect(
    within((card.fill.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number), light.surface, 1),
    `R4: the card is filled ${card.fill}, not \`surface\``,
  );
  expect(
    Math.abs(card.titleSize - 1.42 * type.size) <= 1 && /600|SemiBold/.test(card.titleFamily),
    `R4: the card title is ${card.titleSize} px in ${card.titleFamily}, expected ${1.42 * type.size} in 600`,
  );
  step(
    `R4: the chapter card has the eyebrow "${card.eyebrow}", a 1 px border, \`surface\`, a title of 1.42 em in 600`,
  );

  // R5: the outline
  expect((await shown(page, 'outline-tab-contents').count()) === 1, 'R5: no tab "Cuprins"');
  expect((await shown(page, 'outline-search').count()) === 1, 'R5: no search field in the outline');
  const count = await textOf(page, 'outline-count');
  expect(/^\d+ intrări în cuprins$/i.test(count), `R5: the count line says "${count}"`);
  const currentEntry = page.locator(
    '[data-testid^="outline-entry-"][aria-current="location"]:visible',
  );
  expect((await currentEntry.count()) === 1, 'R5: no current entry (aria-current="location")');
  const entryLook = await currentEntry.first().evaluate((el) => {
    const parts = [el, ...el.querySelectorAll('*')];
    const bar = parts.find((node) => {
      const box = node.getBoundingClientRect();
      const bg = getComputedStyle(node).backgroundColor;
      return Math.round(box.width) === 2 && box.height > 8 && bg !== 'rgba(0, 0, 0, 0)';
    });
    const label = parts.find((node) =>
      [...node.childNodes].some((child) => child.nodeType === 3 && child.textContent.trim()),
    );
    return {
      family: getComputedStyle(label ?? el).fontFamily,
      bar: bar ? getComputedStyle(bar).backgroundColor : null,
    };
  });
  expect(
    /600|SemiBold/.test(entryLook.family) && entryLook.bar !== null,
    `R5: the current entry is ${JSON.stringify(entryLook)}, expected 600 with a 2 px bar`,
  );
  const before = await page.locator('[data-testid^="outline-entry-"]:visible').count();
  await shown(page, 'outline-search').fill('Împărăția');
  await page.waitForTimeout(300);
  const after = await page.locator('[data-testid^="outline-entry-"]:visible').count();
  expect(
    after > 0 && after < before,
    `R5: typing in the outline left ${after} of ${before} entries`,
  );
  await shown(page, 'outline-search').fill('');
  step(
    'R5: the outline has its tab, its search, its count line and a current entry; typing filters',
  );

  // R9: the transparency dialog
  const button = await textOf(page, 'transparency-button');
  expect(/^Transparență AI$/i.test(button), `R9: the button reads "${button}"`);
  await shown(page, 'transparency-button').click();
  const dialog = await boxOf(page, 'transparency-panel');
  expect(Math.abs(dialog.width - 560) <= 2, `R9: the dialog is ${dialog.width} px wide, not 560`);
  const rows = await textOf(page, 'transparency-content');
  for (const label of ['SURSA', 'TRADUCEREA', 'VERIFICARE', 'CORECTURI']) {
    expect(rows.includes(label), `R9: the dialog has no row ${label}`);
  }
  // T1, T2: the lead of an AI translation, its review chip
  expect(
    (await textOf(page, 'transparency-lead')).includes(
      'Această traducere a fost făcută de o mașină',
    ),
    'T1: the lead is not the one of an AI translation',
  );
  expect(
    /NEVERIFICAT/i.test(await textOf(page, 'transparency-review-chip')),
    'T2: the review chip does not say "neverificată"',
  );
  // T4: the report is a mail that names the place
  const mail = decodeURIComponent(
    (await shown(page, 'transparency-report').getAttribute('href')) ?? '',
  );
  expect(
    /^mailto:/.test(mail) && /Tip/.test(mail) && /Ediție/.test(mail) && /Secțiune/.test(mail),
    `T4: the report link is not a mail with the type and the place: ${mail.slice(0, 120)}`,
  );
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await shown(page, 'transparency-panel').waitFor({ state: 'hidden' });
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  expect(focused === 'transparency-button', `R9: after Esc the focus is on "${focused}"`);
  step(
    'R9, T1, T2, T4: "Transparență AI", a dialog of 560 with its four rows, the lead and the review, the report mail; Esc gives the focus back',
  );

  // R18: the progress bar grows with the scroll
  const start = await progressNow(page);
  await scrollText(page, 1500);
  const later = await progressNow(page);
  expect(later > start, `R18: the progress is ${start} before and ${later} after scrolling`);
  step(`R18: the progress bar grows with the scroll (${start} to ${later})`);

  // R11: find
  const placeBefore = await firstInView(page);
  await page.keyboard.press('/');
  await shown(page, 'find-bar').waitFor({ state: 'visible' });
  const findFocused = await page.evaluate(() =>
    document.activeElement?.getAttribute('data-testid'),
  );
  expect(findFocused === 'find-input', `R11: "/" left the focus on "${findFocused}"`);
  await page.keyboard.type('împărăția');
  await page.waitForFunction(() =>
    /^\d+ din \d+$/.test(
      [...document.querySelectorAll('[data-testid="find-status"]')]
        .find((el) => el.getBoundingClientRect().width > 0)
        ?.textContent?.trim() ?? '',
    ),
  );
  const status = await textOf(page, 'find-status');
  expect(/^1 din [1-9]\d*$/.test(status), `R11: the find bar says "${status}"`);
  const hits = Number(status.split(' ')[2]);
  if (hits > 1) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    expect(
      (await textOf(page, 'find-status')).startsWith('2 din'),
      'R11: Enter did not move to the second hit',
    );
  }
  await page.keyboard.press('Escape');
  await shown(page, 'find-bar').waitFor({ state: 'hidden' });
  await page.waitForTimeout(500);
  const placeAfter = await firstInView(page);
  expect(
    placeBefore && placeAfter && Math.abs(placeAfter.index - placeBefore.index) <= 1,
    `R11: Esc left the reader at ${JSON.stringify(placeAfter)}, it was at ${JSON.stringify(placeBefore)}`,
  );
  step(
    `R11: "/" opens the bar with the focus, "împărăția" gives "${status}", Enter moves on, Esc puts the reader back`,
  );

  // R12: the keys
  await page.mouse.move(700, 500);
  const sectionBefore = new URL(page.url()).pathname;
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction((previous) => location.pathname !== previous, sectionBefore);
  await openReaderReady(page);
  await page.keyboard.press('[');
  await page.waitForTimeout(300);
  expect(
    (await page.locator('[data-testid="outline-panel"]:visible').count()) === 0,
    'R12: "[" did not close the outline',
  );
  await page.keyboard.press(']');
  await page.waitForTimeout(300);
  expect(
    (await page.locator('[data-testid="outline-panel"]:visible').count()) === 1,
    'R12: "]" did not open the outline',
  );
  step('R12: the right arrow opens the next chapter; [ and ] close and open the outline');

  // R10: Aa (size, spacing, face, theme)
  await shown(page, 'aa-button').click();
  await shown(page, 'typography-panel').waitFor({ state: 'visible' });
  for (let step4 = 0; step4 < 4; step4 += 1) await shown(page, 'aa-larger').click();
  await page.waitForTimeout(300);
  const larger = await leafOf(page, '[data-testid^="paragraph-"]');
  expect(larger.size === 24, `R10: size 24 gives ${larger.size} px at once`);
  await page
    .getByRole('radio', { name: /Aerisit/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  const airy = await leafOf(page, '[data-testid^="paragraph-"]');
  expect(
    Math.abs(airy.lineHeight / airy.size - 1.85) <= 0.02,
    `R10: "Aerisit" gives a line height of ${airy.lineHeight / airy.size}, not 1.85`,
  );
  await page
    .getByRole('radio', { name: /^Literata$/ })
    .first()
    .click();
  await page.waitForTimeout(500);
  const literata = await leafOf(page, '[data-testid^="paragraph-"]');
  expect(/Literata/.test(literata.family), `R10: the face is ${literata.family}, not Literata`);
  await page
    .getByRole('radio', { name: /^Sepia$/ })
    .first()
    .click();
  await page.waitForTimeout(300);
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(
    within((background.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number), sepia.background, 1),
    `R10: Sepia gives a background of ${background}`,
  );
  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openReaderReady(page);
  const kept = await leafOf(page, '[data-testid^="paragraph-"]');
  expect(
    kept.size === 24 && /Literata/.test(kept.family),
    `R10: after a reload the text is ${kept.size} px in ${kept.family}`,
  );
  step(
    'R10: size 24 at once and after a reload, "Aerisit" is 1.85, Literata changes the face, Sepia gives the background',
  );

  // R19: resume (a new context keeps the settings of this one only, so the place is its own)
  await context.close();
  {
    const { context: second, page: reader } = await fresh(browser, DESKTOP);
    watch(reader, 'reader, resume');
    await openReader(reader, base, readPath);
    await scrollText(reader, 2600);
    await reader.waitForTimeout(1800); // the position is written when the scrolling has stopped
    const left = await firstInView(reader);
    await open(reader, base, workPath, 'work-card');
    const resume = await textOf(reader, 'work-cta-start');
    expect(/Continuă lectura/i.test(resume), `R19/W4: after reading the button says "${resume}"`);
    await shown(reader, 'work-cta-start').click();
    await reader.waitForURL(/\/read\//);
    await reader.waitForFunction(
      () =>
        [...document.querySelectorAll('[data-testid^="paragraph-"]')].filter(
          (el) => el.getBoundingClientRect().height > 0,
        ).length >= 2,
    );
    await reader.waitForTimeout(1500);
    const back = await firstInView(reader);
    expect(
      left &&
        back &&
        left.paragraphId !== null &&
        Math.abs(back.index - left.index) <= 1 &&
        new URL(reader.url()).pathname.length > 0,
      `R19: the reader left at ${JSON.stringify(left)} and came back at ${JSON.stringify(back)}`,
    );
    step(
      'R19, W4: "Continuă lectura" opens the chapter at the paragraph that was left (plus or minus one)',
    );
    await second.close();
  }
}

/** Waits for the paragraphs of the page that is open (after a navigation inside the app). */
async function openReaderReady(page) {
  await shown(page, READY).waitFor({ state: 'visible' });
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('[data-testid^="paragraph-"]')].filter(
        (el) => el.getBoundingClientRect().height > 0,
      ).length >= 2,
  );
  await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------------------------------
// the language and the two lanes

async function readerLaneChecks({ browser, base, readPath, watch, step }) {
  // R6: the language switch keeps the place
  {
    const { context, page } = await fresh(browser, DESKTOP);
    watch(page, 'reader, language');
    await openReader(page, base, readPath);
    await scrollText(page, 1800);
    const place = await firstInView(page);
    expect(
      place && place.sourceId,
      'R6: the reader has no paragraph with a data-source-id in view',
    );
    await shown(page, 'lang-en').click();
    await page.waitForFunction(() => location.search.includes('lang=en'));
    await openReaderReady(page);
    await page.waitForTimeout(1200);
    const moved = await firstInView(page);
    expect(
      moved && moved.sourceId === place.sourceId,
      `R6: the aligned paragraph is ${moved?.sourceId}, the reader was at ${place.sourceId}`,
    );
    expect(
      (await shown(page, 'lang-en').getAttribute('aria-checked')) === 'true',
      'R6: English is not the chosen language after the switch',
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openReaderReady(page);
    expect(
      (await shown(page, 'lang-en').getAttribute('aria-checked')) === 'true' &&
        page.url().includes('lang=en'),
      'R6: a reload does not keep the language',
    );
    step(
      'R6: English opens the aligned section with the paragraph in view (same data-source-id); ?lang=en survives a reload',
    );
    await context.close();
  }

  // R7: two lanes
  {
    const { context, page } = await fresh(browser, DESKTOP);
    watch(page, 'reader, two lanes');
    await open(page, base, `${readPath}?pair=ro+en`, 'lane-labels');
    await shown(page, 'lane-left').waitFor({ state: 'visible' });
    await page.waitForTimeout(500);
    const labels = [await textOf(page, 'lane-label-ro'), await textOf(page, 'lane-label-en')];
    expect(
      /^ROMÂNĂ · TRADUCERE$/.test(labels[0]) && /^ENGLISH · ORIGINAL$/.test(labels[1]),
      `R7: the lane labels read ${labels.join(' | ')}`,
    );
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid^="lane-row-"]')]
        .filter((row) => row.getBoundingClientRect().height > 0)
        .slice(0, 6)
        .map((row) => {
          const box = (id) => row.querySelector(`[data-testid="${id}"]`).getBoundingClientRect();
          const source = (id) =>
            row
              .querySelector(`[data-testid="${id}"] [data-source-id]`)
              ?.getAttribute('data-source-id') ??
            row.querySelector(`[data-testid="${id}"]`).getAttribute('data-source-id');
          const left = box('lane-left');
          const right = box('lane-right');
          return {
            heights: [left.height, right.height],
            sources: [source('lane-left'), source('lane-right')],
            sideBySide: right.x >= left.x + left.width - 1 && Math.abs(left.y - right.y) <= 1,
          };
        }),
    );
    expect(rows.length >= 3, `R7: only ${rows.length} rows of lanes on screen`);
    for (const row of rows) {
      expect(row.sideBySide, 'R7: a row does not have its two lanes side by side');
      expect(
        Math.abs(row.heights[0] - row.heights[1]) <= 1,
        `R7: the blocks of a row are ${row.heights.join(' and ')} px high`,
      );
      expect(
        row.sources[0] && row.sources[0] === row.sources[1],
        `R7: the two paragraphs of a row have data-source-id ${row.sources.join(' and ')}`,
      );
    }
    const left = await boxOf(page, 'lane-left');
    const right = await boxOf(page, 'lane-right');
    expect(
      Math.abs(left.width - right.width) <= 2,
      `R7: the lanes are ${left.width} and ${right.width} px wide, not equal`,
    );
    step(
      'R7: two lanes side by side, rows of equal height, the same data-source-id on both sides, labels "Română · traducere" and "English · original"',
    );
    await context.close();
  }
}

// ---------------------------------------------------------------------------------------------------
// the reader on a phone

async function readerPhoneChecks({ browser, base, readPath, watch, step }) {
  const { context, page } = await fresh(browser, PHONE);
  watch(page, 'reader, phone');
  await openReader(page, base, readPath);

  // R3 on a phone: 17 for a fresh profile
  const type = await leafOf(page, '[data-testid^="paragraph-"]');
  expect(type.size === 17, `R3: the text is ${type.size} px at 390, not 17`);

  // R13: the shell of a phone
  const toolbar = await boxOf(page, 'reader-toolbar');
  expect(
    Math.abs(toolbar.height - 53) <= 1.5,
    `R13: the toolbar is ${toolbar.height} px high, not 53`,
  );
  const bar = await boxOf(page, 'thumb-bar');
  expect(
    Math.abs(bar.height - 61) <= 1.5,
    `R13: the bar under the text is ${bar.height} px high, not 61`,
  );
  const cells = await page.locator('[data-testid^="thumb-cell-"]:visible').count();
  expect(cells === 5, `R13: the bar has ${cells} cells, not 5`);
  for (const box of await page
    .locator('[data-testid^="thumb-cell-"]:visible')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
    expect(
      box.width >= 44 && box.height >= 44,
      `G6: a cell of the bar is ${box.width} x ${box.height}`,
    );
  }
  expect(
    (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0,
    'R13: the page scrolls sideways',
  );

  // The outline: a drawer as wide as the window, shut by choosing an entry.
  await shown(page, 'thumb-cell-contents').click();
  const drawer = await boxOf(page, 'outline-panel');
  expect(
    Math.abs(drawer.width - PHONE.width) <= 1,
    `R13: the outline drawer is ${drawer.width} px wide`,
  );
  const entry = page.locator('[data-testid^="outline-entry-"]:visible').nth(2);
  await entry.click();
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll('[data-testid="outline-panel"]')].some(
        (el) => el.getBoundingClientRect().height > 0,
      ),
  );
  await openReaderReady(page);

  // Text and Language open as bottom sheets.
  for (const [cell, sheet] of [
    ['thumb-cell-text', 'aa-sheet-panel'],
    ['thumb-cell-language', 'language-sheet-panel'],
  ]) {
    await shown(page, cell).click();
    await shown(page, sheet).waitFor({ state: 'visible' });
    await page.waitForTimeout(500);
    const box = await boxOf(page, sheet);
    expect(
      Math.abs(box.y + box.height - PHONE.height) <= 1 && box.height <= PHONE.height * 0.7 + 1,
      `R13: "${sheet}" is at ${box.y} to ${box.y + box.height}, not a bottom sheet of 70% at most`,
    );
    await page.keyboard.press('Escape');
    await shown(page, sheet).waitFor({ state: 'hidden' });
  }
  step(
    "R3, R13, G6: 17 px text, toolbar 53, a bar of 61 with five cells of 44 or more, the outline as a drawer of the window's width that closes, Text and Language as bottom sheets",
  );

  // T5: the transparency panel is a sheet of 70 % at most, with the focus on its close button
  await shown(page, 'thumb-cell-tools').click();
  await shown(page, 'tool-report').click();
  await shown(page, 'transparency-panel').waitFor({ state: 'visible' });
  await page.waitForTimeout(600);
  const panel = await boxOf(page, 'transparency-panel');
  expect(
    panel.height <= PHONE.height * 0.7 + 1,
    `T5: the sheet is ${panel.height} px high, more than 70 %`,
  );
  const focus = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  expect(focus === 'transparency-close', `T5: the focus is on "${focus}", not on the close button`);
  step('T5: the transparency panel is a sheet of 70 % at most with the focus on its close button');
  await page.keyboard.press('Escape');
  await shown(page, 'transparency-panel').waitFor({ state: 'hidden' });
  await context.close();

  // R7 on a phone: the lanes stack, each under its label
  {
    const { context: lanes, page: stacked } = await fresh(browser, PHONE);
    watch(stacked, 'reader, lanes, phone');
    await open(stacked, base, `${readPath}?pair=ro+en`, 'lane-left');
    await stacked.waitForTimeout(500);
    const first = await stacked.evaluate(() => {
      const row = [...document.querySelectorAll('[data-testid^="lane-row-"]')].find(
        (el) => el.getBoundingClientRect().height > 0,
      );
      const left = row.querySelector('[data-testid="lane-left"]').getBoundingClientRect();
      const right = row.querySelector('[data-testid="lane-right"]').getBoundingClientRect();
      const labels = [...row.querySelectorAll('[data-testid^="lane-label-"]')].length;
      return {
        stacked: right.y >= left.y + left.height - 1 && Math.abs(left.x - right.x) <= 1,
        labels,
      };
    });
    expect(first.stacked, 'R7: the lanes of a phone do not stack');
    expect(first.labels === 2, `R7: a stacked row has ${first.labels} lane labels, not 2`);
    expect(
      (await stacked.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0,
      'R7: two lanes make the phone page scroll sideways',
    );
    step('R7: on a phone the lanes stack, each paragraph under its own label');
    await lanes.close();
  }
}

// ---------------------------------------------------------------------------------------------------
// a link into a paragraph, and the first stop of the keyboard

async function readerLinkChecks({ browser, base, readPath, watch, step }) {
  const light = palette('light');
  const { context, page } = await fresh(browser, DESKTOP);
  watch(page, 'reader, link');

  // R12: Tab starts in the section bar
  await openReader(page, base, readPath);
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => {
    const active = document.activeElement;
    return {
      inBar: Boolean(active?.closest('[data-testid="section-bar"]')),
      what: active?.getAttribute('data-testid') ?? active?.tagName,
    };
  });
  expect(first.inBar, `R12: the first Tab lands on "${first.what}", not in the section bar`);

  // R15: ?p=<paragraph>&q=words scrolls the paragraph into view and marks it
  const target = await page.evaluate(() => {
    const paragraphs = [...document.querySelectorAll('[data-testid^="paragraph-"]')].filter(
      (el) => el.getBoundingClientRect().height > 0,
    );
    const el = paragraphs[Math.min(8, paragraphs.length - 1)];
    return el?.getAttribute('data-paragraph-id') ?? null;
  });
  expect(target, 'R15: the chapter has no paragraph to link to');
  await openReader(page, base, `${readPath}?p=${encodeURIComponent(target)}&q=Dumnezeu`);
  await page.waitForTimeout(1500); // the jump, then the wash fades in over 300 ms
  const mark = await page.evaluate((id) => {
    const el = [...document.querySelectorAll(`[data-paragraph-id="${id}"]`)].find(
      (node) => node.getBoundingClientRect().height > 0,
    );
    if (!el) return null;
    const wash = el.querySelector('[data-testid="target-paragraph"]');
    const bar = el.querySelector('[data-testid="target-bar"]');
    const box = el.getBoundingClientRect();
    const toolbar = document
      .querySelector('[data-testid="reader-toolbar"]')
      .getBoundingClientRect().bottom;
    return {
      inView: box.top >= toolbar - 1 && box.bottom <= innerHeight + 1,
      wash: wash ? getComputedStyle(wash).backgroundColor : null,
      bar: bar ? getComputedStyle(bar).backgroundColor : null,
      barWidth: bar ? bar.getBoundingClientRect().width : 0,
    };
  }, target);
  expect(mark, 'R15: the paragraph of the link is not on the page');
  expect(mark.inView, 'R15: the paragraph of the link is not in view');
  expect(
    mark.wash && within(rgb(mark.wash), light.target, 8),
    `R15: the wash is ${mark.wash}, not \`target\``,
  );
  expect(
    mark.bar && within(rgb(mark.bar), light.accentStrong, 1) && Math.round(mark.barWidth) === 3,
    `R15: the bar is ${mark.bar} of ${mark.barWidth} px, not 3 px of \`accentStrong\``,
  );
  expect(
    (await shown(page, 'find-input').inputValue()) === 'Dumnezeu',
    'R15: the words of the link are not in the find bar',
  );
  step(
    'R12, R15: Tab starts in the section bar; a link with ?p= and ?q= scrolls the paragraph into view with the target wash and a 3 px bar, and the words in the find bar',
  );
  await context.close();
}

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { evaluate, hasFix } from './audit-gate.mjs';

const adv = (over) => ({
  severity: 'moderate',
  module_name: 'pkg',
  title: 't',
  patched_versions: '>=2.0.0',
  github_advisory_id: 'GHSA-xxxx',
  ...over,
});
const today = new Date('2026-11-04T00:00:00Z');

test('hasFix understands pnpm "<0.0.0" as no fix', () => {
  assert.equal(hasFix({ patched_versions: '<0.0.0' }), false);
  assert.equal(hasFix({ patched_versions: '' }), false);
  assert.equal(hasFix({ patched_versions: '>=1.2.3' }), true);
});

test('a fixable moderate advisory blocks; an unfixable one only warns', () => {
  const report = { advisories: { 1: adv({}), 2: adv({ patched_versions: '<0.0.0' }) } };
  const r = evaluate(report, { advisories: [] }, 'moderate', today);
  assert.deepEqual(
    r.blocking.map((a) => a.id),
    ['1'],
  );
  assert.deepEqual(
    r.unfixable.map((a) => a.id),
    ['2'],
  );
});

test('advisories below the level are ignored', () => {
  const report = { advisories: { 1: adv({ severity: 'low' }) } };
  assert.equal(evaluate(report, { advisories: [] }, 'moderate', today).blocking.length, 0);
  assert.equal(evaluate(report, { advisories: [] }, 'low', today).blocking.length, 1);
});

test('allow-list entries need a reason and are ignored after they expire', () => {
  const report = { advisories: { 1: adv({}) } };
  const ok = { advisories: [{ id: 1, reason: 'build tool', expires: '2027-01-31' }] };
  const expired = { advisories: [{ id: 1, reason: 'build tool', expires: '2026-10-01' }] };
  const noReason = { advisories: [{ id: 1, expires: '2027-01-31' }] };
  assert.equal(evaluate(report, ok, 'moderate', today).allowed.length, 1);
  assert.equal(evaluate(report, expired, 'moderate', today).blocking[0].expired, true);
  assert.equal(evaluate(report, noReason, 'moderate', today).blocking.length, 1);
});

test('an unfixable high or critical advisory blocks unless allow-listed', () => {
  const report = {
    advisories: {
      1: adv({ severity: 'high', patched_versions: '<0.0.0' }),
      2: adv({ severity: 'critical', patched_versions: '<0.0.0' }),
      3: adv({ severity: 'moderate', patched_versions: '<0.0.0' }),
    },
  };
  const none = evaluate(report, { advisories: [] }, 'moderate', today);
  assert.deepEqual(
    none.blocking.map((a) => a.id),
    ['1', '2'],
  );
  assert.deepEqual(
    none.unfixable.map((a) => a.id),
    ['3'],
  );
  const listed = {
    advisories: [{ id: 1, reason: 'no fix, build tool only', expires: '2027-01-31' }],
  };
  assert.deepEqual(
    evaluate(report, listed, 'moderate', today).blocking.map((a) => a.id),
    ['2'],
  );
});

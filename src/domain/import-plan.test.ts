import { describe, expect, it } from 'vitest';

import { importLabel, importSummary, initiallyChosen, planImport } from '@/domain/import-plan';
import type { FoundSubscription } from '@/lib/subscriptions';
import { makeDocument } from '@/test/factories';

function found(name: string, extra: Partial<FoundSubscription> = {}): FoundSubscription {
  return {
    name,
    plan: '',
    price: 'AED 25.00',
    period: 'monthly',
    renewsOn: '2026-11-20',
    domain: '',
    status: 'active',
    ...extra,
  };
}

const tracked = [
  makeDocument('membership', { title: 'Shahid', renewsEvery: 'monthly' }),
  makeDocument('membership', { title: 'OSN+', iconDomain: 'osnplus.com', renewsEvery: 'monthly' }),
];

describe('planImport', () => {
  it('sorts what a Settings screenshot shows', () => {
    const rows = planImport(
      [
        found('Calm'),
        found('Apple TV+', { trial: true }),
        found('Shahid', { status: 'expired' }),
        found('OSN Plus', { domain: 'osnplus.com' }),
        found('Starzplay', { status: 'cancelled' }),
        found('Anghami', { renewsOn: '' }),
      ],
      tracked
    );
    expect(rows.map((row) => row.kind)).toEqual(['new', 'trial', 'ended', 'tracked', 'gone', 'undated']);
    expect(rows[2].match?.title).toBe('Shahid');
    expect(rows[3].match?.title).toBe('OSN+');
  });

  it('adds again something that was archived', () => {
    const archived = [{ ...tracked[0], archivedAt: '2026-10-01T00:00:00Z' }];
    expect(planImport([found('Shahid')], archived)[0].kind).toBe('new');
  });

  it('treats a missing trial flag from an older reader as no trial', () => {
    expect(planImport([found('Calm')], [])[0].kind).toBe('new');
  });
});

describe('importSummary', () => {
  it('says what is new and what will be archived', () => {
    const rows = planImport([found('Calm'), found('Apple TV+', { trial: true }), found('Shahid', { status: 'expired' })], tracked);
    expect(importSummary(rows)).toBe(
      'Two are new, and Shahid has ended, so Expyr will archive it. Anything you already track is left alone.'
    );
  });

  it('says when nothing is new', () => {
    expect(importSummary(planImport([found('Shahid')], tracked))).toBe(
      'Nothing is new. Anything you already track is left alone.'
    );
  });
});

describe('the button', () => {
  const rows = planImport([found('Calm'), found('Shahid', { status: 'expired' }), found('OSN+')], tracked);

  it('starts with everything that acts ticked', () => {
    expect([...initiallyChosen(rows)]).toEqual([0, 1]);
  });

  it('counts what is ticked', () => {
    expect(importLabel(rows, new Set([0, 1]))).toBe('Add 1, archive 1');
    expect(importLabel(rows, new Set([0]))).toBe('Add 1');
    expect(importLabel(rows, new Set([1]))).toBe('Archive 1');
    expect(importLabel(rows, new Set())).toBe('Done');
  });
});

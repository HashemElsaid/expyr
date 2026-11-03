import type { FoundSubscription } from '@/lib/subscriptions';
import type { TrackedDocument } from '@/types';

/**
 * What to do with each subscription a screenshot turned up.
 *
 * A screenshot of the Subscriptions page in Settings is a statement of the
 * truth as Apple sees it, so it does more than add: anything already tracked
 * is left alone, and anything tracked that Apple now lists as expired or
 * cancelled is offered for the archive, because it has stopped charging.
 *
 *   new       not tracked yet, with a date: added
 *   trial     the same, in a free trial: added, warned before the first charge
 *   ended     tracked, and the screenshot says it has stopped: archived
 *   tracked   tracked already and still running: left alone
 *   gone      stopped, and not tracked anyway: nothing to do
 *   undated   no date on the screen, so nothing to remind about: not added
 */
export type ImportKind = 'new' | 'trial' | 'ended' | 'tracked' | 'gone' | 'undated';

export type ImportRow = {
  found: FoundSubscription;
  kind: ImportKind;
  /** The tracked subscription it matched, for `ended` and `tracked`. */
  match?: TrackedDocument;
};

/** The kinds that do something when the button is pressed. */
export const ACTS: readonly ImportKind[] = ['new', 'trial', 'ended'];

export function planImport(
  found: readonly FoundSubscription[],
  tracked: readonly TrackedDocument[]
): ImportRow[] {
  const live = tracked.filter((doc) => !doc.archivedAt);
  return found.map((sub) => {
    const match = live.find((doc) => sameService(doc, sub));
    const stopped = sub.status === 'expired' || sub.status === 'cancelled';
    if (stopped) return match ? { found: sub, kind: 'ended', match } : { found: sub, kind: 'gone' };
    if (match) return { found: sub, kind: 'tracked', match };
    if (!sub.renewsOn) return { found: sub, kind: 'undated' };
    return { found: sub, kind: sub.trial ? 'trial' : 'new' };
  });
}

/** By name, or by the service's website when both have one. */
function sameService(doc: TrackedDocument, sub: FoundSubscription): boolean {
  const name = sub.name.trim().toLowerCase();
  if (name && doc.title.trim().toLowerCase() === name) return true;
  const domain = sub.domain.trim().toLowerCase();
  return !!domain && doc.iconDomain?.trim().toLowerCase() === domain;
}

const WORDS = ['Nothing', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const counted = (n: number) => WORDS[n] ?? String(n);

/**
 * The line under the title: what is new, what has ended, and the promise that
 * nothing already tracked is touched.
 */
export function importSummary(rows: readonly ImportRow[]): string {
  const fresh = rows.filter((row) => row.kind === 'new' || row.kind === 'trial').length;
  const ended = rows.filter((row) => row.kind === 'ended');
  const lead = fresh ? `${counted(fresh)} ${fresh === 1 ? 'is' : 'are'} new` : 'Nothing is new';
  const archive = ended.length
    ? ended.length === 1
      ? `, and ${ended[0].found.name.trim()} has ended, so Expyr will archive it`
      : `, and ${counted(ended.length).toLowerCase()} have ended, so Expyr will archive them`
    : '';
  return `${lead}${archive}. Anything you already track is left alone.`;
}

/** The button: "Add 2, archive 1", "Add 2", "Archive 1", or "Done". */
export function importLabel(rows: readonly ImportRow[], chosen: ReadonlySet<number>): string {
  let add = 0;
  let archive = 0;
  rows.forEach((row, index) => {
    if (!chosen.has(index)) return;
    if (row.kind === 'new' || row.kind === 'trial') add += 1;
    if (row.kind === 'ended') archive += 1;
  });
  if (add && archive) return `Add ${add}, archive ${archive}`;
  if (add) return `Add ${add}`;
  if (archive) return `Archive ${archive}`;
  return 'Done';
}

/** What is ticked to begin with: everything that acts. */
export function initiallyChosen(rows: readonly ImportRow[]): Set<number> {
  return new Set(rows.flatMap((row, index) => (ACTS.includes(row.kind) ? [index] : [])));
}

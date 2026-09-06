import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { successFeedback, tapFeedback } from '@/lib/haptics';
import {
  hasReading,
  isReading,
  loadBrief,
  NotEnoughCredits,
  readDocumentFully,
  readsOnArrival,
  summariseDocument,
  type Brief,
  type ReadProgress,
  type ReadStage,
} from '@/lib/reading';
import { canAfford, chargeForPages, priceOfPages } from '@/domain/credits';
import { useSettings } from '@/store/settings';
import type { TrackedDocument } from '@/types';

/**
 * Reading a document in full, and the accounting that goes with it.
 *
 * Pulled out of the detail screen because it is the most intricate thing that
 * screen was doing and had nothing to do with drawing it: an effect that starts
 * a read on arrival, a manual retry, a summary retry, and the rule about which
 * of those spends one of the two free readings. That rule has been got wrong
 * twice — once charging for a read the add screen had already paid for, once
 * charging for a document already on disk — so it lives here now, in one place,
 * stated once.
 */

export type DocumentReading = {
  /** The summary, once there is one. */
  brief: Brief | null;
  /** Whether a transcript exists, which is what makes questions possible. */
  readable: boolean;
  /** What it is doing now, or null when it is doing nothing. */
  stage: ReadStage | null;
  /** How far through a long document it has got, when there is more than one page. */
  progress: ReadProgress | null;
  /** Reads it, on request. Safe to call while one is already running. */
  readNow: () => Promise<void>;
  /** Retries only the summary, for a document already transcribed. */
  retrySummary: () => Promise<void>;
  /** Set when a read stopped because the balance would not cover it. */
  shortOfCredits: number | null;
};

export function useDocumentReading(doc: TrackedDocument | undefined): DocumentReading {
  const { settings, update } = useSettings();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [readable, setReadable] = useState(false);
  const [stage, setStage] = useState<ReadStage | null>(null);
  const [progress, setProgress] = useState<ReadProgress | null>(null);
  const [shortOfCredits, setShortOfCredits] = useState<number | null>(null);

  /**
   * The money side of a read, in one place.
   *
   * Affordability is answered once, after the page count is known and before
   * anything is fetched, so a refusal costs nothing and never leaves half a
   * document. Pages are then counted as they land and charged for at the end,
   * whether the read finished or gave up — because a batch that arrived was
   * paid for by us either way, and a batch that did not was not.
   */
  function budgetFor(title: string) {
    let pagesRead = 0;
    return {
      budget: {
        canAfford: (pages: number) => canAfford(settings.credits, priceOfPages(pages)),
        onPagesRead: (pages: number) => {
          pagesRead += pages;
        },
      },
      settle: () => {
        if (pagesRead === 0) return;
        const detail = `${title} · ${pagesRead} page${pagesRead === 1 ? '' : 's'}`;
        update({
          credits: chargeForPages(
            settings.credits,
            pagesRead,
            detail,
            new Date(),
            `${Date.now()}`
          ),
        });
      },
    };
  }

  /* One callback for both, so a caller cannot set a stage and forget the count. */
  function report(next: ReadStage, at?: ReadProgress) {
    setStage(next);
    setProgress(at ?? null);
  }

  /*
   * Reading normally starts the moment a contract is saved. Picking it up again
   * here covers the times that did not finish: the app was closed too soon, the
   * network was gone, the phone suspended the work.
   */
  useEffect(() => {
    if (!doc) return;
    setBrief(loadBrief(doc.id));
    setReadable(hasReading(doc.id));

    const first = doc.files[0];
    if (!first || !readsOnArrival(doc.typeId) || loadBrief(doc.id)) return;

    /*
     * A read already running was started by the screen that saved the document,
     * and that screen counts it. Join it rather than bailing out, so the brief
     * arrives here when it finishes instead of leaving this sitting on
     * "reading it" until the screen is opened again.
     */
    const joined = isReading(doc.id);

    let live = true;
    const money = budgetFor(doc.title);
    readDocumentFully(doc.id, first, (next, at) => live && report(next, at), money.budget)
      .then((result) => {
        if (!live) return;
        setReadable(true);
        setBrief(result.brief);
      })
      .catch((error) => {
        if (live && error instanceof NotEnoughCredits) setShortOfCredits(error.pages);
        /*
         * Offered as a button instead, rather than an alert nobody asked for.
         *
         * Quiet for the person is not the same as invisible to us, though: a
         * read that failed on somebody's phone used to leave no trace at all,
         * anywhere, which made "it just says reading" impossible to diagnose.
         * The message is the service's own wording — never the document.
         */
        console.warn(
          '[reading] on-arrival read failed:',
          error instanceof Error ? error.message : String(error)
        );
      })
      .finally(() => {
        // Settled whether it finished or not: the pages that landed are ours to pay for.
        if (!joined) money.settle();
        if (!live) return;
        setStage(null);
        setProgress(null);
      });

    return () => {
      live = false;
    };
    // Deliberately keyed on the document alone: re-running because the settings
    // object changed would start a second read of the same file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);

  async function readNow() {
    if (!doc || stage) return;
    const first = doc.files[0];
    if (!first) return;

    tapFeedback();
    setShortOfCredits(null);
    const money = budgetFor(doc.title);
    try {
      const result = await readDocumentFully(doc.id, first, report, money.budget);
      setReadable(true);
      setBrief(result.brief);
      successFeedback();
    } catch (error) {
      if (error instanceof NotEnoughCredits) {
        /*
         * Not an error to apologise for. The screen offers a top-up, so this
         * only records how short the balance was.
         */
        setShortOfCredits(error.pages);
      } else {
        Alert.alert(
          'Could not read that',
          error instanceof Error ? error.message : 'Something went wrong.'
        );
      }
    } finally {
      money.settle();
      setStage(null);
      setProgress(null);
    }
  }

  async function retrySummary() {
    if (!doc || stage) return;
    tapFeedback();
    setStage('summarising');
    try {
      setBrief(await summariseDocument(doc.id));
      successFeedback();
    } catch (error) {
      Alert.alert(
        'Could not summarise it',
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    } finally {
      setStage(null);
    }
  }

  return { brief, readable, stage, progress, readNow, retrySummary, shortOfCredits };
}

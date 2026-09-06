import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { successFeedback, tapFeedback } from '@/lib/haptics';
import {
  hasReading,
  isReading,
  loadBrief,
  readDocumentFully,
  readsOnArrival,
  summariseDocument,
  type Brief,
  type ReadProgress,
  type ReadStage,
} from '@/lib/reading';
import { FREE_READ_LIMIT, useSettings } from '@/store/settings';
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
};

export function useDocumentReading(doc: TrackedDocument | undefined): DocumentReading {
  const { settings, update } = useSettings();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [readable, setReadable] = useState(false);
  const [stage, setStage] = useState<ReadStage | null>(null);
  const [progress, setProgress] = useState<ReadProgress | null>(null);

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
    // An already-read document costs nothing to revisit; a new one does.
    const fresh = !hasReading(doc.id);
    if (!joined && !settings.premium && fresh && settings.readsUsed >= FREE_READ_LIMIT) return;

    let live = true;
    readDocumentFully(doc.id, first, (next, at) => live && report(next, at))
      .then((result) => {
        if (!live) return;
        setReadable(true);
        setBrief(result.brief);
        if (!settings.premium && fresh && !joined) update({ readsUsed: settings.readsUsed + 1 });
      })
      .catch((error) => {
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
    // Only a document being read for the first time spends one of the free reads.
    const fresh = !hasReading(doc.id);
    try {
      const result = await readDocumentFully(doc.id, first, report);
      setReadable(true);
      setBrief(result.brief);
      if (!settings.premium && fresh) update({ readsUsed: settings.readsUsed + 1 });
      successFeedback();
    } catch (error) {
      Alert.alert(
        'Could not read that',
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    } finally {
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

  return { brief, readable, stage, progress, readNow, retrySummary };
}

import { useCallback, useEffect, useState } from 'react';

import { countryLabel, type Country } from '@/data/countries';
import { labelFor } from '@/data/document-types';
import {
  fromGenerated,
  fromVerified,
  provenanceFor,
  type DisplayGuidance,
} from '@/domain/renewal-guidance';
import { cachedGuidance, fetchGuidance, type GuidanceQuery } from '@/lib/guidance';
import type { DocumentType } from '@/types';

/**
 * The renewal guidance for a document, from wherever it comes from.
 *
 * Two sources behind one shape, so the screen draws guidance once. Where the
 * app has hand-checked guides — the UAE — it uses them and never touches the
 * network. Everywhere else it asks the service, which searches the web once per
 * jurisdiction and serves the same answer to everybody.
 *
 * Two things about when it asks:
 *
 * It only asks once the section is actually opened. Most people never open it —
 * they came to see a date — and a request fired on mount would be a web search
 * charged for a screen nobody read.
 *
 * And anything already on the phone is returned straight away, however old,
 * while a fresher copy is fetched behind it. The moment somebody most wants
 * renewal steps is standing in a service centre on a bad connection, and a
 * spinner is the wrong answer there when there is a perfectly good answer on
 * disk from last month.
 */

export type RenewalGuidance = {
  /** What to draw, or null when there is nothing yet. */
  guidance: DisplayGuidance | null;
  /** True while a fetch is running with nothing on screen behind it. */
  loading: boolean;
  /** True while refreshing something already shown. */
  refreshing: boolean;
  /** Set when there is nothing to show and the fetch failed. */
  error: string | null;
  retry: () => void;
};

export function useRenewalGuidance(opts: {
  /**
   * Null while the document is still loading. Hooks run on every render,
   * including the ones before a document exists, so this has to be answerable
   * then too — a hook called conditionally is a hook React refuses.
   */
  type: DocumentType | null;
  country: Country | null;
  /** Emirate, state or province. Empty when the user has not said. */
  region: string;
  /** Where the verified guide says to go — already resolved by the caller. */
  verifiedWhere: string;
  /** Only ask once somebody has actually opened the section. */
  enabled: boolean;
}): RenewalGuidance {
  const { type, country, region, verifiedWhere, enabled } = opts;
  const provenance = provenanceFor(country);

  const [generated, setGenerated] = useState<DisplayGuidance | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const query: GuidanceQuery | null =
    type && provenance === 'generated' && country
      ? {
          typeId: type.id,
          label: labelFor(type, country),
          country,
          countryName: countryLabel(country),
          region,
        }
      : null;

  // Depended on as a string, so a new object each render does not re-fetch.
  const key = query ? `${query.typeId}.${query.country}.${query.region}` : '';

  useEffect(() => {
    if (!enabled || !query) return;

    let live = true;

    // Anything on this phone goes up immediately, however old.
    const existing = cachedGuidance(query);
    if (existing) setGenerated(fromGenerated(existing));

    setError(null);
    if (existing) setRefreshing(true);
    else setLoading(true);

    fetchGuidance(query)
      .then((value) => {
        if (!live) return;
        setGenerated(fromGenerated(value));
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!live) return;
        /*
         * Only an error when there is nothing behind it. A stale copy on screen
         * is a better answer than replacing it with a failure.
         */
        if (!existing) {
          setError(reason instanceof Error ? reason.message : 'Could not look that up.');
        }
      })
      .finally(() => {
        if (!live) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (!type) {
    return { guidance: null, loading: false, refreshing: false, error: null, retry };
  }

  if (provenance === 'verified') {
    return {
      guidance: fromVerified(type, verifiedWhere),
      loading: false,
      refreshing: false,
      error: null,
      retry,
    };
  }

  return { guidance: generated, loading, refreshing, error, retry };
}

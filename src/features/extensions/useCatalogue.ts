import { useCallback, useEffect, useRef, useState } from 'react';
import { CATALOGUE_SAVED, type CatalogueReply } from '../../api/catalogue/public';

/** Metadata lifetime is independent of the selected local Engine. */
export function useCatalogue<T>(load: (refresh?: boolean) => Promise<CatalogueReply<T>>) {
  const [reply, setReply] = useState<CatalogueReply<T> | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(true);
  const generation = useRef(0);
  const refresh = useCallback(async (force = true) => {
    const version = ++generation.current;
    setBusy(true); setError('');
    try { const value = await load(force); if (generation.current === version) setReply(value); }
    catch (reason) { if (generation.current === version) setError(String(reason)); }
    finally { if (generation.current === version) setBusy(false); }
  }, [load]);
  useEffect(() => { void refresh(false); return () => { ++generation.current; }; }, [refresh]);
  // Another view's Try again (the page beside the sidebar) saved an answer: a view still showing the failure reads it from the cache
  const failed = useRef(false);
  failed.current = Boolean(error) && !reply;
  useEffect(() => {
    const again = () => { if (failed.current) void refresh(false); };
    window.addEventListener(CATALOGUE_SAVED, again);
    return () => window.removeEventListener(CATALOGUE_SAVED, again);
  }, [refresh]);
  return { reply, error, busy, refresh };
}

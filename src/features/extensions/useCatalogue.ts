import { useCallback, useEffect, useRef, useState } from 'react';
import type { CatalogueReply } from '../../api/catalogue/public';

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
  return { reply, error, busy, refresh };
}

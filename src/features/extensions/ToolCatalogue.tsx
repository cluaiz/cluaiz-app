import { useEffect, useRef, useState } from 'react';
import { toolCatalogue, type RegistryTool, type RegistryDetails } from '../../api/catalogue/tools';
import { installTool, resumeToolInstall } from '../../api/engine/tools/lifecycle';
import type { ToolKind } from '../../api/engine/tools/catalog';
import { listTools } from '../../api/engine/tools/catalog';
import { useConnectionStore } from '../../store/engine/useConnectionStore';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { CustomDropdown } from '../../components/ui/dropdown/CustomDropdown';
import { useCatalogue } from './useCatalogue';
import { useCatalogueTask } from './useCatalogueTask';
import { CatalogueTaskStatus } from './CatalogueTaskStatus';
const resumeInstall: Parameters<typeof useCatalogueTask<Awaited<ReturnType<typeof resumeToolInstall>>>>[1] =
  (target, id, signal, observer) => {
    const split = target.indexOf(':');
    return resumeToolInstall(target.slice(0, split) as ToolKind, target.slice(split + 1), id, signal, observer);
  };

export function ToolCatalogue() {
  const catalogue = useCatalogue(toolCatalogue.list);
  const installation = useCatalogueTask('tools.install', resumeInstall);
  const [kind, setKind] = useState(''), [query, setQuery] = useState('');
  const [selected, setSelected] = useState<RegistryTool | null>(null), [details, setDetails] = useState<RegistryDetails | null>(null);
  const [message, setMessage] = useState(''), [installed, setInstalled] = useState<string[]>([]);
  const busy = installation.busy || installation.cancelling;
  const [limit, setLimit] = useState(24);
  const generation = useRef(0), selection = useRef(0);
  const [connection, setConnection] = useState(0);
  useEffect(() => {
    const unsubscribe = useConnectionStore.subscribe((next, previous) => {
      if (next.host !== previous.host || next.port !== previous.port || next.protocol !== previous.protocol) {
        ++generation.current; ++selection.current;
        setMessage(''); setInstalled([]); setSelected(null); setDetails(null); setConnection(v => v + 1);
      }
    });
    return () => { ++generation.current; ++selection.current; unsubscribe(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(), version = generation.current;
    void listTools(undefined, controller.signal).then(values => {
      if (!controller.signal.aborted && version === generation.current) setInstalled(values.map(tool => `${tool.category}:${tool.id}`));
    }).catch(error => { if (!controller.signal.aborted && version === generation.current) setMessage(`Installed tool status unavailable: ${String(error)}`); });
    return () => controller.abort();
  }, [connection]);
  useEffect(() => { if (installation.result) setConnection(value => value + 1); }, [installation.result]);
  async function inspect(tool: RegistryTool) {
    const version = ++selection.current;
    setSelected(tool); setDetails(null); setMessage('Loading package details…');
    try { const result = await toolCatalogue.details(tool); if (version === selection.current) { setDetails(result.data); setMessage(result.warning || ''); } }
    catch (error) { if (version === selection.current) setMessage(String(error)); }
  }
  async function install() {
    if (!selected || !details || selected.kind === 'extension' || !installation.canStart) return;
    const kind = selected.kind;
    const target = selected;
    await installation.start(`${kind}:${target.id}`, (signal, observer) => installTool(kind, target.id, signal, observer));
  }
  const rows = (catalogue.reply?.data ?? []).filter(tool => (!kind || tool.kind === kind) && tool.id.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3"><p className="text-sm">Available packages from the Cluaiz Tools repository.</p>
      <Button variant="outline" disabled={catalogue.busy || busy} onClick={() => { void catalogue.refresh(); setConnection(v => v + 1); }}>Refresh</Button></div>
    <div className="grid gap-3 md:grid-cols-2"><Input value={query} onChange={e => { setQuery(e.target.value); setLimit(24); }} placeholder="Search package ids" />
      <CustomDropdown value={kind} options={[{ value: '', label: 'All types' }, ...['plugin', 'skill', 'mcp', 'extension'].map(value => ({ value, label: value }))]} onChange={value => { setKind(value); setLimit(24); }} /></div>
    {catalogue.busy && <p role="status">Loading available packages…</p>}
    {(catalogue.error || catalogue.reply?.warning) && <p role="alert">{catalogue.error || catalogue.reply?.warning}</p>}
    {message && <p role="status">{message}</p>}
    <CatalogueTaskStatus {...installation} />
    <p className="text-xs text-[var(--text-secondary)]">Catalogue metadata is untrusted text. A listing does not grant permissions or prove runtime compatibility. Package details load only when opened.</p>
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{rows.slice(0, limit).map(tool => <Card key={`${tool.kind}:${tool.id}`}><CardHeader><CardTitle>{tool.id}</CardTitle></CardHeader><CardContent className="space-y-2">
      <p className="text-xs">{tool.kind} {installed.includes(`${tool.kind}:${tool.id}`) ? '· Installed' : ''}</p>
      <Button variant="outline" disabled={busy} onClick={() => { void inspect(tool); }}>View package</Button>
    </CardContent></Card>)}</div>
    {rows.length > limit && <Button variant="outline" onClick={() => setLimit(value => value + 24)}>Show more packages</Button>}
    {!catalogue.busy && catalogue.reply && !rows.length && <p>No packages match these filters.</p>}
    {selected && <Card><CardHeader><CardTitle>{details?.name || selected.id}</CardTitle></CardHeader><CardContent className="space-y-3">
      <p className="text-sm whitespace-pre-wrap">{details?.description}</p><p className="text-xs">{selected.kind} · {details?.version} · {details?.build}</p>
      {selected.kind === 'extension' ? <p>This registry contains legacy extension manifests. They cannot be executed as App UI packages. Use Extensions to import a compatible built package; no automatic scripts or native code will run here.</p>
        : <><p className="text-xs">Install requests the Engine registry's current release. It may download dependencies. Execution still follows Engine permissions.</p>
          {!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(selected.id) && <p>This legacy registry id is not accepted by the current Engine installer.</p>}
          <Button disabled={!details || !installation.canStart || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(selected.id) || installed.includes(`${selected.kind}:${selected.id}`)} onClick={() => { void install(); }}>{busy ? 'Installing…' : installed.includes(`${selected.kind}:${selected.id}`) ? 'Installed' : 'Install current registry release'}</Button></>}
    </CardContent></Card>}
  </div>;
}

import { useEffect, useRef, useState } from 'react';
import { toolCatalogue, type RegistryTool, type RegistryDetails } from '../../api/catalogue/tools';
import { installTool, resumeToolInstall } from '../../api/engine/tools/lifecycle';
import type { ToolKind } from '../../api/engine/tools/catalog';
import { listTools } from '../../api/engine/tools/catalog';
import { useConnectionStore } from '../../store/engine/useConnectionStore';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { CustomDropdown } from '../../components/ui/dropdown/CustomDropdown';
import { useCatalogue } from './useCatalogue';
import { Boxes } from 'lucide-react';
import { MultiLevelDropdown, type MultiLevelCategory } from '../../components/ui/dropdown';
import { CatalogueCard, CatalogueFilter, CatalogueLogo, CatalogueStickyHeader, CatalogueTags } from './CatalogueUI';
import { filterTools } from './catalogueView';
import { useCatalogueTask } from './useCatalogueTask';
import { CatalogueTaskStatus } from './CatalogueTaskStatus';
const resumeInstall: Parameters<typeof useCatalogueTask<Awaited<ReturnType<typeof resumeToolInstall>>>>[1] =
  (target, id, signal, observer) => {
    const split = target.indexOf(':');
    return resumeToolInstall(target.slice(0, split) as ToolKind, target.slice(split + 1), id, signal, observer);
  };

export function ToolCatalogue({ initialKind }: { initialKind?: string } = {}) {
  const catalogue = useCatalogue(toolCatalogue.list);
  const installation = useCatalogueTask('tools.install', resumeInstall);
  const [kind, setKind] = useState(initialKind ?? ''), [query, setQuery] = useState('');

  useEffect(() => {
    if (initialKind !== undefined) {
      setKind(initialKind);
    }
  }, [initialKind]);
  const [selected, setSelected] = useState<RegistryTool | null>(null), [details, setDetails] = useState<RegistryDetails | null>(null);
  const [openedDetails, setOpenedDetails] = useState<Record<string, RegistryDetails>>({});
  const [message, setMessage] = useState(''), [installed, setInstalled] = useState<string[]>([]);
  const [engineError, setEngineError] = useState(''), [inventoryReady, setInventoryReady] = useState(false);
  const busy = installation.busy || installation.cancelling;
  const [limit, setLimit] = useState(24);
  const generation = useRef(0), selection = useRef(0);
  const [connection, setConnection] = useState(0);
  useEffect(() => {
    const unsubscribe = useConnectionStore.subscribe((next, previous) => {
      if (next.host !== previous.host || next.port !== previous.port || next.protocol !== previous.protocol) {
        ++generation.current; ++selection.current;
        setMessage(''); setEngineError(''); setInventoryReady(false); setInstalled([]); setSelected(null); setDetails(null); setConnection(v => v + 1);
      }
    });
    return () => { ++generation.current; ++selection.current; unsubscribe(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(), version = generation.current;
    setInventoryReady(false);
    void listTools(undefined, controller.signal).then(values => {
      if (!controller.signal.aborted && version === generation.current) {
        setInstalled(values.map(tool => `${tool.category}:${tool.id}`)); setEngineError(''); setInventoryReady(true);
      }
    }).catch(error => { if (!controller.signal.aborted && version === generation.current) setEngineError(`Installed tool status unavailable: ${String(error)}`); });
    return () => controller.abort();
  }, [connection]);
  useEffect(() => { if (installation.result) setConnection(value => value + 1); }, [installation.result]);
  async function inspect(tool: RegistryTool) {
    const version = ++selection.current;
    setSelected(tool); setDetails(null); setMessage('Loading package details…');
    try { const result = await toolCatalogue.details(tool); if (version === selection.current) {
      setDetails(result.data); setOpenedDetails(previous => ({ ...previous, [`${tool.kind}:${tool.id}`]: result.data })); setMessage(result.warning || '');
    } }
    catch (error) { if (version === selection.current) setMessage(String(error)); }
  }
  async function install() {
    if (!selected || !details || selected.kind === 'extension' || !installation.canStart || !inventoryReady) return;
    const kind = selected.kind;
    const target = selected;
    await installation.start(`${kind}:${target.id}`, (signal, observer) => installTool(kind, target.id, signal, observer));
  }
  const rows = filterTools((catalogue.reply?.data ?? []).map(tool => ({ tool, details: openedDetails[`${tool.kind}:${tool.id}`] })),
    { query, kind, build: '', os: '', sort: 'name' });
  const pageTitle = initialKind === 'mcp'
    ? 'MCP Servers'
    : initialKind === 'skill'
    ? 'Agent Skills'
    : initialKind === 'plugin'
    ? 'Plugins & Tools'
    : 'Available Tools';

  const pageSubtitle = initialKind === 'mcp'
    ? 'Standard protocol bridging your engine to external databases, APIs and environments.'
    : initialKind === 'skill'
    ? 'Modular agentic capabilities and workflows for tasks.'
    : initialKind === 'plugin'
    ? 'Native and community runtime plugins for your workspace.'
    : 'Plugins, MCP servers and skills for your workspace.';

  const toolCategories: MultiLevelCategory[] = [
    {
      id: 'kind',
      label: 'Package Type',
      icon: Boxes,
      options: [
        { value: '', label: 'All Types' },
        { value: 'plugin', label: 'Plugins' },
        { value: 'skill', label: 'Skills' },
        { value: 'mcp', label: 'MCP Servers' },
        { value: 'extension', label: 'Extensions' },
      ],
      selectedValue: kind,
      onSelect: (val) => {
        setKind(val);
        setLimit(24);
      },
    },
  ];

  return <div className="w-full flex flex-col min-h-full">
    <CatalogueStickyHeader
      title={pageTitle}
      subtitle={pageSubtitle}
      searchQuery={query}
      onSearchChange={value => { setQuery(value); setLimit(24); }}
      searchPlaceholder="Search package IDs or opened details"
      filterElement={
        <MultiLevelDropdown
          categories={toolCategories}
          activeCount={kind ? 1 : 0}
          onClearAll={() => setKind('')}
        />
      }
    />
    <div className="mx-auto w-full max-w-7xl p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-xs text-[var(--text-muted)]">{rows.length} packages · Open a package for details</p>
      </div>
    {catalogue.busy && <p role="status">Loading available packages…</p>}
    {(catalogue.error || catalogue.reply?.warning) && <p role="alert">{catalogue.error || catalogue.reply?.warning}</p>}
    {engineError && <p role="alert">{engineError}</p>}
    {message && <p role="status">{message}</p>}
    <CatalogueTaskStatus {...installation} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.slice(0, limit).map(({ tool, details: metadata }) => <CatalogueCard key={`${tool.kind}:${tool.id}`}
      title={metadata?.name || tool.id} subtitle={metadata?.author || ''} source={metadata?.icon} imageBase={tool.manifest}
      marker={installed.includes(`${tool.kind}:${tool.id}`) ? 'Installed' : tool.kind} description={metadata?.description || 'Open this package to load its published details.'}
      tags={metadata?.tags || []} identity={tool.id} meta={metadata?.version}
      onOpen={() => { if (!busy) void inspect(tool); }} />)}</div>
    {rows.length > limit && <Button variant="outline" onClick={() => setLimit(value => value + 24)}>Show more packages</Button>}
    {!catalogue.busy && catalogue.reply && !rows.length && <p>No packages match these filters.</p>}
    {selected && <Card><CardHeader><CardTitle>{details?.name || selected.id}</CardTitle></CardHeader><CardContent className="space-y-3">
      <CatalogueLogo source={details?.icon} base={selected.manifest} name={details?.name || selected.id} large />
      <CatalogueTags values={details?.tags || [selected.kind]} />
      <p className="text-sm whitespace-pre-wrap">{details?.description}</p><p className="text-xs">{selected.kind} · {details?.version} · {details?.build}</p>
      {selected.kind === 'extension' ? <p>This registry contains legacy extension manifests. They cannot be executed as App UI packages. Use Extensions to import a compatible built package; no automatic scripts or native code will run here.</p>
        : <><p className="text-xs">Install requests the Engine registry's current release. It may download dependencies. Execution still follows Engine permissions.</p>
          {!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(selected.id) && <p>This legacy registry id is not accepted by the current Engine installer.</p>}
          <Button disabled={!details || !installation.canStart || !inventoryReady || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(selected.id) || installed.includes(`${selected.kind}:${selected.id}`)} onClick={() => { void install(); }}>{busy ? 'Installing…' : installed.includes(`${selected.kind}:${selected.id}`) ? 'Installed' : 'Install current registry release'}</Button></>}
    </CardContent></Card>}
  </div></div>;
}

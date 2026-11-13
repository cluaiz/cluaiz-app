import { useEffect, useState } from 'react';
import { Boxes } from 'lucide-react';
import type { RegistryKind } from '../../api/catalogue/tools';
import { installTool, resumeToolInstall } from '../../api/engine/tools/lifecycle';
import type { ToolKind } from '../../api/engine/tools/catalog';
import { MultiLevelDropdown, type MultiLevelCategory } from '../../components/ui/dropdown';
import { CatalogueStickyHeader } from './CatalogueUI';
import { PackageLogo } from './ToolSidebarDirectory';
import { ToolPackagePanel } from './ToolPackagePanel';
import { ModelCardFrame } from './ModelSliderCard';
import { setToolkitParams } from './toolkitNavigation';
import { installStep, searchPackages, useToolInventory, useToolPackages, useToolView, type ToolPackage } from './toolPackages';
import { useCatalogueTask } from './useCatalogueTask';
import { CatalogueTaskStatus } from './CatalogueTaskStatus';

const resumeInstall: Parameters<typeof useCatalogueTask<Awaited<ReturnType<typeof resumeToolInstall>>>>[1] =
  (target, id, signal, observer) => {
    const split = target.indexOf(':');
    return resumeToolInstall(target.slice(0, split) as ToolKind, target.slice(split + 1), id, signal, observer);
  };

const KINDS: Record<RegistryKind, { title: string; subtitle: string; label: string }> = {
  mcp: { title: 'MCP Servers', subtitle: 'Standard protocol bridging your engine to external databases, APIs and environments.', label: 'MCP' },
  skill: { title: 'Agent Skills', subtitle: 'Modular agentic capabilities and workflows for tasks.', label: 'Skill' },
  plugin: { title: 'Plugins & Tools', subtitle: 'Native and community runtime plugins for your workspace.', label: 'Plugin' },
  extension: { title: 'App Extensions', subtitle: 'Bundled applications.', label: 'Extension' },
};
const ENGINE_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** A package in the catalogue's model card */
function ToolPackageCard({ item, active }: { item: ToolPackage; active: boolean }) {
  const kind = (item.tool?.kind ?? item.installed?.category ?? 'plugin') as RegistryKind;
  const version = item.details?.version || item.installed?.version;
  return <ModelCardFrame className="w-full" isActive={active}
    logo={<PackageLogo item={item} large boxed={false} />}
    badge={version ? `v${version}` : KINDS[kind].label} provider={item.details?.author || 'Local'} title={item.name}
    tags={(item.details?.tags ?? []).slice(0, 3)} description={item.details?.description || item.installed?.description || ''}
    footerStart={item.id} footerEnd={KINDS[kind].label} mark={item.installed ? 'Installed' : undefined}
    onSelect={() => setToolkitParams({ package: active ? null : item.id })} />;
}

/**
 * Toolkit → MCP Servers, Agent Skills, Plugins (and the Tools workspace's catalogue): the packages in the
 * catalogue's model cards (published, or installed with `list=installed`); an open package (`package` in the URL) shows only its page.
 */
export function ToolCatalogue({ initialKind }: { initialKind?: string } = {}) {
  const [kind, setKind] = useState(initialKind ?? ''), [query, setQuery] = useState('');
  useEffect(() => { if (initialKind !== undefined) setKind(initialKind); }, [initialKind]);
  const registryKind = (kind || undefined) as RegistryKind | undefined;
  const { catalogue, packages, engineError, inventoryReady } = useToolPackages(registryKind);
  const { listing, open } = useToolView();
  const installation = useCatalogueTask('tools.install', resumeInstall);
  const changed = useToolInventory(state => state.changed);
  const busy = installation.busy || installation.cancelling;
  useEffect(() => { if (installation.result) changed(); }, [installation.result, changed]);
  /* The running install, step by step, for this page and the sidebar */
  const setInstall = useToolInventory(state => state.setInstall);
  const running = busy && installation.receipt ? installation.receipt.target : '';
  const { step, label } = installStep(installation.task?.stage);
  useEffect(() => { setInstall(running ? { target: running, step, label } : null); }, [running, step, label, setInstall]);
  useEffect(() => () => setInstall(null), [setInstall]);
  useEffect(() => {
    if (installation.error || (installation.receipt && !installation.busy)) installation.forget();
  }, [installation.error, installation.receipt, installation.busy]);

  const shown = searchPackages(packages.filter(item => item.tool), query);
  const selected = packages.find(item => item.id === open);
  const install = async (item: ToolPackage) => {
    const tool = item.tool;
    if (!tool || tool.kind === 'extension' || !installation.canStart || !inventoryReady) return;
    const target = tool.kind;
    await installation.start(`${target}:${tool.id}`, (signal, observer) => installTool(target, tool.id, signal, observer));
  };
  const page = KINDS[registryKind ?? 'plugin'];
  const categories: MultiLevelCategory[] = [{
    id: 'kind', label: 'Package Type', icon: Boxes, selectedValue: kind, onSelect: value => setKind(value),
    options: [{ value: '', label: 'All Types' }, ...(Object.keys(KINDS) as RegistryKind[]).map(value => ({ value, label: KINDS[value].title }))],
  }];

  return <div className="w-full flex flex-col min-h-full">
    {!selected && <CatalogueStickyHeader title={registryKind ? page.title : 'Available Tools'}
      subtitle={registryKind ? page.subtitle : 'Plugins, MCP servers and skills for your workspace.'}
      searchQuery={query} onSearchChange={setQuery}
      searchPlaceholder={listing === 'installed' ? 'Search installed tools, skills, or triggers…' : 'Search packages…'}
      filterElement={initialKind ? undefined : <MultiLevelDropdown categories={categories} activeCount={kind ? 1 : 0} onClearAll={() => setKind('')} />} />}
    <div className="mx-auto w-full max-w-7xl p-6 space-y-4">
      {catalogue.error && !catalogue.reply && <p role="alert" className="text-xs text-[var(--status-error)]">The package list could not be loaded. Check your internet connection.</p>}
      {engineError && <p role="alert" className="text-xs text-[var(--status-error)]">{engineError}</p>}
      {installation.error && <CatalogueTaskStatus {...installation} />}
      {selected ? <ToolPackagePanel item={selected}
        installing={running === `${selected.tool?.kind}:${selected.id}` ? { step, label, cancel: () => void installation.cancel(),
          approval: installation.task?.stage === 'approval' ? installation.task.stageEvent : undefined } : undefined}
        canInstall={Boolean(selected.tool) && selected.tool!.kind !== 'extension' && installation.canStart && inventoryReady && ENGINE_ID.test(selected.id)}
        onInstall={() => void install(selected)} /> : <>
        {catalogue.busy && !packages.length && <p role="status" className="text-xs text-[var(--text-secondary)]">Loading packages…</p>}
        {listing === 'installed' ? <div className="py-12 text-center border border-dashed border-[var(--border-color)] rounded-2xl bg-[var(--bg-tertiary)]/20">
          <p className="text-xs font-mono text-[var(--text-muted)]">{packages.some(item => item.installed)
            ? 'Pick an installed package in the sidebar to manage it.' : 'Nothing installed here yet. Open Browse to install a package.'}</p>
        </div> : <>
          <p className="text-xs text-[var(--text-muted)]">{shown.length} packages · open one for its details</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map(item => <ToolPackageCard key={`${item.tool!.kind}:${item.id}`} item={item} active={false} />)}
          </div>
          {!catalogue.busy && catalogue.reply && !shown.length && <p className="text-xs text-[var(--text-muted)]">No packages match these filters.</p>}
        </>}
      </>}
    </div>
  </div>;
}

import { useState } from 'react';
import { Blocks, Cpu, Loader2, Search, Wrench, Zap } from 'lucide-react';
import { ThemedLogo } from './ProviderLogo';
import { Input } from '../../components/ui/Input';
import { catalogueImage } from './catalogueView';
import { ActivityPill, DirectoryRow } from './DirectoryRow';
import { ListingTabs } from './ModelListingTabs';
import { setToolkitParams, TOOLKIT_SECTIONS } from './toolkitNavigation';
import { INSTALL_STEPS, SECTION_KIND, searchPackages, useToolInventory, useToolPackages, useToolView, type ToolPackage, type ToolSection } from './toolPackages';

/** Each kind's icon, as on the Toolkit's section list */
const KIND_ICON = { mcp: Cpu, skill: Zap, plugin: Wrench, extension: Blocks } as const;

/** A package's logo (drawn in the theme's colour when it has one colour), or its kind's icon */
export function PackageLogo({ item, large = false, boxed = true }: { item: ToolPackage; large?: boolean; boxed?: boolean }) {
    const Icon = KIND_ICON[(item.tool?.kind ?? item.installed?.category ?? 'plugin') as keyof typeof KIND_ICON] ?? Wrench;
    return <ThemedLogo url={item.tool ? catalogueImage(item.details?.icon ?? '', item.tool.manifest) ?? '' : ''} large={large} boxed={boxed}
        fallback={<Icon className={`${large ? 'w-6 h-6' : 'w-4 h-4'} text-[var(--text-primary)]`} aria-hidden="true" />} />;
}

/**
 * Sidebar of Toolkit → MCP Servers, Agent Skills and Plugins, as the models sidebar: Browse (published packages)
 * or Installed (on the connected Engine), search, and the packages; one opens its page in the content pane.
 */
export function ToolSidebarDirectory({ section }: { section: ToolSection }) {
    const { catalogue, packages, installed, engineError } = useToolPackages(SECTION_KIND[section]);
    const { listing, open } = useToolView();
    const [query, setQuery] = useState('');
    const install = useToolInventory(state => state.install);
    const shown = searchPackages(listing === 'installed' ? installed : packages.filter(item => item.tool), query);
    const title = TOOLKIT_SECTIONS.find(item => item.id === section)?.label ?? section;
    const status = 'p-4 text-center text-xs text-[var(--text-muted)]';

    return (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-[var(--bg-secondary)] font-sans">
            <div className="p-3.5 pb-2.5 border-b border-[var(--border-color)] space-y-0.5">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">{title}</h2>
                    {install && <ActivityPill>{install.label} {install.step}/{INSTALL_STEPS}</ActivityPill>}
                </div>
                <p className="text-xs text-[var(--text-muted)]">Find, install and manage {title.toLowerCase()} for your Engine.</p>
            </div>
            <ListingTabs value={listing} onChange={value => setToolkitParams({ list: value === 'installed' ? value : null, package: null })}
                browse={packages.filter(item => item.tool).length} installed={installed.length} />
            <div className="p-2.5 border-b border-[var(--border-color)]">
                <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${title.toLowerCase()}…`}
                    leftIcon={<Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />} wrapperClassName="w-full" />
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {shown.map(item => <DirectoryRow key={item.id} title={item.name} subtitle={item.details?.description || item.installed?.description || item.id}
                    icon={<PackageLogo item={item} boxed={false} />} selected={open === item.id}
                    done={item.installed ? 'Installed' : undefined}
                    downloading={install && item.tool && install.target === `${item.tool.kind}:${item.id}` ? `${install.step}/${INSTALL_STEPS}` : undefined}
                    onClick={() => setToolkitParams({ package: open === item.id ? null : item.id })} />)}
                {catalogue.busy && !packages.length && <div className={`${status} flex items-center justify-center gap-2`}>
                    <Loader2 size={13} className="animate-spin" /> Reading packages…
                </div>}
                {catalogue.error && !packages.length && <button type="button" onClick={() => void catalogue.refresh()} className={`${status} w-full`} title={catalogue.error}>
                    Package list could not be read. Retry
                </button>}
                {listing === 'installed' && engineError && <p className={status} title={engineError}>Installed packages could not be read from the Engine.</p>}
                {!catalogue.busy && !shown.length && !engineError && <p className={status}>
                    {query ? <>No packages match &ldquo;{query}&rdquo;</> : listing === 'installed' ? `No ${title.toLowerCase()} installed yet. Pick one in Browse.` : 'No packages published yet.'}
                </p>}
            </div>
            <div className="p-2.5 border-t border-[var(--border-color)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />{installed.length} installed</span>
                <span className="text-[10px] font-mono">{packages.filter(item => item.tool).length} published</span>
            </div>
        </div>
    );
}

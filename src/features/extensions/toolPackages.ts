import { useCallback, useEffect, useState } from 'react';
import { create } from 'zustand';
import { toolCatalogue, type RegistryDetails, type RegistryKind, type RegistryTool } from '../../api/catalogue/tools';
import { isToolKind, listTools, type ToolCatalogEntry } from '../../api/engine/tools/catalog';
import { useConnectionStore } from '../../store/engine/useConnectionStore';
import { useCatalogue } from './useCatalogue';
import { toolkitParam } from './toolkitNavigation';
import { useToolkitUrl } from './useToolkitUrl';

/** The package kind each Toolkit section lists */
export const SECTION_KIND = { mcp: 'mcp', skills: 'skill', plugins: 'plugin' } as const;
export type ToolSection = keyof typeof SECTION_KIND;
export const isToolSection = (section: string): section is ToolSection => Object.prototype.hasOwnProperty.call(SECTION_KIND, section);

/** One package of a section: what the registry publishes, what the Engine has installed, or both */
export interface ToolPackage { id: string; name: string; tool?: RegistryTool; details?: RegistryDetails; installed?: ToolCatalogEntry }

/** An install the Engine is running: its `kind:id`, step (of `INSTALL_STEPS`) and what it is doing */
export interface ToolInstall { target: string; step: number; label: string }

/**
 * Bumped after an install or uninstall so every list re-reads the Engine's installed tools; also the
 * running install, so the sidebar shows it as the models sidebar shows a download.
 */
export const useToolInventory = create<{ revision: number; changed: () => void; install: ToolInstall | null; setInstall: (install: ToolInstall | null) => void }>(set => ({
    revision: 0,
    changed: () => set(state => ({ revision: state.revision + 1 })),
    install: null,
    setInstall: install => set({ install }),
}));

/** tools.install reports stages, not bytes: each stage is a step of the install */
export const INSTALL_STEPS = 3;
const STAGES: Record<string, [number, string]> = {
    planned: [1, 'Planning'], approval: [1, 'Waiting for approval'], installing: [2, 'Installing'], installed: [3, 'Installed'],
};
/** The step and label of an install from the stage the Engine last reported */
export const installStep = (stage?: string): { step: number; label: string } => {
    const [step, label] = (stage && Object.prototype.hasOwnProperty.call(STAGES, stage) ? STAGES[stage] : [0, 'Starting']);
    return { step, label };
};

/** Toolkit URL view of a tools section: `list` (browse | installed, as for models) and the open `package` */
export function useToolView() {
    useToolkitUrl();
    return { listing: toolkitParam('list') === 'installed' ? 'installed' as const : 'browse' as const, open: toolkitParam('package') };
}

/** A section's packages: the registry's (with their manifests read) joined with the Engine's installed ones. */
export function useToolPackages(kind?: RegistryKind) {
    const load = useCallback((refresh?: boolean) => toolCatalogue.packages(kind, refresh), [kind]);
    const catalogue = useCatalogue(load);
    const scope = useConnectionStore(state => state.getBaseUrl());
    const revision = useToolInventory(state => state.revision);
    const [installed, setInstalled] = useState<ToolCatalogEntry[]>([]);
    const [engineError, setEngineError] = useState(''), [inventoryReady, setInventoryReady] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        setInventoryReady(false);
        /* App extensions are not Engine tools: none of them is installed there */
        (kind && !isToolKind(kind) ? Promise.resolve([]) : listTools(kind, controller.signal)).then(values => { if (controller.signal.aborted) return; setInstalled(values); setEngineError(''); setInventoryReady(true); })
            .catch(error => { if (!controller.signal.aborted) { setInstalled([]); setEngineError(`Installed tool status unavailable: ${String(error)}`); } });
        return () => controller.abort();
    }, [kind, scope, revision]);

    const byId = new Map(installed.map(entry => [`${entry.category}:${entry.id}`, entry]));
    const published = (catalogue.reply?.data ?? []).map(({ tool, details }): ToolPackage =>
        ({ id: tool.id, name: details?.name || tool.id, tool, details, installed: byId.get(`${tool.kind}:${tool.id}`) }));
    const listed = new Set(published.map(item => `${item.tool!.kind}:${item.id}`));
    const local = installed.filter(entry => !listed.has(`${entry.category}:${entry.id}`))
        .map((entry): ToolPackage => ({ id: entry.id, name: entry.name || entry.id, installed: entry }));
    const packages = [...published, ...local];
    return { catalogue, packages, installed: packages.filter(item => item.installed), engineError, inventoryReady };
}

/** Packages matching the search text (name, id, author, description, tags) */
export const searchPackages = (packages: ToolPackage[], query: string) => {
    const text = query.trim().toLowerCase();
    return !text ? packages : packages.filter(item => [item.id, item.name, item.details?.author, item.details?.description,
        item.installed?.description, ...(item.details?.tags ?? [])].some(value => value?.toLowerCase().includes(text)));
};

import { MessageSquare, Sparkles } from 'lucide-react';
import type { PublicModel } from '../../api/catalogue/models';
import { modelsApi } from '../../api/engine/models/models.api';
import type { ModelRegistryEntry } from '../../api/engine/models/models.types';
import { formatModelTag } from '../../components/layout/SwipeableChatCard';
import { pushViewRoute } from '../../core/router';
import { useLayoutStore } from '../../store/ui/useLayoutStore';
import { catalogueImage, groupInstalled } from './catalogueView';
import { AccordionGroup, AccordionItem } from '../../components/ui/Accordion';
import { useFolds } from './DirectoryRow';
import { useModelCatalogueStore } from './modelCatalogueStore';

const OTHER = 'Other models';

async function chatWith(entry: ModelRegistryEntry) {
    try {
        await modelsApi.selectChatModel(entry);
        useLayoutStore.getState().setActiveView('chat');
        pushViewRoute('chat');
    } catch { /* the chat picker shows the Engine's answer */ }
}

/**
 * Local → Installed: installed models under their family (logo and name, as in Browse). The family opens its
 * page showing installed models only; a model opens its own page. Both are kept in the URL.
 */
export function InstalledFamilies({ installed, models, query }: { installed: ModelRegistryEntry[]; models: PublicModel[]; query: string }) {
    const { family, selectedModel, openFamily, setInstalledOnly } = useModelCatalogueStore();
    const folds = useFolds();
    const text = query.trim().toLowerCase();
    const groups = groupInstalled(installed, models, OTHER)
        .map(group => ({ ...group, entries: group.entries.filter(({ entry, model }) =>
            !text || [group.family, entry.id, model?.name ?? ''].some(value => value.toLowerCase().includes(text))) }))
        .filter(group => group.entries.length);

    return <>
        {groups.map(group => {
            const logo = catalogueImage(group.logo);
            const known = group.family !== OTHER;
            return <AccordionGroup key={group.family} title={group.family} count={group.entries.length} open={folds.open(group.family)}
                icon={logo ? <img src={logo} alt="" aria-hidden="true" loading="lazy" referrerPolicy="no-referrer" className="w-4 h-4 shrink-0 object-contain" />
                    : <Sparkles className="w-4 h-4 shrink-0 text-[var(--accent-color)]" />}
                onToggle={() => folds.click(group.family, !known || (family === group.family && !selectedModel),
                    () => { setInstalledOnly(true); openFamily(group.family); })}>
                {group.entries.map(({ entry, model }) => <AccordionItem key={entry.id} title={entry.id}
                    selected={!!model && selectedModel?.id === model.id}
                    onClick={() => { if (model) openFamily(model.family, model); }}
                    action={<button type="button" onClick={() => void chatWith(entry)} title="Select model and open Chat"
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-[var(--bg-tertiary)] hover:bg-[var(--accent-color)] hover:text-[var(--accent-contrast)] text-[var(--text-primary)] border border-[var(--border-color)] transition-colors cursor-pointer shrink-0">
                        <MessageSquare size={11} /> Chat
                    </button>}>
                    <span className="truncate text-[11px] leading-tight">{model?.name ?? formatModelTag(entry.id)}</span>
                </AccordionItem>)}
            </AccordionGroup>;
        })}
        {installed.length > 0 && !groups.length && <p className="p-4 text-center text-xs text-[var(--text-muted)]">No installed models match &ldquo;{query}&rdquo;</p>}
    </>;
}

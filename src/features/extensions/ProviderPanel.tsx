import { useEffect, useId, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { CatalogueChips, CatalogueHero, CatalogueImageFilters } from './CatalogueUI';
import { CloudModelCard, CloudModelGrid, listedModels } from './CloudModelGrid';
import { compareModels, providerCapabilities } from './cloudModelView';
import { FamilyRow, ModelCardTrack } from './FamilyModelSliderRow';
import { ProviderHeroLogo, ProviderLogo } from './ProviderLogo';
import { useCloudDirectory } from './useCloudDirectory';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ConfirmationModal } from '../../components/ui/modal/ConfirmationModal';
import { toast } from '../../components/ui/toast';
import { errorMessage } from '../../api/client/errors';
import type { CloudProvider } from '../../api/catalogue/providers';
import { PROVIDER_NAME, providersApi, type ModelProvider } from '../../api/engine/providers';
import { NEW_PROVIDER, useProvidersStore } from '../../store/cloud/useProvidersStore';

/** Model cards shown per provider on the overview; the provider's page shows all */
const PREVIEW = 12;
const host = (url?: string) => { try { return url ? new URL(url).hostname : ''; } catch { return ''; } };
const docsHost = (doc?: string) => doc && /^https:/.test(doc) ? host(doc) : '';
const providerHost = (url: string) => host(url) || url;

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: (id: string) => ReactNode }) {
    const id = useId();
    return <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-[var(--text-primary)]" htmlFor={id}>{label}</label>
        {children(id)}
        {hint && <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>}
    </div>;
}

/**
 * Connects a provider: a known one needs only its API key (URL and key variable come from the catalogue,
 * under Advanced); a custom endpoint also needs a name and base URL. A key left empty keeps the saved one.
 */
function ProviderForm({ preset, current, onSaved }: { preset?: CloudProvider; current?: ModelProvider; onSaved: (provider: ModelProvider) => void }) {
    const [name, setName] = useState(current?.name ?? preset?.id ?? '');
    const [url, setUrl] = useState(current?.base_url ?? preset?.api ?? '');
    const [key, setKey] = useState('');
    const [keyEnv, setKeyEnv] = useState(current ? '' : preset?.env[0] ?? '');
    const [advanced, setAdvanced] = useState(!preset);
    const [busy, setBusy] = useState(false);
    const custom = !preset && !current;
    const save = async () => {
        setBusy(true);
        try {
            const saved = await providersApi.save({ name: name.trim(), base_url: url,
                ...(key.trim() ? { api_key: key.trim() } : keyEnv.trim() ? { api_key_env: keyEnv.trim() } : {}),
                ...(current && { models: listedModels(current.models) }) });
            toast.success(current ? `${saved.name} saved` : `${saved.name} connected`);
            setKey('');
            onSaved(saved);
        } catch (reason) { toast.error(errorMessage(reason)); }
        finally { setBusy(false); }
    };
    const docs = docsHost(preset?.doc) && <>Get a key from <a href={preset!.doc} target="_blank" rel="noreferrer noopener"
        className="text-[var(--accent-color)] hover:underline">{docsHost(preset?.doc)}</a>. </>;

    return <Card><CardContent className="space-y-4 pt-5">
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
            {custom && <Field label="Name" hint={<>Letters, digits, - and _. Its models are called <code>{name.trim() || 'name'}/&lt;model&gt;</code>.</>}>
                {id => <Input id={id} value={name} onChange={event => setName(event.target.value)} autoComplete="off" />}
            </Field>}
            <Field label="API key" hint={<>{docs}The Engine keeps the key in providers.json; the App does not store it.
                {current && <> Now: {current.key}. Leave empty to keep it.</>}</>}>
                {id => <Input id={id} type="password" value={key} onChange={event => setKey(event.target.value)} autoComplete="off" />}
            </Field>
            {!custom && <Button type="button" size="sm" variant="ghost" onClick={() => setAdvanced(value => !value)}>
                {advanced ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />} Advanced
            </Button>}
            {advanced && <>
                <Field label="Base URL" hint="OpenAI-compatible or Anthropic API address, usually ending in /v1.">
                    {id => <Input id={id} value={url} onChange={event => setUrl(event.target.value)} autoComplete="off" />}
                </Field>
                <Field label="Key from an environment variable" hint="Used when the API key is empty: the Engine reads it from its environment or config/.env.">
                    {id => <Input id={id} value={keyEnv} onChange={event => setKeyEnv(event.target.value)} autoComplete="off" />}
                </Field>
            </>}
            <Button type="submit" size="sm" disabled={busy || !PROVIDER_NAME.test(name.trim()) || !url.trim()}>
                {current ? 'Save' : 'Connect'}
            </Button>
        </form>
    </CardContent></Card>;
}

/** Content pane of Toolkit → AI Models → Cloud: the provider chosen in the sidebar, or the custom endpoint form. */
export function ProviderPanel() {
    const { providers, selected, select, refresh } = useProvidersStore();
    const { catalogue, known, entries, filter } = useCloudDirectory();
    const [editing, setEditing] = useState(false);
    const [removing, setRemoving] = useState(false);
    const preset = known.find(item => item.id === selected);
    const engine = providers.find(item => item.name === selected);
    useEffect(() => setEditing(false), [selected]);
    const saved = (next: ModelProvider) => { void refresh(); select(next.name); setEditing(false); };
    const remove = async () => {
        if (!engine) return;
        try { await providersApi.remove(engine.name); toast.success(`${engine.name} disconnected`); void refresh(); }
        catch (reason) { toast.error(errorMessage(reason)); }
    };
    const name = preset?.name ?? engine?.name ?? 'Add custom';
    const models = preset?.models ?? [];

    return <div className="w-full flex flex-col min-h-full">
        <div className="mx-auto w-full max-w-7xl p-6 space-y-5">
            {selected && <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)]">
                <button type="button" onClick={() => select(null)} className="hover:text-[var(--text-primary)] cursor-pointer flex items-center gap-1.5 font-medium transition-colors">
                    <ArrowLeft size={14} /> Back to All Providers
                </button>
                <span className="text-[var(--border-color)]">/</span>
                <span className="text-[var(--accent-color)] font-bold">{name}</span>
            </div>}
            {catalogue.busy && !known.length && <p role="status">Loading providers…</p>}
            {catalogue.error && !known.length && <p role="alert">{catalogue.error}</p>}
            <CatalogueImageFilters />

            {selected === NEW_PROVIDER && <>
                <CatalogueHero title="Add custom" tags={[]}
                    description="Any OpenAI-compatible or Anthropic API: a service, a company server or one on this computer." />
                <ProviderForm onSaved={saved} />
            </>}

            {(preset || engine) && <div className="space-y-6">
                <CatalogueHero title={name} by={providerHost(engine?.base_url ?? preset!.api)} count={preset ? models.length : engine!.models.length}
                    description={engine ? `Connected · key: ${engine.key}` : 'Add your API key to use these models.'}
                    tags={[...(preset?.tested ? ['Tested with the Engine'] : []), ...providerCapabilities(models)]}
                    logo={preset && <ProviderHeroLogo id={preset.id} />} />
                <div className="flex flex-wrap gap-2">
                    {preset && docsHost(preset.doc) && <Button size="sm" variant="secondary" onClick={() => window.open(preset.doc, '_blank', 'noopener,noreferrer')}>
                        Docs <ArrowUpRight size={13} />
                    </Button>}
                    {engine && <Button size="sm" variant="secondary" onClick={() => setEditing(value => !value)}>{editing ? 'Close' : 'Key & URL'}</Button>}
                    {engine && <Button size="sm" variant="ghost" onClick={() => setRemoving(true)}><Trash2 size={13} /> Disconnect</Button>}
                </div>
                {preset && !engine && <ProviderForm key={preset.id} preset={preset} onSaved={saved} />}
                {engine && editing && <ProviderForm key={engine.name} preset={preset} current={engine} onSaved={saved} />}
                <CloudModelGrid providerId={preset?.id ?? engine!.name} preset={preset} engine={engine} onSaved={saved} />
            </div>}

            {!selected && <div className="space-y-6">
                <CatalogueChips values={filter.chips} clear={filter.clear} />
                {entries.map(({ item, engine: connected, models: matching }) => <FamilyRow key={item.id} header={{
                    logo: <ProviderLogo id={item.id} large />, name: item.name, count: matching.length,
                    by: providerHost(connected?.base_url ?? item.api),
                    description: connected ? 'Connected' : item.tested ? 'Tested with the Engine' : '',
                    tags: providerCapabilities(matching), onOpen: () => select(item.id),
                }}>
                    <ModelCardTrack items={[...matching].sort(compareModels('newest')).slice(0, PREVIEW)} keyOf={model => model.id}
                        renderCard={(model, fill) => <CloudModelCard providerId={item.id} providerName={item.name} model={model}
                            fill={fill} active={false} onSelect={() => select(item.id)} />} />
                </FamilyRow>)}
                {known.length > 0 && !entries.length && <p className="text-sm text-[var(--text-secondary)] p-6 text-center border border-dashed border-[var(--border-color)] rounded-2xl">
                    No providers to show here. Pick one in Browse, or clear the filters.
                </p>}
            </div>}
        </div>
        <ConfirmationModal open={removing} title={`Disconnect ${engine?.name ?? 'provider'}?`} isDestructive confirmText="Disconnect"
            message="Its models leave the model picker. A key kept in providers.json is deleted with it."
            onCancel={() => setRemoving(false)} onConfirm={() => { setRemoving(false); void remove(); }} />
    </div>;
}

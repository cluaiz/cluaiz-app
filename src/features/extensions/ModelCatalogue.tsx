import { useEffect, useRef, useState } from 'react';
import { modelCatalogue, modelInstallReference, type PublicModel, type PublicVariant } from '../../api/catalogue/models';
import { modelsApi } from '../../api/engine/models/models.api';
import { useConnectionStore } from '../../store/engine/useConnectionStore';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { CustomDropdown } from '../../components/ui/dropdown/CustomDropdown';
import { useCatalogue } from './useCatalogue';
import { Tabs } from '../../components/ui/Tabs';

export function ModelCatalogue() {
  const catalogue = useCatalogue(modelCatalogue.list);
  const [query, setQuery] = useState(''), [task, setTask] = useState(''), [format, setFormat] = useState('');
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [installed, setInstalled] = useState<string[]>([]), [engineError, setEngineError] = useState('');
  const [busy, setBusy] = useState(''), [notice, setNotice] = useState('');
  const [limit, setLimit] = useState(24);
  const [view, setView] = useState<'families' | 'models'>('families'), [family, setFamily] = useState('');
  const scope = useRef(0), operation = useRef<AbortController | null>(null);
  const [connection, setConnection] = useState(0);
  useEffect(() => {
    const unsubscribe = useConnectionStore.subscribe((next, previous) => {
      if (next.host !== previous.host || next.port !== previous.port || next.protocol !== previous.protocol) {
        ++scope.current; operation.current?.abort(); operation.current = null;
        setInstalled([]); setEngineError(''); setBusy(''); setNotice(''); setConnection(value => value + 1);
      }
    });
    return () => { ++scope.current; operation.current?.abort(); unsubscribe(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(), version = scope.current;
    void modelsApi.getInstalled(controller.signal).then(value => {
      if (scope.current === version && !controller.signal.aborted) { setInstalled(value.installed.map(model => model.id)); setEngineError(''); }
    }).catch(error => { if (!controller.signal.aborted && scope.current === version) setEngineError(String(error)); });
    return () => controller.abort();
  }, [connection]);
  const models = catalogue.reply?.data ?? [];
  const tasks = [...new Set(models.flatMap(model => model.tasks))].sort();
  const filtered = models.filter(model => (!task || model.tasks.includes(task))
    && (!family || model.family === family)
    && (!format || model.variants.some(v => v.format === format))
    && `${model.name} ${model.family} ${model.provider} ${model.repo}`.toLowerCase().includes(query.toLowerCase()));

  async function install(model: PublicModel, variant: PublicVariant) {
    if (operation.current) return;
    const controller = new AbortController(), version = scope.current;
    operation.current = controller; setBusy(model.id); setNotice('');
    try {
      const reference = modelInstallReference(model, variant);
      const result = await modelsApi.downloadModel({ model_id: reference }, controller.signal);
      if (version !== scope.current || controller.signal.aborted) return;
      setNotice(`${result.downloaded ? 'Downloaded' : 'Already available'}: ${result.model}`);
      try {
        const current = await modelsApi.getInstalled(controller.signal);
        if (version === scope.current && !controller.signal.aborted) { setInstalled(current.installed.map(item => item.id)); setEngineError(''); }
      } catch (error) {
        if (version === scope.current && !controller.signal.aborted) setEngineError(`Download acknowledged; installed list could not refresh: ${String(error)}`);
      }
    } catch (error) { if (version === scope.current && !controller.signal.aborted) setNotice(`Download did not complete: ${String(error)}`); }
    finally { if (operation.current === controller) { operation.current = null; setBusy(''); } }
  }
  return <div className="p-5 space-y-4">
    <div className="flex items-center justify-between gap-3">
      <div><h2 className="font-semibold">Models</h2><p className="text-sm text-[var(--text-secondary)]">Browse the Cluaiz website catalogue. Downloads run in your selected Engine.</p></div>
      <Button variant="outline" disabled={catalogue.busy} onClick={() => { void catalogue.refresh(); setConnection(value => value + 1); }}>Refresh</Button>
    </div>
    <Tabs items={[{ id: 'families', label: 'Family cards' }, { id: 'models', label: 'Single models' }]} value={view} onChange={value => { setView(value); setFamily(''); setLimit(24); }} />
    {family && <Button variant="ghost" onClick={() => { setFamily(''); setLimit(24); }}>All families · {family}</Button>}
    <div className="grid gap-3 md:grid-cols-3">
      <Input value={query} placeholder="Search models, families or providers" onChange={event => { setQuery(event.target.value); setLimit(24); }} />
      <CustomDropdown value={task} options={[{ value: '', label: 'All capabilities' }, ...tasks.map(value => ({ value, label: value }))]} onChange={value => { setTask(value); setLimit(24); }} />
      <CustomDropdown value={format} options={[{ value: '', label: 'All formats' }, { value: 'gguf', label: 'GGUF' }, { value: 'onnx', label: 'ONNX' }]} onChange={value => { setFormat(value); setLimit(24); }} />
    </div>
    {catalogue.busy && <p role="status">Loading catalogue…</p>}
    {(catalogue.error || catalogue.reply?.warning) && <p role="alert">{catalogue.error || catalogue.reply?.warning}</p>}
    {engineError && <p role="alert">Installed model status unavailable. {engineError}</p>}
    {notice && <p role="status">{notice}</p>}
    {busy && <p role="status">Downloading {busy}… Installation is confirmed only after the Engine finishes. Leaving this view stops waiting; it does not cancel the Engine download.</p>}
    {catalogue.reply && <p className="text-xs text-[var(--text-secondary)]">{filtered.length} models · Catalogue saved {new Date(catalogue.reply.saved).toLocaleString()} · Search and filters use the saved list.</p>}
    {view === 'families' && !family ? <div className="grid gap-3 lg:grid-cols-2">{[...new Set(filtered.map(model => model.family))].map(name => {
      const members = filtered.filter(model => model.family === name);
      return <Card key={name}><CardHeader><CardTitle>{name}</CardTitle></CardHeader><CardContent className="space-y-3">
        <p className="text-sm">{members[0]?.provider} · {members.length} models</p>
        <p className="text-xs">{[...new Set(members.flatMap(model => model.tasks))].join(' · ')}</p>
        <Button variant="outline" onClick={() => { setFamily(name); setLimit(24); }}>Explore family</Button>
      </CardContent></Card>;
    })}</div> : <div className="grid gap-3 lg:grid-cols-2">{filtered.slice(0, limit).map(model => {
      const variants = model.variants.filter(v => !format || v.format === format);
      const variant = variants.find(v => v.id === chosen[model.id]) ?? variants[0];
      let reference = '', refusal = '';
      try { if (variant) reference = modelInstallReference(model, variant); else refusal = 'No downloadable package is available.'; }
      catch (error) { refusal = String(error); }
      return <Card key={model.id}><CardHeader><CardTitle>{model.name || model.id}</CardTitle></CardHeader><CardContent className="space-y-3">
        <p className="text-xs text-[var(--text-secondary)]">{model.family} · {model.provider} · {model.repo}</p>
        <p className="text-sm">{model.description}</p>
        <p className="text-xs">{model.tasks.join(' · ')} · Runtime: {model.support}</p>
        {model.note && <p className="text-xs text-[var(--text-secondary)]">{model.note}</p>}
        <CustomDropdown disabled={!variants.length || !!busy} value={variant?.id} placeholder="No package available"
          options={variants.map(v => ({ value: v.id, label: `${v.format.toUpperCase()} · ${v.quant} · ${(v.bytes / 1024 ** 3).toFixed(2)} GiB`, description: `${v.file} · ${v.readiness}` }))}
          onChange={value => setChosen(previous => ({ ...previous, [model.id]: value }))} />
        {refusal && <p className="text-xs">{refusal}</p>}
        {variant && <p className="text-xs break-all">{variant.file}</p>}
        <Button disabled={!reference || !!busy || !!engineError} onClick={() => { if (variant) void install(model, variant); }}>
          {busy === model.id ? 'Downloading…' : installed.includes(reference) ? 'Check / install selected package' : 'Download selected package'}
        </Button>
      </CardContent></Card>;
    })}</div>}
    {!catalogue.busy && catalogue.reply && !filtered.length && <p>No models match these filters.</p>}
    {(view === 'models' || family) && filtered.length > limit && <Button variant="outline" onClick={() => setLimit(value => value + 24)}>Show more models</Button>}
  </div>;
}

import { useCallback, useState } from 'react';
import { Check, CheckCircle2, Copy, Download, FileText, Loader2, Pause, Play, Trash2, X } from 'lucide-react';
import { isCompanion, modelInstallReference, modelReadme, variantTag, type PublicModel, type PublicVariant } from '../../api/catalogue/models';
import type { ModelRegistryEntry } from '../../api/engine/models/models.types';
import { HoldButton } from '../../components/HoldButton/HoldButton';
import { DANGER_HOLD } from '../../components/HoldButton/dangerHold';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { CustomDropdown } from '../../components/ui/dropdown';
import { MarkdownRenderer, parseMarkdownWithFrontmatter } from '../../components/ui/MarkdownRenderer';
import { chooseModelVariant, installedModelForVariant } from './catalogueView';
import { SpecList } from './CatalogueUI';
import type { CachedHardwareProfile } from './hardwareRecommendation';
import { useCatalogue } from './useCatalogue';
import { useModelDownloadStore } from './modelDownloadStore';

interface Props {
  model: PublicModel;
  installed: ModelRegistryEntry[];
  selectedVariantId?: string;
  onSelectVariant(id: string): void;
  onInstall(model: PublicModel, variant: PublicVariant): Promise<void>;
  onUninstall(entry: ModelRegistryEntry): Promise<void>;
  /** Pauses the running download (what arrived is kept) */
  onPause(): void;
  /** Stops the running download and deletes what arrived */
  onCancel(): void;
  /** Deletes what a paused download of this reference left */
  onDiscard(reference: string): void;
  canStart: boolean;
  inventoryReady: boolean;
  hardware: CachedHardwareProfile | null;
}

const gib = (bytes: number) => bytes > 0 ? `${(bytes / 1024 ** 3).toFixed(2)} GiB` : 'Unknown';
/** The catalogue's quantization with its size, and the file's own tag where it says more ('Q4_K' is 'UD-Q4_K_XL') */
function quantChoice(model: PublicModel, item: PublicVariant) {
  let tag = '';
  try { tag = variantTag(model, item); } catch { /* the panel shows the refusal for the chosen package */ }
  const duplicateQuant = model.variants.some(other => other.id !== item.id && other.quant === item.quant);
  const detail = duplicateQuant ? ` · ${item.file}` : tag && tag.toUpperCase() !== item.quant.toUpperCase() ? ` · ${tag}` : '';
  return { value: item.id, label: item.quant, description: gib(item.bytes) + detail };
}

/** A paused download: a click continues it from what arrived, a hold deletes that */
function PausedButton({ percent, onResume, onDiscard }: { percent: number | null; onResume: () => void; onDiscard: () => void }) {
  return <span className="inline-flex" title="Click to resume, hold to cancel and delete what was downloaded">
    <HoldButton {...DANGER_HOLD} backgroundColor="var(--bg-tertiary)" textColor="var(--text-primary)" size="sm" radius={8} glow={false}
      icon={<Play size={14} />} doneLabel="Cancelling…" onTap={onResume} onHold={onDiscard}>
      Resume{percent === null ? '' : ` · ${percent}%`}
    </HoldButton>
  </span>;
}

/**
 * The Download (or Install) button while it runs: the background fills with its progress. With `onCancel`, a pointer
 * over it offers to stop it: a click (`cancel="click"`) or a hold (`cancel="hold"`, the red hold look).
 */
export function DownloadingButton({ percent, label = 'Downloading', progressText, onCancel, onPause, cancel = 'click' }: {
  percent?: number; label?: string; /** Shown after the label instead of the percent ('2/3') */ progressText?: string;
  onCancel?: () => void; cancel?: 'click' | 'hold';
  /** With `cancel="hold"`: a click pauses (what arrived is kept), a hold cancels */
  onPause?: () => void;
}) {
  const [over, setOver] = useState(false);
  const offer = Boolean(onCancel) && over;
  if (offer && cancel === 'hold') return <span onMouseLeave={() => setOver(false)} className="inline-flex"
    title={onPause ? 'Click to pause, hold to cancel' : 'Hold to cancel'}>
    <HoldButton {...DANGER_HOLD} size="sm" radius={8} glow={false} icon={onPause ? <Pause size={14} /> : <X size={14} />} doneLabel="Cancelling…"
      onTap={onPause} onHold={() => onCancel?.()}>{onPause ? 'Pause · hold to cancel' : 'Hold to cancel'}</HoldButton>
  </span>;
  return <Button variant="secondary" size="sm" disabled={!onCancel} aria-busy="true" className="relative overflow-hidden !opacity-100"
    onMouseEnter={() => setOver(true)} onMouseLeave={() => setOver(false)} onClick={cancel === 'click' ? onCancel : undefined}
    title={onCancel ? (cancel === 'click' ? 'Click to cancel' : 'Hold to cancel') : undefined}>
    <span aria-hidden="true" style={percent === undefined ? undefined : { width: `${percent}%` }}
      className={`absolute inset-y-0 left-0 bg-[var(--accent-color)]/40 transition-[width] duration-500 ${percent === undefined ? 'w-1/3 animate-pulse' : ''}`} />
    <span className="relative flex items-center gap-1.5">{offer
      ? <><X size={14} /> Cancel</>
      : <><Loader2 size={14} className="animate-spin" />{label}{progressText ? ` · ${progressText}` : percent === undefined ? '…' : ` · ${percent}%`}</>}</span>
  </Button>;
}

function ModelReadme({ model }: { model: PublicModel }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one read per model, not per render of its object
  const load = useCallback((refresh?: boolean) => modelReadme(model, refresh), [model.familyId, model.id]);
  const readme = useCatalogue(load);
  const body = parseMarkdownWithFrontmatter(readme.reply?.data ?? '').cleanBody.trim();
  if (readme.busy) return <p role="status" className="text-xs text-[var(--text-secondary)]">Loading README…</p>;
  if (!body) return null;
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText size={15} /> README</CardTitle></CardHeader>
    <CardContent><MarkdownRenderer content={body} /></CardContent>
  </Card>;
}

/** Download first (quantization, its size, the button), then specifications, the run command and the README. */
export function ModelPackagePanel(props: Props) {
  const { model } = props;
  const variant = chooseModelVariant(model, model.variants, props.selectedVariantId, props.installed);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  let reference = '', unavailable = '';
  try {
    if (variant) reference = modelInstallReference(model, variant);
    else unavailable = 'No downloadable packages are listed for this model.';
  } catch (error) {
    unavailable = error instanceof Error ? error.message : String(error);
  }
  const installed = installedModelForVariant(props.installed, model, variant);
  const download = useModelDownloadStore(state => state.download);
  const paused = useModelDownloadStore(state => state.paused);
  const packages = model.variants.filter(item => !isCompanion(model, item));
  const command = reference ? `cluaiz run ${reference}` : '';
  const size = variant ? gib(variant.bytes) : 'Unknown';
  const specs: [string, string][] = [
    ['Parameters', model.parameters || 'Not reported'],
    ['Download size', size],
    ['Context window', model.context || 'Not reported'],
    ['Quantization', variant?.quant || 'Not reported'],
    ['Format', variant?.format.toUpperCase() || 'Not reported'],
    ['Architecture', model.architecture || 'Not reported'],
    ['Provider', model.provider || 'Not reported'],
    ['Downloads', model.downloads == null ? 'Not reported' : model.downloads.toLocaleString()],
    ['Tasks', model.tasks.join(', ') || 'Not reported'],
  ];
  const choose = (id: string) => { props.onSelectVariant(id); setCopied(false); setCopyError(''); };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true); setCopyError('');
    } catch {
      setCopyError('Unable to copy. Select the command text to copy it manually.');
    }
  };

  return <section className="space-y-4 border-t border-[var(--border-color)] pt-5" aria-label="Selected model package">
    <Card><CardContent className="p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{model.name || model.id}</p>
          <p className="text-xs text-[var(--text-secondary)]">{new Set(packages.map(item => item.quant)).size} quantizations · {packages.length} packages · install on your connected Engine</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-48 shrink-0">
            <CustomDropdown floating value={variant?.id} onChange={choose}
              options={packages.map(item => quantChoice(model, item))} />
          </div>
          {installed ? <>
            <Badge variant="outline"><CheckCircle2 size={14} className="text-emerald-400" /> Installed</Badge>
            <HoldButton {...DANGER_HOLD} size="sm" radius={8} glow={false} icon={<Trash2 size={14} />} doneLabel="Uninstalling…"
              onHold={() => void props.onUninstall(installed)}>Hold to uninstall</HoldButton>
          </> : download?.target === reference && reference ? <DownloadingButton percent={download.percent} cancel="hold" onPause={props.onPause} onCancel={props.onCancel} />
            : reference && Object.prototype.hasOwnProperty.call(paused, reference) ? <PausedButton percent={paused[reference]}
              onResume={() => { if (variant && !download) void props.onInstall(model, variant); }} onDiscard={() => props.onDiscard(reference)} /> :
            <Button size="sm" disabled={!reference || !props.inventoryReady || !props.canStart || Boolean(download)}
              title={download ? 'Another model is downloading; one download runs at a time' : undefined}
              onClick={() => { if (variant) void props.onInstall(model, variant); }}>
              <Download size={14} /> Download package · {size}
            </Button>}
        </div>
      </div>
      {unavailable && <p role="alert" className="text-sm text-[var(--status-error)]">{unavailable}</p>}
    </CardContent></Card>

    <Card><CardHeader><CardTitle>Specifications</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <SpecList specs={specs} />
        {props.hardware && <p className="text-xs text-[var(--text-secondary)]">
          Device memory: {props.hardware.ramGb} GB RAM · {props.hardware.vramGb} GB VRAM
        </p>}
      </CardContent>
    </Card>

    {command && <Card><CardContent className="flex flex-wrap items-center gap-3 p-4">
      <code className="min-w-0 flex-1 break-all text-xs text-[var(--text-primary)]">{command}</code>
      <Button variant="secondary" size="sm" onClick={() => void copy()}>
        {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy command'}
      </Button>
      {copyError && <p role="alert" className="basis-full text-xs text-[var(--status-error)]">{copyError}</p>}
    </CardContent></Card>}

    <ModelReadme model={model} />
  </section>;
}

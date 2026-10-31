import { useState } from 'react';
import { Check, CheckCircle2, Copy, Download } from 'lucide-react';
import { modelInstallReference, type ModelInstallSource, type PublicModel, type PublicVariant } from '../../api/catalogue/models';
import type { ModelRegistryEntry } from '../../api/engine/models/models.types';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { chooseModelVariant, installedModelForVariant } from './catalogueView';
import type { CachedHardwareProfile } from './hardwareRecommendation';

interface Props {
  model: PublicModel;
  installed: ModelRegistryEntry[];
  source: ModelInstallSource;
  selectedVariantId?: string;
  onSelectVariant(id: string): void;
  onInstall(model: PublicModel, variant: PublicVariant): Promise<void>;
  canStart: boolean;
  inventoryReady: boolean;
  hardware: CachedHardwareProfile | null;
}

/** One package choice owns the displayed size, command and Engine download target. */
export function ModelPackagePanel(props: Props) {
  const { model } = props;
  const variant = chooseModelVariant(model, model.variants, props.selectedVariantId);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  let reference = '', unavailable = '';
  try {
    if (variant) reference = modelInstallReference(model, variant, props.source);
    else unavailable = 'No downloadable packages are listed for this model.';
  } catch (error) {
    unavailable = error instanceof Error ? error.message : String(error);
  }
  const installed = Boolean(installedModelForVariant(props.installed, model, variant));
  const command = reference ? `cluaiz run ${reference}` : '';
  const size = variant && variant.bytes > 0 ? `${(variant.bytes / 1024 ** 3).toFixed(2)} GiB` : 'Unknown';
  const specs = [
    ['Parameters', model.parameters || 'Not reported'],
    ['Download size', size],
    ['Context window', model.context || 'Not reported'],
    ['Architecture', model.architecture || 'Not reported'],
    ['Format', variant?.format.toUpperCase() || 'Not reported'],
    ['Provider', model.provider || 'Not reported'],
  ];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true); setCopyError('');
    } catch {
      setCopyError('Unable to copy. Select the command text to copy it manually.');
    }
  };

  return <section className="space-y-4 border-t border-[var(--border-color)] pt-5" aria-label="Selected model package">
    <Card><CardHeader><CardTitle>Packages &amp; specifications</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-xs text-[var(--text-secondary)] mb-2">Choose a package · {model.variants.length} available</legend>
          <div className="flex flex-wrap gap-2">
            {model.variants.map(item => <Button key={item.id} size="sm"
              variant={variant?.id === item.id ? 'default' : 'secondary'}
              aria-pressed={variant?.id === item.id}
              title={`${item.quant} · ${item.file}`}
              onClick={() => { props.onSelectVariant(item.id); setCopied(false); setCopyError(''); }}>
              {variant?.id === item.id && <Check size={12} aria-hidden="true" />}
              {item.quant}
              {model.variants.filter(other => other.quant === item.quant).length > 1 &&
                <span className="max-w-40 truncate text-xs">{item.file}</span>}
            </Button>)}
          </div>
        </fieldset>
        {variant && <p className="text-xs break-all text-[var(--text-secondary)]">{variant.file}</p>}
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
          {specs.map(([label, value]) => <div key={label} className="min-w-0">
            <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
            <dd className="text-sm text-[var(--text-primary)] break-words mt-1">{value}</dd>
          </div>)}
        </dl>
        {props.hardware && <p className="text-xs text-[var(--text-secondary)]">
          Device memory: {props.hardware.ramGb} GB RAM · {props.hardware.vramGb} GB VRAM
        </p>}
        {unavailable && <p role="alert" className="text-sm text-[var(--status-error)]">{unavailable}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-color)] pt-4">
          <span className="text-xs text-[var(--text-secondary)]">Install on your connected Engine</span>
          {installed ? <Badge variant="outline"><CheckCircle2 size={14} /> Installed</Badge> :
            <Button variant="secondary" size="sm" disabled={!reference || !props.inventoryReady || !props.canStart}
              onClick={() => { if (variant) void props.onInstall(model, variant); }}>
              <Download size={14} /> Download package{variant?.bytes ? ` (${size})` : ''}
            </Button>}
        </div>
      </CardContent>
    </Card>
    {command && <Card><CardContent className="flex flex-wrap items-center gap-3 p-4">
      <code className="min-w-0 flex-1 break-all text-xs text-[var(--text-primary)]">{command}</code>
      <Button variant="secondary" size="sm" onClick={() => void copy()}>
        {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy command'}
      </Button>
      {copyError && <p role="alert" className="basis-full text-xs text-[var(--status-error)]">{copyError}</p>}
    </CardContent></Card>}
  </section>;
}

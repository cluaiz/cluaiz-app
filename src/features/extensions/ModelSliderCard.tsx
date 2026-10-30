import React, { useState } from 'react';
import { ArrowUpRight, CheckCircle2, Download } from 'lucide-react';
import type { PublicModel, PublicVariant } from '../../api/catalogue/models';
import type { ModelRegistryEntry } from '../../api/engine/models/models.types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CatalogueLogo } from './CatalogueUI';
import { installedModelForVariant } from './catalogueView';

export interface ModelSliderCardProps {
  model: PublicModel;
  installed: ModelRegistryEntry[];
  isBusy: boolean;
  downloadingTarget?: string;
  onDownload: (model: PublicModel, variant: PublicVariant) => void;
  onSelectModel: (model: PublicModel) => void;
}

export const ModelSliderCard: React.FC<ModelSliderCardProps> = ({
  model,
  installed,
  isBusy,
  downloadingTarget,
  onDownload,
  onSelectModel,
}) => {
  const [selectedVariant, setSelectedVariant] = useState<PublicVariant | null>(null);

  const variants = model.variants || [];
  const currentVariant = selectedVariant || variants[0] || null;

  const isCurrentInstalled = currentVariant
    ? !!installedModelForVariant(installed, model, currentVariant)
    : false;

  const isDownloadingCurrent = Boolean(
    isBusy && downloadingTarget && currentVariant && downloadingTarget.includes(currentVariant.quant)
  );

  const deploySpec = currentVariant
    ? `${model.id.toLowerCase()}:latest:${currentVariant.format.toLowerCase()}:${currentVariant.quant.toLowerCase()}`
    : `${model.id.toLowerCase()}:latest:gguf:q4_k_m`;

  return (
    <div className="group relative flex flex-col justify-between gap-4 p-4 sm:p-5 mx-2 border-2 border-[var(--border-color)] bg-[var(--bg-secondary)] transition-all min-w-[340px] sm:min-w-[420px] text-left rounded-xl select-none">
      {/* Top Section: Logo + Details (Exact cluaiz.com style) */}
      <div className="flex flex-row items-start sm:items-center gap-4 w-full">
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 border-2 border-[var(--border-color)] bg-[var(--bg-tertiary)] overflow-hidden shrink-0 flex items-center justify-center rounded-lg">
          <CatalogueLogo source={model.logo} name={model.name || model.id} large />
        </div>

        <div className="flex flex-col gap-1 w-full overflow-hidden">
          {/* Top Header Badge & Provider */}
          <div className="flex items-center gap-2">
            <span className="bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] font-bold text-[11px] px-1.5 py-0.5 tracking-wider uppercase font-mono rounded">
              {model.parameters || model.id}
            </span>
            <span className="text-[10px] sm:text-[11px] font-mono text-[var(--text-muted)] font-bold uppercase tracking-wider truncate">
              {model.provider || 'CLUAIZ'}
            </span>
          </div>

          {/* Title */}
          <span className="font-bold text-lg sm:text-xl font-mono uppercase text-[var(--text-primary)] leading-tight tracking-tight truncate">
            {model.name || model.id}
          </span>

          {/* Capabilities Tags */}
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5 overflow-hidden">
            {model.tasks?.slice(0, 3).map((cap: string, i: number) => (
              <span
                key={i}
                className="text-[9px] font-mono font-bold border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-1.5 py-0.5 uppercase whitespace-nowrap rounded"
              >
                {cap}
              </span>
            ))}
            {model.context && (
              <span className="text-[9px] font-mono font-bold border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-1.5 py-0.5 uppercase whitespace-nowrap rounded">
                {model.context} ctx
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quantizations Selector Pills */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
          <span>Select Quantization:</span>
          <span>{variants.length} packages</span>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-18 overflow-y-auto custom-scrollbar">
          {variants.map((v) => {
            const isSelected = currentVariant?.id === v.id;
            const isInstalled = !!installedModelForVariant(installed, model, v);

            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVariant(v)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1 border ${
                  isSelected
                    ? 'bg-[var(--accent-color)] text-[var(--bg-primary)] border-[var(--accent-color)] font-bold shadow-xs'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)] hover:border-[var(--accent-color)]/40'
                }`}
              >
                <span>{v.quant}</span>
                <span className="text-[10px] opacity-75">· {(v.bytes / 1024 ** 3).toFixed(1)}G</span>
                {isInstalled && <CheckCircle2 size={10} className="text-[var(--status-success)]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Section: Deploy Spec & Download Action */}
      <div className="pt-2.5 border-t border-[var(--border-color)] flex items-center justify-between gap-2 mt-auto">
        <div className="min-w-0">
          <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] tracking-wider uppercase block truncate max-w-[200px]">
            {deploySpec}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onSelectModel(model)}
            className="text-[11px] text-[var(--accent-color)] hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
          >
            Details <ArrowUpRight size={11} />
          </button>

          {currentVariant && (
            isCurrentInstalled ? (
              <Badge variant="outline" className="text-xs text-[var(--status-success)] border-[var(--status-success)]/40 flex items-center gap-1 font-semibold py-1">
                <CheckCircle2 size={12} /> Installed
              </Badge>
            ) : (
              <Button
                size="sm"
                disabled={isDownloadingCurrent}
                onClick={() => onDownload(model, currentVariant)}
                className="text-xs font-semibold gap-1.5 py-1 px-3 h-7"
              >
                <Download size={12} />
                {isDownloadingCurrent ? 'Downloading…' : 'Download'}
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
};

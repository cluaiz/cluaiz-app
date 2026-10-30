import React, { useState } from 'react';
import { ArrowUpRight, CheckCircle2, Download } from 'lucide-react';
import type { PublicModel, PublicVariant } from '../../api/catalogue/models';
import type { ModelRegistryEntry } from '../../api/engine/models/models.types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CatalogueLogo } from './CatalogueUI';
import { cleanModelDescription, installedModelForVariant } from './catalogueView';

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

  const cleanDesc = cleanModelDescription(model.description);

  const deploySpec = currentVariant
    ? `${model.id.toLowerCase()}:latest:${currentVariant.format.toLowerCase()}:${currentVariant.quant.toLowerCase()}`
    : `${model.id.toLowerCase()}:latest:gguf:q4_k_m`;

  return (
    <div className="group relative flex flex-col justify-between gap-3 p-4 sm:p-5 mx-1 border-2 border-[var(--border-color)] bg-[var(--bg-secondary)] transition-colors w-[340px] sm:w-[380px] max-w-[380px] shrink-0 text-left rounded-xl select-none overflow-hidden">
      {/* Top Section: Logo + Header Details */}
      <div className="flex flex-row items-start sm:items-center gap-3.5 w-full overflow-hidden">
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 border-2 border-[var(--border-color)] bg-[var(--bg-tertiary)] overflow-hidden shrink-0 flex items-center justify-center rounded-lg">
          <CatalogueLogo source={model.logo} name={model.name || model.id} large />
        </div>

        <div className="flex flex-col gap-1 w-full min-w-0 overflow-hidden">
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

      {/* Short Description */}
      {cleanDesc && (
        <p className="text-xs text-[var(--text-secondary)] line-clamp-1 truncate">
          {cleanDesc}
        </p>
      )}

      {/* Quantization Section: Smart 1 vs Multiple handling */}
      {variants.length <= 1 ? (
        /* Single Quantization: Direct clean label, no dots or slider */
        <div className="pt-2 border-t border-[var(--border-color)]/60 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Package:</span>
            <span className="font-bold text-[var(--text-primary)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded border border-[var(--border-color)] truncate">
              {currentVariant?.quant || 'Default'}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] uppercase">
              {currentVariant?.format}
            </span>
          </div>
          <span className="font-bold text-[var(--accent-color)] text-xs shrink-0 ml-2">
            {currentVariant ? `${(currentVariant.bytes / 1024 ** 3).toFixed(2)} GiB` : ''}
          </span>
        </div>
      ) : (
        /* Multiple Quantizations: Compact Square Dots Stepper */
        <div className="space-y-1.5 pt-2 border-t border-[var(--border-color)]/60">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Quant:</span>
              <span className="font-bold text-[var(--text-primary)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded border border-[var(--border-color)] truncate">
                {currentVariant?.quant}
              </span>
              <span className="text-[10px] text-[var(--text-muted)] uppercase">
                {currentVariant?.format}
              </span>
            </div>
            <div className="text-right shrink-0 ml-2">
              <span className="font-bold text-[var(--accent-color)] font-mono text-xs">
                {currentVariant ? `${(currentVariant.bytes / 1024 ** 3).toFixed(2)} GiB` : ''}
              </span>
            </div>
          </div>

          {/* Stepped Square Dots Row */}
          <div className="flex items-center gap-1 w-full overflow-x-auto no-scrollbar py-0.5">
            {variants.map((v) => {
              const isSelected = currentVariant?.id === v.id;
              const isInstalled = !!installedModelForVariant(installed, model, v);

              return (
                <button
                  key={v.id}
                  type="button"
                  title={`${v.quant} · ${(v.bytes / 1024 ** 3).toFixed(1)} GiB`}
                  onClick={() => setSelectedVariant(v)}
                  className={`h-6 px-1.5 rounded-[4px] text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 shrink-0 border ${
                    isSelected
                      ? 'bg-[var(--accent-color)] text-[var(--bg-primary)] border-[var(--accent-color)] shadow-xs scale-105 z-10'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-primary)] hover:border-[var(--accent-color)]/50'
                  }`}
                >
                  <span>{v.quant}</span>
                  {isInstalled && (
                    <CheckCircle2
                      size={9}
                      className={isSelected ? 'text-[var(--bg-primary)]' : 'text-[var(--status-success)]'}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Section: Deploy Spec & Download Action */}
      <div className="pt-2.5 border-t border-[var(--border-color)] flex items-center justify-between gap-2 mt-auto w-full">
        <div className="min-w-0 overflow-hidden">
          <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] tracking-wider uppercase block truncate max-w-[170px]">
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
                className="text-xs font-semibold gap-1.5 py-1 px-3 h-7 cursor-pointer"
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

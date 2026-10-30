import React, { useState } from 'react';
import { ArrowUpRight, CheckCircle2, Download } from 'lucide-react';
import type { PublicModel, PublicVariant } from '../../api/catalogue/models';
import type { ModelRegistryEntry } from '../../api/engine/models/models.types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CatalogueLogo, CatalogueTags } from './CatalogueUI';
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

  return (
    <div className="w-[300px] sm:w-[350px] shrink-0 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)]/70 p-4 flex flex-col justify-between gap-3 text-left transition-colors duration-150 hover:border-[var(--accent-color)]/50 group select-none">
      {/* Model Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <CatalogueLogo source={model.logo} name={model.name || model.id} />
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
              {model.name || model.id}
            </h4>
            <p className="text-[11px] text-[var(--text-muted)] truncate">
              {[model.parameters, model.architecture, model.context ? `${model.context} ctx` : ''].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        {model.parameters && (
          <Badge variant="outline" className="text-[10px] font-mono font-bold shrink-0">
            {model.parameters}
          </Badge>
        )}
      </div>

      {/* Capability Tags */}
      {model.tasks && model.tasks.length > 0 && (
        <CatalogueTags values={model.tasks} />
      )}

      {/* Short Description */}
      {cleanDesc && (
        <p className="text-xs leading-4.5 text-[var(--text-secondary)] line-clamp-2 min-h-9">
          {cleanDesc}
        </p>
      )}

      {/* Quantization Variants Selector */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          <span>Quantization:</span>
          <span className="font-mono">{variants.length} packages</span>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto custom-scrollbar">
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
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]/60 hover:text-[var(--text-primary)] hover:border-[var(--accent-color)]/40'
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

      {/* Bottom Download & Details Bar */}
      <div className="pt-2.5 border-t border-[var(--border-color)]/60 flex items-center justify-between gap-2 mt-auto">
        <button
          type="button"
          onClick={() => onSelectModel(model)}
          className="text-[11px] text-[var(--accent-color)] hover:underline flex items-center gap-1 cursor-pointer font-medium"
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
              className="text-xs font-semibold gap-1.5 py-1 px-2.5 h-7"
            >
              <Download size={12} />
              {isDownloadingCurrent ? 'Downloading…' : 'Download'}
            </Button>
          )
        )}
      </div>
    </div>
  );
};

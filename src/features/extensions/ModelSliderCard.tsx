import React from 'react';
import type { PublicModel, PublicVariant } from '../../api/catalogue/models';
import type { ModelRegistryEntry } from '../../api/engine/models/models.types';
import { CatalogueLogo } from './CatalogueUI';
import { cleanModelDescription } from './catalogueView';
import { Card } from '../../components/ui/Card';

export interface ModelSliderCardProps {
  model: PublicModel;
  installed: ModelRegistryEntry[];
  isBusy: boolean;
  downloadingTarget?: string;
  className?: string;
  isActive?: boolean;
  onDownload?: (model: PublicModel, variant: PublicVariant) => void;
  onSelectModel: (model: PublicModel) => void;
}

export const ModelSliderCard: React.FC<ModelSliderCardProps> = ({
  model,
  className,
  isActive = false,
  onSelectModel,
}) => {

  const variants = model.variants || [];

  const cleanDesc = cleanModelDescription(model.description)
    || cleanModelDescription(model.familyDescription)
    || 'Foundation model ready for inference.';

  const borderClasses = isActive
    ? 'border-2 border-[var(--accent-color)] ring-1 ring-[var(--accent-color)] shadow-sm shadow-[var(--accent-color)]/20'
    : 'border-2 border-[var(--border-color)] hover:border-[var(--accent-color)]/60';

  const containerClasses = className
    ? `group relative flex flex-col justify-between gap-3 p-3 sm:p-5 ${borderClasses} bg-[var(--bg-secondary)] transition-all text-left rounded-xl select-none overflow-hidden cursor-pointer ${className}`
    : `group relative flex flex-col justify-between gap-3 p-3 sm:p-5 mx-0.5 sm:mx-1 ${borderClasses} bg-[var(--bg-secondary)] transition-all w-[270px] sm:w-[350px] md:w-[380px] max-w-[calc(100vw-2.5rem)] shrink-0 text-left rounded-xl select-none overflow-hidden cursor-pointer`;

  return (
    <Card
      role="button" tabIndex={0} aria-pressed={isActive}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectModel(model); }
      }}
      onClick={() => onSelectModel(model)}
      className={containerClasses}
      title={`View ${model.name || model.id} details`}
    >
      {/* Top Section: Logo + Header Details */}
      <div
        className="flex flex-row items-start sm:items-center gap-2.5 sm:gap-3.5 w-full overflow-hidden group/cardheader"
      >
        <div className="relative w-11 h-11 sm:w-14 sm:h-14 border-2 border-[var(--border-color)] bg-[var(--bg-tertiary)] overflow-hidden shrink-0 flex items-center justify-center rounded-lg group-hover/cardheader:border-[var(--accent-color)]/60 transition-colors">
          <CatalogueLogo source={model.logo} name={model.name || model.id} large />
        </div>

        <div className="flex flex-col gap-0.5 w-full min-w-0 overflow-hidden">
          {/* Top Header Badge & Provider */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] font-bold text-[10px] sm:text-[11px] px-1.5 py-0.2 tracking-wider uppercase font-mono rounded">
              {model.parameters || model.id}
            </span>
            <span className="text-[10px] sm:text-[11px] font-mono text-[var(--text-muted)] font-bold uppercase tracking-wider truncate">
              {model.provider || 'CLUAIZ'}
            </span>
          </div>

          {/* Title (Fluid text scaling down to 300px viewports) */}
          <span className="font-bold text-sm sm:text-lg font-mono uppercase text-[var(--text-primary)] group-hover/cardheader:text-[var(--accent-color)] transition-colors leading-tight tracking-tight truncate">
            {model.name || model.id}
          </span>

          {/* Capabilities Tags */}
          <div className="flex flex-wrap items-center gap-1 mt-0.5 overflow-hidden">
            {model.tasks?.slice(0, 2).map((cap: string, i: number) => (
              <span
                key={i}
                className="text-[9px] font-mono font-bold border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-1.5 py-0.2 uppercase whitespace-nowrap rounded"
              >
                {cap}
              </span>
            ))}
            {model.context && (
              <span className="text-[9px] font-mono font-bold border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-1.5 py-0.2 uppercase whitespace-nowrap rounded">
                {model.context} ctx
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Short Description (Clickable) */}
      {cleanDesc && (
        <p
          onClick={() => onSelectModel(model)}
          className="text-xs text-[var(--text-secondary)] line-clamp-1 truncate cursor-pointer hover:text-[var(--text-primary)] transition-colors"
        >
          {cleanDesc}
        </p>
      )}

      <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
        <span>{variants.length} {variants.length === 1 ? 'package' : 'packages'}</span>
        <span className="uppercase">{[...new Set(variants.map(variant => variant.format))].join(' · ')}</span>
      </div>
    </Card>
  );
};

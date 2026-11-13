import React from 'react';
import { CheckCircle2, Circle, Download } from 'lucide-react';
import type { PublicModel, PublicVariant } from '../../api/catalogue/models';
import type { ModelRegistryEntry } from '../../api/engine/models/models.types';
import { CatalogueLogo } from './CatalogueUI';
import { cleanModelDescription, isModelInstalled } from './catalogueView';
import { Card } from '../../components/ui/Card';
import { useRepoDownload, type ModelDownload } from './modelDownloadStore';

export interface ModelCardFrameProps {
  logo: React.ReactNode;
  badge: string;
  provider: string;
  title: string;
  tags: string[];
  description: string;
  footerStart: React.ReactNode;
  footerEnd: React.ReactNode;
  className?: string;
  isActive?: boolean;
  /** Label of the green check in the corner (installed, in the model picker) */
  mark?: string;
  /** Makes the corner check a toggle: an empty circle labelled `toggleLabel` adds, the green check removes */
  onToggleMark?: () => void;
  toggleLabel?: string;
  /** A download of this model is running: the footer says so and a bar along the bottom fills */
  downloading?: ModelDownload | null;
  onSelect: () => void;
}

/** The catalogue's model card; local packages and provider models fill it with their own facts. */
export const ModelCardFrame: React.FC<ModelCardFrameProps> = ({
  logo,
  badge,
  provider,
  title,
  tags,
  description,
  footerStart,
  footerEnd,
  className,
  isActive = false,
  mark,
  onToggleMark,
  toggleLabel,
  downloading,
  onSelect,
}) => {
  const borderClasses = isActive
    ? 'border-2'
    : 'border-2 border-[var(--border-color)] hover:border-[var(--accent-color)]/60';

  const containerClasses = className
    ? `group relative flex flex-col justify-between gap-3 p-3 sm:p-5 ${borderClasses} bg-[var(--bg-secondary)] transition-all text-left rounded-xl select-none overflow-hidden cursor-pointer ${className}`
    : `group relative flex flex-col justify-between gap-3 p-3 sm:p-5 mx-0.5 sm:mx-1 ${borderClasses} bg-[var(--bg-secondary)] transition-all w-[270px] sm:w-[350px] md:w-[380px] max-w-[calc(100vw-2.5rem)] shrink-0 text-left rounded-xl select-none overflow-hidden cursor-pointer`;

  return (
    <Card
      role="button" tabIndex={0} aria-pressed={isActive}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(); }
      }}
      onClick={onSelect}
      className={containerClasses}
      /* .ui-card sets its own border; the selected card's softened accent border must win over it */
      style={isActive ? { borderColor: 'color-mix(in srgb, var(--accent-color) 55%, var(--border-color))' } : undefined}
      title={`View ${title} details`}
    >
      {onToggleMark ? <button type="button" aria-pressed={Boolean(mark)} title={mark ? `${mark} · click to remove` : toggleLabel}
        onClick={event => { event.stopPropagation(); onToggleMark(); }} onKeyDown={event => event.stopPropagation()}
        className={`absolute top-2 right-2 p-0.5 rounded-full cursor-pointer transition-colors ${mark ? 'text-emerald-400' : 'text-[var(--text-muted)] hover:text-[var(--accent-color)]'}`}>
        {mark ? <CheckCircle2 size={16} /> : <Circle size={16} />}
      </button>
        : mark && <CheckCircle2 size={16} role="img" aria-label={mark} className="absolute top-2.5 right-2.5 text-emerald-400"><title>{mark}</title></CheckCircle2>}

      {/* Top Section: Logo + Header Details */}
      <div
        className="flex flex-row items-start sm:items-center gap-2.5 sm:gap-3.5 w-full overflow-hidden group/cardheader"
      >
        <div className="relative w-11 h-11 sm:w-14 sm:h-14 border-2 border-[var(--border-color)] bg-[var(--bg-tertiary)] overflow-hidden shrink-0 flex items-center justify-center rounded-lg group-hover/cardheader:border-[var(--accent-color)]/60 transition-colors">
          {logo}
        </div>

        <div className="flex flex-col gap-0.5 w-full min-w-0 overflow-hidden">
          {/* Top Header Badge & Provider */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] font-bold text-[10px] sm:text-[11px] px-1.5 py-0.2 tracking-wider uppercase font-mono rounded">
              {badge}
            </span>
            <span className="text-[10px] sm:text-[11px] font-mono text-[var(--text-muted)] font-bold uppercase tracking-wider truncate">
              {provider}
            </span>
          </div>

          {/* Title (Fluid text scaling down to 300px viewports) */}
          <span className="font-bold text-sm sm:text-lg font-mono uppercase text-[var(--text-primary)] group-hover/cardheader:text-[var(--accent-color)] transition-colors leading-tight tracking-tight truncate">
            {title}
          </span>

          {/* Capabilities Tags */}
          <div className="flex flex-wrap items-center gap-1 mt-0.5 overflow-hidden">
            {tags.map((tag, i) => (
              <span
                key={i}
                className="text-[9px] font-mono font-bold border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-1.5 py-0.2 uppercase whitespace-nowrap rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Short Description (Clickable) */}
      {description && (
        <p
          onClick={onSelect}
          className="text-xs text-[var(--text-secondary)] line-clamp-1 truncate cursor-pointer hover:text-[var(--text-primary)] transition-colors"
        >
          {description}
        </p>
      )}

      <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
        {downloading ? <span className="flex items-center gap-1.5 text-[var(--accent-color)] font-semibold">
          <Download size={13} className="animate-pulse" /> Downloading{downloading.percent === undefined ? '…' : ` · ${downloading.percent}%`}
        </span> : <span>{footerStart}</span>}
        <span className="uppercase">{footerEnd}</span>
      </div>
      {downloading && <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-[var(--bg-tertiary)]">
        <div style={downloading.percent === undefined ? undefined : { width: `${downloading.percent}%` }}
          className={`h-full bg-[var(--accent-color)] transition-[width] duration-500 ${downloading.percent === undefined ? 'w-1/3 animate-pulse' : ''}`} />
      </div>}
    </Card>
  );
};

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
  installed,
  className,
  isActive = false,
  onSelectModel,
}) => {
  const variants = model.variants || [];
  const download = useRepoDownload(model.repo);
  return (
    <ModelCardFrame
      logo={<CatalogueLogo source={model.logo} name={model.name || model.id} large />}
      badge={model.parameters || model.id}
      provider={model.provider || 'CLUAIZ'}
      title={model.name || model.id}
      tags={[...(model.tasks?.slice(0, 2) ?? []), ...(model.context ? [`${model.context} ctx`] : [])]}
      description={cleanModelDescription(model.description)
        || cleanModelDescription(model.familyDescription)
        || 'Foundation model ready for inference.'}
      footerStart={`${variants.length} ${variants.length === 1 ? 'package' : 'packages'}`}
      footerEnd={[...new Set(variants.map(variant => variant.format))].join(' · ')}
      className={className}
      isActive={isActive}
      mark={isModelInstalled(installed, model) ? 'Installed' : undefined}
      downloading={download}
      onSelect={() => onSelectModel(model)}
    />
  );
};

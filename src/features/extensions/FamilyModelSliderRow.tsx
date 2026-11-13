import React, { useRef } from 'react';
import { motion, useTransform, type MotionValue, useMotionValue } from 'framer-motion';
import { Boxes } from 'lucide-react';
import type { PublicModel, PublicVariant } from '../../api/catalogue/models';
import type { ModelRegistryEntry } from '../../api/engine/models/models.types';
import { Badge } from '../../components/ui/Badge';
import { CatalogueLogo, CatalogueTags } from './CatalogueUI';
import { cleanModelDescription, extractFamilyCapabilities, isModelInstalled } from './catalogueView';
import { ModelSliderCard } from './ModelSliderCard';

// -----------------------------------------------------------------------------
// EXACT 1:1 SCRUBBER CODE FROM cluaiz.com (RESPONSIVE DOT SCALING)
// -----------------------------------------------------------------------------
const ScrubberDot = ({ index, total, progress }: { index: number; total: number; progress: MotionValue<number> }) => {
  const center = index / (total - 1);
  const distance = 1 / total;

  // Scale peaks when progress matches this dot's position
  const scale = useTransform(
    progress,
    [center - distance * 3, center, center + distance * 3],
    [1, 1.8, 1]
  );

  // Active is full theme-dependent, inactive is very dim
  const opacity = useTransform(
    progress,
    [center - distance * 3, center, center + distance * 3],
    [0.15, 1, 0.15]
  );

  return (
    <motion.span
      className="inline-block w-[1.5px] sm:w-1 h-3 sm:h-5 bg-zinc-400 dark:bg-zinc-600 rounded-[1px] sm:rounded-[2px] shrink-0 origin-center pointer-events-none"
      style={{
        scale,
        opacity,
      }}
    />
  );
};

export interface FamilyRowHeaderProps {
  logo: React.ReactNode;
  name: string;
  count: number;
  by: string;
  description?: string;
  tags: string[];
  onOpen: () => void;
}

/** Header of a family row: logo, name, model count, maker, description and tags; opens the family. */
export const FamilyRowHeader: React.FC<FamilyRowHeaderProps> = ({ logo, name, count, by, description, tags, onOpen }) => (
  <div
    onClick={onOpen}
    className="group/family-header flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3 border-b border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-tertiary)]/30 -mx-2 px-2 -mt-1 pt-1 rounded-xl transition-colors"
    title={`View ${name} details`}
  >
    {/* Left Side: Logo, Name, Publisher, Description, Tags, Count */}
    <div className="flex items-start gap-2.5 sm:gap-3.5 min-w-0 flex-1">
      {logo}
      <div className="space-y-1 min-w-0 flex-1">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <h3 className="text-base sm:text-lg font-bold font-mono uppercase text-[var(--text-primary)] group-hover/family-header:text-[var(--accent-color)] transition-colors tracking-tight">
            {name}
          </h3>
          <Badge variant="outline" className="text-[10px] font-mono font-bold uppercase tracking-wider">
            {count} {count === 1 ? 'Model' : 'Models'}
          </Badge>
          <span className="text-xs text-[var(--text-muted)] font-mono">
            by <span className="text-[var(--text-secondary)] font-bold">{by}</span>
          </span>
        </div>

        {description && (
          <p className="text-xs text-[var(--text-secondary)] line-clamp-1 max-w-2xl">
            {description}
          </p>
        )}

        <div className="pt-0.5">
          <CatalogueTags values={tags} />
        </div>
      </div>
    </div>
  </div>
);

export interface ModelCardTrackProps<T> {
  items: T[];
  keyOf: (item: T) => string;
  /** `fill` is true when the card takes the row's width (one or two cards) */
  renderCard: (item: T, fill: boolean) => React.ReactNode;
  borderless?: boolean;
  /** The open card; the scrubber marks its place */
  activeKey?: string;
  /** Label of a card's green mark (installed, in the model picker); the scrubber marks its place too */
  markOf?: (item: T) => string | undefined;
}

/** A family's model cards: one fills the row, two share it, three or more slide with the wave scrubber. */
export function ModelCardTrack<T>({ items, keyOf, renderCard, borderless = false, activeKey, markOf }: ModelCardTrackProps<T>) {
  const scrubberRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const isScrubberDragging = useRef(false);
  const isTrackDragging = useRef(false);
  const trackHasMoved = useRef(false);
  const trackStartX = useRef(0);
  const trackStartScrollLeft = useRef(0);
  const localProgress = useMotionValue(0);

  // Direct 1:1 instantaneous scroll assignment without lag
  const updateScroll = (prog: number) => {
    if (trackRef.current) {
      const maxScroll = trackRef.current.scrollWidth - trackRef.current.clientWidth;
      if (maxScroll > 0) {
        trackRef.current.scrollLeft = prog * maxScroll;
      }
    }
  };

  // Synchronize scrubber dots when track scrolls physically
  const handleTrackScroll = () => {
    if (isScrubberDragging.current || !trackRef.current) return;
    const maxScroll = trackRef.current.scrollWidth - trackRef.current.clientWidth;
    if (maxScroll > 0) {
      const currentProg = Math.max(0, Math.min(1, trackRef.current.scrollLeft / maxScroll));
      localProgress.set(currentProg);
    }
  };

  // Scrubber drag handlers (live real-time update)
  const updateProgressFromScrubber = (e: React.PointerEvent) => {
    if (!scrubberRef.current) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newProgress = Math.max(0, Math.min(1, x / rect.width));
    localProgress.set(newProgress);
    updateScroll(newProgress);
  };

  const handleScrubberDown = (e: React.PointerEvent) => {
    isScrubberDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateProgressFromScrubber(e);
  };

  const handleScrubberMove = (e: React.PointerEvent) => {
    if (!isScrubberDragging.current) return;
    updateProgressFromScrubber(e);
  };

  const handleScrubberUp = (e: React.PointerEvent) => {
    isScrubberDragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { /* ignore */ }
  };

  // Cards Track direct mouse drag-to-scroll handlers (does not block pure clicks)
  const handleTrackPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    if (!trackRef.current) return;

    isTrackDragging.current = true;
    trackHasMoved.current = false;
    trackStartX.current = e.clientX;
    trackStartScrollLeft.current = trackRef.current.scrollLeft;
  };

  const handleTrackPointerMove = (e: React.PointerEvent) => {
    if (!isTrackDragging.current || !trackRef.current) return;
    const dx = e.clientX - trackStartX.current;
    if (Math.abs(dx) > 4) {
      trackHasMoved.current = true;
      if (!trackRef.current.hasPointerCapture(e.pointerId)) {
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch { /* ignore */ }
      }
      trackRef.current.scrollLeft = trackStartScrollLeft.current - dx;
      handleTrackScroll();
    }
  };

  const handleTrackPointerUp = (e: React.PointerEvent) => {
    isTrackDragging.current = false;
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch { /* ignore */ }
  };

  /* Places of the open and marked cards along the scrubber; a click scrolls to that card */
  const places = items.flatMap((item, index) => {
    const mark = markOf?.(item), open = keyOf(item) === activeKey;
    return mark || open ? [{ key: keyOf(item), at: index / Math.max(1, items.length - 1), mark, open }] : [];
  });
  const jump = (at: number) => { localProgress.set(at); updateScroll(at); };

  /* 1 Model: 100% Full-Width | 2 Models: 50%-50% Grid | 3+ : Slider */
  if (items.length === 1) return <div className="w-full">{renderCard(items[0], true)}</div>;
  if (items.length === 2) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
        {items.map(item => <React.Fragment key={keyOf(item)}>{renderCard(item, true)}</React.Fragment>)}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 sm:gap-4 w-full select-none">
      {/* Track Container with Left and Right Edge Fade Shadows */}
      <div className="relative w-full overflow-hidden">
        {/* Left Edge Fade Shadow */}
        <div className={`absolute top-0 left-0 w-6 sm:w-16 h-full bg-gradient-to-r ${borderless ? 'from-[var(--bg-primary,#09090b)]' : 'from-[var(--bg-secondary)]'} to-transparent z-10 pointer-events-none`} />
        {/* Right Edge Fade Shadow */}
        <div className={`absolute top-0 right-0 w-6 sm:w-16 h-full bg-gradient-to-l ${borderless ? 'from-[var(--bg-primary,#09090b)]' : 'from-[var(--bg-secondary)]'} to-transparent z-10 pointer-events-none`} />

        {/* Draggable Horizontal Models Track */}
        <div
          ref={trackRef}
          onScroll={handleTrackScroll}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handleTrackPointerMove}
          onPointerUp={handleTrackPointerUp}
          onPointerCancel={handleTrackPointerUp}
          className="flex w-full overflow-x-auto no-scrollbar py-1.5 sm:py-2 cursor-grab active:cursor-grabbing"
          style={{ scrollBehavior: 'auto' }}
        >
          <div className="flex w-max px-1 sm:px-4 gap-2 sm:gap-3.5">
            {items.map(item => <React.Fragment key={keyOf(item)}>{renderCard(item, false)}</React.Fragment>)}
          </div>
        </div>
      </div>

      {/* EXACT 60-DOT WAVE SCRUBBER TRACK */}
      <div className="flex items-center justify-center w-full overflow-visible z-10">
        <div className="relative w-full max-w-4xl">
        <div
          ref={scrubberRef}
          className="flex items-center justify-between w-full px-2 sm:px-4 py-1.5 sm:py-2 cursor-grab active:cursor-grabbing touch-none"
          style={{
            maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
          }}
          onPointerDown={handleScrubberDown}
          onPointerMove={handleScrubberMove}
          onPointerUp={handleScrubberUp}
          onPointerCancel={handleScrubberUp}
        >
          {Array.from({ length: 60 }).map((_, i) => (
            <ScrubberDot key={i} index={i} total={60} progress={localProgress} />
          ))}
        </div>
        {/* The chat minimap's look: a white line at the card's place, glowing for the open card; green tip when marked */}
        {places.length > 0 && <div className="absolute inset-x-2 sm:inset-x-4 inset-y-0 pointer-events-none">
          {places.map(place => (
            <button key={place.key} type="button" onClick={() => jump(place.at)} style={{ left: `${place.at * 100}%` }}
              title={[place.key, place.open && 'Open', place.mark].filter(Boolean).join(' · ')}
              className="absolute inset-y-0 -translate-x-1/2 px-1 flex items-center cursor-pointer pointer-events-auto">
              <span className="relative block w-[2px] h-3 sm:h-5 rounded-[1px] bg-white" style={{
                opacity: place.open ? 1 : 0.7,
                boxShadow: place.open ? '0 0 8px 1px rgba(255,255,255,0.85)' : 'none',
                transition: 'opacity 220ms ease, box-shadow 220ms ease',
              }}>
                {place.mark && <span className="absolute -top-1 left-0 block w-[2px] h-[2px] rounded-[1px] bg-emerald-400" />}
              </span>
            </button>
          ))}
        </div>}
        </div>
      </div>
    </div>
  );
}

/** A family block: its header (optional) above its model cards. */
export const FamilyRow: React.FC<{ borderless?: boolean; header?: FamilyRowHeaderProps; children: React.ReactNode }> = ({
  borderless = false,
  header,
  children,
}) => (
  <div className={`w-full ${borderless ? 'p-0 space-y-4' : 'rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-3 sm:p-5 space-y-3 sm:space-y-4'} text-left`}>
    {header && <FamilyRowHeader {...header} />}
    {children}
  </div>
);

export interface FamilyModelSliderRowProps {
  family: string;
  models: PublicModel[];
  installed: ModelRegistryEntry[];
  isBusy: boolean;
  downloadingTarget?: string;
  borderless?: boolean;
  hideHeader?: boolean;
  activeModelId?: string;
  onDownload: (model: PublicModel, variant: PublicVariant) => void;
  onViewAll: (family: string) => void;
  onSelectModel: (model: PublicModel) => void;
}

export const FamilyModelSliderRow: React.FC<FamilyModelSliderRowProps> = ({
  family,
  models,
  installed,
  isBusy,
  downloadingTarget,
  borderless = false,
  hideHeader = false,
  activeModelId,
  onDownload,
  onViewAll,
  onSelectModel,
}) => {
  const firstModel = models[0];
  return (
    <FamilyRow borderless={borderless} header={hideHeader ? undefined : {
      logo: <CatalogueLogo source={firstModel?.logo} name={family} large icon={Boxes} />,
      name: family,
      count: models.length,
      by: firstModel?.provider || 'Open Source',
      description: cleanModelDescription(firstModel?.familyDescription || firstModel?.description),
      tags: extractFamilyCapabilities(models),
      onOpen: () => onViewAll(family),
    }}>
      <ModelCardTrack items={models} keyOf={model => model.id} borderless={borderless} activeKey={activeModelId}
        markOf={model => isModelInstalled(installed, model) ? 'Installed' : undefined} renderCard={(model, fill) => (
        <ModelSliderCard
          model={model}
          installed={installed}
          isBusy={isBusy}
          downloadingTarget={downloadingTarget}
          isActive={model.id === activeModelId}
          className={fill ? 'w-full' : undefined}
          onDownload={onDownload}
          onSelectModel={onSelectModel}
        />
      )} />
    </FamilyRow>
  );
};

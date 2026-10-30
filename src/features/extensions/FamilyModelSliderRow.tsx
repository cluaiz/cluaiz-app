import React, { useRef } from 'react';
import { motion, useTransform, type MotionValue, useMotionValue } from 'framer-motion';
import { ArrowUpRight, Boxes } from 'lucide-react';
import type { PublicModel, PublicVariant } from '../../api/catalogue/models';
import type { ModelRegistryEntry } from '../../api/engine/models/models.types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CatalogueLogo, CatalogueTags } from './CatalogueUI';
import { cleanModelDescription, extractFamilyCapabilities } from './catalogueView';
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

export interface FamilyModelSliderRowProps {
  family: string;
  models: PublicModel[];
  installed: ModelRegistryEntry[];
  isBusy: boolean;
  downloadingTarget?: string;
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
  onDownload,
  onViewAll,
  onSelectModel,
}) => {
  const scrubberRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const isScrubberDragging = useRef(false);
  const isTrackDragging = useRef(false);
  const trackStartX = useRef(0);
  const trackStartScrollLeft = useRef(0);
  const localProgress = useMotionValue(0);

  const firstModel = models[0];
  const distinctCapabilities = extractFamilyCapabilities(models);
  const cleanDesc = cleanModelDescription(firstModel?.familyDescription || firstModel?.description);

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

  // Cards Track direct mouse drag-to-scroll handlers
  const handleTrackPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    if (!trackRef.current) return;

    isTrackDragging.current = true;
    trackStartX.current = e.clientX;
    trackStartScrollLeft.current = trackRef.current.scrollLeft;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleTrackPointerMove = (e: React.PointerEvent) => {
    if (!isTrackDragging.current || !trackRef.current) return;
    const dx = e.clientX - trackStartX.current;
    trackRef.current.scrollLeft = trackStartScrollLeft.current - dx;
    handleTrackScroll();
  };

  const handleTrackPointerUp = (e: React.PointerEvent) => {
    isTrackDragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { /* ignore */ }
  };

  return (
    <div className="w-full rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-3 sm:p-5 space-y-3 sm:space-y-4 text-left">
      {/* ------------------------------------------------------------------ */}
      {/* SECTION 1: FAMILY HEADER (RESPONSIVE STACK)                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3 border-b border-[var(--border-color)]">
        {/* Left Side: Logo, Name, Publisher, Description, Tags, Count */}
        <div className="flex items-start gap-2.5 sm:gap-3.5 min-w-0">
          <CatalogueLogo source={firstModel?.logo} name={family} large icon={Boxes} />
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold font-mono uppercase text-[var(--text-primary)] tracking-tight">
                {family}
              </h3>
              <Badge variant="outline" className="text-[10px] font-mono font-bold uppercase tracking-wider">
                {models.length} {models.length === 1 ? 'Model' : 'Models'}
              </Badge>
              <span className="text-xs text-[var(--text-muted)] font-mono">
                by <span className="text-[var(--text-secondary)] font-bold">{firstModel?.provider || 'Open Source'}</span>
              </span>
            </div>

            {cleanDesc && (
              <p className="text-xs text-[var(--text-secondary)] line-clamp-1 max-w-2xl">
                {cleanDesc}
              </p>
            )}

            <div className="pt-0.5">
              <CatalogueTags values={distinctCapabilities} />
            </div>
          </div>
        </div>

        {/* Right Side: View All Action */}
        <div className="shrink-0 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewAll(family)}
            className="text-xs font-semibold font-mono gap-1.5 cursor-pointer hover:border-[var(--accent-color)]/60 w-full sm:w-auto justify-center"
          >
            View All Models <ArrowUpRight size={13} />
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 2: ADAPTIVE FAMILY BODY                                    */}
      {/* 1 Model: 100% Full-Width | 2 Models: 50%-50% Grid | 3+ : Slider   */}
      {/* ------------------------------------------------------------------ */}
      {models.length === 1 ? (
        /* Case 1: Exactly 1 Model -> 100% Full Width (No empty gap) */
        <div className="w-full">
          <ModelSliderCard
            model={models[0]}
            installed={installed}
            isBusy={isBusy}
            downloadingTarget={downloadingTarget}
            className="w-full"
            onDownload={onDownload}
            onSelectModel={onSelectModel}
          />
        </div>
      ) : models.length === 2 ? (
        /* Case 2: Exactly 2 Models -> 50% - 50% Clean Grid (No empty gap) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
          {models.map((model) => (
            <ModelSliderCard
              key={model.id}
              model={model}
              installed={installed}
              isBusy={isBusy}
              downloadingTarget={downloadingTarget}
              className="w-full"
              onDownload={onDownload}
              onSelectModel={onSelectModel}
            />
          ))}
        </div>
      ) : (
        /* Case 3: 3+ Models -> Horizontal Slider Track + 60-Dot Scrubber */
        <div className="flex flex-col gap-3 sm:gap-4 w-full select-none">
          {/* Track Container with Left and Right Edge Fade Shadows */}
          <div className="relative w-full overflow-hidden">
            {/* Left Edge Fade Shadow */}
            <div className="absolute top-0 left-0 w-6 sm:w-16 h-full bg-gradient-to-r from-[var(--bg-secondary)] to-transparent z-10 pointer-events-none" />
            {/* Right Edge Fade Shadow */}
            <div className="absolute top-0 right-0 w-6 sm:w-16 h-full bg-gradient-to-l from-[var(--bg-secondary)] to-transparent z-10 pointer-events-none" />

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
                {models.map((model) => (
                  <ModelSliderCard
                    key={model.id}
                    model={model}
                    installed={installed}
                    isBusy={isBusy}
                    downloadingTarget={downloadingTarget}
                    onDownload={onDownload}
                    onSelectModel={onSelectModel}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* EXACT 60-DOT WAVE SCRUBBER TRACK */}
          <div className="flex items-center justify-center w-full overflow-visible z-10">
            <div
              ref={scrubberRef}
              className="flex items-center justify-between w-full max-w-4xl px-2 sm:px-4 py-1.5 sm:py-2 cursor-grab active:cursor-grabbing touch-none"
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
          </div>
        </div>
      )}
    </div>
  );
};

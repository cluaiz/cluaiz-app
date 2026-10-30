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

const ScrubberDot = ({ index, total, progress }: { index: number; total: number; progress: MotionValue<number> }) => {
  const center = index / (total - 1);
  const distance = 1 / total;

  // Scale peaks when progress matches this dot's position
  const scale = useTransform(
    progress,
    [center - distance * 3, center, center + distance * 3],
    [1, 1.8, 1]
  );

  // Active is bright accent, inactive is subtle
  const opacity = useTransform(
    progress,
    [center - distance * 3, center, center + distance * 3],
    [0.18, 1, 0.18]
  );

  return (
    <motion.span
      className="inline-block w-1 h-3.5 sm:h-4 bg-[var(--accent-color)] rounded-[2px] shrink-0 origin-center pointer-events-none"
      style={{ scale, opacity }}
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
  const isDragging = useRef(false);
  const localProgress = useMotionValue(0);

  const firstModel = models[0];
  const distinctCapabilities = extractFamilyCapabilities(models);
  const cleanDesc = cleanModelDescription(firstModel?.familyDescription || firstModel?.description);

  const updateScroll = (prog: number) => {
    if (trackRef.current) {
      const maxScroll = trackRef.current.scrollWidth - trackRef.current.clientWidth;
      if (maxScroll > 0) {
        trackRef.current.scrollLeft = prog * maxScroll;
      }
    }
  };

  const handleTrackScroll = () => {
    if (isDragging.current || !trackRef.current) return;
    const maxScroll = trackRef.current.scrollWidth - trackRef.current.clientWidth;
    if (maxScroll > 0) {
      const currentProg = Math.max(0, Math.min(1, trackRef.current.scrollLeft / maxScroll));
      localProgress.set(currentProg);
    }
  };

  const updateProgressFromDrag = (e: React.PointerEvent) => {
    if (!scrubberRef.current) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newProgress = Math.max(0, Math.min(1, x / rect.width));
    localProgress.set(newProgress);
    updateScroll(newProgress);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateProgressFromDrag(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    updateProgressFromDrag(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div className="w-full rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)]/80 p-5 space-y-4 text-left transition-colors">
      {/* ------------------------------------------------------------------ */}
      {/* SECTION 1: FAMILY HEADER                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[var(--border-color)]/60">
        {/* Left Side: Logo, Name, Publisher, Tags, Count */}
        <div className="flex items-start gap-3.5 min-w-0">
          <CatalogueLogo source={firstModel?.logo} name={family} large icon={Boxes} />
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight">
                {family}
              </h3>
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">
                {models.length} {models.length === 1 ? 'Model' : 'Models'}
              </Badge>
              <span className="text-xs text-[var(--text-muted)]">
                by <span className="text-[var(--text-secondary)] font-medium">{firstModel?.provider || 'Open Source'}</span>
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
        <div className="shrink-0 self-start sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewAll(family)}
            className="text-xs font-semibold gap-1.5 hover:border-[var(--accent-color)]/60 cursor-pointer"
          >
            View All Models <ArrowUpRight size={13} />
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 2: FAMILY BODY (MODELS SLIDER + WAVE SCRUBBER)             */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3 w-full overflow-hidden select-none">
        {/* Horizontal Models Track */}
        <div
          ref={trackRef}
          onScroll={handleTrackScroll}
          className="flex w-full overflow-x-auto no-scrollbar py-2 cursor-grab active:cursor-grabbing scroll-smooth"
        >
          <div className="flex w-max gap-3.5 px-1">
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

        {/* 48-Dot Wave Scrubber Track */}
        {models.length > 1 && (
          <div className="flex items-center justify-center w-full overflow-visible z-10 pt-1 pb-1">
            <div
              ref={scrubberRef}
              className="flex items-center justify-between w-full max-w-md px-3.5 py-1.5 cursor-grab active:cursor-grabbing touch-none select-none bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)]/60 rounded-xl"
              style={{
                maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
                WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {Array.from({ length: 48 }).map((_, i) => (
                <ScrubberDot key={i} index={i} total={48} progress={localProgress} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

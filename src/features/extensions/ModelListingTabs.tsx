import React from 'react';
import { Boxes, Sparkles } from 'lucide-react';
import { Tabs } from '../../components/ui/Tabs';
import type { ModelListing } from './modelCatalogueStore';

/** One of the two segments at the top of the models sidebar */
export function PlaceTab({ icon: Icon, label, active, onClick }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
        active
          ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-2xs'
          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/50 border border-transparent'
      }`}
    >
      <Icon size={12} className={active ? 'text-[var(--accent-color)]' : 'opacity-60'} />
      <span>{label}</span>
    </button>
  );
}

/** Browse | Installed inside Local and Cloud; Cloud's installed list is its connected providers */
export function ListingTabs({ value, onChange, browse, installed, installedLabel = 'Installed' }: {
  value: ModelListing; onChange: (value: ModelListing) => void; browse: number; installed: number; installedLabel?: string;
}) {
  return (
    <Tabs<ModelListing> variant="underline" className="px-2" value={value} onChange={onChange}
      items={[{ id: 'browse', label: 'Browse', icon: Sparkles, count: browse }, { id: 'installed', label: installedLabel, icon: Boxes, count: installed }]} />
  );
}

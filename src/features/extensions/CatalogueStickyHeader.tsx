import React, { useState } from 'react';
import { Search, SlidersHorizontal, ChevronDown, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export interface CatalogueStickyHeaderProps {
  title: string;
  subtitle?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  activeFilterCount?: number;
  filterContent?: React.ReactNode;
  actions?: React.ReactNode;
  rightExtra?: React.ReactNode;
  chips?: React.ReactNode;
  initialFilterOpen?: boolean;
}

export const CatalogueStickyHeader: React.FC<CatalogueStickyHeaderProps> = ({
  title,
  subtitle,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search…',
  activeFilterCount = 0,
  filterContent,
  actions,
  rightExtra,
  chips,
  initialFilterOpen = false,
}) => {
  const [isFilterOpen, setIsFilterOpen] = useState(initialFilterOpen);

  return (
    <header className="sticky top-0 z-20 -mx-5 px-5 py-3.5 bg-[var(--bg-primary)]/95 backdrop-blur-md border-b border-[var(--border-color)] transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Dynamic Title & Subtitle */}
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-[var(--text-primary)] tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-xs text-[var(--text-secondary)] truncate">
              {subtitle}
            </p>
          )}
        </div>

        {/* Right: Actions, Search & Filter Button */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          {actions}

          {/* Compact Right-Aligned Search Input */}
          <div className="w-56 sm:w-64 md:w-80">
            <Input
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              leftIcon={<Search size={14} className="text-[var(--text-muted)]" />}
              rightElement={
                searchQuery ? (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    title="Clear search"
                  >
                    <X size={12} />
                  </button>
                ) : undefined
              }
              className="h-8 text-xs bg-[var(--bg-secondary)] border-[var(--border-color)]"
            />
          </div>

          {/* Filter Toggle Button */}
          {filterContent && (
            <Button
              type="button"
              variant={isFilterOpen || activeFilterCount > 0 ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setIsFilterOpen(prev => !prev)}
              className={`h-8 px-2.5 gap-1.5 text-xs transition-colors cursor-pointer shrink-0 ${
                isFilterOpen || activeFilterCount > 0
                  ? 'border-[var(--accent-color)] text-[var(--text-primary)] bg-[var(--accent-color)]/10'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Toggle filters"
            >
              <SlidersHorizontal size={13} />
              <span className="hidden md:inline font-medium">Filters</span>
              {activeFilterCount > 0 && (
                <span className="min-w-[16px] h-4 px-1 rounded-full bg-[var(--accent-color)] text-[var(--bg-primary)] text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                size={12}
                className={`transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`}
              />
            </Button>
          )}

          {rightExtra}
        </div>
      </div>

      {/* Expandable Filter Panel */}
      {filterContent && isFilterOpen && (
        <div className="mt-3 pt-3 border-t border-[var(--border-color)]/60 animate-fade-in">
          {filterContent}
        </div>
      )}

      {/* Filter Chips Row */}
      {chips && (
        <div className="mt-2.5">
          {chips}
        </div>
      )}
    </header>
  );
};

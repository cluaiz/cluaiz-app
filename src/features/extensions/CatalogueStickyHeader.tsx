import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '../../components/ui/Input';

export interface CatalogueStickyHeaderProps {
  title: string;
  subtitle?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
  filterElement?: React.ReactNode;
  rightExtra?: React.ReactNode;
  chips?: React.ReactNode;
}

export const CatalogueStickyHeader: React.FC<CatalogueStickyHeaderProps> = ({
  title,
  subtitle,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search…',
  actions,
  filterElement,
  rightExtra,
  chips,
}) => {
  return (
    <header className="sticky top-0 z-20 w-full px-6 py-3.5 bg-[var(--bg-primary)]/95 backdrop-blur-md border-b border-[var(--border-color)] transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-7xl mx-auto">
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

          {filterElement}

          {rightExtra}
        </div>
      </div>

      {chips && (
        <div className="max-w-7xl mx-auto mt-2.5">
          {chips}
        </div>
      )}
    </header>
  );
};

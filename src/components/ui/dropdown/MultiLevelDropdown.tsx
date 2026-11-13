import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal, ChevronRight, ChevronDown, Check, X, type LucideIcon } from 'lucide-react';
import { Button } from '../Button';

export interface MultiLevelOption {
  value: string;
  label: string;
  icon?: LucideIcon;
}

export interface MultiLevelCategory {
  id: string;
  label: string;
  icon?: LucideIcon;
  options: MultiLevelOption[];
  selectedValue?: string | string[];
  isMultiSelect?: boolean;
  onSelect: (value: string) => void;
}

export interface MultiLevelDropdownProps {
  categories: MultiLevelCategory[];
  triggerLabel?: string;
  activeCount?: number;
  onClearAll?: () => void;
  className?: string;
  iconOnly?: boolean;
  submenuAlign?: 'left' | 'right';
}

export const MultiLevelDropdown: React.FC<MultiLevelDropdownProps> = ({
  categories,
  triggerLabel = 'Filters',
  activeCount = 0,
  onClearAll,
  className = '',
  iconOnly = false,
  submenuAlign = 'right',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const primaryMenuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const closeSubmenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [submenuPos, setSubmenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const menuWidth = 240;
    let left = rect.right - menuWidth;
    if (left < 8) left = 8;
    if (left + menuWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - menuWidth - 8);
    }
    const top = rect.bottom + 6;
    setDropdownPos({ top, left });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        primaryMenuRef.current?.contains(target) ||
        submenuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
      setActiveCategoryId(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setActiveCategoryId(null);
      }
    };

    if (isOpen) {
      updateDropdownPosition();
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('resize', updateDropdownPosition);
      window.addEventListener('scroll', updateDropdownPosition, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  const activeCategory = categories.find(cat => cat.id === activeCategoryId);

  const handleCategoryMouseEnter = (catId: string, e?: React.MouseEvent<HTMLButtonElement>) => {
    if (closeSubmenuTimerRef.current) {
      clearTimeout(closeSubmenuTimerRef.current);
      closeSubmenuTimerRef.current = null;
    }
    setActiveCategoryId(catId);

    if (e) {
      const catRect = e.currentTarget.getBoundingClientRect();
      const subWidth = 240;
      let left = catRect.right + 6;
      if (left + subWidth > window.innerWidth - 8) {
        left = Math.max(8, catRect.left - subWidth - 6);
      }
      setSubmenuPos({ top: catRect.top, left });
    }
  };

  const handleSubmenuMouseLeave = () => {
    closeSubmenuTimerRef.current = setTimeout(() => {
      setActiveCategoryId(null);
    }, 200);
  };

  const handleSubmenuMouseEnter = () => {
    if (closeSubmenuTimerRef.current) {
      clearTimeout(closeSubmenuTimerRef.current);
      closeSubmenuTimerRef.current = null;
    }
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <Button
        type="button"
        variant={isOpen || activeCount > 0 ? 'secondary' : 'outline'}
        size="sm"
        onClick={() => {
          setIsOpen(prev => !prev);
          if (isOpen) setActiveCategoryId(null);
        }}
        className={`h-8 ${iconOnly ? 'w-8 !px-0 justify-center' : 'px-2.5 gap-1.5'} text-xs transition-colors cursor-pointer shrink-0 ${
          isOpen || activeCount > 0
            ? 'border-[var(--accent-color)] text-[var(--text-primary)] bg-[var(--accent-color)]/10 font-semibold'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
        title="Filter options"
      >
        <SlidersHorizontal size={14} />
        {!iconOnly && <span className="font-medium">{triggerLabel}</span>}
        {activeCount > 0 && (
          <span className={`h-4 px-1 rounded-full bg-[var(--accent-color)] text-[var(--bg-primary)] text-[10px] font-bold flex items-center justify-center ${iconOnly ? 'absolute -top-1 -right-1 text-[9px] min-w-[14px] h-3.5' : 'min-w-[16px]'}`}>
            {activeCount}
          </span>
        )}
        {!iconOnly && (
          <ChevronDown
            size={12}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        )}
      </Button>

      {/* Primary Categories Dropdown rendered in document.body Portal to prevent clipping */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={primaryMenuRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: 240,
            zIndex: 99999,
            borderStyle: 'var(--border-style)',
          }}
          className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1.5 backdrop-blur-xl animate-fade-in"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-color)]/50 mb-1">
            Filter by Category
          </div>

          <div className="space-y-0.5">
            {categories.map(category => {
              const CategoryIcon = category.icon;
              const isSelected = activeCategoryId === category.id;

              // Compute preview text for selected value
              let previewLabel = '';
              if (Array.isArray(category.selectedValue)) {
                previewLabel = category.selectedValue.length > 0 ? `${category.selectedValue.length} selected` : '';
              } else if (category.selectedValue) {
                const opt = category.options.find(o => o.value === category.selectedValue);
                previewLabel = opt?.label || category.selectedValue;
              }

              return (
                <button
                  key={category.id}
                  type="button"
                  onMouseEnter={(e) => handleCategoryMouseEnter(category.id, e)}
                  onClick={(e) => {
                    handleCategoryMouseEnter(category.id, e);
                    setActiveCategoryId(prev => prev === category.id ? null : category.id);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-[var(--accent-color)]/15 text-[var(--text-primary)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {CategoryIcon && <CategoryIcon size={14} className="shrink-0 text-[var(--text-muted)]" />}
                    <span className="truncate">{category.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {previewLabel && (
                      <span className="text-[10px] text-[var(--accent-color)] font-medium max-w-[70px] truncate">
                        {previewLabel}
                      </span>
                    )}
                    <ChevronRight size={13} className="text-[var(--text-muted)] opacity-70" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer: Clear All Filters */}
          {activeCount > 0 && onClearAll && (
            <div className="pt-1.5 mt-1 border-t border-[var(--border-color)]/50">
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setActiveCategoryId(null);
                }}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
              >
                <X size={12} />
                <span>Clear all filters</span>
              </button>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Submenu Flyout rendered in document.body Portal */}
      {isOpen && activeCategory && typeof document !== 'undefined' && createPortal(
        <div
          ref={submenuRef}
          onMouseEnter={handleSubmenuMouseEnter}
          onMouseLeave={handleSubmenuMouseLeave}
          style={{
            position: 'fixed',
            top: submenuPos.top,
            left: submenuPos.left,
            width: 240,
            zIndex: 100000,
            borderStyle: 'var(--border-style)',
          }}
          className="max-h-80 overflow-y-auto custom-scrollbar bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1.5 backdrop-blur-xl animate-fade-in"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-color)]/50 mb-1 flex items-center justify-between">
            <span>{activeCategory.label}</span>
            {activeCategory.isMultiSelect && (
              <span className="text-[9px] lowercase font-normal text-[var(--text-muted)]">(multi)</span>
            )}
          </div>

          <div className="space-y-0.5">
            {activeCategory.options.map(option => {
              const isChecked = Array.isArray(activeCategory.selectedValue)
                ? activeCategory.selectedValue.includes(option.value)
                : activeCategory.selectedValue === option.value || (!activeCategory.selectedValue && option.value === '');

              const OptionIcon = option.icon;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => activeCategory.onSelect(option.value)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                    isChecked
                      ? 'bg-[var(--accent-color)]/10 text-[var(--text-primary)] font-medium'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {OptionIcon && <OptionIcon size={13} className="shrink-0 text-[var(--text-muted)]" />}
                    <span className="truncate">{option.label}</span>
                  </div>

                  {isChecked && (
                    <Check size={13} className="text-[var(--accent-color)] shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

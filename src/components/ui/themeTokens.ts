/**
 * Reusable Theme Tokens & Centralized Classes
 * Single Source of Truth for active/inactive tabs, tree items, icon buttons, and inputs.
 * Ensures 100% theme safety across light, dark, and custom themes with zero visual glitches.
 */

export const themeTokens = {
    tab: {
        active: 'ui-tab-active',
        inactive: 'ui-tab-inactive',
    },
    treeItem: {
        active: 'ui-tree-item-active',
        inactive: 'ui-tree-item-inactive',
    },
    iconButton: {
        default: 'ui-icon-btn',
        active: 'ui-icon-btn-active',
    },
    input: 'bg-[var(--bg-secondary)] text-xs text-[var(--text-primary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] placeholder:text-[var(--text-muted)] rounded outline-none font-mono transition-colors',
    header: 'bg-[var(--bg-secondary)] border-b border-[var(--border-color)]/70 text-[var(--text-primary)]',
} as const;

export default themeTokens;

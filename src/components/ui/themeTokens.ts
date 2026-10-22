/**
 * Cluaiz Centralized Theme Tokens & Class Name Manifest
 * Single Source of Truth for semantic UI component classes.
 * Ensures 100% theme safety across light, dark, and custom themes with zero visual glitches.
 */

export const themeTokens = {
    card: {
        root: 'ui-card',
        hover: 'ui-card-hover',
        header: 'ui-card-header',
        title: 'ui-card-title',
        description: 'ui-card-description',
        content: 'ui-card-content',
        footer: 'ui-card-footer',
    },
    button: {
        root: 'ui-btn',
        primary: 'ui-btn-primary',
        secondary: 'ui-btn-secondary',
        destructive: 'ui-btn-destructive',
        outline: 'ui-btn-outline',
        ghost: 'ui-btn-ghost',
        link: 'ui-btn-link',
        cyber: 'ui-btn-cyber',
        pixel: 'ui-btn-pixel',
        sm: 'ui-btn-sm',
        md: 'ui-btn-md',
        lg: 'ui-btn-lg',
        icon: 'ui-btn-icon',
    },
    input: 'ui-input',
    inputError: 'ui-input-error',
    badge: {
        root: 'ui-badge',
        primary: 'ui-badge-primary',
        secondary: 'ui-badge-secondary',
        destructive: 'ui-badge-destructive',
        outline: 'ui-badge-outline',
        cyber: 'ui-badge-cyber',
        pixel: 'ui-badge-pixel',
    },
    tag: {
        root: 'ui-tag',
        active: 'ui-tag-active',
    },
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
    modal: {
        root: 'ui-modal',
        overlay: 'ui-modal-overlay',
        header: 'ui-modal-header',
        footer: 'ui-modal-footer',
    },
    dropdown: {
        root: 'ui-dropdown',
        item: 'ui-dropdown-item',
        itemActive: 'ui-dropdown-item-active',
    },
    toast: {
        root: 'ui-toast',
        info: 'ui-toast-info',
        success: 'ui-toast-success',
        error: 'ui-toast-error',
        warning: 'ui-toast-warning',
        prompt: 'ui-toast-prompt',
    },
    tooltip: 'ui-tooltip',
} as const;

export default themeTokens;

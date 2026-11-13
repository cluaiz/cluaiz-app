import type { HoldButtonProps } from './HoldButton';

/** The red hold-to-delete look (chat list delete, model uninstall) */
export const DANGER_HOLD: Pick<HoldButtonProps, 'holdTime' | 'backgroundColor' | 'fillColor' | 'textColor' | 'fillTextColor'> = {
    holdTime: 1200,
    backgroundColor: 'color-mix(in srgb, #ef4444 18%, var(--bg-primary))',
    fillColor: '#ef4444',
    textColor: '#f87171',
    fillTextColor: '#ffffff',
};

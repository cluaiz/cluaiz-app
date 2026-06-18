export interface ThemeVariables {
    name: string;
    class: string;
    properties: {
        '--bg-primary': string;
        '--bg-secondary': string;
        '--bg-tertiary': string;
        '--border-color': string;
        '--accent-color': string;
        '--accent-glow': string;
        '--text-primary': string;
        '--text-secondary': string;
        '--text-muted': string;
        '--radius-base': string;
        '--font-family': string;
        '--border-style': string;
        '--glow-effect': string;
    };
}

export const THEMES: Record<string, ThemeVariables> = {
    dark: {
        name: 'Dark Engine',
        class: 'theme-dark',
        properties: {
            '--bg-primary': '#000000',
            '--bg-secondary': '#030303',
            '--bg-tertiary': '#080808',
            '--border-color': '#111111',
            '--accent-color': '#6366f1',
            '--accent-glow': 'rgba(99, 102, 241, 0.25)',
            '--text-primary': '#f3f4f6',
            '--text-secondary': '#d1d5db',
            '--text-muted': '#6b7280',
            '--radius-base': '8px',
            '--font-family': 'system-ui, -apple-system, sans-serif',
            '--border-style': 'solid',
            '--glow-effect': '0 0 10px rgba(99, 102, 241, 0.15)',
        },
    },
    light: {
        name: 'Light System',
        class: 'theme-light',
        properties: {
            '--bg-primary': '#fafafa',
            '--bg-secondary': '#f4f4f5',
            '--bg-tertiary': '#e4e4e7',
            '--border-color': '#d4d4d8',
            '--accent-color': '#2563eb',
            '--accent-glow': 'rgba(37, 99, 235, 0.15)',
            '--text-primary': '#18181b',
            '--text-secondary': '#27272a',
            '--text-muted': '#71717a',
            '--radius-base': '8px',
            '--font-family': 'system-ui, -apple-system, sans-serif',
            '--border-style': 'solid',
            '--glow-effect': 'none',
        },
    },
    oled: {
        name: 'OLED Blackout',
        class: 'theme-oled',
        properties: {
            '--bg-primary': '#000000',
            '--bg-secondary': '#080808',
            '--bg-tertiary': '#101010',
            '--border-color': '#1f1f1f',
            '--accent-color': '#ffffff',
            '--accent-glow': 'rgba(255, 255, 255, 0.15)',
            '--text-primary': '#ffffff',
            '--text-secondary': '#a3a3a3',
            '--text-muted': '#525252',
            '--radius-base': '4px',
            '--font-family': 'system-ui, -apple-system, sans-serif',
            '--border-style': 'solid',
            '--glow-effect': 'none',
        },
    },
    cyberpunk: {
        name: 'Cyberpunk Neon',
        class: 'theme-cyberpunk',
        properties: {
            '--bg-primary': '#000000',
            '--bg-secondary': '#030303',
            '--bg-tertiary': '#080808',
            '--border-color': '#111111',
            '--accent-color': '#00f0ff',
            '--accent-glow': 'rgba(0, 240, 255, 0.45)',
            '--text-primary': '#ffffff',
            '--text-secondary': '#cbd5e1',
            '--text-muted': '#a0a5c0',
            '--radius-base': '0px',
            '--font-family': 'ui-monospace, Consolas, Monaco, monospace',
            '--border-style': 'solid',
            '--glow-effect': '0 0 12px rgba(0, 240, 255, 0.35), 0 0 4px rgba(255, 0, 127, 0.2)',
        },
    },
    matrix: {
        name: 'Matrix Console',
        class: 'theme-matrix',
        properties: {
            '--bg-primary': '#000000',
            '--bg-secondary': '#050c05',
            '--bg-tertiary': '#0d1a0d',
            '--border-color': '#00ff00',
            '--accent-color': '#00ff00',
            '--accent-glow': 'rgba(0, 255, 0, 0.6)',
            '--text-primary': '#00ff00',
            '--text-secondary': '#33ff33',
            '--text-muted': '#004400',
            '--radius-base': '0px',
            '--font-family': 'Courier New, Courier, monospace',
            '--border-style': 'solid',
            '--glow-effect': '0 0 8px rgba(0, 255, 0, 0.4)',
        },
    },
    pixel: {
        name: 'Pixel Retro',
        class: 'theme-pixel',
        properties: {
            '--bg-primary': '#1c120c',
            '--bg-secondary': '#2e1c12',
            '--bg-tertiary': '#3d2518',
            '--border-color': '#f2a65a',
            '--accent-color': '#f2a65a',
            '--accent-glow': 'rgba(242, 166, 90, 0.2)',
            '--text-primary': '#fce3b8',
            '--text-secondary': '#ecc082',
            '--text-muted': '#7a5135',
            '--radius-base': '0px',
            '--font-family': '"Courier New", Courier, monospace',
            '--border-style': 'double',
            '--glow-effect': 'none',
        },
    },
};

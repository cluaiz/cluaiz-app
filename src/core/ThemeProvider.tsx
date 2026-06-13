import React, { useEffect } from 'react';
import { useThemeStore } from '../store/ui/useThemeStore';
import { THEMES } from '../config/themes';

const GOOGLE_FONTS = [
    { name: 'Inter', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap' },
    { name: 'Roboto', url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap' },
    { name: 'Lato', url: 'https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap' },
    { name: 'Montserrat', url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap' },
    { name: 'Oswald', url: 'https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&display=swap' },
    { name: 'Playfair Display', url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap' },
    { name: 'Merriweather', url: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&display=swap' },
    { name: 'Nunito', url: 'https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700&display=swap' },
    { name: 'Raleway', url: 'https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap' },
    { name: 'Poppins', url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap' },
    { name: 'Open Sans', url: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&display=swap' },
    { name: 'Inconsolata', url: 'https://fonts.googleapis.com/css2?family=Inconsolata:wght@300;400;500;700&display=swap' },
    { name: 'Press Start 2P', url: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap' },
    { name: 'VT323', url: 'https://fonts.googleapis.com/css2?family=VT323&display=swap' },
    { name: 'Silkscreen', url: 'https://fonts.googleapis.com/css2?family=Silkscreen&display=swap' }
];

const getContrastColor = (hexColor: string) => {
    if (!hexColor || hexColor === 'none') return 'var(--text-primary)';
    const hex = hexColor.replace('#', '');
    if (hex.length < 6) return '#ffffff';
    const rVal = parseInt(hex.substr(0, 2), 16) || 0;
    const gVal = parseInt(hex.substr(2, 2), 16) || 0;
    const bVal = parseInt(hex.substr(4, 2), 16) || 0;
    const yiq = ((rVal * 299) + (gVal * 587) + (bVal * 114)) / 1000;
    return yiq >= 128 ? '#000000' : '#ffffff';
};

interface ThemeProviderProps {
    children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const { 
        theme, 
        textScale, 
        fontFamily, 
        darkAccent, 
        lightAccent,
        myBubbleColor,
        aiBubbleColor,
        localFontSize,
        cursorType,
        bgGlowOpacity
    } = useThemeStore();

    // Load all Google fonts on mount
    useEffect(() => {
        GOOGLE_FONTS.forEach(font => {
            const fontId = `font-${font.name.replace(/\s+/g, '-')}`;
            if (!document.getElementById(fontId)) {
                const link = document.createElement('link');
                link.id = fontId;
                link.rel = 'stylesheet';
                link.href = font.url;
                document.head.appendChild(link);
            }
        });
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        const activeTheme = THEMES[theme] || THEMES.dark;

        // Remove previous theme classes
        Object.values(THEMES).forEach((t) => {
            root.classList.remove(t.class);
        });

        // Add active theme class
        root.classList.add(activeTheme.class);

        // Hide native cursor if custom cursor is active
        if (['smooth', 'neon', 'canvas', 'aura'].includes(cursorType)) {
            root.classList.add('custom-cursor-active');
        } else {
            root.classList.remove('custom-cursor-active');
        }

        // Apply theme properties as CSS Custom Properties (Variables)
        const isDarkTheme = theme !== 'light';
        const customAccent = isDarkTheme ? darkAccent : lightAccent;

        const r = parseInt(customAccent.slice(1, 3), 16) || 0;
        const g = parseInt(customAccent.slice(3, 5), 16) || 0;
        const b = parseInt(customAccent.slice(5, 7), 16) || 0;
        root.style.setProperty('--accent-color-rgb', `${r}, ${g}, ${b}`);

        // Set accent contrast dynamically
        const accentContrast = getContrastColor(customAccent);
        root.style.setProperty('--accent-contrast', accentContrast);

        Object.entries(activeTheme.properties).forEach(([propName, propValue]) => {
            if (propName === '--accent-color') {
                root.style.setProperty(propName, customAccent);
            } else if (propName === '--accent-glow') {
                root.style.setProperty(propName, `rgba(${r}, ${g}, ${b}, 0.25)`);
            } else if (propName === '--bg-primary' || propName === '--bg-secondary' || propName === '--bg-tertiary') {
                root.style.setProperty(propName, `color-mix(in srgb, ${customAccent} calc(var(--bg-glow-opacity) * 10%), ${propValue})`);
            } else if (propName === '--border-color') {
                root.style.setProperty(propName, `color-mix(in srgb, ${customAccent} calc(var(--bg-glow-opacity) * 15%), ${propValue})`);
            } else {
                root.style.setProperty(propName, propValue);
            }
        });

        // Set global text scale font multiplier
        root.style.setProperty('--text-scale', textScale.toString());
        root.style.fontSize = `${textScale * 100}%`; // updates rem values dynamically!

        // Apply font family override
        let fontVal = activeTheme.properties['--font-family'];
        if (fontFamily === 'mono') {
            fontVal = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
        } else if (fontFamily === 'pixel') {
            fontVal = '"Courier New", Courier, monospace';
        } else if (fontFamily) {
            fontVal = `"${fontFamily}", system-ui, -apple-system, sans-serif`;
        }
        root.style.setProperty('--font-family', fontVal);

        // Apply chat bubble background overrides
        const bubbleBgMy = myBubbleColor === 'none' ? 'var(--bg-secondary)' : myBubbleColor;
        const bubbleBgAi = aiBubbleColor === 'none' ? 'var(--bg-tertiary)' : aiBubbleColor;
        const bubbleFgMy = myBubbleColor === 'none' ? 'var(--text-primary)' : getContrastColor(myBubbleColor);
        const bubbleFgAi = aiBubbleColor === 'none' ? 'var(--text-primary)' : getContrastColor(aiBubbleColor);

        root.style.setProperty('--chat-bubble-bg-my', bubbleBgMy);
        root.style.setProperty('--chat-bubble-bg-ai', bubbleBgAi);
        root.style.setProperty('--chat-bubble-fg-my', bubbleFgMy);
        root.style.setProperty('--chat-bubble-fg-ai', bubbleFgAi);
        root.style.setProperty('--chat-bubble-font-size', `${localFontSize * textScale}px`);
        
        root.style.setProperty('--bg-glow-opacity', (bgGlowOpacity / 100).toString());
        
        // Dynamic scrollbar styles based on theme colors
        root.style.setProperty('--scrollbar-bg', activeTheme.properties['--bg-secondary']);
        root.style.setProperty('--scrollbar-thumb', activeTheme.properties['--border-color']);

    }, [theme, textScale, fontFamily, darkAccent, lightAccent, myBubbleColor, aiBubbleColor, localFontSize, cursorType, bgGlowOpacity]);

    return (
        <div className="h-full w-full bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300 font-[family-name:var(--font-family)]">
            {children}
        </div>
    );
}

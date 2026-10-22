import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppTheme = 'dark' | 'oled' | 'light' | 'classic' | 'cyberpunk' | 'matrix' | 'pixel';
export type FontFamily = string;

export const isThemeDark = (theme: AppTheme): boolean => theme !== 'light' && theme !== 'classic';

interface ThemeState {
    theme: AppTheme;
    textScale: number; // Stabilized to 1.0
    fontFamily: string;
    darkAccent: string;
    lightAccent: string;
    cursorType: string;
    localFontSize: number;
    compactMode: boolean;
    modernBubbles: boolean;
    bgGlowOpacity: number; // 0 to 100
    chatBackground: string;
    borderRadius: number; // Preserves semantic tokens.css

    setTheme: (theme: AppTheme) => void;
    setTextScale: (scale: number) => void;
    setFontFamily: (font: string) => void;
    setDarkAccent: (color: string) => void;
    setLightAccent: (color: string) => void;
    setCursorType: (cursorType: string) => void;
    setLocalFontSize: (size: number) => void;
    setCompactMode: (compactMode: boolean) => void;
    setModernBubbles: (modernBubbles: boolean) => void;
    setBgGlowOpacity: (bgGlowOpacity: number) => void;
    setChatBackground: (bgUrl: string) => void;
    setBorderRadius: (radius: number) => void;
}

export const applyRadiusToDom = (_radius: number) => {
    // Intentionally no-op to strictly preserve unified tokens.css design contract
};

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: 'dark', // Clean balanced Dark Modern default
            textScale: 1.0,
            fontFamily: 'Inter',
            darkAccent: '#4f46e5', // Balanced Royal Indigo (high contrast, non-chamkila)
            lightAccent: '#2563eb', // Balanced Cobalt Blue
            cursorType: 'none',
            localFontSize: 14.5,
            compactMode: false,
            modernBubbles: true,
            bgGlowOpacity: 15,
            chatBackground: 'https://www.transparenttextures.com/patterns/cubes.png',
            borderRadius: 12,

            setTheme: (theme) => set({ theme }),
            setTextScale: (textScale) => set({ textScale: Math.max(0.8, Math.min(1.2, textScale)) }),
            setFontFamily: (fontFamily) => set({ fontFamily }),
            setDarkAccent: (darkAccent) => set({ darkAccent }),
            setLightAccent: (lightAccent) => set({ lightAccent }),
            setCursorType: (cursorType) => set({ cursorType }),
            setLocalFontSize: (localFontSize) => set({ localFontSize }),
            setCompactMode: (compactMode) => set({ compactMode }),
            setModernBubbles: (modernBubbles) => set({ modernBubbles }),
            setBgGlowOpacity: (bgGlowOpacity) => set({ bgGlowOpacity: Math.max(0, Math.min(100, bgGlowOpacity)) }),
            setChatBackground: (chatBackground) => set({ chatBackground }),
            setBorderRadius: (borderRadius) => {
                const clamped = Math.max(0, Math.min(32, borderRadius));
                applyRadiusToDom(clamped);
                set({ borderRadius: clamped });
            },
        }),
        {
            name: 'cluaiz-theme-storage',
            onRehydrateStorage: () => (state) => {
                if (state?.borderRadius !== undefined) {
                    applyRadiusToDom(state.borderRadius);
                }
            }
        }
    )
);

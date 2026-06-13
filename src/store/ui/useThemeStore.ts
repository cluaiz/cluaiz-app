import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppTheme = 'dark' | 'light' | 'oled' | 'cyberpunk' | 'matrix' | 'pixel';
export type FontFamily = string;

interface ThemeState {
    theme: AppTheme;
    textScale: number; // 0.8 to 1.2
    fontFamily: string;
    darkAccent: string;
    lightAccent: string;
    cursorType: string;
    myBubbleColor: string;
    aiBubbleColor: string;
    localFontSize: number;
    compactMode: boolean;
    modernBubbles: boolean;
    bgGlowOpacity: number; // 0 to 100
    chatBackground: string;
    
    setTheme: (theme: AppTheme) => void;
    setTextScale: (scale: number) => void;
    setFontFamily: (font: string) => void;
    setDarkAccent: (color: string) => void;
    setLightAccent: (color: string) => void;
    setCursorType: (cursorType: string) => void;
    setMyBubbleColor: (color: string) => void;
    setAiBubbleColor: (color: string) => void;
    setLocalFontSize: (size: number) => void;
    setCompactMode: (compactMode: boolean) => void;
    setModernBubbles: (modernBubbles: boolean) => void;
    setBgGlowOpacity: (bgGlowOpacity: number) => void;
    setChatBackground: (bgUrl: string) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: 'cyberpunk', // default premium theme matching the cyberpunk vision
            textScale: 1.0,
            fontFamily: 'Inter',
            darkAccent: '#00f0ff', // default (cyberpunk cyan)
            lightAccent: '#2563eb', // default (light blue)
            cursorType: 'none',
            myBubbleColor: 'none',
            aiBubbleColor: 'none',
            localFontSize: 14.5,
            compactMode: false,
            modernBubbles: true,
            bgGlowOpacity: 15, // default opacity is 15%
            chatBackground: 'https://www.transparenttextures.com/patterns/cubes.png', // Default texture

            setTheme: (theme) => set({ theme }),
            setTextScale: (textScale) => set({ textScale: Math.max(0.8, Math.min(1.2, textScale)) }),
            setFontFamily: (fontFamily) => set({ fontFamily }),
            setDarkAccent: (darkAccent) => set({ darkAccent }),
            setLightAccent: (lightAccent) => set({ lightAccent }),
            setCursorType: (cursorType) => set({ cursorType }),
            setMyBubbleColor: (myBubbleColor) => set({ myBubbleColor }),
            setAiBubbleColor: (aiBubbleColor) => set({ aiBubbleColor }),
            setLocalFontSize: (localFontSize) => set({ localFontSize }),
            setCompactMode: (compactMode) => set({ compactMode }),
            setModernBubbles: (modernBubbles) => set({ modernBubbles }),
            setBgGlowOpacity: (bgGlowOpacity) => set({ bgGlowOpacity: Math.max(0, Math.min(100, bgGlowOpacity)) }),
            setChatBackground: (chatBackground) => set({ chatBackground }),
        }),
        {
            name: 'cluaiz-theme-storage',
        }
    )
);

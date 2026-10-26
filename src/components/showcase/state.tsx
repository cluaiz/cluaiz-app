import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Contrast } from 'lucide-react';
import { DateRange } from '../ui/dropdown/CalendarDropdown';
import { useThemeStore, AppTheme } from '../../store/ui/useThemeStore';
import { COMPONENT_GROUPS } from './catalog';
import type { ComponentId } from './types';
export function useShowcaseState(){
const {
        theme,
        setTheme,
        darkAccent,
        setDarkAccent,
        lightAccent,
        setLightAccent,
        fontFamily,
        setFontFamily,
        borderRadius,
        setBorderRadius
    } = useThemeStore();
const [selectedId, setSelectedId] = useState<ComponentId>('typography');
const [searchQuery, setSearchQuery] = useState('');
const [inputVal, setInputVal] = useState('Interactive editable input');
const [inputError, setInputError] = useState('');
const [toggle1, setToggle1] = useState(true);
const [toggle2, setToggle2] = useState(false);
const [sliderVal, setSliderVal] = useState(65);
const [customDropdownVal, setCustomDropdownVal] = useState('Rust Native');
const [selectedFilter, setSelectedFilter] = useState('all');
const [demoDateRange, setDemoDateRange] = useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(Date.now() + 86400000 * 3)
    });
const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);
const [isCalendarDropdownOpen, setIsCalendarDropdownOpen] = useState(false);
const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
const [isConfirmOpen, setIsConfirmOpen] = useState(false);
const [isPortModalOpen, setIsPortModalOpen] = useState(false);
const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
const [selectedEmoji, setSelectedEmoji] = useState('⚡');
const [copiedText, setCopiedText] = useState<string | null>(null);
const actionDropdownRef = useRef<HTMLButtonElement>(null);
const calendarDropdownRef = useRef<HTMLButtonElement>(null);
const filterDropdownRef = useRef<HTMLButtonElement>(null);
const emojiTriggerRef = useRef<HTMLButtonElement>(null);
const [copyError, setCopyError] = useState('');
const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
const copyToClipboard = async (text: string) => {
    setCopyError('');
    try {
        await navigator.clipboard.writeText(text);
        setCopiedText(text);
        if (copyTimer.current) clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopiedText(null), 1800);
    } catch {
        setCopiedText(null);
        setCopyError('Clipboard access is unavailable. Select and copy the displayed text manually.');
    }
};
const filteredGroups = COMPONENT_GROUPS.map((grp) => ({
        ...grp,
        items: grp.items.filter(
            (item) =>
                item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.path.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter((grp) => grp.items.length > 0);
const activeItem = COMPONENT_GROUPS.flatMap((g) => g.items).find((i) => i.id === selectedId) || COMPONENT_GROUPS[0].items[0];
const accentOptions = [
        { label: 'Cyan Cyber', dark: '#00f0ff', light: '#0891b2' },
        { label: 'Violet Neon', dark: '#a855f7', light: '#7c3aed' },
        { label: 'Emerald Signal', dark: '#10b981', light: '#059669' },
        { label: 'Amber Alert', dark: '#f59e0b', light: '#d97706' },
        { label: 'Rose Flame', dark: '#f43f5e', light: '#e11d48' },
        { label: 'Pure White', dark: '#f8fafc', light: '#0f172a' }
    ];
const themeModes: { id: AppTheme; label: string; icon: React.ReactNode; desc: string }[] = [
        { id: 'dark', label: 'Dark Modern', icon: <Moon className="w-4 h-4 text-violet-400" />, desc: 'Deep zinc surfaces with balanced shadows' },
        { id: 'oled', label: 'OLED Black', icon: <Contrast className="w-4 h-4 text-gray-300" />, desc: 'Pitch #000000 for pure battery & contrast' },
        { id: 'light', label: 'Light Modern', icon: <Sun className="w-4 h-4 text-amber-500" />, desc: 'Clean white surfaces with high daytime readability' },
        { id: 'classic', label: 'Light Classic', icon: <Contrast className="w-4 h-4 text-sky-400" />, desc: 'High-contrast traditional crisp daylight' },
    ];
return { theme, setTheme, darkAccent, setDarkAccent, lightAccent, setLightAccent, fontFamily, setFontFamily, borderRadius, setBorderRadius, selectedId, setSelectedId, searchQuery, setSearchQuery, inputVal, setInputVal, inputError, setInputError, toggle1, setToggle1, toggle2, setToggle2, sliderVal, setSliderVal, customDropdownVal, setCustomDropdownVal, selectedFilter, setSelectedFilter, demoDateRange, setDemoDateRange, isActionDropdownOpen, setIsActionDropdownOpen, isCalendarDropdownOpen, setIsCalendarDropdownOpen, isFilterDropdownOpen, setIsFilterDropdownOpen, isConfirmOpen, setIsConfirmOpen, isPortModalOpen, setIsPortModalOpen, isLabelModalOpen, setIsLabelModalOpen, isEmojiPickerOpen, setIsEmojiPickerOpen, selectedEmoji, setSelectedEmoji, copiedText, setCopiedText, copyError, actionDropdownRef, calendarDropdownRef, filterDropdownRef, emojiTriggerRef, copyToClipboard, filteredGroups, activeItem, accentOptions, themeModes };
}
export type ShowcaseDemoState = ReturnType<typeof useShowcaseState>;

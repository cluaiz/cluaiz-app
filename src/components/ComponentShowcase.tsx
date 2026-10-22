import React, { useState, useRef } from 'react';
import {
    Sparkles,
    Check,
    AlertCircle,
    Trash2,
    Settings,
    Plus,
    Search,
    Smile,
    Copy,
    ExternalLink,
    Layers,
    Eye,
    Palette,
    Sliders,
    MessageSquare,
    Info,
    CheckCircle2,
    AlertTriangle,
    X,
    Folder,
    FileText,
    Flame,
    Zap,
    Terminal,
    Code,
    HelpCircle,
    Calendar,
    Filter,
    Volume2,
    Shield,
    Bell,
    Share2,
    RefreshCw,
    Play,
    Cpu,
    MousePointer,
    LayoutGrid,
    Inbox,
    Component,
    ChevronRight,
    SlidersHorizontal,
    Box,
    Type,
    Maximize2,
    Sun,
    Moon,
    Contrast,
    Paintbrush,
    CornerUpRight
} from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Tag } from './ui/Tag';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/Card';
import { ToggleSwitch } from './ui/ToggleSwitch';
import { AlertBanner } from './ui/AlertBanner';
import { ActionDropdown, ActionDropdownItem } from './ui/dropdown/ActionDropdown';
import { CustomDropdown, DropdownOption } from './ui/dropdown/CustomDropdown';
import { CalendarDropdown, DateRange } from './ui/dropdown/CalendarDropdown';
import { FilterDropdown } from './ui/dropdown/FilterDropdown';
import { ConfirmationModal } from './ui/modal/ConfirmationModal';
import { PortConfirmModal } from './ui/modal/PortConfirmModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { LabelModal } from './ui/LabelModal';
import { EmojiPicker } from './ui/context-menu/EmojiPicker';
import { Tooltip } from './ui/tooltip';
import { ElasticSlider } from './ui/cursor/ElasticSlider';
import { ContextChip } from './ui/ContextChip';
import { DateDivider } from './ui/DateDivider';
import BorderGlow from './ui/BorderGlow';
import ClickSpark from './ui/ClickSpark';
import { Backlight } from './ui/Backlight';
import { RichHoverCard } from './ui/RichHoverCard';
import { ToastContainer } from './ui/toast/ToastContainer';
import { toast } from './ui/toast';
import { BinaryFileCard } from './preview/BinaryFileCard';

// Animated Micro-Icons from animate-ui
import { Bot as AnimatedBot } from './animate-ui/icons/bot';
import { Calendar as AnimatedCalendar } from './animate-ui/icons/calendar';
import { Clipboard as AnimatedClipboard } from './animate-ui/icons/clipboard';
import { Pause as AnimatedPause } from './animate-ui/icons/pause';
import { Play as AnimatedPlay } from './animate-ui/icons/play';
import { PhoneCall as AnimatedPhoneCall } from './animate-ui/icons/phone-call';
import { SlidersHorizontal as AnimatedSliders } from './animate-ui/icons/sliders-horizontal';
import { RotateCw as AnimatedRotateCw } from './animate-ui/icons/rotate-cw';
import { Search as AnimatedSearch } from './animate-ui/icons/search';
import { X as AnimatedX } from './animate-ui/icons/x';

import { useThemeStore, AppTheme } from '../store/ui/useThemeStore';
import Logo3D from './ui/Logo3D';

type ComponentId =
    | 'typography'
    | 'radius'
    | 'colors'
    | 'themestudio'
    | 'button'
    | 'input'
    | 'toggleswitch'
    | 'elasticslider'
    | 'badge'
    | 'tag'
    | 'contextchip'
    | 'datedivider'
    | 'customdropdown'
    | 'calendardropdown'
    | 'filterdropdown'
    | 'actiondropdown'
    | 'confirmationmodal'
    | 'portmodal'
    | 'labelmodal'
    | 'emojipicker'
    | 'borderglow'
    | 'clickspark'
    | 'richhovercard'
    | 'backlight'
    | 'tooltip'
    | 'toast'
    | 'alertbanner'
    | 'animatedicons'
    | 'binarypreview'
    | 'card';

interface ComponentNavGroup {
    group: string;
    items: {
        id: ComponentId;
        label: string;
        path: string;
        description: string;
        tag?: string;
    }[];
}

const COMPONENT_GROUPS: ComponentNavGroup[] = [
    {
        group: 'Design Foundations',
        items: [
            { id: 'typography', label: 'Typography & Scale', path: 'src/styles/index.css', description: 'Font stacks, type scale from 32px to 10px, weights, and tracking.', tag: 'Tokens' },
            { id: 'radius', label: 'Border Radius Scale', path: 'src/styles/index.css', description: 'Corner curvature tokens from 0px to 24px and full pills.', tag: 'Tokens' },
            { id: 'colors', label: 'Colors & Surfaces', path: 'src/styles/index.css', description: 'Three-layer background depth, text hierarchy, and status tokens.', tag: 'Tokens' },
            { id: 'themestudio', label: 'Theme Studio (6 Modes)', path: 'src/store/ui/useThemeStore.ts', description: 'Live real-time switch between Dark, Light, OLED, Cyberpunk, Matrix, and Pixel.', tag: 'Live' }
        ]
    },
    {
        group: 'Primitives & Actions',
        items: [
            { id: 'button', label: 'Button', path: 'src/components/ui/Button.tsx', description: '8 visual variants, 4 sizing scales, icons and states.', tag: 'Core' },
            { id: 'badge', label: 'Badge', path: 'src/components/ui/Badge.tsx', description: 'Semantic status pills, cyber, and 8-bit chip badges.', tag: 'Core' },
            { id: 'tag', label: 'Tag', path: 'src/components/ui/Tag.tsx', description: 'Interactive toggle and trending filter tags.' },
            { id: 'card', label: 'Card', path: 'src/components/ui/Card.tsx', description: 'Structured surfaces with headers, bodies, and glassmorphism.' }
        ]
    },
    {
        group: 'Inputs & Controls',
        items: [
            { id: 'input', label: 'Input', path: 'src/components/ui/Input.tsx', description: 'Text input with validation error states and disabled modes.' },
            { id: 'toggleswitch', label: 'ToggleSwitch', path: 'src/components/ui/ToggleSwitch.tsx', description: 'Hardware acceleration switch with smooth pill sliding.' },
            { id: 'elasticslider', label: 'ElasticSlider', path: 'src/components/ui/cursor/ElasticSlider.tsx', description: 'Spring physics numeric slider with boundary sigmoid stretch.' }
        ]
    },
    {
        group: 'Dropdowns & Portals',
        items: [
            { id: 'actiondropdown', label: 'ActionDropdown', path: 'src/components/ui/dropdown/ActionDropdown.tsx', description: 'Floating portal menu anchored to button with zero screen clipping.' },
            { id: 'customdropdown', label: 'CustomDropdown', path: 'src/components/ui/dropdown/CustomDropdown.tsx', description: 'Searchable dropdown supporting custom values & icons.' },
            { id: 'calendardropdown', label: 'CalendarDropdown', path: 'src/components/ui/dropdown/CalendarDropdown.tsx', description: 'Drag-to-select date range picker with booked chats count.' },
            { id: 'filterdropdown', label: 'FilterDropdown', path: 'src/components/ui/dropdown/FilterDropdown.tsx', description: 'Status and category filtering checklist.' },
            { id: 'emojipicker', label: 'EmojiPicker', path: 'src/components/ui/context-menu/EmojiPicker.tsx', description: 'Floating reaction emoji picker grid.' }
        ]
    },
    {
        group: 'Modals & Overlays',
        items: [
            { id: 'confirmationmodal', label: 'ConfirmationModal', path: 'src/components/ui/modal/ConfirmationModal.tsx', description: 'Destructive action prompt with animated backdrop.' },
            { id: 'portmodal', label: 'PortConfirmModal', path: 'src/components/ui/modal/PortConfirmModal.tsx', description: 'Engine gateway port reconfiguration dialog.' },
            { id: 'labelmodal', label: 'LabelModal', path: 'src/components/ui/LabelModal.tsx', description: 'Color ribbon manager and tag pool creator.' }
        ]
    },
    {
        group: 'Visual FX & Lighting',
        items: [
            { id: 'borderglow', label: 'BorderGlow', path: 'src/components/ui/BorderGlow.tsx', description: 'Specular glowing neon edge responsive to cursor proximity.', tag: 'Cyber' },
            { id: 'clickspark', label: 'ClickSpark', path: 'src/components/ui/ClickSpark.tsx', description: 'Canvas hardware particle explosion on click interaction.', tag: 'Cyber' },
            { id: 'richhovercard', label: 'RichHoverCard', path: 'src/components/ui/RichHoverCard.tsx', description: 'Hover inspect card displaying code ranges & AI prompts.' },
            { id: 'backlight', label: 'Backlight', path: 'src/components/ui/Backlight.tsx', description: 'SVG Gaussian filter creating ambient diffused illumination.' },
            { id: 'tooltip', label: 'Tooltip', path: 'src/components/ui/tooltip.tsx', description: 'Viewport-aware floating hint tooltip with arrow alignment.' }
        ]
    },
    {
        group: 'Feedback & Timeline',
        items: [
            { id: 'toast', label: 'Toast Notifications', path: 'src/components/ui/toast/ToastContainer.tsx', description: 'Stackable notification toasts with timers and action buttons.' },
            { id: 'alertbanner', label: 'AlertBanner', path: 'src/components/ui/AlertBanner.tsx', description: 'Info, warning, success, and error notification banners.' },
            { id: 'contextchip', label: 'ContextChip', path: 'src/components/ui/ContextChip.tsx', description: 'Removable draggable file, folder, and skill context chip.' },
            { id: 'datedivider', label: 'DateDivider', path: 'src/components/ui/DateDivider.tsx', description: 'Chat stream calendar timeline divider.' }
        ]
    },
    {
        group: 'Icons & Media Previews',
        items: [
            { id: 'animatedicons', label: 'Animated Icons', path: 'src/components/animate-ui/icons/', description: '10 physics-driven micro-interaction animated vector icons.', tag: 'Anim' },
            { id: 'binarypreview', label: 'BinaryFileCard', path: 'src/components/preview/BinaryFileCard.tsx', description: 'Fallback preview for tar.gz archives and native binaries.' }
        ]
    }
];

export const ComponentShowcase: React.FC = () => {
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

    // Interactive Demo States
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

    // Modals & Overlays States
    const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);
    const [isCalendarDropdownOpen, setIsCalendarDropdownOpen] = useState(false);
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isPortModalOpen, setIsPortModalOpen] = useState(false);
    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [selectedEmoji, setSelectedEmoji] = useState('⚡');
    const [copiedText, setCopiedText] = useState<string | null>(null);

    // Anchor Refs
    const actionDropdownRef = useRef<HTMLButtonElement>(null);
    const calendarDropdownRef = useRef<HTMLButtonElement>(null);
    const filterDropdownRef = useRef<HTMLButtonElement>(null);
    const emojiTriggerRef = useRef<HTMLButtonElement>(null);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedText(text);
        setTimeout(() => setCopiedText(null), 1800);
    };

    // Filter components by search query
    const filteredGroups = COMPONENT_GROUPS.map((grp) => ({
        ...grp,
        items: grp.items.filter(
            (item) =>
                item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.path.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter((grp) => grp.items.length > 0);

    // Current active component metadata
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

    return (
        <div className="flex h-full w-full bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden font-sans">
            {/* Dedicated Toast Container for interactive testing */}
            <ToastContainer />

            {/* LEFT SIDEBAR: DESIGN SYSTEM & COMPONENT DIRECTORY */}
            <aside className="w-72 md:w-80 shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-secondary)]/40 flex flex-col h-full select-none">
                {/* Sidebar Header */}
                <div className="p-4 border-b border-[var(--border-color)] space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {/* <div className="p-1.5 rounded-lg bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20 shadow-sm">
                                <Layers className="w-4 h-4" />
                            </div> */}
                            <div className="w-24 h-24">
                                <Logo3D />
                            </div>
                            <div>
                                <span className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)] block">
                                    Cluaiz Design System
                                </span>
                                <span className="text-[10px] text-[var(--text-muted)] font-mono">v1.0 Specifications</span>
                            </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--accent-color)]/15 text-[var(--accent-color)] font-bold">
                            28 Specs
                        </span>
                    </div>

                    {/* Search Field */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <input
                            type="text"
                            placeholder="Search tokens & components..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)] transition-colors"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Sidebar Scrollable Nav List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-5 scrollbar-thin">
                    {filteredGroups.map((grp) => (
                        <div key={grp.group} className="space-y-1">
                            <div className="px-2 pb-1 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
                                <span>{grp.group}</span>
                                <span className="text-[9px] font-mono opacity-60">{grp.items.length}</span>
                            </div>

                            <div className="space-y-0.5">
                                {grp.items.map((item) => {
                                    const isSelected = selectedId === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setSelectedId(item.id)}
                                            className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-between group ${isSelected
                                                ? 'bg-[var(--accent-color)] text-[var(--accent-contrast)] shadow-sm font-semibold'
                                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]/70'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                {item.id === 'typography' ? (
                                                    <Type className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[var(--accent-contrast)]' : 'text-[var(--text-muted)] group-hover:text-[var(--accent-color)]'}`} />
                                                ) : item.id === 'radius' ? (
                                                    <Maximize2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[var(--accent-contrast)]' : 'text-[var(--text-muted)] group-hover:text-[var(--accent-color)]'}`} />
                                                ) : item.id === 'colors' || item.id === 'themestudio' ? (
                                                    <Palette className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[var(--accent-contrast)]' : 'text-[var(--text-muted)] group-hover:text-[var(--accent-color)]'}`} />
                                                ) : (
                                                    <Box className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[var(--accent-contrast)]' : 'text-[var(--text-muted)] group-hover:text-[var(--accent-color)]'}`} />
                                                )}
                                                <span className="truncate">{item.label}</span>
                                            </div>

                                            {item.tag && (
                                                <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${isSelected
                                                    ? 'bg-black/10 border-current/20 text-[var(--accent-contrast)]'
                                                    : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-muted)]'
                                                    }`}>
                                                    {item.tag}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Sidebar Footer Theme Status & Quick Switch */}
                <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-primary)]/50 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <div className="flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                        <span className="capitalize font-medium">{theme} Mode</span>
                    </div>
                    <button
                        onClick={() => setSelectedId('themestudio')}
                        className="px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[10px] text-[var(--accent-color)] hover:bg-[var(--accent-color)]/10 transition-colors"
                    >
                        Tweak
                    </button>
                </div>
            </aside>

            {/* RIGHT MAIN PANEL: LIVE DESIGN STAGE */}
            <main className="flex-1 h-full overflow-y-auto flex flex-col">
                {/* Header Canvas Banner */}
                <div className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/20 px-8 py-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
                                    {activeItem.label}
                                </h1>
                                <span className="font-mono text-[10px] text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-2 py-0.5 rounded-md border border-[var(--accent-color)]/20">
                                    {activeItem.path}
                                </span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                {activeItem.description}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => copyToClipboard(activeItem.path)}
                                className="px-3 py-1.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 transition-colors"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                <span>{copiedText === activeItem.path ? 'Copied Path!' : 'Copy Path'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Preview Playground Stage */}
                <div className="flex-1 p-8 max-w-5xl space-y-8">
                    {/* 0A. TYPOGRAPHY FOUNDATIONS */}
                    {selectedId === 'typography' && (
                        <div className="space-y-8">
                            {/* Font Family & Live Scale Controls */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                            Font Families & Typographic Scale
                                        </h3>
                                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                            Active Family: <code className="text-[var(--accent-color)]">{fontFamily}</code> · Unified optical scaling
                                        </p>
                                    </div>

                                    {/* Font Family Switcher */}
                                    <div className="flex items-center gap-2">
                                        {['Inter', 'JetBrains Mono', 'Fira Code', 'Press Start 2P'].map((font) => (
                                            <button
                                                key={font}
                                                onClick={() => setFontFamily(font)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${fontFamily === font
                                                    ? 'bg-[var(--accent-color)] text-[var(--accent-contrast)] font-bold'
                                                    : 'bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                    }`}
                                            >
                                                {font}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Type Scale Hierarchy Table */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-6">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                    Type Scale Hierarchy (Pixels & Line Heights)
                                </h3>

                                <div className="space-y-5 divide-y divide-[var(--border-color)]">
                                    {/* Display H1 */}
                                    <div className="pt-4 first:pt-0 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
                                        <div className="md:w-48 shrink-0">
                                            <span className="text-xs font-mono font-bold text-[var(--accent-color)]">Display / H1</span>
                                            <p className="text-[10px] text-[var(--text-muted)] font-mono">32px (2rem) · font-black</p>
                                        </div>
                                        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
                                            Silicon Orchestrator Gateway
                                        </h1>
                                    </div>

                                    {/* Section H2 */}
                                    <div className="pt-4 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
                                        <div className="md:w-48 shrink-0">
                                            <span className="text-xs font-mono font-bold text-[var(--accent-color)]">Section / H2</span>
                                            <p className="text-[10px] text-[var(--text-muted)] font-mono">24px (1.5rem) · font-bold</p>
                                        </div>
                                        <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                                            Real-Time Tensor Compute Graph
                                        </h2>
                                    </div>

                                    {/* Subsection H3 */}
                                    <div className="pt-4 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
                                        <div className="md:w-48 shrink-0">
                                            <span className="text-xs font-mono font-bold text-[var(--accent-color)]">Subsection / H3</span>
                                            <p className="text-[10px] text-[var(--text-muted)] font-mono">18px (1.125rem) · font-semibold</p>
                                        </div>
                                        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                                            Memory Guard & Unified Buffer Allocation
                                        </h3>
                                    </div>

                                    {/* Body Base */}
                                    <div className="pt-4 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
                                        <div className="md:w-48 shrink-0">
                                            <span className="text-xs font-mono font-bold text-[var(--accent-color)]">Body / Regular</span>
                                            <p className="text-[10px] text-[var(--text-muted)] font-mono">14px (0.875rem) · font-normal</p>
                                        </div>
                                        <p className="text-sm font-normal text-[var(--text-secondary)] leading-relaxed max-w-xl">
                                            Zero-copy execution transfers tensors straight to GPU device memory without going through host RAM serialization passes.
                                        </p>
                                    </div>

                                    {/* Caption / Small */}
                                    <div className="pt-4 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
                                        <div className="md:w-48 shrink-0">
                                            <span className="text-xs font-mono font-bold text-[var(--accent-color)]">Small / Caption</span>
                                            <p className="text-[10px] text-[var(--text-muted)] font-mono">12px (0.75rem) · font-medium</p>
                                        </div>
                                        <p className="text-xs font-medium text-[var(--text-muted)]">
                                            Last sync: 2 ms ago · Latency: 0.45 ms/token · Threads: 16 (AVX-512)
                                        </p>
                                    </div>

                                    {/* Micro / Tag */}
                                    <div className="pt-4 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
                                        <div className="md:w-48 shrink-0">
                                            <span className="text-xs font-mono font-bold text-[var(--accent-color)]">Micro / Token</span>
                                            <p className="text-[10px] text-[var(--text-muted)] font-mono">10px (0.625rem) · font-bold</p>
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                            METRIC_VRAM_PEAK_CONSUMPTION
                                        </span>
                                    </div>

                                    {/* Mono Code */}
                                    <div className="pt-4 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
                                        <div className="md:w-48 shrink-0">
                                            <span className="text-xs font-mono font-bold text-[var(--accent-color)]">Code / Mono</span>
                                            <p className="text-[10px] text-[var(--text-muted)] font-mono">11px · font-mono</p>
                                        </div>
                                        <code className="text-[11px] font-mono text-[var(--accent-color)] bg-[var(--bg-primary)] px-2.5 py-1 rounded-md border border-[var(--border-color)]">
                                            ptx_compile_kernel(&quot;gemm_fp16&quot;, Arch::Sm89)?
                                        </code>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 0B. BORDER RADIUS FOUNDATIONS */}
                    {selectedId === 'radius' && (
                        <div className="space-y-8">
                            {/* Global Concentric Radius Controller */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                            Global Unified Corner Radius Controller
                                        </h3>
                                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                            Updates <code className="text-[var(--accent-color)]">--app-radius</code> globally. Notice the entire sidebar, buttons, and cards morph live!
                                        </p>
                                    </div>
                                    <span className="font-mono text-xs font-bold px-3 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--accent-color)] shrink-0">
                                        Current: {borderRadius}px
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    <input
                                        type="range"
                                        min="0"
                                        max="32"
                                        step="1"
                                        value={borderRadius}
                                        onChange={(e) => setBorderRadius(parseInt(e.target.value))}
                                        className="w-full accent-[var(--accent-color)] cursor-pointer"
                                    />

                                    {/* Preset Radius Buttons */}
                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                        {[
                                            { label: '0px Sharp', val: 0 },
                                            { label: '6px Compact', val: 6 },
                                            { label: '12px Modern (Default)', val: 12 },
                                            { label: '16px Smooth', val: 16 },
                                            { label: '24px Curved', val: 24 }
                                        ].map((preset) => (
                                            <button
                                                key={preset.val}
                                                onClick={() => setBorderRadius(preset.val)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${borderRadius === preset.val
                                                    ? 'bg-[var(--accent-color)] text-[var(--accent-contrast)] font-bold shadow-sm'
                                                    : 'bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                    }`}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3">
                                    <div className="p-5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl text-center transition-all">
                                        <p className="text-xs font-bold text-[var(--text-primary)]">Card Component</p>
                                        <p className="text-[10px] text-[var(--text-muted)] mt-1">Global radius applied live</p>
                                    </div>
                                    <button className="p-5 bg-[var(--accent-color)] text-[var(--accent-contrast)] text-center font-bold text-xs rounded-xl flex items-center justify-center transition-all shadow-sm">
                                        Button Component
                                    </button>
                                    <div className="p-5 bg-[var(--bg-primary)] border border-[var(--accent-color)]/60 text-center text-xs font-mono text-[var(--text-primary)] rounded-xl transition-all">
                                        Input Field ({borderRadius}px)
                                    </div>
                                </div>
                            </div>

                            {/* Concentric Corner Radius Law (Diagram & Mathematical Rule) */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-6">
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                        Concentric Corner Radius Law (Nested Geometry)
                                    </h3>
                                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                        The fundamental mathematical rule for nested elements: <code className="text-[var(--accent-color)]">R_inner = max(0, R_outer - padding)</code>.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* ❌ Clashing Radii (Wrong) */}
                                    <div className="p-5 rounded-2xl bg-[var(--bg-primary)] border border-rose-500/30 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs">
                                                <X className="w-4 h-4" />
                                                <span>Wrong: Outer = Inner</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-rose-400/80 bg-rose-500/10 px-2 py-0.5 rounded">
                                                Visual Clash &amp; Pinching
                                            </span>
                                        </div>

                                        {/* Visual Box */}
                                        <div className="relative p-3 bg-[var(--bg-secondary)] border border-white/10 rounded-2xl flex items-center justify-center">
                                            <div
                                                style={{ borderRadius: `${borderRadius}px` }}
                                                className="w-full h-32 border-2 border-dashed border-rose-400/50 p-2 flex items-center justify-center"
                                            >
                                                <div
                                                    style={{ borderRadius: `${borderRadius}px` }}
                                                    className="w-full h-full bg-rose-500/10 border border-rose-500/40 flex flex-col items-center justify-center text-center p-2"
                                                >
                                                    <span className="text-xs font-bold text-rose-300">Inner: {borderRadius}px</span>
                                                    <span className="text-[9px] text-rose-400/70">Outer: {borderRadius}px (Clashing corners)</span>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                            When inner radius equals outer radius, the distance between the arcs narrows unnaturally at the 45° corner, looking distorted and pinched.
                                        </p>
                                    </div>

                                    {/* ✅ Concentric Harmonic Radii (Correct) */}
                                    <div className="p-5 rounded-2xl bg-[var(--bg-primary)] border border-emerald-500/30 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                                                <Check className="w-4 h-4" />
                                                <span>Correct: Outer = Inner + Padding</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded">
                                                Parallel Arcs (Harmonic)
                                            </span>
                                        </div>

                                        {/* Visual Box */}
                                        <div className="relative p-3 bg-[var(--bg-secondary)] border border-white/10 rounded-2xl flex items-center justify-center">
                                            <div
                                                style={{ borderRadius: `${borderRadius}px` }}
                                                className="w-full h-32 border-2 border-emerald-400/70 p-2.5 flex items-center justify-center transition-all"
                                            >
                                                <div
                                                    style={{ borderRadius: `${Math.max(0, borderRadius - 10)}px` }}
                                                    className="w-full h-full bg-emerald-500/10 border border-emerald-500/40 flex flex-col items-center justify-center text-center p-2 transition-all"
                                                >
                                                    <span className="text-xs font-bold text-emerald-300">
                                                        Inner: {Math.max(0, borderRadius - 10)}px
                                                    </span>
                                                    <span className="text-[9px] text-emerald-400/70">
                                                        Outer: {borderRadius}px (Padding: 10px)
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                            By subtracting the 10px padding from the outer radius, both curves share the exact same radial center. When outer is 0px, inner collapses cleanly to 0px!
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Standard Scale Table */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-5">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                    Official Design Token Radius Scale
                                </h3>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {[
                                        { name: 'rounded-none', value: '0px', usage: 'Pixel theme & sharp overlays', class: 'rounded-none' },
                                        { name: 'rounded-sm', value: '2px', usage: 'Code tokens & micro badges', class: 'rounded-sm' },
                                        { name: 'rounded-md', value: '6px', usage: 'Context chips & tooltips', class: 'rounded-md' },
                                        { name: 'rounded-lg', value: '8px', usage: 'Icon buttons & list items', class: 'rounded-lg' },
                                        { name: 'rounded-xl', value: '12px', usage: 'Inputs, buttons & dropdowns', class: 'rounded-xl' },
                                        { name: 'rounded-2xl', value: '16px', usage: 'Modals, cards & dialogs', class: 'rounded-2xl' },
                                        { name: 'rounded-3xl', value: '24px', usage: 'Floating HUDs & hero decks', class: 'rounded-3xl' },
                                        { name: 'rounded-full', value: '9999px', usage: 'Status badges & toggle pills', class: 'rounded-full' },
                                    ].map((rad, idx) => (
                                        <div
                                            key={idx}
                                            className="p-4 bg-[var(--bg-primary)] border border-[var(--border-color)] flex flex-col justify-between space-y-3 group hover:border-[var(--accent-color)] transition-all"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono text-xs font-bold text-[var(--text-primary)]">{rad.name}</span>
                                                <span className="font-mono text-[10px] text-[var(--accent-color)]">{rad.value}</span>
                                            </div>

                                            <div className="h-14 bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center overflow-hidden">
                                                <div className={`w-10 h-10 bg-[var(--accent-color)]/20 border-2 border-[var(--accent-color)] ${rad.class}`} />
                                            </div>

                                            <p className="text-[10px] text-[var(--text-muted)] leading-tight">{rad.usage}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 0C. COLORS & SURFACES */}
                    {selectedId === 'colors' && (
                        <div className="space-y-8">
                            {/* Surface Depth Layers */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                    Three-Layer Background Surface Depth
                                </h3>
                                <p className="text-xs text-[var(--text-muted)]">
                                    Our layout enforces strict depth separation between viewport canvas, containers, and elevated floating cards.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                    {[
                                        { token: '--bg-primary', label: 'Layer 1: Canvas Base', desc: 'Main window backdrop behind all panes', bg: 'var(--bg-primary)' },
                                        { token: '--bg-secondary', label: 'Layer 2: Surface Panes', desc: 'Sidebars, content cards, and chat deck', bg: 'var(--bg-secondary)' },
                                        { token: '--bg-tertiary', label: 'Layer 3: Elevated Items', desc: 'Hovered rows, toolbars, and active chips', bg: 'var(--bg-tertiary, rgba(255,255,255,0.06))' },
                                    ].map((layer, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => copyToClipboard(`var(${layer.token})`)}
                                            className="p-5 rounded-2xl border border-[var(--border-color)] text-left space-y-3 hover:border-[var(--accent-color)] transition-all group"
                                            style={{ backgroundColor: layer.bg }}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono text-xs font-bold text-[var(--text-primary)]">{layer.token}</span>
                                                <Copy className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent-color)]" />
                                            </div>
                                            <p className="text-xs font-bold text-[var(--text-primary)]">{layer.label}</p>
                                            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{layer.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Text Contrast Tokens */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                    Text Contrast & Hierarchy Tokens
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] space-y-1">
                                        <span className="font-mono text-[10px] text-[var(--accent-color)] font-bold">--text-primary</span>
                                        <p className="text-sm font-bold text-[var(--text-primary)]">Primary Headings & Active Values</p>
                                        <p className="text-[10px] text-[var(--text-muted)]">100% full optical contrast</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] space-y-1">
                                        <span className="font-mono text-[10px] text-[var(--accent-color)] font-bold">--text-secondary</span>
                                        <p className="text-sm font-medium text-[var(--text-secondary)]">Secondary Labels & Body Paragraphs</p>
                                        <p className="text-[10px] text-[var(--text-muted)]">75% balanced readable contrast</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] space-y-1">
                                        <span className="font-mono text-[10px] text-[var(--accent-color)] font-bold">--text-muted</span>
                                        <p className="text-sm font-medium text-[var(--text-muted)]">Muted Timestamps & Micro Hints</p>
                                        <p className="text-[10px] text-[var(--text-muted)]">45% de-emphasized metadata</p>
                                    </div>
                                </div>
                            </div>

                            {/* Semantic Status Colors */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                    Semantic Status Signals
                                </h3>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {[
                                        { name: 'Success Signal', hex: '#10b981', desc: 'Hardware ready & compile OK', class: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' },
                                        { name: 'Warning Alert', hex: '#f59e0b', desc: 'VRAM pressure & fallback mode', class: 'bg-amber-500/15 border-amber-500/30 text-amber-400' },
                                        { name: 'Destructive Error', hex: '#f43f5e', desc: 'Memory OOM & socket failure', class: 'bg-rose-500/15 border-rose-500/30 text-rose-400' },
                                        { name: 'Info Notice', hex: '#0284c7', desc: 'Daemon connecting on port', class: 'bg-sky-500/15 border-sky-500/30 text-sky-400' },
                                    ].map((stat, idx) => (
                                        <div key={idx} className={`p-4 rounded-xl border ${stat.class} space-y-2`}>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold">{stat.name}</span>
                                                <span className="font-mono text-[10px] opacity-75">{stat.hex}</span>
                                            </div>
                                            <p className="text-[11px] opacity-85 leading-tight">{stat.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 0D. THEME & MODES STUDIO */}
                    {selectedId === 'themestudio' && (
                        <div className="space-y-8">
                            {/* Live Theme Switcher */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-5">
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                        Live Theme Engine Switcher (4 Modes)
                                    </h3>
                                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                                        Click any theme card below to instantly shift the entire application runtime with zero reload.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {themeModes.map((m) => {
                                        const isCurrent = theme === m.id;
                                        return (
                                            <button
                                                key={m.id}
                                                onClick={() => {
                                                    setTheme(m.id);
                                                    toast.success(`Activated ${m.label} theme mode.`);
                                                }}
                                                className={`p-4 rounded-2xl border text-left transition-all space-y-2 group relative overflow-hidden ${isCurrent
                                                    ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)] shadow-md'
                                                    : 'bg-[var(--bg-primary)] border-[var(--border-color)] hover:border-[var(--accent-color)]/50'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        {m.icon}
                                                        <span className="text-xs font-bold text-[var(--text-primary)]">{m.label}</span>
                                                    </div>
                                                    {isCurrent && (
                                                        <CheckCircle2 className="w-4 h-4 text-[var(--accent-color)]" />
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{m.desc}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Accent Color Palette Customizer */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                    Dynamic Accent Token Customizer
                                </h3>
                                <p className="text-xs text-[var(--text-muted)]">
                                    Select an accent hue to recolor buttons, active badges, and neon glowing borders:
                                </p>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
                                    {accentOptions.map((acc, idx) => {
                                        const isSelected = darkAccent === acc.dark;
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    setDarkAccent(acc.dark);
                                                    setLightAccent(acc.light);
                                                    toast.info(`Accent updated: ${acc.label}`);
                                                }}
                                                className={`p-3 rounded-xl bg-[var(--bg-primary)] border text-left transition-all ${isSelected
                                                    ? 'border-[var(--accent-color)] shadow-sm'
                                                    : 'border-[var(--border-color)] hover:border-[var(--text-muted)]'
                                                    }`}
                                            >
                                                <div
                                                    className="w-full h-8 rounded-lg mb-2 shadow-inner"
                                                    style={{ backgroundColor: acc.dark }}
                                                />
                                                <p className="text-xs font-bold text-[var(--text-primary)] truncate">{acc.label}</p>
                                                <span className="font-mono text-[9px] text-[var(--text-muted)]">{acc.dark}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 1. BUTTON PREVIEW */}
                    {selectedId === 'button' && (
                        <div className="space-y-6">
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-6">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                    Visual Variants
                                </h3>
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button variant="default">Default Accent</Button>
                                    <Button variant="secondary">Secondary</Button>
                                    <Button variant="outline">Outline</Button>
                                    <Button variant="ghost">Ghost</Button>
                                    <Button variant="destructive">Destructive</Button>
                                    <Button variant="cyber">Cyberpunk Neon</Button>
                                    <Button variant="pixel">Pixel 8-Bit</Button>
                                    <Button variant="link">Inline Link</Button>
                                </div>

                                <div className="border-t border-[var(--border-color)] pt-5">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                                        Sizing Scale & Icon Slot
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Button size="sm" variant="outline">Small (sm)</Button>
                                        <Button size="default" variant="outline">Default</Button>
                                        <Button size="lg" variant="outline">Large (lg)</Button>
                                        <Button size="icon" variant="outline">
                                            <Sparkles className="w-4 h-4 text-[var(--accent-color)]" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. INPUT PREVIEW */}
                    {selectedId === 'input' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-5 max-w-xl">
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Standard Editable Input</label>
                                <Input
                                    value={inputVal}
                                    onChange={(e) => setInputVal(e.target.value)}
                                    placeholder="Type something here..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Validation Error State</label>
                                <Input
                                    value={inputError}
                                    onChange={(e) => setInputError(e.target.value)}
                                    placeholder="Enter port number..."
                                    error="Port must be an integer between 1024 and 65535"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Disabled Input</label>
                                <Input disabled value="Protected Silicon Registry Port" />
                            </div>
                        </div>
                    )}

                    {/* 3. TOGGLESWITCH PREVIEW */}
                    {selectedId === 'toggleswitch' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-xl">
                            <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-[var(--text-primary)]">Hardware Acceleration</p>
                                    <p className="text-[11px] text-[var(--text-muted)]">Direct NVMM/Vulkan tensor compute pass</p>
                                </div>
                                <ToggleSwitch active={toggle1} onToggle={() => setToggle1(!toggle1)} />
                            </div>
                            <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-[var(--text-primary)]">Low Latency Zero-Copy Buffer</p>
                                    <p className="text-[11px] text-[var(--text-muted)]">Bypass IPC buffer serialization</p>
                                </div>
                                <ToggleSwitch active={toggle2} onToggle={() => setToggle2(!toggle2)} />
                            </div>
                        </div>
                    )}

                    {/* 4. ELASTICSLIDER PREVIEW */}
                    {selectedId === 'elasticslider' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-2xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-bold text-[var(--text-primary)]">Inference Temperature / Penalty</h4>
                                    <p className="text-[11px] text-[var(--text-muted)]">Drag the slider or stretch past bounds to feel elastic sigmoid recoil.</p>
                                </div>
                                <span className="font-mono text-xs font-bold px-3 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--accent-color)]">
                                    Value: {sliderVal}%
                                </span>
                            </div>

                            <div className="py-6">
                                <ElasticSlider
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={sliderVal}
                                    onChange={setSliderVal}
                                />
                            </div>
                        </div>
                    )}

                    {/* 5. BADGE PREVIEW */}
                    {selectedId === 'badge' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">All Badge Variants</h3>
                            <div className="flex flex-wrap items-center gap-3">
                                <Badge variant="default">Default Accent</Badge>
                                <Badge variant="secondary">Secondary</Badge>
                                <Badge variant="outline">Outline</Badge>
                                <Badge variant="destructive">Destructive Error</Badge>
                                <Badge variant="cyber">Neon Sync</Badge>
                                <Badge variant="pixel">8-BIT CHIP</Badge>
                            </div>
                        </div>
                    )}

                    {/* 6. TAG PREVIEW */}
                    {selectedId === 'tag' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Interactive Filter Tags</h3>
                            <div className="flex flex-wrap items-center gap-3">
                                <Tag>Research</Tag>
                                <Tag active>Active Tag</Tag>
                                <Tag className="inline-flex items-center gap-1">
                                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Trending</span>
                                </Tag>
                                <Tag className="inline-flex items-center gap-1">
                                    <Code className="w-3.5 h-3.5 text-blue-500" />
                                    <span>Rust Native</span>
                                </Tag>
                            </div>
                        </div>
                    )}

                    {/* 7. CONTEXTCHIP PREVIEW */}
                    {selectedId === 'contextchip' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Draggable Context Chips</h3>
                            <div className="flex flex-wrap items-center gap-3">
                                <ContextChip
                                    id="src/engine/cuda.rs"
                                    rawPath="src/engine/cuda.rs"
                                    type="file"
                                    lineRange="L1-L45"
                                    onRemove={() => toast.info('Removed file chip')}
                                />
                                <ContextChip
                                    id="cluaiz-core"
                                    name="cluaiz-core"
                                    type="folder"
                                    onRemove={() => toast.info('Removed folder chip')}
                                />
                                <ContextChip
                                    id="rust-analyzer"
                                    name="Rust Expert Skill"
                                    type="skill"
                                    icon={<Zap className="w-3.5 h-3.5 text-amber-400" />}
                                    onRemove={() => toast.info('Removed skill chip')}
                                />
                            </div>
                        </div>
                    )}

                    {/* 8. DATEDIVIDER PREVIEW */}
                    {selectedId === 'datedivider' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Timeline Date Divider</h3>
                            <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
                                <DateDivider date={new Date()} />
                            </div>
                        </div>
                    )}

                    {/* 9. CUSTOMDROPDOWN PREVIEW */}
                    {selectedId === 'customdropdown' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-md">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">CustomDropdown (Searchable Floating Portal)</h4>
                                <p className="text-[11px] text-[var(--text-muted)] mt-1">Searchable options list with custom input support.</p>
                            </div>
                            <CustomDropdown
                                options={[
                                    { value: 'Rust Native', label: 'Rust Native Engine' },
                                    { value: 'CUDA Acceleration', label: 'NVIDIA CUDA Kernel' },
                                    { value: 'Metal Shaders', label: 'Apple Metal Shaders' },
                                    { value: 'Vulkan Compute', label: 'Cross-Vendor Vulkan' },
                                ]}
                                value={customDropdownVal}
                                onChange={setCustomDropdownVal}
                                placeholder="Select Engine Profile..."
                                floating={true}
                            />
                            <p className="text-xs text-[var(--text-muted)] font-mono">Selected: <span className="text-[var(--accent-color)]">{customDropdownVal}</span></p>
                        </div>
                    )}

                    {/* 10. CALENDARDROPDOWN PREVIEW */}
                    {selectedId === 'calendardropdown' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-bold text-[var(--text-primary)]">CalendarDropdown</h4>
                                    <p className="text-[11px] text-[var(--text-muted)]">Interactive drag-to-select calendar range selector.</p>
                                </div>
                                <div className="relative">
                                    <Button
                                        ref={calendarDropdownRef}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsCalendarDropdownOpen(!isCalendarDropdownOpen)}
                                    >
                                        <Calendar className="w-3.5 h-3.5 mr-1.5" />
                                        <span>Pick Date Range</span>
                                    </Button>
                                    <CalendarDropdown
                                        isOpen={isCalendarDropdownOpen}
                                        onClose={() => setIsCalendarDropdownOpen(false)}
                                        dateRange={demoDateRange}
                                        onDateRangeChange={setDemoDateRange}
                                        bookedDates={[new Date()]}
                                        filteredChatsCount={12}
                                        triggerRef={calendarDropdownRef}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 11. FILTERDROPDOWN PREVIEW */}
                    {selectedId === 'filterdropdown' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-bold text-[var(--text-primary)]">FilterDropdown</h4>
                                    <p className="text-[11px] text-[var(--text-muted)]">Active Filter: <span className="text-[var(--accent-color)] capitalize">{selectedFilter}</span></p>
                                </div>
                                <div className="relative">
                                    <Button
                                        ref={filterDropdownRef}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                                    >
                                        <Filter className="w-3.5 h-3.5 mr-1.5" />
                                        <span>Filter Menu</span>
                                    </Button>
                                    <FilterDropdown
                                        isOpen={isFilterDropdownOpen}
                                        onClose={() => setIsFilterDropdownOpen(false)}
                                        activeFilter={selectedFilter}
                                        onFilterChange={(f) => {
                                            setSelectedFilter(f);
                                            setIsFilterDropdownOpen(false);
                                        }}
                                        triggerRef={filterDropdownRef}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 12. ACTIONDROPDOWN PREVIEW */}
                    {selectedId === 'actiondropdown' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-bold text-[var(--text-primary)]">ActionDropdown</h4>
                                    <p className="text-[11px] text-[var(--text-muted)]">Anchored floating actions portal.</p>
                                </div>
                                <div className="relative">
                                    <Button
                                        ref={actionDropdownRef}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsActionDropdownOpen(!isActionDropdownOpen)}
                                    >
                                        <Settings className="w-3.5 h-3.5 mr-1.5" />
                                        <span>Actions</span>
                                    </Button>
                                    <ActionDropdown
                                        isOpen={isActionDropdownOpen}
                                        onClose={() => setIsActionDropdownOpen(false)}
                                        triggerRef={actionDropdownRef}
                                    >
                                        <ActionDropdownItem
                                            icon={<Sparkles className="w-3.5 h-3.5 text-[var(--accent-color)]" />}
                                            onClick={() => toast.info('Memory Probed')}
                                        >
                                            Run Memory Prober
                                        </ActionDropdownItem>
                                        <ActionDropdownItem
                                            icon={<Copy className="w-3.5 h-3.5" />}
                                            onClick={() => toast.success('Config Copied')}
                                        >
                                            Copy Configuration
                                        </ActionDropdownItem>
                                        <ActionDropdownItem
                                            icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
                                            danger
                                            onClick={() => toast.warning('Cache Purged')}
                                        >
                                            Purge KV Cache
                                        </ActionDropdownItem>
                                    </ActionDropdown>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 13. EMOJIPICKER PREVIEW */}
                    {selectedId === 'emojipicker' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-bold text-[var(--text-primary)]">EmojiPicker</h4>
                                    <p className="text-[11px] text-[var(--text-muted)]">Selected: <span className="text-lg">{selectedEmoji}</span></p>
                                </div>
                                <div className="relative">
                                    <Button
                                        ref={emojiTriggerRef}
                                        variant="cyber"
                                        size="sm"
                                        onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                                    >
                                        <Smile className="w-3.5 h-3.5 mr-1.5" />
                                        Open Reaction Picker
                                    </Button>
                                    {isEmojiPickerOpen && (
                                        <div className="absolute bottom-full mb-2 right-0 z-50">
                                            <EmojiPicker
                                                onSelect={(e) => {
                                                    setSelectedEmoji(e);
                                                    setIsEmojiPickerOpen(false);
                                                }}
                                                onClose={() => setIsEmojiPickerOpen(false)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 14. CONFIRMATIONMODAL PREVIEW */}
                    {selectedId === 'confirmationmodal' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-md">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">ConfirmationModal (Destructive)</h4>
                                <p className="text-[11px] text-[var(--text-muted)]">Triggers a dialog with backdrop dimming and confirmation button.</p>
                            </div>
                            <Button variant="destructive" size="sm" onClick={() => setIsConfirmOpen(true)}>
                                Trigger Confirmation Dialog
                            </Button>
                            <ConfirmationModal
                                open={isConfirmOpen}
                                onCancel={() => setIsConfirmOpen(false)}
                                onConfirm={() => {
                                    setIsConfirmOpen(false);
                                    toast.success('Action successfully confirmed.');
                                }}
                                title="Purge Active Inference Context?"
                                message="This will reset the current KV cache in VRAM. All unsaved tokens will be discarded."
                                confirmText="Purge VRAM"
                                isDestructive={true}
                            />
                        </div>
                    )}

                    {/* 15. PORTMODAL PREVIEW */}
                    {selectedId === 'portmodal' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-md">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">PortConfirmModal</h4>
                                <p className="text-[11px] text-[var(--text-muted)]">Server daemon port reconfiguration restart warning.</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setIsPortModalOpen(true)}>
                                Open Port Modal
                            </Button>
                            <PortConfirmModal
                                open={isPortModalOpen}
                                pendingPort={8088}
                                currentPort="8080"
                                isUpdating={false}
                                onConfirm={() => setIsPortModalOpen(false)}
                                onCancel={() => setIsPortModalOpen(false)}
                            />
                        </div>
                    )}

                    {/* 16. LABELMODAL PREVIEW */}
                    {selectedId === 'labelmodal' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-md">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">LabelModal</h4>
                                <p className="text-[11px] text-[var(--text-muted)]">Interactive tag ribbons pool manager.</p>
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => setIsLabelModalOpen(true)}>
                                Open Ribbon Manager
                            </Button>
                            <LabelModal
                                isOpen={isLabelModalOpen}
                                onClose={() => setIsLabelModalOpen(false)}
                                onApply={(n) => {
                                    setIsLabelModalOpen(false);
                                    toast.success(`Applied tag: ${n}`);
                                }}
                                onCreate={(n) => {
                                    setIsLabelModalOpen(false);
                                    toast.success(`Created tag: ${n}`);
                                }}
                                existingTags={['urgent:urgent', 'core-engine:info', 'memory-leak:warning']}
                            />
                        </div>
                    )}

                    {/* 17. BORDERGLOW PREVIEW */}
                    {selectedId === 'borderglow' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-xl">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">BorderGlow Interactive Edge</h4>
                                <p className="text-[11px] text-[var(--text-muted)]">Hover your cursor along the perimeter to see specular dynamic glow.</p>
                            </div>
                            <BorderGlow
                                edgeSensitivity={30}
                                glowColor="var(--accent-color)"
                                backgroundColor="var(--bg-secondary)"
                                borderRadius={16}
                                glowRadius={35}
                                glowIntensity={1.2}
                                animated={true}
                            >
                                <div className="p-8 text-center select-none">
                                    <Zap className="w-6 h-6 text-[var(--accent-color)] mx-auto mb-2" />
                                    <h4 className="text-sm font-bold text-[var(--text-primary)]">Specular Edge Tracker</h4>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">Conic gradient mask calculates live proximity angle.</p>
                                </div>
                            </BorderGlow>
                        </div>
                    )}

                    {/* 18. CLICKSPARK PREVIEW */}
                    {selectedId === 'clickspark' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-xl">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">ClickSpark Canvas Physics</h4>
                                <p className="text-[11px] text-[var(--text-muted)]">Click anywhere in the target below to spawn hardware accelerated particles.</p>
                            </div>
                            <ClickSpark sparkColor="var(--accent-color)" sparkCount={14} sparkRadius={25} duration={450}>
                                <div className="p-12 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] text-center cursor-pointer select-none">
                                    <Sparkles className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                                    <p className="text-sm font-bold text-[var(--text-primary)]">Click to ignite particle sparks</p>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">Canvas overlay emits multi-angle spark lines.</p>
                                </div>
                            </ClickSpark>
                        </div>
                    )}

                    {/* 19. RICHHOVERCARD PREVIEW */}
                    {selectedId === 'richhovercard' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-md">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">RichHoverCard Inspect Portal</h4>
                                <p className="text-[11px] text-[var(--text-muted)]">Hover over the token chip below to preview source code context.</p>
                            </div>
                            <div className="pt-2">
                                <RichHoverCard
                                    title="cuda_memory.rs"
                                    filePath="src/engine/cuda_memory.rs"
                                    lineRange="45-120"
                                    previewText="VMM allocation pool managing NVMM virtual addresses."
                                    userPrompt="Inspect zero-copy host pinned buffer"
                                    aiSnippet="Page locked host memory allocated via cudaHostAllocMapped."
                                >
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-xs font-mono text-[var(--accent-color)] cursor-help">
                                        <Code className="w-3.5 h-3.5" />
                                        <span>Hover over cuda_memory.rs</span>
                                    </span>
                                </RichHoverCard>
                            </div>
                        </div>
                    )}

                    {/* 20. BACKLIGHT PREVIEW */}
                    {selectedId === 'backlight' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-md">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">Backlight Ambient Blur</h4>
                                <p className="text-[11px] text-[var(--text-muted)]">SVG Gaussian blur creating ambient diffused halo.</p>
                            </div>
                            <div className="relative p-8 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] overflow-hidden text-center">
                                <Backlight blur={28} className="absolute inset-0 opacity-40">
                                    <div className="w-24 h-24 rounded-full bg-[var(--accent-color)] mx-auto" />
                                </Backlight>
                                <div className="relative z-10">
                                    <p className="text-xs font-bold text-[var(--text-primary)]">Ambient Glow Surface</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 21. TOOLTIP PREVIEW */}
                    {selectedId === 'tooltip' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-md">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">Floating Hint Tooltip</h4>
                                <p className="text-[11px] text-[var(--text-muted)]">Hover over the button below to see auto-repositioning tooltip.</p>
                            </div>
                            <div className="pt-2">
                                <Tooltip title="Direct CUDA Memory Bridge" subtitle="Bypasses CPU bus transfers">
                                    <Button variant="outline" size="sm">
                                        Hover For Tooltip
                                    </Button>
                                </Tooltip>
                            </div>
                        </div>
                    )}

                    {/* 22. TOAST PREVIEW */}
                    {selectedId === 'toast' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">Live Toast Notification Stack</h4>
                                <p className="text-[11px] text-[var(--text-muted)]">Click any button below to dispatch live floating notifications:</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toast.success('Compilation finished with 0 errors.', { title: 'Cargo Build' })}
                                    className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                    Success Toast
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toast.error('Out of VRAM: Falling back to System RAM.', { title: 'CUDA Allocation' })}
                                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                >
                                    <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                                    Error Toast
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toast.warning('High memory pressure detected (>85%).', { title: 'Memory Guard' })}
                                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                >
                                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                                    Warning Toast
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toast.info('Connected to Cluaiz Gateway daemon on port 8080.', { title: 'Engine Daemon' })}
                                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                >
                                    <Info className="w-3.5 h-3.5 mr-1.5" />
                                    Info Toast
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* 23. ALERTBANNER PREVIEW */}
                    {selectedId === 'alertbanner' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">All AlertBanner Variants</h3>
                            <div className="space-y-3">
                                <AlertBanner variant="info" title="Engine Update" message="Cluaiz Inference Daemon v1.2 is ready to run." />
                                <AlertBanner variant="success" title="Kernel Compiled" message="All 14 CUDA PTX shaders loaded into VRAM." />
                                <AlertBanner variant="warning" title="Memory Warning" message="Shared host RAM usage has exceeded 80%." />
                                <AlertBanner variant="error" title="Inference Failure" message="OOM triggered during long context decoding." />
                            </div>
                        </div>
                    )}

                    {/* 24. ANIMATED ICONS PREVIEW */}
                    {selectedId === 'animatedicons' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                10 Physics-Driven Micro-Interaction Icons (Hover to Animate)
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                {[
                                    { label: 'Bot', icon: <AnimatedBot size={24} /> },
                                    { label: 'Calendar', icon: <AnimatedCalendar size={24} /> },
                                    { label: 'Clipboard', icon: <AnimatedClipboard size={24} /> },
                                    { label: 'Sliders', icon: <AnimatedSliders size={24} /> },
                                    { label: 'RotateCw', icon: <AnimatedRotateCw size={24} /> },
                                    { label: 'Search', icon: <AnimatedSearch size={24} /> },
                                    { label: 'Phone', icon: <AnimatedPhoneCall size={24} /> },
                                    { label: 'Play', icon: <AnimatedPlay size={24} /> },
                                    { label: 'Pause', icon: <AnimatedPause size={24} /> },
                                    { label: 'Close', icon: <AnimatedX size={24} /> },
                                ].map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] flex flex-col items-center justify-center gap-2 hover:border-[var(--accent-color)] transition-colors cursor-pointer group"
                                    >
                                        <div className="text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors">
                                            {item.icon}
                                        </div>
                                        <span className="text-[10px] font-mono text-[var(--text-muted)]">{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 25. BINARYFILECARD PREVIEW */}
                    {selectedId === 'binarypreview' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Binary File Fallback Previews</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="border border-[var(--border-color)] rounded-xl overflow-hidden bg-[var(--bg-primary)]">
                                    <BinaryFileCard fileName="cluaiz_engine_v1.tar.gz" filePath="/downloads/cluaiz_engine_v1.tar.gz" />
                                </div>
                                <div className="border border-[var(--border-color)] rounded-xl overflow-hidden bg-[var(--bg-primary)]">
                                    <BinaryFileCard fileName="ptx_compiler_daemon.exe" filePath="/bin/ptx_compiler_daemon.exe" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 26. CARD PREVIEW */}
                    {selectedId === 'card' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-6">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Card Surface Types</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Standard Card</CardTitle>
                                        <CardDescription>Default surface token</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-xs text-[var(--text-muted)]">Informational grids and structured items.</p>
                                    </CardContent>
                                </Card>

                                <Card className="bg-[var(--bg-primary)]/40 backdrop-blur-md border-[var(--border-color)]">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-[var(--accent-color)]" />
                                            <span>Glassmorphic</span>
                                        </CardTitle>
                                        <CardDescription>Frosted glass blur</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-xs text-[var(--text-muted)]">Floating HUD overlays.</p>
                                    </CardContent>
                                </Card>

                                <Card className="hover:border-[var(--accent-color)]/50 transition-all cursor-pointer">
                                    <CardHeader>
                                        <CardTitle>Interactive Card</CardTitle>
                                        <CardDescription>Hover border reactive</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-xs text-[var(--text-muted)]">Click targets and library rows.</p>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

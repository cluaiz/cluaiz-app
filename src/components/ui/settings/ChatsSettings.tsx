import { useThemeStore } from '../../../store/ui/useThemeStore';
import { Palette, Bot, Type, X, MousePointer } from 'lucide-react';
import { SettingSection, SettingItem, ThemeCard } from './SharedComponents';
import { ElasticSlider } from '../cursor/ElasticSlider';

function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

export function ChatsSettings() {
    // Theme store mapping
    const {
        theme,
        setTheme,
        textScale,
        setTextScale,
        fontFamily,
        setFontFamily,
        darkAccent,
        setDarkAccent,
        lightAccent,
        setLightAccent,
        cursorType,
        setCursorType,
        myBubbleColor,
        setMyBubbleColor,
        aiBubbleColor,
        setAiBubbleColor,
        localFontSize,
        setLocalFontSize,
        compactMode,
        setCompactMode,
        modernBubbles,
        setModernBubbles,
        bgGlowOpacity,
        setBgGlowOpacity,
        chatBackground,
        setChatBackground
    } = useThemeStore();

    const activeAccent = theme !== 'light' ? darkAccent : lightAccent;

    return (
        <div className="space-y-8 select-none">
            <SettingSection title="Appearance Theme">
                <div className="p-4 space-y-6">
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <ThemeCard
                            label="Dark Mode"
                            emoji="🌑"
                            active={theme !== 'light'}
                            onClick={() => setTheme('dark')}
                        />
                        <ThemeCard
                            label="Light Mode"
                            emoji="☀️"
                            active={theme === 'light'}
                            onClick={() => setTheme('light')}
                        />
                    </div>

                    <div className="h-[1px] bg-white/5 my-2" />

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Accent Color</span>
                                <p className="text-[10px] text-zinc-500">Choose custom highlight color for {theme !== 'light' ? 'Dark' : 'Light'} Mode.</p>
                            </div>
                            <div className="w-4 h-4 rounded-full border border-white/20 shadow-md animate-pulse" style={{ backgroundColor: activeAccent, boxShadow: `0 0 8px ${activeAccent}` }} />
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {theme !== 'light' ? (
                                [
                                    { name: 'Cyber Neon', color: '#00f0ff' },
                                    { name: 'Emerald', color: '#10b981' },
                                    { name: 'Laser Red', color: '#ef4444' },
                                    { name: 'Neon Violet', color: '#8b5cf6' },
                                    { name: 'Hot Pink', color: '#ff007f' },
                                    { name: 'Sun Gold', color: '#f59e0b' },
                                    { name: 'Bright Orange', color: '#f97316' },
                                    { name: 'Teal Bright', color: '#06b6d4' },
                                    { name: 'Pure White', color: '#ffffff' }
                                ].map((item) => (
                                    <button
                                        key={item.color}
                                        onClick={() => setDarkAccent(item.color)}
                                        title={item.name}
                                        className={cn(
                                            "w-8 h-8 rounded-full transition-all hover:scale-110 relative border border-white/10 shadow-lg cursor-pointer",
                                            darkAccent.toLowerCase() === item.color.toLowerCase() ? "scale-105" : "opacity-60 hover:opacity-100"
                                        )}
                                        style={{
                                            backgroundColor: item.color,
                                            boxShadow: darkAccent.toLowerCase() === item.color.toLowerCase()
                                                ? `0 0 0 2px var(--bg-primary, #09090b), 0 0 0 4px ${item.color}`
                                                : undefined
                                        }}
                                    />
                                ))
                            ) : (
                                [
                                    { name: 'Ocean Blue', color: '#1d4ed8' },
                                    { name: 'Deep Forest', color: '#065f46' },
                                    { name: 'Crimson Red', color: '#991b1b' },
                                    { name: 'Royal Purple', color: '#6d28d9' },
                                    { name: 'Midnight Slate', color: '#1e293b' },
                                    { name: 'Burnt Amber', color: '#b45309' },
                                    { name: 'Deep Rose', color: '#be185d' },
                                    { name: 'Dark Teal', color: '#0f766e' },
                                    { name: 'Pure Black', color: '#000000' }
                                ].map((item) => (
                                    <button
                                        key={item.color}
                                        onClick={() => setLightAccent(item.color)}
                                        title={item.name}
                                        className={cn(
                                            "w-8 h-8 rounded-full transition-all hover:scale-110 relative border border-white/10 shadow-lg cursor-pointer",
                                            lightAccent.toLowerCase() === item.color.toLowerCase() ? "scale-105" : "opacity-60 hover:opacity-100"
                                        )}
                                        style={{
                                            backgroundColor: item.color,
                                            boxShadow: lightAccent.toLowerCase() === item.color.toLowerCase()
                                                ? `0 0 0 2px var(--bg-primary, #ffffff), 0 0 0 4px ${item.color}`
                                                : undefined
                                        }}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    <div className="h-[1px] bg-white/5 my-2" />

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Dashboard Glow Tint</span>
                                <p className="text-[10px] text-zinc-500 font-medium">Adjust the intensity of the dynamic ambient background glow.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setBgGlowOpacity(0)}
                                    className={cn(
                                        "px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded border transition-colors cursor-pointer",
                                        bgGlowOpacity === 0
                                            ? "bg-[var(--accent-color)]/10 border-[var(--accent-color)] text-[var(--accent-color)]"
                                            : "border-white/5 text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    None
                                </button>
                                <span className="text-xs font-mono text-[var(--accent-color)]">{bgGlowOpacity}%</span>
                            </div>
                        </div>
                        <ElasticSlider
                            min={0}
                            max={100}
                            step={1}
                            value={bgGlowOpacity}
                            onChange={setBgGlowOpacity}
                        />
                    </div>
                </div>
            </SettingSection>

            <SettingSection title="Interface Scaling">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white">Scaling Value</span>
                        <span className="text-xs font-mono text-[var(--accent-color)]">{(textScale * 100).toFixed(0)}%</span>
                    </div>
                    <ElasticSlider
                        min={0.8}
                        max={1.2}
                        step={0.05}
                        value={textScale}
                        onChange={setTextScale}
                    />
                </div>
            </SettingSection>

            <SettingSection title="Chat Density">
                <SettingItem
                    label="Compact Mode"
                    description="Show more messages on screen."
                    toggle
                    active={compactMode}
                    onToggle={() => setCompactMode(!compactMode)}
                />
                <SettingItem
                    label="Modern Bubbles"
                    description="Use the new rounded bubble design."
                    toggle
                    active={modernBubbles}
                    onToggle={() => setModernBubbles(!modernBubbles)}
                />
            </SettingSection>

            <SettingSection title="Chat Background">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
                    {[
                        { id: 'none', label: 'None (Solid Color)' },
                        { id: 'https://www.transparenttextures.com/patterns/cubes.png', label: 'Cubes' },
                        { id: 'https://www.transparenttextures.com/patterns/carbon-fibre.png', label: 'Carbon Fibre' },
                        { id: 'https://www.transparenttextures.com/patterns/black-scales.png', label: 'Scales' },
                        { id: 'https://www.transparenttextures.com/patterns/stardust.png', label: 'Stardust' },
                        { id: 'https://www.transparenttextures.com/patterns/maze-black.png', label: 'Maze' }
                    ].map((item) => (
                        <div
                            key={item.id}
                            onClick={() => setChatBackground(item.id)}
                            className={cn(
                                "p-3 bg-zinc-800/50 border rounded-2xl cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group text-center select-none min-h-[80px] relative overflow-hidden",
                                chatBackground === item.id ? "border-[var(--accent-color)]/50 bg-[var(--accent-color)]/5" : "border-white/5 hover:border-zinc-700"
                            )}
                        >
                            {item.id !== 'none' && (
                                <div
                                    className="absolute inset-0 opacity-30 pointer-events-none"
                                    style={{ backgroundImage: `url("${item.id}")`, backgroundSize: '120px' }}
                                />
                            )}
                            <span className={cn(
                                "text-[10px] font-black uppercase tracking-widest leading-none z-10",
                                chatBackground === item.id ? "text-[var(--accent-color)]" : "text-zinc-500 group-hover:text-zinc-300"
                            )}>
                                {item.label}
                            </span>
                        </div>
                    ))}
                </div>
            </SettingSection>

            <SettingSection title="Cursor Effects">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
                    {[
                        { id: 'none', label: 'none' },
                        { id: 'splash', label: 'spark click' },
                        { id: 'smooth', label: 'smooth follow' },
                        { id: 'neon', label: 'neon pulse' },
                        { id: 'canvas', label: 'canvas trail' },
                        { id: 'aura', label: 'glow aura' }
                    ].map((item) => (
                        <div
                            key={item.id}
                            onClick={() => setCursorType(item.id)}
                            className={cn(
                                "p-3 bg-zinc-800/50 border rounded-2xl cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group text-center select-none",
                                cursorType === item.id ? "border-[var(--accent-color)]/50 bg-[var(--accent-color)]/5" : "border-white/5 hover:border-zinc-700"
                            )}
                        >
                            <MousePointer size={18} className={cursorType === item.id ? "text-[var(--accent-color)]" : "text-zinc-500 group-hover:text-zinc-400"} />
                            <span className={cn(
                                "text-[9px] font-black uppercase tracking-widest leading-none whitespace-nowrap",
                                cursorType === item.id ? "text-[var(--accent-color)]" : "text-zinc-600 group-hover:text-zinc-400"
                            )}>
                                {item.label}
                            </span>
                        </div>
                    ))}
                </div>
            </SettingSection>

            <SettingSection title="Chat Bubble Styling">
                <div className="p-4 space-y-6">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Palette size={14} className="text-zinc-500" />
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">My Messages</span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => setMyBubbleColor('none')}
                                className={cn(
                                    "w-8 h-8 rounded-full transition-all hover:scale-110 relative border border-dashed border-white/20 flex items-center justify-center bg-black/40 shadow-lg cursor-pointer",
                                    myBubbleColor === 'none' ? "scale-105" : "opacity-60 hover:opacity-100"
                                )}
                                style={{
                                    boxShadow: myBubbleColor === 'none'
                                        ? `0 0 0 2px var(--bg-primary, #09090b), 0 0 0 4px var(--accent-color)`
                                        : undefined
                                }}
                                title="No custom color (Default)"
                            >
                                <X size={14} className="text-zinc-500" />
                            </button>
                            {[
                                '#09090b', '#022c22', '#064e3b', '#14532d',
                                '#0f172a', '#172554', '#312e81', '#4c0519',
                                '#451a03', '#1c1917', '#27272a', '#000000'
                            ].map((color) => (
                                <button
                                    key={color}
                                    onClick={() => setMyBubbleColor(color)}
                                    className={cn(
                                        "w-8 h-8 rounded-full transition-all hover:scale-110 relative border border-white/10 shadow-lg cursor-pointer",
                                        myBubbleColor === color ? "scale-105" : "opacity-60 hover:opacity-100"
                                    )}
                                    style={{
                                        backgroundColor: color,
                                        boxShadow: myBubbleColor === color
                                            ? `0 0 0 2px var(--bg-primary, #09090b), 0 0 0 4px var(--accent-color)`
                                            : undefined
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="h-[1px] bg-white/5" />

                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Bot size={14} className="text-zinc-500" />
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">AI Messages</span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => setAiBubbleColor('none')}
                                className={cn(
                                    "w-8 h-8 rounded-full transition-all hover:scale-110 relative border border-dashed border-white/20 flex items-center justify-center bg-black/40 shadow-lg cursor-pointer",
                                    aiBubbleColor === 'none' ? "scale-105" : "opacity-60 hover:opacity-100"
                                )}
                                style={{
                                    boxShadow: aiBubbleColor === 'none'
                                        ? `0 0 0 2px var(--bg-primary, #09090b), 0 0 0 4px var(--accent-color)`
                                        : undefined
                                }}
                                title="No custom color (Default)"
                            >
                                <X size={14} className="text-zinc-500" />
                            </button>
                            {[
                                '#09090b', '#022c22', '#064e3b', '#14532d',
                                '#0f172a', '#172554', '#312e81', '#4c0519',
                                '#451a03', '#1c1917', '#27272a', '#000000'
                            ].map((color) => (
                                <button
                                    key={color}
                                    onClick={() => setAiBubbleColor(color)}
                                    className={cn(
                                        "w-8 h-8 rounded-full transition-all hover:scale-110 relative border border-white/10 shadow-lg cursor-pointer",
                                        aiBubbleColor === color ? "scale-105" : "opacity-60 hover:opacity-100"
                                    )}
                                    style={{
                                        backgroundColor: color,
                                        boxShadow: aiBubbleColor === color
                                            ? `0 0 0 2px var(--bg-primary, #09090b), 0 0 0 4px var(--accent-color)`
                                            : undefined
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </SettingSection>

            <SettingSection title="Typography & Font Size">
                <div className="p-4 space-y-6">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Type size={14} className="text-zinc-500" />
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Local Font Size</span>
                            </div>
                            <span className="text-xs font-mono text-[var(--accent-color)]">{localFontSize}px</span>
                        </div>
                        <ElasticSlider
                            min={13}
                            max={18}
                            step={0.5}
                            value={localFontSize}
                            onChange={setLocalFontSize}
                        />
                    </div>

                    <div className="h-[1px] bg-white/5" />

                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Type size={14} className="text-zinc-500" />
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Typography</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                'Inter', 'Roboto', 'Lato', 'Montserrat',
                                'Oswald', 'Playfair Display', 'Merriweather',
                                'Nunito', 'Raleway', 'Poppins', 'Open Sans', 'Inconsolata',
                                'Press Start 2P', 'VT323', 'Silkscreen'
                            ].map((font) => (
                                <button
                                    key={font}
                                    onClick={() => setFontFamily(font)}
                                    className={cn(
                                        "px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border text-left truncate cursor-pointer",
                                        fontFamily === font
                                            ? "bg-[var(--accent-color)]/10 border-[var(--accent-color)]/50 text-[var(--accent-color)] font-extrabold"
                                            : "bg-black/20 border-white/5 text-zinc-400 hover:bg-white/5 hover:text-white"
                                    )}
                                    style={{ fontFamily: font }}
                                >
                                    {font === 'Press Start 2P' ? 'Minecraft (2P)' : font}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </SettingSection>
        </div>
    );
}

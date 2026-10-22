import { useThemeStore, isThemeDark } from '../../store/ui/useThemeStore';
import { Type, Moon, Contrast, Sun, Sparkles, MousePointer, Check } from 'lucide-react';
import { SettingSection, SettingItem, ThemeCard } from './SharedComponents';
import { ElasticSlider } from '../../components/ui/cursor/ElasticSlider';

function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

export function ChatsSettings() {
    // Theme store mapping
    const {
        theme,
        setTheme,
        fontFamily,
        setFontFamily,
        darkAccent,
        setDarkAccent,
        lightAccent,
        setLightAccent,
        cursorType,
        setCursorType,
        bgGlowOpacity,
        setBgGlowOpacity,
        chatBackground,
        setChatBackground
    } = useThemeStore();

    const isDark = isThemeDark(theme);
    const activeAccent = isDark ? darkAccent : lightAccent;

    return (
        <div className="space-y-8 select-none">
            <SettingSection title="Typography">
                <SettingItem
                    label="Font Family"
                    description="Select the primary typography typeface for the interface."
                    icon={Type}
                    previewFont={true}
                    select={[
                        { value: 'Inter', label: 'Inter (Clean Sans)', fontFamily: 'Inter, sans-serif' },
                        { value: 'Roboto', label: 'Roboto', fontFamily: 'Roboto, sans-serif' },
                        { value: 'Montserrat', label: 'Montserrat', fontFamily: 'Montserrat, sans-serif' },
                        { value: 'Poppins', label: 'Poppins', fontFamily: 'Poppins, sans-serif' },
                        { value: 'Open Sans', label: 'Open Sans', fontFamily: '"Open Sans", sans-serif' },
                        { value: 'Nunito', label: 'Nunito', fontFamily: 'Nunito, sans-serif' },
                        { value: 'Lato', label: 'Lato', fontFamily: 'Lato, sans-serif' },
                        { value: 'Raleway', label: 'Raleway', fontFamily: 'Raleway, sans-serif' },
                        { value: 'JetBrains Mono', label: 'JetBrains Mono (Code)', fontFamily: '"JetBrains Mono", monospace' },
                        { value: 'Fira Code', label: 'Fira Code (Code)', fontFamily: '"Fira Code", monospace' },
                        { value: 'Inconsolata', label: 'Inconsolata (Code)', fontFamily: 'Inconsolata, monospace' },
                        { value: 'Playfair Display', label: 'Playfair Display (Serif)', fontFamily: '"Playfair Display", serif' },
                        { value: 'Merriweather', label: 'Merriweather (Serif)', fontFamily: 'Merriweather, serif' },
                        { value: 'Oswald', label: 'Oswald (Display)', fontFamily: 'Oswald, sans-serif' },
                        { value: 'Silkscreen', label: 'Silkscreen (Pixel)', fontFamily: 'Silkscreen, monospace' }
                    ]}
                    value={fontFamily}
                    onChange={(val) => setFontFamily(val)}
                />
            </SettingSection>

            <SettingSection title="Appearance Theme">
                <div className="p-4 space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                        <ThemeCard
                            label="Dark Modern"
                            icon={<Moon size={20} className="text-[var(--accent-color)]" />}
                            active={theme === 'dark'}
                            onClick={() => setTheme('dark')}
                        />
                        <ThemeCard
                            label="OLED Black"
                            icon={<Contrast size={20} className="text-[var(--accent-color)]" />}
                            active={theme === 'oled'}
                            onClick={() => setTheme('oled')}
                        />
                        <ThemeCard
                            label="Light Modern"
                            icon={<Sun size={20} className="text-[var(--accent-color)]" />}
                            active={theme === 'light'}
                            onClick={() => setTheme('light')}
                        />
                        <ThemeCard
                            label="Light Classic"
                            icon={<Sparkles size={20} className="text-[var(--accent-color)]" />}
                            active={theme === 'classic'}
                            onClick={() => setTheme('classic')}
                        />
                    </div>

                    <div className="h-[1px] bg-[var(--border-color)]/60 my-2" />

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Accent Color</span>
                                <p className="text-[10px] text-[var(--text-muted)]">Choose custom highlight color for {isDark ? 'Dark' : 'Light'} Mode.</p>
                            </div>
                            <div className="w-4 h-4 rounded-full border border-[var(--border-color)] shadow-md animate-pulse" style={{ backgroundColor: activeAccent, boxShadow: `0 0 8px ${activeAccent}` }} />
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {isDark ? (
                                [
                                    { name: 'Royal Indigo', color: '#4f46e5' },
                                    { name: 'Deep Emerald', color: '#059669' },
                                    { name: 'Cobalt Blue', color: '#2563eb' },
                                    { name: 'Crimson Slate', color: '#dc2626' },
                                    { name: 'Deep Violet', color: '#7c3aed' },
                                    { name: 'Warm Amber', color: '#d97706' },
                                    { name: 'Deep Rose', color: '#db2777' },
                                    { name: 'Teal Ocean', color: '#0d9488' },
                                    { name: 'Steel Zinc', color: '#52525b' }
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

                    <div className="h-[1px] bg-[var(--border-color)]/60 my-2" />

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Dashboard Glow Tint</span>
                                <p className="text-[10px] text-[var(--text-muted)] font-medium">Adjust the intensity of the dynamic ambient background glow.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setBgGlowOpacity(0)}
                                    className={cn(
                                        "px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded border transition-colors cursor-pointer",
                                        bgGlowOpacity === 0
                                            ? "bg-[var(--accent-color)]/10 border-[var(--accent-color)] text-[var(--accent-color)]"
                                            : "border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
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

            <SettingSection title="Chat Background">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
                    {[
                        { id: 'none', label: 'None (Solid Color)' },
                        { id: 'https://www.transparenttextures.com/patterns/cubes.png', label: 'Cubes' },
                        { id: 'https://www.transparenttextures.com/patterns/carbon-fibre.png', label: 'Carbon Fibre' },
                        { id: 'https://www.transparenttextures.com/patterns/black-scales.png', label: 'Scales' },
                        { id: 'https://www.transparenttextures.com/patterns/stardust.png', label: 'Stardust' },
                        { id: 'https://www.transparenttextures.com/patterns/maze-black.png', label: 'Maze' }
                    ].map((item) => {
                        const isSelected = (chatBackground || 'none') === item.id;
                        return (
                            <div
                                key={item.id}
                                onClick={() => setChatBackground(item.id)}
                                className={cn(
                                    "p-3 rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group text-center select-none min-h-[85px] relative overflow-hidden",
                                    isSelected
                                        ? "border-2 border-[var(--accent-color)] bg-[var(--accent-color)]/15 shadow-sm"
                                        : "border border-[var(--border-color)] hover:border-[var(--accent-color)]/40 bg-[var(--bg-secondary)]/50 hover:bg-[var(--bg-secondary)]/80"
                                )}
                            >
                                {item.id !== 'none' && (
                                    <div
                                        className="absolute inset-0 pointer-events-none transition-opacity"
                                        style={{
                                            backgroundImage: `url("${item.id}")`,
                                            backgroundSize: '100px',
                                            filter: isDark ? 'invert(1) opacity(0.35)' : 'opacity(0.4)'
                                        }}
                                    />
                                )}
                                {isSelected && (
                                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[var(--accent-color)] text-white flex items-center justify-center shadow-md z-20">
                                        <Check size={10} strokeWidth={3} />
                                    </div>
                                )}
                                <span className={cn(
                                    "text-[10px] uppercase tracking-widest leading-none z-10 transition-colors",
                                    isSelected
                                        ? "font-black text-[var(--accent-color)]"
                                        : "font-bold text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
                                )}>
                                    {item.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </SettingSection>

            <SettingSection title="Cursor Effects">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
                    {[
                        { id: 'none', label: 'None' },
                        { id: 'splash', label: 'Spark Click' },
                        { id: 'neon', label: 'Neon Pulse' },
                        { id: 'canvas', label: 'Canvas Trail' }
                    ].map((item) => (
                        <div
                            key={item.id}
                            onClick={() => setCursorType(item.id)}
                            className={cn(
                                "p-3 bg-[var(--bg-secondary)]/50 border rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group text-center select-none",
                                cursorType === item.id 
                                    ? "border-[var(--accent-color)]/50 bg-[var(--accent-color)]/5 text-[var(--accent-color)]" 
                                    : "border-[var(--border-color)] hover:border-[var(--accent-color)]/40 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            )}
                        >
                            <MousePointer size={18} className={cursorType === item.id ? "text-[var(--accent-color)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"} />
                            <span className="text-[10px] font-black uppercase tracking-widest leading-none whitespace-nowrap">
                                {item.label}
                            </span>
                        </div>
                    ))}
                </div>
            </SettingSection>
        </div>
    );
}

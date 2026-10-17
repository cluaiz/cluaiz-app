import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Tag as TagIcon, Check, Sparkles, Plus } from 'lucide-react';

interface LabelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (tagName: string, color: string) => void;
    onCreate: (tagName: string, color: string) => void;
    onDelete?: (tag: string) => void;
    existingTags?: string[];
    activeTags?: string[];
}

const COLORS = [
    { name: 'urgent', label: 'Urgent', gradient: 'from-red-500 to-rose-600', shadow: 'shadow-red-500/40', text: 'text-red-400' },
    { name: 'warning', label: 'Warning', gradient: 'from-amber-400 to-orange-500', shadow: 'shadow-amber-500/40', text: 'text-amber-400' },
    { name: 'success', label: 'Success', gradient: 'from-emerald-400 to-teal-600', shadow: 'shadow-emerald-500/40', text: 'text-emerald-400' },
    { name: 'info', label: 'Info', gradient: 'from-blue-400 to-indigo-600', shadow: 'shadow-blue-500/40', text: 'text-blue-400' },
    { name: 'priority', label: 'Priority', gradient: 'from-purple-400 to-violet-600', shadow: 'shadow-purple-500/40', text: 'text-purple-400' },
    { name: 'pending', label: 'Pending', gradient: 'from-cyan-400 to-sky-500', shadow: 'shadow-cyan-500/40', text: 'text-cyan-400' },
    { name: 'hot', label: 'Hot', gradient: 'from-pink-400 to-rose-500', shadow: 'shadow-pink-500/40', text: 'text-pink-400' },
    { name: 'lead', label: 'Lead', gradient: 'from-indigo-400 to-purple-500', shadow: 'shadow-indigo-500/40', text: 'text-indigo-400' },
];

function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

export function LabelModal({
    isOpen,
    onClose,
    onApply,
    onCreate,
    onDelete,
    existingTags = [],
    activeTags = []
}: LabelModalProps) {
    const [view, setView] = useState<'LIST' | 'ADD'>('LIST');
    const [tagName, setTagName] = useState('');
    const [selectedColor, setSelectedColor] = useState(COLORS[2]); // Default Success
    const [searchTerm, setSearchTerm] = useState('');

    // Deduplicate tags by name
    const uniqueTags = existingTags.reduce((acc: string[], tag) => {
        const [name] = tag.includes(':') ? tag.split(':') : [tag, 'success'];
        const exists = acc.some(t => t.split(':')[0].toLowerCase() === name.toLowerCase());
        if (!exists) acc.push(tag);
        return acc;
    }, []);

    const filteredTags = uniqueTags.filter(tag =>
        tag.split(':')[0].toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSave = () => {
        if (!tagName.trim()) return;

        if (uniqueTags.length >= 30) {
            alert("Maximum 30 ribbons allowed in the pool.");
            return;
        }

        onCreate(tagName.trim(), selectedColor.name.toLowerCase());
        setTagName('');
        setView('LIST');
    };

    const handleApplyExisting = (tag: string) => {
        const [name, color] = tag.includes(':') ? tag.split(':') : [tag, 'success'];
        onApply(name, color);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Theme-Aligned Modal Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 8 }}
                        transition={{ duration: 0.15 }}
                        className="relative w-full max-w-[340px] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-2xl z-10 overflow-hidden"
                        style={{ borderStyle: 'var(--border-style)' }}
                    >
                        {/* Top Accent Line */}
                        <div className={cn("h-[2px] w-full bg-gradient-to-r transition-all duration-300", view === 'ADD' ? selectedColor.gradient : "from-[var(--accent-color)] to-[var(--accent-color)] opacity-70")} />

                        <div className="p-4 pb-5 space-y-4">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => view === 'ADD' && uniqueTags.length > 0 && setView('LIST')}
                                        className={cn("w-8 h-8 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-center transition-all",
                                            view === 'ADD' ? selectedColor.text : "text-[var(--text-secondary)] font-semibold"
                                        )}
                                    >
                                        {view === 'ADD' ? <Sparkles size={15} /> : <span className="text-xs font-bold">{uniqueTags.length}</span>}
                                    </button>
                                    <div>
                                        <h2 className="text-sm font-bold text-[var(--text-primary)]">
                                            {view === 'LIST' ? "Ribbon Pool" : "Create Ribbon"}
                                        </h2>
                                        <p className="text-[11px] text-[var(--text-muted)] font-medium mt-0.5">
                                            {view === 'LIST' ? "Select or search ribbons" : "Add priority label"}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={onClose} 
                                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors rounded-lg cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {view === 'LIST' ? (
                                <div className="space-y-3">
                                    {/* Search Pool */}
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="Find labels..."
                                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent-color)] transition-all font-medium"
                                            style={{ borderStyle: 'var(--border-style)' }}
                                        />
                                        <TagIcon size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                                    </div>

                                    {/* Scrollable Label Pool */}
                                    <div className="h-[220px] overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                                        {filteredTags.length > 0 ? filteredTags.map((tag, idx) => {
                                            const [name, colorName] = tag.includes(':') ? tag.split(':') : [tag, 'success'];
                                            const color = COLORS.find(c => c.name.toLowerCase() === colorName.toLowerCase()) || COLORS[2];

                                            const isActive = activeTags.some(t => {
                                                const tName = t.includes(':') ? t.split(':')[0].toLowerCase() : t.toLowerCase();
                                                return tName === name.toLowerCase();
                                            });

                                            return (
                                                <motion.div
                                                    key={tag}
                                                    initial={{ opacity: 0, x: -4 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: idx * 0.015 }}
                                                    className={cn(
                                                        "group relative flex items-center w-full rounded-xl p-2.5 transition-all overflow-hidden cursor-pointer border",
                                                        isActive 
                                                            ? "bg-[var(--bg-tertiary)] border-[var(--accent-color)] shadow-sm"
                                                            : "bg-[var(--bg-tertiary)]/50 hover:bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                                                    )}
                                                    onClick={() => handleApplyExisting(tag)}
                                                >
                                                    {/* Mini Ribbon Indicator */}
                                                    <div className={cn("w-1.5 h-6 rounded-full bg-gradient-to-b mr-3 transition-transform group-hover:scale-105 shadow-sm", color.gradient)} />

                                                    <div className="text-left flex-1 min-w-0">
                                                        <div className="text-xs font-semibold text-[var(--text-primary)] truncate">{name}</div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5">
                                                        {/* Checkmark - Only show if this tag is active */}
                                                        {isActive && (
                                                            <Check size={14} className={cn(
                                                                "transition-all duration-200",
                                                                color.text
                                                            )} />
                                                        )}

                                                        {/* Delete Button - Show on hover */}
                                                        {onDelete && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onDelete(tag);
                                                                }}
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 rounded-md cursor-pointer"
                                                                title="Delete from pool"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            );
                                        }) : (
                                            <div className="py-8 text-center space-y-2">
                                                <div className="text-[var(--text-muted)] font-medium text-xs">
                                                    {searchTerm ? "No matching ribbons" : "No custom ribbons yet"}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => { setTagName(searchTerm); setView('ADD'); }}
                                                    className="text-[var(--accent-color)] font-semibold text-xs hover:underline cursor-pointer"
                                                >
                                                    {searchTerm ? `Create "${searchTerm}"?` : "Create your first label"}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Create New Trigger */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (uniqueTags.length >= 30) {
                                                alert("Ribbon pool is full (Max 30). Delete some to add new ones.");
                                                return;
                                            }
                                            setView('ADD');
                                        }}
                                        className={cn(
                                            "w-full py-2.5 rounded-xl border border-[var(--border-color)] font-semibold text-xs transition-all flex items-center justify-center gap-2 group mt-2 cursor-pointer",
                                            uniqueTags.length >= 30 
                                                ? "bg-[var(--bg-tertiary)]/30 text-[var(--text-muted)] cursor-not-allowed opacity-50" 
                                                : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)]"
                                        )}
                                    >
                                        <div className="w-5 h-5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                                            {uniqueTags.length >= 30 ? <X size={12} /> : <Plus size={12} strokeWidth={2.5} />}
                                        </div>
                                        <span>{uniqueTags.length >= 30 ? "Pool Full (30/30)" : "Add New Ribbon"}</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    {/* Input Field */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Ribbon Name</label>
                                        <div className="relative group">
                                            <input
                                                autoFocus
                                                type="text"
                                                value={tagName}
                                                onChange={(e) => setTagName(e.target.value)}
                                                placeholder="Label name (max 20)..."
                                                maxLength={20}
                                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent-color)] transition-all font-medium"
                                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                            />
                                            <TagIcon size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                                        </div>
                                    </div>

                                    {/* Color Swatches */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Ribbon Color</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {COLORS.map((color) => {
                                                const isSelected = selectedColor.name === color.name;
                                                return (
                                                    <button
                                                        type="button"
                                                        key={color.name}
                                                        onClick={() => setSelectedColor(color)}
                                                        title={color.label}
                                                        className={cn(
                                                            "h-11 rounded-xl transition-all relative flex flex-col items-center justify-center border cursor-pointer",
                                                            "bg-gradient-to-br",
                                                            color.gradient,
                                                            isSelected ? cn("ring-2 ring-white/70 shadow-lg scale-100", color.shadow) : "opacity-60 hover:opacity-100 scale-95"
                                                        )}
                                                    >
                                                        {isSelected && (
                                                            <Check size={14} strokeWidth={3} className="text-white drop-shadow" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="grid grid-cols-2 gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => uniqueTags.length > 0 ? setView('LIST') : onClose()}
                                            className="py-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)] font-semibold text-xs hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-all cursor-pointer"
                                        >
                                            {uniqueTags.length > 0 ? "Back" : "Cancel"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            disabled={!tagName.trim()}
                                            className={cn(
                                                "py-2.5 rounded-xl font-semibold text-xs transition-all cursor-pointer",
                                                !tagName.trim() 
                                                    ? "bg-[var(--bg-tertiary)]/50 text-[var(--text-muted)] cursor-not-allowed opacity-50" 
                                                    : "bg-[var(--accent-color)] text-white hover:opacity-90 shadow-md"
                                            )}
                                            style={{ color: tagName.trim() ? 'var(--accent-contrast, #ffffff)' : undefined }}
                                        >
                                            Create
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

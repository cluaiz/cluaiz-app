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
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200]"
                    />

                    {/* Premium Glass Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20, x: '-50%' }}
                        animate={{ opacity: 1, scale: 1, y: '-50%', x: '-50%' }}
                        exit={{ opacity: 0, scale: 0.95, y: -20, x: '-50%' }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[320px] bg-zinc-950/95 border border-white/10 rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] z-[210] overflow-hidden"
                    >
                        {/* Top Accent Line */}
                        <div className={cn("h-[1.5px] w-full bg-gradient-to-r transition-all duration-500", view === 'ADD' ? selectedColor.gradient : "from-zinc-800 to-zinc-700")} />

                        <div className="p-4 pb-5 space-y-4">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <button
                                        onClick={() => view === 'ADD' && uniqueTags.length > 0 && setView('LIST')}
                                        className={cn("w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center transition-all duration-500",
                                            view === 'ADD' ? selectedColor.text : "text-zinc-400 font-bold"
                                        )}
                                    >
                                        {view === 'ADD' ? <Sparkles size={16} /> : <span className="text-xs">{uniqueTags.length}</span>}
                                    </button>
                                    <div>
                                        <h2 className="text-sm font-black text-white tracking-tight">
                                            {view === 'LIST' ? "Ribbon Pool" : "Create Ribbon"}
                                        </h2>
                                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.15em] leading-none mt-0.5">
                                            {view === 'LIST' ? "Select or Search" : "Add priority label"}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-white transition-colors bg-white/5 rounded-lg">
                                    <X size={14} />
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
                                            className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-700 outline-none focus:ring-1 focus:ring-white/10 transition-all font-bold"
                                        />
                                        <TagIcon size={10} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-white/40 transition-colors" />
                                    </div>

                                    {/* Scrollable Label Pool */}
                                    <div className="h-[220px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
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
                                                    initial={{ opacity: 0, x: -5 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: idx * 0.02 }}
                                                    className="group relative flex items-center w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-xl p-2.5 transition-all overflow-hidden cursor-pointer"
                                                    onClick={() => handleApplyExisting(tag)}
                                                >
                                                    {/* Mini Ribbon Indicator */}
                                                    <div className={cn("w-1 h-6 rounded-full bg-gradient-to-b mr-3 transition-transform group-hover:scale-110 shadow-lg", color.gradient)} />

                                                    <div className="text-left flex-1 min-w-0">
                                                        <div className="text-[11px] font-black text-white uppercase tracking-wider leading-none truncate">{name}</div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {/* Checkmark - Only show if this tag is active */}
                                                        {isActive && (
                                                            <Check size={12} className={cn(
                                                                "transition-all duration-300 opacity-100 scale-100",
                                                                color.text
                                                            )} />
                                                        )}

                                                        {/* Delete Button - Show on hover */}
                                                        {onDelete && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onDelete(tag);
                                                                }}
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/20 rounded-md"
                                                                title="Delete from pool"
                                                            >
                                                                    <X size={10} className="text-red-400" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            );
                                        }) : (
                                            <div className="py-8 text-center space-y-2">
                                                <div className="text-zinc-600 font-bold text-[10px] uppercase tracking-widest">No matching ribbons</div>
                                                <button onClick={() => { setTagName(searchTerm); setView('ADD'); }} className="text-[var(--accent-color)] font-black text-[9px] uppercase tracking-widest hover:underline">
                                                    Create "{searchTerm || 'new'}"?
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Create New Trigger */}
                                    <button
                                        onClick={() => {
                                            if (uniqueTags.length >= 30) {
                                                alert("Ribbon pool is full (Max 30). Delete some to add new ones.");
                                                return;
                                            }
                                            setView('ADD');
                                        }}
                                        className={cn(
                                            "w-full py-2 rounded-xl border border-white/5 font-black text-[9px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 group mt-2",
                                            uniqueTags.length >= 30 ? "bg-zinc-950 text-zinc-700 cursor-not-allowed" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                        )}
                                    >
                                        <div className="w-5 h-5 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors text-zinc-300">
                                            {uniqueTags.length >= 30 ? <X size={12} /> : <Plus size={12} strokeWidth={3} />}
                                        </div>
                                        <span>{uniqueTags.length >= 30 ? "Pool Full (30/30)" : "Add New Ribbon"}</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* Input Field */}
                                    <div className="space-y-2">
                                        <div className="relative group">
                                            <input
                                                autoFocus
                                                type="text"
                                                value={tagName}
                                                onChange={(e) => setTagName(e.target.value)}
                                                placeholder="Label name (max 20)..."
                                                maxLength={20}
                                                className="w-full bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-3 text-xs text-white placeholder:text-zinc-700 outline-none focus:ring-1 focus:ring-white/10 transition-all font-bold"
                                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                            />
                                            <TagIcon size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-white/40 transition-colors" />
                                        </div>
                                    </div>

                                    {/* Color Swatches */}
                                    <div className="space-y-2">
                                        <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest ml-1">Ribbon Theme</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {COLORS.map((color) => {
                                                const isSelected = selectedColor.name === color.name;
                                                return (
                                                    <button
                                                        key={color.name}
                                                        onClick={() => setSelectedColor(color)}
                                                        title={color.label}
                                                        className={cn(
                                                            "aspect-square rounded-xl transition-all duration-300 relative flex flex-col items-center justify-center pb-0 border border-transparent",
                                                            "bg-gradient-to-br",
                                                            color.gradient,
                                                            isSelected ? cn("shadow-2xl ring-2 ring-white/50", color.shadow) : "opacity-40 hover:opacity-100"
                                                        )}
                                                        style={{ height: '54px' }}
                                                    >
                                                        {isSelected && (
                                                            <motion.div layoutId="badge-check-modal" className="text-white drop-shadow-md">
                                                                <Check size={14} strokeWidth={4} />
                                                            </motion.div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="grid grid-cols-2 gap-2 pt-2">
                                        <button
                                            onClick={() => uniqueTags.length > 0 ? setView('LIST') : onClose()}
                                            className="py-3 rounded-xl bg-zinc-900 text-zinc-500 font-black text-[9px] uppercase tracking-widest hover:bg-zinc-800 transition-all"
                                        >
                                            {uniqueTags.length > 0 ? "Back" : "Cancel"}
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={!tagName.trim()}
                                            className={cn(
                                                "py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all duration-500",
                                                !tagName.trim() ? "bg-zinc-800 text-zinc-600" : cn("bg-gradient-to-r text-white shadow-xl", selectedColor.gradient)
                                            )}
                                        >
                                            Create
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
